export async function handleConnection(request, client) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    const user = await client.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    return Response.json({ connected: true, user: { id: user.id, email: user.email } }, { headers });
  } catch (error) {
    const status = [401, 403].includes(error?.status) ? 401 : 503;
    return Response.json({ error: status === 401 ? 'Sign in again to test your connection.' : 'Connection check unavailable. Try again.' }, { status, headers });
  }
}
