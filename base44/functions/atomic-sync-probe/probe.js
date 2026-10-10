// Temporary admin-only diagnostic. Never reads or writes production entities.
const headers = { 'Cache-Control': 'no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const reject = status => { throw { status, local: true }; };
const validUUID = value => typeof value === 'string' && uuid.test(value);
const version = 'cas-probe-v1-sdk-0.8.53';

export async function handleProbe(request, client) {
  if (request.method !== 'POST') return Response.json({ code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers });
  let stage = 'auth';
  try {
    let user;
    try { user = await client.auth.me(); }
    catch (error) { if ([401, 403].includes(error?.status)) reject(401); throw error; }
    if (!user?.id) reject(401);
    if (user.role !== 'admin') reject(403);
    const text = await request.text();
    if (text.length > 2000) reject(400);
    let input;
    try { input = JSON.parse(text); } catch { reject(400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || !validUUID(input.runId)) reject(400);
    const allowed = {
      prepare: ['action', 'runId'], cleanup: ['action', 'runId'],
      read: ['action', 'runId', 'id'],
      cas: ['action', 'runId', 'id', 'businessId', 'recordUUID', 'expectedRevision', 'writerId', 'delete'],
    }[input.action];
    if (!allowed || Object.keys(input).some(k => !allowed.includes(k))) reject(400);
    const entity = client.asServiceRole.entities.AtomicSyncProbe;
    const scope = { disposable: true, ownerUserId: user.id, runId: input.runId };
    if (input.action === 'prepare') {
      stage = 'prepare';
      const row = await entity.create({ ...scope, businessId: crypto.randomUUID(), recordUUID: crypto.randomUUID(), revision: 1, writerId: crypto.randomUUID(), payload: 'disposable-probe-seed', deleted: false });
      return Response.json({ version, id: row.id, businessId: row.businessId, recordUUID: row.recordUUID, revision: row.revision }, { headers });
    }
    if (input.action === 'cleanup') {
      stage = 'cleanup';
      const result = await entity.deleteMany(scope);
      const remaining = await entity.filter(scope, undefined, 1);
      return Response.json({ version, deleted: result.deleted, remaining: remaining.length }, { headers });
    }
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) reject(400);
    if (input.action === 'read') {
      stage = 'read';
      const rows = await entity.filter({ ...scope, id: input.id }, undefined, 2);
      if (rows.length !== 1) reject(404);
      const row = rows[0];
      return Response.json({ version, revision: row.revision, writerId: row.writerId, payload: row.payload, deleted: row.deleted }, { headers });
    }
    if (![input.businessId, input.recordUUID, input.writerId].every(validUUID) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || input.expectedRevision >= Number.MAX_SAFE_INTEGER || typeof input.delete !== 'boolean') reject(400);
    // One database mutation, with revision and scope in the predicate. There is
    // no pre-read, application mutex, or unconditional update fallback.
    stage = 'cas';
    const result = await entity.updateMany(
      { ...scope, id: input.id, businessId: input.businessId, recordUUID: input.recordUUID, revision: input.expectedRevision, deleted: false },
      { $set: { writerId: input.writerId, payload: input.delete ? 'disposable-tombstone' : input.writerId, deleted: input.delete }, $inc: { revision: 1 } },
    );
    if (result.success !== true || ![0, 1].includes(result.updated) || result.has_more !== false) reject(502);
    return Response.json({ version, updated: result.updated, code: result.updated === 1 ? 'APPLIED' : 'REVISION_CONFLICT' }, { status: result.updated === 1 ? 200 : 409, headers });
  } catch (error) {
    // Never return or log an SDK error object; it can include bearer tokens.
    if (error?.local) return Response.json({ code: 'PROBE_REQUEST_FAILED' }, { status: error.status, headers });
    const rawStatus = error?.response?.status ?? error?.status;
    const upstreamStatus = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : null;
    return Response.json({ code: 'PROBE_UPSTREAM_FAILED', stage, upstreamStatus }, { status: upstreamStatus === 429 ? 429 : 503, headers });
  }
}
