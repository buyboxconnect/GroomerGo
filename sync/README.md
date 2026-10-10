# Record synchronization preparation

Status: protocol implementation and disposable unit tests only. Not deployed or
connected to the native app. Existing upload/download remains paused.

`record-protocol.js` defines a record transition keyed by businessId + recordUUID,
with immutable record type, optimistic baseRevision, server timestamps, permanent
deletion markers, and operation receipts for retries after lost acknowledgments.
Payloads are limited to 64 KiB. UUIDs use canonical lowercase UUIDv4 strings; the
iOS serializer must lowercase its existing UUIDs, never generate replacement IDs.

Run `npm test` from the repository root. The two-device test simulates clients
sharing an in-memory serialized store. It is not an iOS Simulator, networking,
disk persistence, or Base44 concurrency test.

## Storage requirements before wiring uploads

The adapter must enforce a unique (businessId, recordUUID) key and perform record
transition + receipt insertion atomically. Receipts require a unique
(businessId, operationId) key. Two concurrent creates must produce one record;
two writes using the same revision must produce one success and one conflict.
Receipts must survive process restarts; never acknowledge an uncommitted write.
Membership authorization must run for every request, before loading receipts or
records. Access revocation must be coordinated with transaction authorization.

The [live compare-and-update gate](ATOMIC_GATE.md) now verifies the observed
single-record revision predicate behavior under concurrent requests. Base44's
official entities documentation exposes keyed upsert and filtered updateMany,
but does not specify the cross-record transaction and uniqueness guarantees
required here. Do not replace the transaction with filter-then-create/update or
an in-process mutex. Source checked October 10, 2026:
https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities

## Remaining implementation

- Verify unique concurrent creation and durable retry receipts atomic with the
  record write; single-record conditional updates have passed the live gate.
- Validate each record payload against the four native model schemas. Reject
  unknown fields and relationship references outside the authorized business;
  coordinate parent deletion and dependent records transactionally.
- Add authenticated backend handlers with strict request limits and deny-direct-
  CRUD entity policies. This pure module is not itself an authorization boundary.
- Add a durable SwiftData outbox, server revisions, tombstones, and conflict UI.
  Capture edits/deletions and pending uploads atomically; never clear the store.
- Pull via a durable change log/cursor, including tombstones, without skipping
  concurrent writes. Persist cursor and applied records together.
- Exercise two actual app instances with disposable fixtures, then close/reopen
  and verify session, outbox, cursor, and records survive. Only afterward wire
  web bookings and transactional availability reservations.

The transition returns a conflict without mutating storage. A retry returns its
original acknowledgment, which may be older than the latest server record; a
client must never roll back a newer local server revision from such a receipt.
Deletes retain identity/revision but remove payload. Restoring a deleted item
requires a new record UUID. Tombstone/receipt retention is intentionally unbounded
until an explicit device acknowledgment and retention policy exists.
