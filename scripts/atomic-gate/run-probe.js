// Run through `npx --no-install base44 exec < scripts/atomic-gate/run-probe.js`.
// Only synthetic IDs and payloads are used. Never print caught SDK error objects.
const runId = crypto.randomUUID();
const pacingMs = 12000;
const initialCooldownMs = 65000;
const scopeOnly = Deno.env.get('GROOMERGO_GATE_SCOPE_ONLY') === '1';
const pause = () => new Promise(resolve => setTimeout(resolve, pacingMs));
const report = { gate: 'base44-existing-record-cas', scopeOnly, runId, sdkVersion: '0.8.53', pacingMs, initialCooldownMs, startedAt: new Date().toISOString(), rounds: [], checks: [], failures: [], cleanup: null };
const assert = (value, label) => { if (!value) throw new Error(label); };
async function call(body) {
  try {
    const response = await base44.functions.invoke('atomic-sync-probe', {runId, ...body});
    return {status: response.status || 200, data: response.data};
  } catch (error) {
    const data = error?.data || error?.response?.data;
    return {status: error?.status || error?.response?.status || 0, data: {code: data?.code, updated: data?.updated, stage: data?.stage, upstreamStatus: data?.upstreamStatus}};
  }
}
async function prepare() {
  const r = await call({action: 'prepare'});
  assert(r.status === 200 && r.data?.version === 'cas-probe-v1-sdk-0.8.53' && r.data.revision === 1, 'PREPARE_FAILED');
  return r.data;
}
async function read(seed) {
  const r = await call({action: 'read', id: seed.id});
  assert(r.status === 200, 'READ_FAILED'); return r.data;
}
const cas = (seed, expectedRevision, writerId, deleted = false, overrides = {}) => call({action: 'cas', id: seed.id, businessId: seed.businessId, recordUUID: seed.recordUUID, expectedRevision, writerId, delete: deleted, ...overrides});
const conflict = r => r.status === 409 && r.data?.code === 'REVISION_CONFLICT' && r.data.updated === 0;
async function race(seed, expectedRevision, deleteFlags, label) {
  const writers = deleteFlags.map(deleted => ({writerId: crypto.randomUUID(), deleted}));
  const dispatchStart = Date.now();
  const requests = writers.map(async w => ({...w, result: await cas(seed, expectedRevision, w.writerId, w.deleted)}));
  const dispatchSpanMs = Date.now() - dispatchStart;
  const responses = await Promise.all(requests);
  const applied = responses.filter(r => r.result.status === 200 && r.result.data?.updated === 1);
  const conflicts = responses.filter(r => conflict(r.result));
  const stored = await read(seed);
  const passed = applied.length === 1 && conflicts.length === writers.length - 1 && stored.revision === expectedRevision + 1 && stored.writerId === applied[0].writerId && stored.deleted === applied[0].deleted && stored.payload === (stored.deleted ? 'disposable-tombstone' : stored.writerId);
  const result = {label, writers: writers.length, dispatchSpanMs, elapsedMs: Date.now() - dispatchStart, applied: applied.length, conflicts: conflicts.length, statuses: responses.map(r => r.result.status), upstreamFailures: responses.filter(r => ![200,409].includes(r.result.status)).map(r => ({status:r.result.status, ...r.result.data})), expectedRevision, storedRevision: stored.revision, payloadMatchesWinner: applied.length === 1 && stored.writerId === applied[0].writerId, passed};
  report.rounds.push(result);
  console.log(JSON.stringify({type: 'round', ...result}));
  assert(passed, 'CONCURRENT_CAS_FAILED');
  return {stored, winner: applied[0]};
}
try {
  console.log(JSON.stringify({type: 'start', runId, gate: report.gate}));
  // Let a prior failed burst's update endpoint limit expire before starting.
  await new Promise(resolve => setTimeout(resolve, initialCooldownMs));
  const seed = await prepare();
  const baselineWriter = crypto.randomUUID();
  assert((await cas(seed, 1, baselineWriter)).status === 200, 'BASELINE_WRITE_FAILED');
  const baseline = await read(seed);
  assert(baseline.revision === 2 && baseline.writerId === baselineWriter && baseline.payload === baselineWriter, 'BASELINE_READBACK_FAILED');
  assert(conflict(await cas(seed, 1, crypto.randomUUID())), 'STALE_REVISION_ACCEPTED');
  report.checks.push({name: 'baseline-and-stale-revision', passed: true});
  for (let round = 0; round < (scopeOnly ? 0 : 10); round++) {
    await race(seed, round + 2, Array(8).fill(false), `edit-${round + 1}`);
    await pause();
  }
  const final = await read(seed);
  // Base44's internal entity id is an ObjectId, separate from our record UUID.
  // A UUID-shaped id is rejected as malformed (HTTP 400), not an empty match.
  assert(/^[0-9a-f]{24}$/.test(seed.id), 'UNEXPECTED_ENTITY_ID_FORMAT');
  const nonexistentId = crypto.randomUUID().replaceAll('-', '').slice(0, 24);
  for (const overrides of [{businessId: crypto.randomUUID()}, {recordUUID: crypto.randomUUID()}, {runId: crypto.randomUUID()}, {id: nonexistentId}]) {
    const response = await cas(seed, final.revision, crypto.randomUUID(), false, overrides);
    const after = await read(seed);
    const check = {name: `wrong-${Object.keys(overrides)[0]}-predicate`, status: response.status, response: response.data, storedRevision: after.revision, expectedRevision: final.revision, passed: conflict(response) && after.revision === final.revision};
    report.checks.push(check); console.log(JSON.stringify({type:'check', ...check}));
    assert(check.passed, 'WRONG_SCOPE_CHECK_FAILED');
  }
  assert((await read(seed)).revision === final.revision, 'WRONG_SCOPE_CHANGED_RECORD');
  report.checks.push({name: 'business-record-run-id-predicates', passed: true});
  const tombstone = await prepare();
  let {stored} = await race(tombstone, 1, [false, true, false, true, false, true, false, true], 'edit-delete-race');
  if (!stored.deleted) {
    assert((await cas(tombstone, stored.revision, crypto.randomUUID(), true)).status === 200, 'DELETE_FAILED');
    stored = await read(tombstone);
  }
  assert(stored.deleted && stored.payload === 'disposable-tombstone', 'TOMBSTONE_NOT_STORED');
  await pause();
  const resurrection = await Promise.all(Array.from({length: 8}, () => cas(tombstone, stored.revision, crypto.randomUUID())));
  assert(resurrection.every(conflict), 'TOMBSTONE_RESURRECTED');
  const after = await read(tombstone);
  assert(after.deleted && after.revision === stored.revision && after.writerId === stored.writerId, 'TOMBSTONE_CHANGED');
  report.checks.push({name: 'tombstone-blocks-eight-current-revision-writers', passed: true});
  report.passed = true;
} catch (error) {
  // All throwing messages in this script are fixed assertion labels, no raw SDK diagnostics.
  report.failures.push(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'UNEXPECTED_HARNESS_FAILURE');
  report.passed = false;
} finally {
  const cleanup = await call({action: 'cleanup'});
  report.cleanup = {status: cleanup.status, deleted: cleanup.data?.deleted, remaining: cleanup.data?.remaining};
  if (cleanup.status !== 200 || cleanup.data?.remaining !== 0) {report.passed = false; report.failures.push('CLEANUP_UNVERIFIED');}
  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify({type: 'report', ...report}));
}
