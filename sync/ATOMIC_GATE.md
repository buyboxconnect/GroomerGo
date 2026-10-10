# Existing-record compare-and-update gate: passed

Verified against the live GroomerGo Base44 backend on October 10, 2026 at
21:32 UTC. Backend SDK: `@base44/sdk@0.8.53`.

| Live check | Observed result |
| --- | --- |
| Ten races, eight concurrent writers each | 10 applications, 70 explicit HTTP 409 conflicts |
| Stored revision and payload | One increment per race; payload matched the sole winning writer |
| Stale expected revision | Zero updates |
| Wrong businessId, recordUUID, runId, or valid internal entity ID | Zero updates; stored revision unchanged |
| Eight competing edits/deletes | One application, seven conflicts; coherent stored winner |
| Eight writers against a tombstone using its current revision | All conflicted; deletion marker and revision preserved |
| Disposable records | All runs cleaned up; zero remaining rows for each run |
| Anonymous probe caller | HTTP 401; no record created |
| Probe after completion | HTTP 410 / PROBE_DISABLED |
| Existing live upload endpoint | HTTP 409 / RECORD_SYNC_REQUIRED; uploads remain paused |
| Read-only test connection | Passed |

The probe sends a single `updateMany` request with the expected revision, scope,
and non-deleted state in its predicate. `$set` of the payload/winner/deletion marker
and `$inc` of the revision are in the same mutation. There is no read-then-update,
unconditional fallback, or application mutex.

The result is composite evidence: ten edit races from one paced run and the
scope/tombstone checks from a focused follow-up. Earlier burst tests hit upstream
HTTP 429 throttling. A negative test initially used a UUID as Base44's internal
entity ID; that malformed ID returned upstream HTTP 400 without modifying data.
The corrected test used a valid missing internal ID and returned zero updates.
Failed attempts are retained in the evidence directory, not counted as passes.

Only the separate `AtomicSyncProbe` entity was written. No production business,
service, client, pet, appointment, or snapshot record was modified. The test
function is disabled at rest; the retained empty entity denies all direct CRUD.
The unit suite passed all 23 tests, including authorization, scoped cleanup,
unexpected update results, and preserving rate-limit failures as failures.

This establishes observed single-record conditional-update behavior on the
current deployment. It does not establish unique concurrent creation, atomic
durable retry receipts, transactions across records, or actual iOS device/relaunch
behavior. Those remain gates before enabling live uploads. A production uploader
must also handle throttling and ambiguous network outcomes with bounded backoff
and durable idempotency.

Evidence and reproduction:

- [Machine-readable summary](evidence/atomic-gate-summary.json)
- [Ten edit races, including original failed malformed-ID test](evidence/atomic-gate-ten-edit-rounds.log)
- [Corrected scope and deletion checks](evidence/atomic-gate-scope.json)
- [Disabled probe and paused upload verification](evidence/post-gate-checks.log)
- [Harness procedure](../scripts/atomic-gate/README.md)
- [Official filtered-update API](https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities#updatemany)
