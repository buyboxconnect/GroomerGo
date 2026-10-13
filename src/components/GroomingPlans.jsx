import { useState } from "react";
import { base44 } from "@/api/base44Client";

const PLANS = [
  { id: "price_1UQ7mOHVjNoG9Lu6BZuC7DvJ", name: "Monthly Bath & Tidy", price: "$49", desc: "One bath, brush-out and nail trim every month" },
  { id: "price_1UQ7mOHVjNoG9Lu6KOdjZ4Kc", name: "Monthly Full Groom", price: "$79", desc: "One full groom with haircut every month" },
  { id: "price_1UQ7mOHVjNoG9Lu6Y2SLZOJp", name: "Twice-Monthly Groom", price: "$139", desc: "Two full grooms with haircut every month" },
];

export default function GroomingPlans() {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const subscribed = location.hash.includes("subscribed=1");

  const subscribe = async (priceId) => {
    setError("");
    setBusy(priceId);
    const isFramed = window.self !== window.top;
    const tab = isFramed ? window.open("", "_blank") : null;
    if (isFramed && !tab) { setBusy(null); setError("Allow popups to continue to checkout."); return; }
    if (tab) tab.opener = null;
    try {
      const { data } = await base44.functions.invoke("create-subscription-checkout", { priceId });
      if (tab) tab.location.replace(data.url); else window.location.assign(data.url);
    } catch (e) {
      tab?.close();
      setError("Could not start checkout. Please try again.");
    }
    setBusy(null);
  };

  return (
    <section className="container" style={{ marginTop: 48 }} aria-labelledby="plans-title">
      <h2 id="plans-title">Monthly grooming plans</h2>
      {subscribed && <p role="status">Thanks! Your subscription is active.</p>}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {PLANS.map((p) => (
          <div key={p.id} className="price-panel panel">
            <h3>{p.name}</h3>
            <p className="price"><strong>{p.price}</strong><span>/ month</span></p>
            <p>{p.desc}</p>
            <button className="button full" disabled={!!busy} onClick={() => subscribe(p.id)}>
              {busy === p.id ? "Opening checkout…" : "Subscribe"}
            </button>
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}