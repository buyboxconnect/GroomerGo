# Business access foundation

## Scope and rollout

Steps 1–2 only. iOS changes are in `/Users/neerajdiwan/Documents/Codex/GroomerGo`. This repository is the backend source of truth; do not deploy the older backend copies in the Xcode directory.

`POST /functions/test-connection` takes a bearer token, calls `auth.me()`, and returns `{connected:true,user:{id,email}}`. It never reads or mutates entities, Keychain, or records. Error responses do not contain tokens. The iOS Test connection button uses this endpoint without automatic sign-in or token replacement.

`POST /functions/business-access` supports `list`, `verify` (businessId), and `create` (name only). Identity always comes from auth.me(). Business creation is an explicit UI action. It does not import existing local/cloud data. Owners cannot pass arbitrary owner IDs or roles. A failed multi-step creation leaves a pending business inaccessible and requires operator recovery. Concurrent onboarding can create separate owned businesses; uniqueness/transactional onboarding is not claimed.

## Authorization

Business has a UUID businessId, immutable-by-client ownerUserId, name and lifecycle status. BusinessMembership has businessId, stable authenticated userId, owner/member role and active/revoked status. Each access rechecks an active membership and active business, with owner-role consistency. Platform admin role grants no bypass in these endpoints. Direct entity CRUD is denied for Business, BusinessMembership and BusinessSnapshot; server functions use service-role access only after authenticating and performing explicit membership checks. Invitation, staff management and ownership transfer are not exposed in this slice.

PilotInterest remains a separate platform lead form with public create and admin-only access. It is not a tenant's operational record.

## Legacy data

Existing snapshots are preserved and quarantined, not assigned to a business based on email. New snapshot schema requires businessId. No automatic migration is performed. The old sync-workspace function returns RECORD_SYNC_REQUIRED and does not read or write snapshots. Both iOS upload/download methods stop before capturing or deleting local data. Record models and local records remain local and unassigned until the explicit migration in steps 3–4. They are not yet a multibusiness local store.

## Verification

13 Node tests pass, covering booking logic plus authentication failure, read-only connection behavior, cross-business denial with forged inputs and platform admin role, inactive/ambiguous membership, server-assigned ownership, failed onboarding, and static deny-by-default schemas. These tests use disposable in-memory fixtures, not live two-device accounts. Web production build passes.

Remaining: live RLS tests with two ordinary accounts, stable record UUIDs/businessId on all operational records, atomic revisions/conflicts, deletion markers, migration of existing records, two-device transfers, app relaunch/session persistence tests, and server-authoritative booking reservations. Do not claim production-safe synchronization from this foundation.

The updated iOS app builds successfully for generic iOS Simulator using full Xcode (`CODE_SIGNING_ALLOWED=NO`). This is compilation, not an executed device or session-persistence test.

GitHub editor publishing did not deploy the new function directories and interpreted lowercase entity filenames as names. The three functions were explicitly deployed from the same source with no pruning. Schemas were applied via the Base44 schema API and reconciled to the canonical PascalCase files it writes. Verify backend deployment separately from frontend publication on future releases.
