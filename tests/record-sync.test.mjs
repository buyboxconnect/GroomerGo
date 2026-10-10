import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { transition } from '../sync/record-protocol.js';

const businessId = randomUUID(), otherBusiness = randomUUID(), recordUUID = randomUUID();
const time = '2026-10-10T12:00:00.000Z';
const mutation = overrides => ({ businessId, recordUUID, recordType: 'service', operationId: randomUUID(), baseRevision: 0, action: 'put', data: { name: 'Disposable bath' }, ...overrides });
// Disposable transaction simulator only; this is NOT a Base44 adapter. A single
// synchronous transition models a storage transaction's serialization boundary.
class Store {
  records = new Map(); receipts = new Map();
  async write(m, authorizedBusinessId = businessId) {
    const key = `${authorizedBusinessId}/${m.recordUUID}`;
    const operation = `${authorizedBusinessId}/${m.operationId}`;
    const result = transition({ authorizedBusinessId, mutation: m, current: this.records.get(key), receipt: this.receipts.get(operation), serverTime: time });
    if (!result.conflict && !result.replay) {
      this.records.set(key, structuredClone(result.record));
      this.receipts.set(operation, structuredClone(result.receipt));
    }
    return result;
  }
}
test('two simulated devices: concurrent create and stale edit never silently win', async () => {
  const s = new Store();
  const creates = await Promise.all([s.write(mutation()), s.write(mutation({ data: { name: 'Device B' } }))]);
  assert.equal(creates.filter(r => r.conflict).length, 1);
  const edits = await Promise.all([s.write(mutation({ baseRevision: 1 })), s.write(mutation({ baseRevision: 1, data: { name: 'Stale B' } }))]);
  assert.equal(edits.filter(r => r.conflict).length, 1);
  assert.equal(edits.find(r => r.conflict).current.revision, 2);
  assert.equal(s.records.size, 1);
});
test('lost acknowledgment retry returns original result even after a later edit', async () => {
  const s = new Store(), original = mutation();
  await s.write(original);
  await s.write(mutation({ baseRevision: 1, data: { name: 'Later edit' } }));
  const retry = await s.write(original);
  assert.equal(retry.replay, true); assert.equal(retry.record.revision, 1);
  assert.equal([...s.records.values()][0].revision, 2);
  await assert.rejects(s.write({ ...original, data: { name: 'Different request' } }), { code: 'OPERATION_ID_REUSED' });
});
test('deletion survives an offline stale edit and cannot be resurrected', async () => {
  const s = new Store(); await s.write(mutation());
  const deletion = mutation({ baseRevision: 1, action: 'delete', data: null });
  const deleted = await s.write(deletion);
  assert.equal(deleted.record.deletedAt, time); assert.equal(deleted.record.data, null);
  assert.equal((await s.write(mutation({ baseRevision: 1 }))).conflict, true);
  await assert.rejects(s.write(mutation({ baseRevision: 2 })), { code: 'RECORD_DELETED' });
  assert.equal((await s.write(deletion)).replay, true);
});
test('business mismatch, type change, forged revision, and forged server fields fail', async () => {
  const s = new Store(); await s.write(mutation());
  for (const [input, code] of [
    [mutation({ businessId: otherBusiness }), 'BUSINESS_ACCESS_DENIED'],
    [mutation({ recordType: 'client', baseRevision: 1 }), 'RECORD_TYPE_MISMATCH'],
    [mutation({ baseRevision: -1 }), 'INVALID_REVISION'],
    [mutation({ updatedAt: time }), 'INVALID_MUTATION'],
    [mutation({ data: { price: NaN } }), 'INVALID_DATA'],
    [mutation({ data: { name: undefined } }), 'INVALID_DATA'],
    [mutation({ data: { name: 'x'.repeat(65536) } }), 'RECORD_TOO_LARGE'],
  ]) await assert.rejects(s.write(input), { code });
  assert.equal([...s.records.values()][0].revision, 1);
});
test('same UUID in two businesses stays isolated and payload key order does not break retries', async () => {
  const s = new Store(), first = mutation({ data: { name: 'A', duration: 30 } });
  await s.write(first);
  await s.write(mutation({ businessId: otherBusiness }), otherBusiness);
  assert.equal(s.records.size, 2);
  assert.equal((await s.write({ ...first, data: { duration: 30, name: 'A' } })).replay, true);
});
