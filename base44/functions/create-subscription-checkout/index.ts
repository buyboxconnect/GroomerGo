const PRICES = new Set([
  "price_1UQ7mOHVjNoG9Lu6BZuC7DvJ",
  "price_1UQ7mOHVjNoG9Lu6KOdjZ4Kc",
  "price_1UQ7mOHVjNoG9Lu6Y2SLZOJp",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const { priceId } = await req.json().catch(() => ({}));
  if (!PRICES.has(priceId)) return Response.json({ error: "Unknown plan" }, { status: 400 });
  const appUrl = req.headers.get("X-Base44-App-Url");
  if (!appUrl) return Response.json({ error: "Missing app URL" }, { status: 400 });

  const appId = Deno.env.get("BASE44_APP_ID") ?? "";
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/#/book?subscribed=1`,
    cancel_url: `${appUrl}/#/book`,
    "metadata[base44_app_id]": appId,
    "subscription_data[metadata][base44_app_id]": appId,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Stripe-Version": "2025-10-29.clover",
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Stripe checkout error:", data.error?.message);
    return Response.json({ error: data.error?.message ?? "Checkout failed" }, { status: 502 });
  }
  return Response.json({ url: data.url });
});