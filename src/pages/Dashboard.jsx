import { useState } from "react";
import {
  CalendarDays,
  Users,
  Scissors,
  Link2,
  RotateCcw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Search,
} from "lucide-react";
import { Avatar, Modal, Notice, ServiceIcon } from "../components/Shared";
import {
  SERVICES,
  dateLabel,
  addDays,
  todayKey,
  timeLabel,
  money,
  bookingDays,
  availableSlots,
  BUSINESS_TIMEZONE,
} from "../lib/booking";

export default function Dashboard({
  appointments,
  date,
  setDate,
  onUpdate,
  onReset,
}) {
  const [view, setView] = useState("schedule");
  const [active, setActive] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const item = appointments.find((a) => a.id === active);
  const daily = appointments
    .filter((a) => a.date === date)
    .sort((a, b) => a.start - b.start);
  const clients = [
    ...new Map(appointments.map((a) => [`${a.client}|${a.pet}`, a])).values(),
  ].filter((a) =>
    `${a.client} ${a.pet} ${a.breed}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}#/book`,
      );
      setCopyMessage(
        "Demo link copied. This link is a preview, not live booking.",
      );
    } catch {
      setCopyMessage(
        "Copy is unavailable. Open the booking demo and copy its address from your browser.",
      );
    }
  };
  return (
    <>
      <Notice>
        Dashboard demo · Sample appointments only. Changes stay in this tab.
      </Notice>
      <main id="main" className="dashboard-layout container">
        <aside className="dashboard-sidebar">
          <div>
            <h2>The Little Paw Studio</h2>
            <p className="muted">Sample business</p>
          </div>
          <nav aria-label="Dashboard navigation">
            {[
              ["schedule", "Schedule", CalendarDays],
              ["clients", "Clients & pets", Users],
              ["services", "Services", Scissors],
              ["connections", "Connections", Link2],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                className={view === key ? "active" : ""}
                aria-current={view === key ? "page" : undefined}
                onClick={() => {
                  setView(key);
                  setCopyMessage("");
                }}
              >
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
          <button
            className="button outline reset-button"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw size={18} aria-hidden="true" />
            Reset demo
          </button>
        </aside>
        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <h1 tabIndex={-1}>
                {view === "schedule"
                  ? "Your day, a little calmer."
                  : view === "clients"
                    ? "Good dogs. Familiar faces."
                    : view === "services"
                      ? "A little care, your way."
                      : "Bring it all together."}
              </h1>
              <p className="muted">
                {view === "schedule"
                  ? `${dateLabel(date)} · ${BUSINESS_TIMEZONE}`
                  : view === "clients"
                    ? "Sample clients and pets from this demo."
                    : view === "services"
                      ? "Example services and prices for the booking demo."
                      : "A clear view of what is connected."}
              </p>
            </div>
            <a className="button" href="#/book">
              Preview booking page
            </a>
          </div>
          {view === "schedule" && (
            <>
              <div className="date-toolbar">
                <button
                  className="icon-button"
                  aria-label="Previous day"
                  onClick={() => setDate(addDays(date, -1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <span>{dateLabel(date)}</span>
                <button
                  className="icon-button"
                  aria-label="Next day"
                  onClick={() => setDate(addDays(date, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
                {date !== todayKey() && (
                  <button
                    className="plain-button"
                    onClick={() => setDate(todayKey())}
                  >
                    Today
                  </button>
                )}
              </div>
              <section className="appointments-panel panel">
                <h2>Appointments</h2>
                {daily.length ? (
                  daily.map((a, index) => (
                    <button
                      className="appointment-row"
                      key={a.id}
                      onClick={() => setActive(a.id)}
                      aria-label={`View ${a.pet} appointment at ${timeLabel(a.start)}`}
                    >
                      <span className="appointment-time">
                        {String(Math.floor(a.start / 60)).padStart(2, "0")}:
                        {String(a.start % 60).padStart(2, "0")}
                      </span>
                      <Avatar name={a.pet} index={index} />
                      <span className="appointment-client">
                        <strong>{a.pet}</strong>
                        <span>{a.client}</span>
                      </span>
                      <span className="appointment-service">
                        <strong>{a.serviceName}</strong>
                        <span>{a.minutes} min</span>
                      </span>
                      <span className={`status ${a.status}`}>
                        {a.status === "no-show"
                          ? "No-show"
                          : a.status[0].toUpperCase() + a.status.slice(1)}
                      </span>
                      <ChevronRight size={22} aria-hidden="true" />
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <CalendarDays size={32} aria-hidden="true" />
                    <h3>A little room in the calendar.</h3>
                    <p>No sample appointments on this day.</p>
                    <a className="text-link" href="#/book">
                      Create a sample booking{" "}
                      <ArrowRight size={18} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </section>
              <div className="dashboard-callout">
                <div>
                  <h2>Try the full journey.</h2>
                  <p>Create a sample booking, then find it here.</p>
                </div>
                <a className="text-link" href="#/book">
                  Open booking demo <ArrowRight size={20} aria-hidden="true" />
                </a>
              </div>
            </>
          )}
          {view === "clients" && (
            <>
              <label className="search-box">
                <Search size={20} aria-hidden="true" />
                <span className="sr-only">Search clients and pets</span>
                <input
                  type="search"
                  placeholder="Search a client, pet, or breed…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <section className="clients-panel panel">
                <h2>Clients & pets</h2>
                {clients.length ? (
                  clients.map((a, index) => (
                    <div className="client-row" key={`${a.client}|${a.pet}`}>
                      <Avatar name={a.pet} index={index} />
                      <div>
                        <h3>{a.pet}</h3>
                        <p>
                          {a.breed} · {a.size}
                        </p>
                      </div>
                      <div>
                        <strong>{a.client}</strong>
                        <p>{a.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>No sample clients match that search.</p>
                  </div>
                )}
              </section>
            </>
          )}
          {view === "services" && (
            <section className="services-panel panel">
              <h2>Grooming services</h2>
              {SERVICES.map((s) => (
                <div className="dashboard-service" key={s.id}>
                  <ServiceIcon service={s} size={30} />
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.description}</p>
                    <p className="fine-print">Prep: {s.prep}</p>
                  </div>
                  <div className="service-values">
                    <strong>{money(s.price)}</strong>
                    <span>{s.minutes} minutes</span>
                    <span>{money(s.deposit)} example deposit</span>
                  </div>
                </div>
              ))}
            </section>
          )}
          {view === "connections" && (
            <>
              <section className="connections-panel panel">
                <h2>Connections</h2>
                {[
                  [
                    "Client booking page",
                    "Demo only",
                    "Share the preview to explore the booking experience.",
                  ],
                  [
                    "Stripe deposits",
                    "Not connected",
                    "No payment details are collected and no deposits are charged.",
                  ],
                  [
                    "SMS & push reminders",
                    "Not connected",
                    "No messages or reminders are sent by the demo.",
                  ],
                  [
                    "Native iPhone app",
                    "Not connected",
                    "Shared authentication and live calendar sync are still in development.",
                  ],
                ].map(([name, status, description]) => (
                  <div className="connection-row" key={name}>
                    <div>
                      <h3>{name}</h3>
                      <p>{description}</p>
                    </div>
                    <span className="connection-status">{status}</span>
                  </div>
                ))}
              </section>
              <div className="share-row">
                <button className="button outline" onClick={copyLink}>
                  <Copy size={18} aria-hidden="true" />
                  Copy demo booking link
                </button>
                <p role="status" className="fine-print">
                  {copyMessage}
                </p>
              </div>
            </>
          )}
          <p className="dashboard-foot fine-print">
            No deposits collected. No reminders sent. iPhone sync not connected.
          </p>
        </div>
        {item && (
          <AppointmentDialog
            item={item}
            appointments={appointments}
            onUpdate={onUpdate}
            onClose={() => setActive(null)}
            onRescheduled={setDate}
          />
        )}
        {resetOpen && (
          <Modal
            title="Start the demo fresh?"
            onClose={() => setResetOpen(false)}
          >
            <p>
              This removes sample bookings you added and restores the three
              original appointments. No real business data is affected.
            </p>
            <div className="form-actions">
              <button
                className="button outline"
                onClick={() => setResetOpen(false)}
              >
                Keep exploring
              </button>
              <button
                className="button"
                onClick={() => {
                  onReset();
                  setResetOpen(false);
                }}
              >
                Reset sample data
              </button>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}

function AppointmentDialog({
  item,
  appointments,
  onUpdate,
  onClose,
  onRescheduled,
}) {
  const [mode, setMode] = useState("details");
  const [date, setDate] = useState(bookingDays()[0]);
  const [start, setStart] = useState(null);
  const [error, setError] = useState("");
  const service = SERVICES.find((s) => s.id === item.serviceId);
  const slots = availableSlots(
    date,
    { minutes: item.minutes },
    appointments.filter((a) => a.id !== item.id),
  );
  const reschedule = () => {
    if (!bookingDays().includes(date) || !slots.includes(start)) {
      setError("Choose an available sample time.");
      return;
    }
    onUpdate(item.id, { date, start });
    onRescheduled(date);
    onClose();
  };
  return (
    <Modal title={`${item.pet}’s visit`} onClose={onClose}>
      <p className="muted">
        Sample appointment ·{" "}
        {item.status === "no-show" ? "No-show" : item.status}
      </p>
      {mode === "details" && (
        <>
          <dl className="appointment-details">
            <div>
              <dt>Service</dt>
              <dd>
                {item.serviceName} · {item.minutes} min
              </dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {dateLabel(item.date)}
                <br />
                {timeLabel(item.start)} · {BUSINESS_TIMEZONE}
              </dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>
                {item.client}
                <br />
                {item.email}
              </dd>
            </div>
            <div>
              <dt>Pet</dt>
              <dd>
                {item.breed} · {item.size}
              </dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{money(item.price)}</dd>
            </div>
            <div>
              <dt>Example deposit</dt>
              <dd>{money(item.deposit)} · not collected</dd>
            </div>
            {item.notes && (
              <div>
                <dt>Notes</dt>
                <dd>{item.notes}</dd>
              </div>
            )}
          </dl>
          <div className="callout">
            <strong>Prep instructions</strong>
            <p>{service.prep}</p>
          </div>
          {item.status === "scheduled" && (
            <div className="appointment-actions">
              <button
                className="button"
                onClick={() => {
                  onUpdate(item.id, { status: "completed" });
                  onClose();
                }}
              >
                Mark sample completed
              </button>
              <button
                className="button outline"
                onClick={() => setMode("reschedule")}
              >
                Reschedule
              </button>
              <button
                className="plain-button danger"
                onClick={() => setMode("cancel")}
              >
                Cancel sample appointment
              </button>
              <button
                className="plain-button"
                onClick={() => {
                  onUpdate(item.id, { status: "no-show" });
                  onClose();
                }}
              >
                Mark sample no-show
              </button>
            </div>
          )}
          <p className="fine-print">
            No payment or reminder action occurs when you change this sample.
          </p>
        </>
      )}
      {mode === "cancel" && (
        <>
          <p>
            Cancel this sample appointment? Its time will become available again
            in this demo. No message will be sent and no refund will be issued.
          </p>
          <div className="form-actions">
            <button
              className="button outline"
              onClick={() => setMode("details")}
            >
              Keep appointment
            </button>
            <button
              className="button danger-button"
              onClick={() => {
                onUpdate(item.id, { status: "cancelled" });
                onClose();
              }}
            >
              Cancel sample appointment
            </button>
          </div>
        </>
      )}
      {mode === "reschedule" && (
        <div className="pet-form">
          <label>
            New day
            <select
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setStart(null);
                setError("");
              }}
            >
              {bookingDays().map((day) => (
                <option value={day} key={day}>
                  {dateLabel(day)}
                </option>
              ))}
            </select>
          </label>
          <label>
            New time
            <select
              value={start === null ? "" : start}
              onChange={(e) =>
                setStart(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Choose a time</option>
              {slots.map((s) => (
                <option key={s} value={s}>
                  {timeLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <p className="fine-print">
            Times are in {BUSINESS_TIMEZONE}. Rescheduling changes this demo
            only.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="button outline"
              onClick={() => setMode("details")}
            >
              Back
            </button>
            <button
              className="button"
              disabled={start === null}
              onClick={reschedule}
            >
              Save sample time
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
