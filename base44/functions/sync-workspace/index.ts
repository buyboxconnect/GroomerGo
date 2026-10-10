import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(request);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const input = await request.json();
    const snapshots = await base44.entities.BusinessSnapshot.list("-updated_date", 1, 0);
    const current = snapshots[0] || null;

    if (typeof input.payload !== "string") {
      return Response.json({
        revision: current?.revision || 0,
        payload: current?.payload || null,
        server_updated_at: current?.updated_date || null
      });
    }

    const expectedRevision = Number(input.expected_revision || 0);
    const currentRevision = Number(current?.revision || 0);
    if (expectedRevision !== currentRevision) {
      return Response.json({
        error: "Sync conflict",
        revision: currentRevision,
        payload: current?.payload || null,
        server_updated_at: current?.updated_date || null
      }, { status: 409 });
    }

    const nextRevision = currentRevision + 1;
    const values = {
      schema_version: 1,
      revision: nextRevision,
      payload: input.payload,
      source_device: String(input.source_device || "unknown"),
      client_updated_at: new Date().toISOString()
    };
    const saved = current
      ? await base44.entities.BusinessSnapshot.update(current.id, values)
      : await base44.entities.BusinessSnapshot.create(values);

    return Response.json({
      revision: saved.revision,
      payload: saved.payload,
      server_updated_at: saved.updated_date
    });
  } catch (error) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return Response.json({ error: error?.message || "Synchronization failed" }, { status });
  }
});
