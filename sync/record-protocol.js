// Pure transition rules. The storage adapter MUST execute this transition and
// persist its result in one transaction with a unique businessId/recordUUID key.
// This module is deliberately not wired to a deployed Base44 function yet.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const types = new Set(['service', 'client', 'pet', 'appointment']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const assertJSON = (value, depth = 0) => {
  if (depth > 32) fail('INVALID_DATA');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { for (const item of value) assertJSON(item, depth + 1); return; }
  if (isObject(value) && Object.getPrototypeOf(value) === Object.prototype) {
    for (const item of Object.values(value)) assertJSON(item, depth + 1);
    return;
  }
  fail('INVALID_DATA');
};
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
};

export function validateMutation(input) {
  if (!isObject(input)) fail('INVALID_MUTATION');
  const fields = ['businessId', 'recordUUID', 'recordType', 'operationId', 'baseRevision', 'action', 'data'];
  if (Object.keys(input).some(k => !fields.includes(k))) fail('INVALID_MUTATION');
  for (const field of ['businessId', 'recordUUID', 'operationId']) {
    if (typeof input[field] !== 'string' || !uuid.test(input[field])) fail('INVALID_UUID');
  }
  if (!types.has(input.recordType)) fail('INVALID_RECORD_TYPE');
  if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0 || input.baseRevision >= Number.MAX_SAFE_INTEGER) fail('INVALID_REVISION');
  if (!['put', 'delete'].includes(input.action)) fail('INVALID_ACTION');
  if (input.action === 'delete' ? input.data !== null : !isObject(input.data)) fail('INVALID_DATA');
  assertJSON(input);
  // Transport supplies parsed JSON; reject non-JSON values for direct callers too.
  let serialized;
  try { serialized = JSON.stringify(input); } catch { fail('INVALID_DATA'); }
  if (new TextEncoder().encode(serialized).length > 65536) fail('RECORD_TOO_LARGE');
  return structuredClone(input);
}

// authorizedBusinessId comes from a fresh server membership check, not a client
// profile. current and receipt must be loaded inside the same storage transaction.
// Receipts are keyed by (businessId, operationId) and retained for safe retries.
export function transition({ authorizedBusinessId, mutation, current = null, receipt = null, serverTime }) {
  const m = validateMutation(mutation);
  if (m.businessId !== authorizedBusinessId) fail('BUSINESS_ACCESS_DENIED');
  const fingerprint = JSON.stringify(canonical(m));
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) fail('OPERATION_ID_REUSED');
    return { replay: true, record: structuredClone(receipt.record), receipt: structuredClone(receipt) };
  }
  if (current && (current.businessId !== m.businessId || current.recordUUID !== m.recordUUID)) fail('STORAGE_SCOPE_MISMATCH');
  if (current && current.recordType !== m.recordType) fail('RECORD_TYPE_MISMATCH');
  if (current && (!Number.isSafeInteger(current.revision) || current.revision < 1)) fail('INVALID_STORED_REVISION');
  if ((current?.revision ?? 0) !== m.baseRevision) {
    return { conflict: true, current: structuredClone(current) };
  }
  // Tombstones are terminal. A replacement record requires a new UUID so an
  // offline device can never accidentally resurrect an explicitly deleted item.
  if (current?.deletedAt) fail('RECORD_DELETED');
  if (!current && m.action === 'delete') fail('RECORD_NOT_FOUND');
  if (typeof serverTime !== 'string' || !Number.isFinite(Date.parse(serverTime))) fail('INVALID_SERVER_TIME');
  const record = {
    businessId: m.businessId, recordUUID: m.recordUUID, recordType: m.recordType,
    revision: m.baseRevision + 1, data: m.action === 'delete' ? null : m.data,
    deletedAt: m.action === 'delete' ? serverTime : null, updatedAt: serverTime,
  };
  return { replay: false, record, receipt: { fingerprint, record: structuredClone(record) } };
}
