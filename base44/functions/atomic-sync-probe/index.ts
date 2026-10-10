// Disabled at rest. The documented gate procedure temporarily deploys active.ts
// as this entry, then restores this file and verifies HTTP 410 after cleanup.
Deno.serve(() => Response.json({ code: "PROBE_DISABLED" }, {
  status: 410, headers: { "Cache-Control": "no-store" }
}));
