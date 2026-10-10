import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { handleProbe } from '../base44/functions/atomic-sync-probe/probe.js';

const runId = randomUUID();
const request = body => new Request('https://probe.invalid', { method: 'POST', body: JSON.stringify(body) });
test('probe rejects unauthenticated and non-admin callers before service access', async () => {
  for (const [user, status] of [[null, 401], [{id: 'member', role: 'user'}, 403]]) {
    const client = { auth: { me: async () => user }, get asServiceRole() { throw Error('must not access'); } };
    assert.equal((await handleProbe(request({action: 'prepare', runId}), client)).status, status);
  }
});
test('probe executes one scoped conditional update and maps zero matches to conflict', async () => {
  const input = { action: 'cas', runId, id: 'row-1', businessId: randomUUID(), recordUUID: randomUUID(), expectedRevision: 3, writerId: randomUUID(), delete: false };
  for (const updated of [0, 1]) {
    let calls = 0;
    const client = { auth: {me: async () => ({id: 'admin-id', role: 'admin'})}, asServiceRole: {entities: {AtomicSyncProbe: {
      async updateMany(query, data) {
        calls++;
        assert.deepEqual(query, {disposable: true, ownerUserId: 'admin-id', runId, id: input.id, businessId: input.businessId, recordUUID: input.recordUUID, revision: 3, deleted: false});
        assert.deepEqual(data, {$set: {writerId: input.writerId, payload: input.writerId, deleted: false}, $inc: {revision: 1}});
        return {success: true, updated, has_more: false};
      },
      get() { throw Error('pre-read forbidden'); }, filter() { throw Error('pre-read forbidden'); }, update() { throw Error('unconditional update forbidden'); },
    }}}};
    const response = await handleProbe(request(input), client);
    assert.equal(calls, 1); assert.equal(response.status, updated ? 200 : 409);
    assert.equal((await response.json()).updated, updated);
  }
});
test('cleanup is scoped to the caller run and SDK errors never escape', async () => {
  let query;
  const client = {auth: {me: async () => ({id: 'admin-id', role: 'admin'})}, asServiceRole: {entities: {AtomicSyncProbe: {
    async deleteMany(q) {query = q; return {success: true, deleted: 2};},
    async filter(q) {assert.deepEqual(q, query); return [];},
  }}}};
  assert.equal((await handleProbe(request({action: 'cleanup', runId}), client)).status, 200);
  assert.deepEqual(query, {disposable: true, ownerUserId: 'admin-id', runId});
  client.asServiceRole.entities.AtomicSyncProbe.deleteMany = async () => {throw Error('bearer secret diagnostic');};
  const response = await handleProbe(request({action: 'cleanup', runId}), client);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('secret'));
});
test('probe rejects forged owner and its committed entry remains disabled', async () => {
  const client = {auth: {me: async () => ({id: 'admin-id', role: 'admin'})}, get asServiceRole() {throw Error('must not access');}};
  assert.equal((await handleProbe(request({action: 'prepare', runId, ownerUserId: 'someone'}), client)).status, 400);
  const entry = readFileSync(new URL('../base44/functions/atomic-sync-probe/index.ts', import.meta.url), 'utf8');
  assert.ok(entry.includes('PROBE_DISABLED')); assert.ok(!entry.includes('createClientFromRequest'));
  const schema = JSON.parse(readFileSync(new URL('../base44/entities/AtomicSyncProbe.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(schema.rls, {create: false, read: false, update: false, delete: false});
});
test('unexpected update counts fail closed and throttling remains an upstream failure', async () => {
  const input = {action: 'cas', runId, id: 'row-1', businessId: randomUUID(), recordUUID: randomUUID(), expectedRevision: 1, writerId: randomUUID(), delete: false};
  const client = {auth: {me: async () => ({id: 'admin-id', role: 'admin'})}, asServiceRole: {entities: {AtomicSyncProbe: {}}}};
  for (const result of [{success: true, updated: 2, has_more: false}, {success: true, updated: 1, has_more: true}, {success: false, updated: 0, has_more: false}]) {
    client.asServiceRole.entities.AtomicSyncProbe.updateMany = async () => result;
    assert.equal((await handleProbe(request(input), client)).status, 502);
  }
  client.asServiceRole.entities.AtomicSyncProbe.updateMany = async () => {throw {status: 429, config: {headers: {Authorization: 'bearer-secret'}}};};
  const response = await handleProbe(request(input), client);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {code: 'PROBE_UPSTREAM_FAILED', stage: 'cas', upstreamStatus: 429});
});
