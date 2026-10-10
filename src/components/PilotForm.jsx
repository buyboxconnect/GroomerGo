import { useState, useRef } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { base44 } from "../api/base44Client";

export default function PilotForm() {
  const [status, setStatus] = useState("idle");
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") || "").trim();
    const business = String(values.get("business") || "").trim();
    const email = String(values.get("email") || "")
      .trim()
      .toLowerCase();
    if (
      !name ||
      !business ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      values.get("consent") !== "on"
    ) {
      setError(
        "Please complete your details and agree to be contacted about the pilot.",
      );
      return;
    }
    if (values.get("website")) {
      setError("Unable to submit this form. Please try again.");
      return;
    }
    inFlight.current = true;
    setStatus("sending");
    setError("");
    try {
      await base44.entities.PilotInterest.create({
        name,
        business_name: business,
        email,
        consent_version: "pilot-contact-v1",
      });
      setStatus("success");
    } catch {
      setStatus("idle");
      setError(
        "We couldn’t save your interest. Please try again. You have not been charged.",
      );
    } finally {
      inFlight.current = false;
    }
  };
  if (status === "success")
    return (
      <div className="success-block" role="status">
        <CheckCircle2 size={44} aria-hidden="true" />
        <h3>You’re on the pilot list.</h3>
        <p>
          Your interest has been saved. We’ll use your email to contact you
          about the pilot. No payment or subscription was created.
        </p>
      </div>
    );
  return (
    <form className="pilot-form" onSubmit={handleSubmit}>
      <p>
        Help shape GroomerGo for solo groomers. Joining the pilot list is free.
      </p>
      <label>
        Your name
        <input
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          disabled={status === "sending"}
        />
      </label>
      <label>
        Business name
        <input
          name="business"
          autoComplete="organization"
          required
          maxLength={150}
          disabled={status === "sending"}
        />
      </label>
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={status === "sending"}
        />
      </label>
      <div className="honey" aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          name="consent"
          required
          disabled={status === "sending"}
        />
        <span>
          I agree that GroomerGo may store these details in Base44 and contact
          me by email about the pilot.
        </span>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button full" disabled={status === "sending"}>
        {status === "sending" ? "Saving your interest…" : "Join the free pilot"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="fine-print">
        No card required. No automated email or SMS is sent by this form.
      </p>
    </form>
  );
}
