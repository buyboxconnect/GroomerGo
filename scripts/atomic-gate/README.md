# Live Base44 compare-and-update gate

This diagnostic tests an existing record in the separate `AtomicSyncProbe`
entity. It uses no services, clients, pets, appointments, business memberships,
or legacy workspace snapshots. Synthetic business IDs are not real businesses.
All direct CRUD rules on the probe entity are false. The temporary handler checks
`auth.me()` and requires an app administrator; every mutation and cleanup is
scoped to that authenticated user's synthetic run ID.

## Predicate under test

One `updateMany` call matches the entity ID, businessId, recordUUID, ownerUserId,
runId, disposable=true, deleted=false, and expected revision. It atomically
requests `$set` of the winner/payload/deletion marker together with `$inc` of
revision. The handler performs no read before that update and has no mutex or
unconditional-update fallback. It reports 200 for updated=1 and 409 for updated=0.
Any unexpected counts or `has_more` result fail the gate.

The backend pins `@base44/sdk@0.8.53`. The official API documents filtered updates,
MongoDB update operators, and updated/has_more response fields:
https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities#updatemany

This is empirical verification against the current live app, not a published
platform guarantee or a proof of transactions across multiple entities.

## Cases

- A baseline write increments revision once; a stale write changes nothing.
- Ten rounds of eight competing requests using one expected revision each:
  exactly one application, seven explicit conflicts, one revision increment,
  and a stored payload matching the successful writer.
- Wrong business, record UUID, run ID, and entity ID predicates match no record.
  Base44's internal entity ID uses its own format; this is separate from the
  application's stable UUID. A malformed internal ID returns HTTP 400 upstream.
- Eight competing edits/deletes produce one coherent winner.
- A stored tombstone blocks eight writers even when they know its current
  revision; the deleted state and revision remain unchanged.
- Scoped cleanup deletes all records from that run and reads back zero remaining.

Earlier rapid runs reached HTTP 429 on the update endpoint. These failures are
preserved as evidence. The final harness begins with a 65-second cooldown and
spaces eight-writer batches by 12 seconds. Requests within each batch remain
concurrent. These intervals are a test precaution, not a claimed platform quota.

## Reproduce

1. Run `npm test` and `npx --no-install base44 whoami` in the linked repository.
2. Verify the deployed AtomicSyncProbe schema denies direct CRUD. Provision only
   this schema if absent; do not push/prune the entire app's schema collection.
3. Temporarily set the probe's function.jsonc entry to `active.ts` and deploy only
   `npx --no-install base44 functions deploy atomic-sync-probe`. Restore the local
   config to `index.ts` immediately afterward. Never commit an enabled entry.
4. Run `npx --no-install base44 exec < scripts/atomic-gate/run-probe.js` and save
   its sanitized output. Execution takes several minutes, including cooldown.
   `GROOMERGO_GATE_SCOPE_ONLY=1` runs the scope/tombstone cases alone when edit races
   have already passed; it is not evidence for the ten edit rounds by itself.
5. Confirm the final report has passed=true and cleanup.remaining=0. The CLI's
   zero exit code alone is not a pass: the harness catches failures to ensure
   cleanup. `extract-report.mjs` produces JSON and exits nonzero for a failed gate.
6. Deploy the restored disabled entry with the same targeted function command,
   then run `base44 exec` through npx with `verify-disabled.js` as stdin. Require
   HTTP 410 / PROBE_DISABLED. The empty locked test schema is retained for repeats.
   The verification script also confirms the retired upload endpoint remains
   paused and the read-only connection endpoint still works.

If interrupted before cleanup, use the emitted runId with the temporary handler's
cleanup action as the same admin, then disable the function. Never delete rows
without the disposable, runId, and ownerUserId predicate.

## Boundary

A successful gate establishes the observed single-record compare-and-update
behavior only. Before production uploads, creation must enforce UUID uniqueness,
retry acknowledgments must be durable with the write, relationships and membership
revocation must remain safe, and the iOS outbox/conflict/relaunch tests must pass.
HTTP 429 and ambiguous network failures require bounded backoff and idempotent
retries; they must never be converted into revision conflicts or successful sync.
