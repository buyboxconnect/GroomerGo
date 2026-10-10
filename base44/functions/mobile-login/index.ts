import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const base44 = createClientFromRequest(request);
    const result = await base44.auth.loginViaEmailPassword(email, password);
    return Response.json({
      access_token: result.access_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.full_name
      }
    });
  } catch (error) {
    const status = typeof error?.status === "number" ? error.status : 401;
    return Response.json(
      { error: status === 401 ? "Invalid email or password" : (error?.message || "Sign in failed") },
      { status }
    );
  }
});
