const headers = { 'Cache-Control': 'no-store' };
const fail = (status, message) => Object.assign(new Error(message), { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Membership is authoritative server data, never a role or businessId on the user profile.
export async function authorizeBusiness(entities, userId, businessId) {
  if (typeof businessId !== 'string' || !uuid.test(businessId)) throw fail(400, 'A valid businessId is required.');
  const memberships = await entities.BusinessMembership.filter({ businessId, userId, status: 'active' }, undefined, 2);
  if (memberships.length !== 1) throw fail(403, 'Business access denied.');
  const businesses = await entities.Business.filter({ businessId, status: 'active' }, undefined, 2);
  if (businesses.length !== 1) throw fail(403, 'Business access denied.');
  const business = businesses[0];
  const membership = memberships[0];
  if (!['owner', 'member'].includes(membership.role)) throw fail(403, 'Business access denied.');
  if ((membership.role === 'owner') !== (business.ownerUserId === userId)) throw fail(403, 'Business access denied.');
  return { businessId, name: business.name, role: membership.role, ownerUserId: business.ownerUserId };
}

export async function handleBusinessAccess(request, client, newId = () => crypto.randomUUID()) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    let user;
    try { user = await client.auth.me(); } catch (error) {
      throw fail([401, 403].includes(error?.status) ? 401 : 503, 'Authentication could not be verified.');
    }
    if (!user?.id) throw fail(401, 'Unauthorized');
    let input;
    try { input = await request.json(); } catch { throw fail(400, 'Invalid request.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'Invalid request.');
    const entities = client.asServiceRole.entities;
    if (input.action === 'verify') {
      const business = await authorizeBusiness(entities, user.id, input.businessId);
      return Response.json({ userId: user.id, business }, { headers });
    }
    if (input.action === 'list') {
      const memberships = await entities.BusinessMembership.filter({ userId: user.id, status: 'active' }, undefined, 1000);
      if (memberships.length === 1000) throw fail(409, 'Too many memberships; contact support.');
      const businesses = [];
      for (const id of new Set(memberships.map(m => m.businessId))) {
        try { businesses.push(await authorizeBusiness(entities, user.id, id)); }
        catch (error) { if (![400, 403].includes(error.status)) throw error; }
      }
      return Response.json({ userId: user.id, businesses }, { headers });
    }
    if (input.action === 'create') {
      if (Object.keys(input).some(k => !['action', 'name'].includes(k))) throw fail(400, 'Only a business name may be supplied.');
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 150) throw fail(400, 'Enter a business name up to 150 characters.');
      const owned = await entities.Business.filter({ ownerUserId: user.id }, undefined, 1);
      if (owned.length) throw fail(409, 'A business already exists for this owner. Refresh businesses or contact support.');
      const businessId = newId();
      // Pending business fails closed if membership creation fails. No automatic data migration.
      const business = await entities.Business.create({ businessId, name, ownerUserId: user.id, status: 'pending' });
      await entities.BusinessMembership.create({ businessId, userId: user.id, role: 'owner', status: 'active' });
      await entities.Business.update(business.id, { status: 'active' });
      return Response.json({ userId: user.id, business: { businessId, name, role: 'owner', ownerUserId: user.id } }, { status: 201, headers });
    }
    throw fail(400, 'Unknown action.');
  } catch (error) {
    const status = [400, 401, 403, 409, 503].includes(error?.status) ? error.status : 500;
    return Response.json({ error: status === 500 ? 'Business operation failed. No access was granted.' : error.message }, { status, headers });
  }
}
