import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Clock3,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { ServiceIcon, Notice } from "../components/Shared";
import GroomingPlans from "@/components/GroomingPlans";
import {
  SERVICES,
  money,
  dateLabel,
  bookingDays,
  availableSlots,
  timeLabel,
  BUSINESS_TIMEZONE,
} from "../lib/booking";

export default function Booking({ appointments, onAdd }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    serviceId: "full",
    date: bookingDays()[0],
    start: null,
    pet: "Pip",
    breed: "Miniature poodle",
    size: "Small",
    client: "Demo Client",
    email: "demo@example.com",
    notes: "",
  });
  const [completed, setCompleted] = useState(null);
  const [error, setError] = useState("");
  const [understood, setUnderstood] = useState(false);
  const titleRef = useRef(null);
  const service = SERVICES.find((s) => s.id === form.serviceId);
  const days = bookingDays();
  const slots = availableSlots(form.date, service, appointments);
  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };
  useEffect(() => {
    if (step > 0 || completed) titleRef.current?.focus();
  }, [step, completed]);
  const next = () => {
    if (step === 1 && form.start === null) {
      setError("Choose a time to continue.");
      return;
    }
    setError("");
    setStep((value) => value + 1);
  };
  const finish = () => {
    if (!understood) {
      setError("Please acknowledge that this is a demo.");
      return;
    }
    try {
      setCompleted(onAdd(form));
      setError("");
    } catch (err) {
      setStep(1);
      setForm((prev) => ({ ...prev, start: null }));
      setError(err.message);
    }
  };
  if (completed)
    return (
      <>
        <Notice>
          Booking demo · Nothing is reserved or charged. Use sample details.
        </Notice>
        <main id="main" className="booking-success container">
          <div className="success-icon">
            <CheckCircle2 size={42} aria-hidden="true" />
          </div>
          <h1 tabIndex={-1} ref={titleRef}>
            Your sample visit is ready.
          </h1>
          <p>
            This appointment exists only in this demo tab. No booking was sent
            to a groomer.
          </p>
          <div className="panel confirmation">
            <h2>
              {completed.pet}’s {completed.serviceName.toLowerCase()}
            </h2>
            <p>
              {dateLabel(completed.date)} · {timeLabel(completed.start)}
              <br />
              <span className="muted">
                {BUSINESS_TIMEZONE} · {completed.minutes} minutes
              </span>
            </p>
            <dl>
              <div>
                <dt>Example deposit</dt>
                <dd>{money(completed.deposit)} · not collected</dd>
              </div>
              <div>
                <dt>Client</dt>
                <dd>{completed.client}</dd>
              </div>
            </dl>
            <div className="prep-block">
              <h3>A little preparation</h3>
              <p>{service.prep}</p>
            </div>
            <p className="fine-print">
              No email, SMS, or push reminder was sent.
            </p>
          </div>
          <a className="button" href="#/dashboard">
            See it in the dashboard <ArrowRight size={20} aria-hidden="true" />
          </a>
          <a className="text-link" href="#">
            Back to website
          </a>
        </main>
      </>
    );
  return (
    <>
      <Notice>
        Booking demo · Nothing is reserved or charged. Use sample details.
      </Notice>
      <main id="main" className="booking-page container">
        <div className="booking-heading">
          <h1 tabIndex={-1}>A fresh start for your best friend.</h1>
          <p>The Little Paw Studio · Sample grooming business</p>
        </div>
        <ol className="booking-steps" aria-label="Booking progress">
          {["Service", "Time", "Pet details", "Review"].map((label, index) => (
            <li
              key={label}
              className={
                step === index ? "current" : step > index ? "done" : ""
              }
              aria-current={step === index ? "step" : undefined}
            >
              <span>
                {step > index ? (
                  <CheckCircle2 size={19} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <div className="booking-layout">
          <section className="booking-form panel">
            <h2 ref={titleRef} tabIndex={-1}>
              {
                [
                  "Choose a little TLC.",
                  "Find a time that fits.",
                  "Tell us about your best friend.",
                  "One last look.",
                ][step]
              }
            </h2>
            {step === 0 && (
              <>
                <fieldset className="service-options">
                  <legend className="sr-only">Choose a grooming service</legend>
                  {SERVICES.map((option) => (
                    <label
                      key={option.id}
                      className={`service-option ${option.id === form.serviceId ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="service"
                        value={option.id}
                        checked={option.id === form.serviceId}
                        onChange={() => {
                          setField("serviceId", option.id);
                          setField("start", null);
                        }}
                      />
                      <ServiceIcon service={option} size={32} />
                      <span className="service-description">
                        <strong>{option.name}</strong>
                        <span>{option.description}</span>
                      </span>
                      <span className="service-duration">
                        {option.minutes} min
                      </span>
                      <strong className="service-price">
                        {money(option.price).replace(".00", "")}
                      </strong>
                    </label>
                  ))}
                </fieldset>
                <button className="button full" onClick={next}>
                  Choose a time <ArrowRight size={20} aria-hidden="true" />
                </button>
              </>
            )}
            {step === 1 && (
              <>
                <p className="muted">
                  Sample opening hours: 9 AM–5 PM, Monday–Friday. Lunch: noon–1
                  PM. All times are in {BUSINESS_TIMEZONE}.
                </p>
                <fieldset className="date-options">
                  <legend>Choose a day</legend>
                  {days.map((day) => (
                    <label
                      className={`date-option ${form.date === day ? "selected" : ""}`}
                      key={day}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="date"
                        value={day}
                        checked={form.date === day}
                        onChange={() => {
                          setField("date", day);
                          setField("start", null);
                        }}
                      />
                      <span>
                        {dateLabel(day, {
                          weekday: "short",
                          month: undefined,
                          day: undefined,
                        })}
                      </span>
                      <strong>{Number(day.slice(-2))}</strong>
                      <span>
                        {dateLabel(day, {
                          weekday: undefined,
                          month: "short",
                          day: undefined,
                        })}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="time-options">
                  <legend>Choose a time</legend>
                  {slots.map((start) => (
                    <label
                      key={start}
                      className={`time-option ${form.start === start ? "selected" : ""}`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="time"
                        checked={form.start === start}
                        onChange={() => setField("start", start)}
                      />
                      {timeLabel(start)}
                    </label>
                  ))}
                  {slots.length === 0 && (
                    <p>No sample times left that day. Try another day.</p>
                  )}
                </fieldset>
                <p className="fine-print">
                  These times are calculated for the demo only.
                </p>
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <div className="form-actions">
                  <button className="button outline" onClick={() => setStep(0)}>
                    <ArrowLeft size={18} aria-hidden="true" /> Back
                  </button>
                  <button
                    className="button"
                    onClick={next}
                    disabled={form.start === null}
                  >
                    Pet details <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <form
                className="pet-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  next();
                }}
              >
                <p className="muted">
                  Sample details are prefilled. Please keep any changes
                  fictional.
                </p>
                <div className="field-grid">
                  <label>
                    Pet’s name
                    <input
                      required
                      maxLength={80}
                      value={form.pet}
                      onChange={(e) => setField("pet", e.target.value)}
                    />
                  </label>
                  <label>
                    Breed
                    <input
                      required
                      maxLength={80}
                      value={form.breed}
                      onChange={(e) => setField("breed", e.target.value)}
                    />
                  </label>
                  <label>
                    Size
                    <select
                      value={form.size}
                      onChange={(e) => setField("size", e.target.value)}
                    >
                      {["Small", "Medium", "Large", "Extra large"].map(
                        (size) => (
                          <option key={size}>{size}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Client name
                    <input
                      required
                      maxLength={100}
                      value={form.client}
                      onChange={(e) => setField("client", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Anything we should know?{" "}
                  <span className="muted">(optional)</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    placeholder="Coat care, handling preferences, or sensitivities…"
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="button outline"
                    type="button"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft size={18} aria-hidden="true" /> Back
                  </button>
                  <button className="button">
                    Review visit <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}
            {step === 3 && (
              <>
                <div className="review-details">
                  <h3>{form.pet}’s visit</h3>
                  <dl>
                    <div>
                      <dt>Service</dt>
                      <dd>{service.name}</dd>
                    </div>
                    <div>
                      <dt>When</dt>
                      <dd>
                        {dateLabel(form.date)}
                        <br />
                        {timeLabel(form.start)} · {BUSINESS_TIMEZONE}
                      </dd>
                    </div>
                    <div>
                      <dt>Pet</dt>
                      <dd>
                        {form.breed} · {form.size}
                      </dd>
                    </div>
                    <div>
                      <dt>Client</dt>
                      <dd>
                        {form.client}
                        <br />
                        {form.email}
                      </dd>
                    </div>
                    {form.notes && (
                      <div>
                        <dt>Notes</dt>
                        <dd>{form.notes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="callout">
                  <strong>A preview of the deposit step</strong>
                  <p>
                    A live booking would continue to secure checkout. In this
                    demo, no card is requested, no deposit is collected, and no
                    real appointment is reserved.
                  </p>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                  />
                  <span>
                    I understand this creates a sample appointment in this tab
                    only.
                  </span>
                </label>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="form-actions">
                  <button className="button outline" onClick={() => setStep(2)}>
                    <ArrowLeft size={18} aria-hidden="true" /> Back
                  </button>
                  <button
                    className="button"
                    onClick={finish}
                    disabled={!understood}
                  >
                    Create sample visit{" "}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </section>
          <aside className="visit-summary panel">
            <div>
              <h2>Your visit</h2>
              <p className="summary-line">
                <ServiceIcon service={service} size={24} />
                {service.name}
              </p>
              <p className="summary-line">
                <Clock3 size={24} strokeWidth={1.5} aria-hidden="true" />
                {service.minutes} minutes
              </p>
              {form.start !== null && (
                <p className="summary-line">
                  <CalendarDays
                    size={24}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span>
                    {dateLabel(form.date, { month: "short", weekday: "short" })}
                    <br />
                    {timeLabel(form.start)}
                  </span>
                </p>
              )}
              <dl>
                <div>
                  <dt>Service total</dt>
                  <dd>{money(service.price)}</dd>
                </div>
                <div>
                  <dt>Example deposit</dt>
                  <dd>{money(service.deposit)}</dd>
                </div>
                <div>
                  <dt>Remaining balance</dt>
                  <dd>{money(service.price - service.deposit)}</dd>
                </div>
              </dl>
              <p className="fine-print">
                This is a preview. No payment information is collected.
              </p>
            </div>
            <div className="summary-prep">
              <h3>A little preparation</h3>
              <p>{service.prep}</p>
            </div>
          </aside>
        </div>
      </main>
      <GroomingPlans />
    </>
  );
}