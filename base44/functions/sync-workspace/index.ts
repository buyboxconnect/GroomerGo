import { createClientFromRequest } from "npm:@base44/sdk";

// Whole-workspace transfers are retired. Preserve legacy snapshots, but never
// expose or replace them until explicit migration and record-level sync exist.
Deno.serve(async (request) => {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  try {
    const user = await createClientFromRequest(request).auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    return Response.json({ error: "Workspace transfers are paused until business-scoped record synchronization is available.", code: "RECORD_SYNC_REQUIRED" }, { status: 409, headers });
  } catch {
    return Response.json({ error: "Authentication could not be verified." }, { status: 401, headers });
  }
});
