import "./index.css";
import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Booking from "./pages/Booking";
import Dashboard from "./pages/Dashboard";
import { Header, Modal } from "./components/Shared";
import PilotForm from "./components/PilotForm";
import { createSamples, todayKey, makeDemoBooking } from "./lib/booking";

const routeFor = () =>
  location.hash.startsWith("#/book")
    ? "book"
    : location.hash.startsWith("#/dashboard")
      ? "dashboard"
      : "home";
export default function App() {
  const [route, setRoute] = useState(routeFor);
  const [appointments, setAppointments] = useState(createSamples);
  const [dashboardDate, setDashboardDate] = useState(todayKey);
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    const onHash = () => setRoute(routeFor());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title =
      route === "book"
        ? "Booking demo · GroomerGo"
        : route === "dashboard"
          ? "Dashboard demo · GroomerGo"
          : "GroomerGo · A calmer day for solo dog groomers";
    window.scrollTo({ top: 0, behavior: "instant" });
    if (route !== "home")
      document.querySelector("main h1")?.focus({ preventScroll: true });
  }, [route]);
  const addBooking = (form) => {
    const item = makeDemoBooking(form, appointments);
    setAppointments((items) => [...items, item]);
    setDashboardDate(item.date);
    return item;
  };
  const updateBooking = (id, values) =>
    setAppointments((items) =>
      items.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header home={route === "home"} />
      {route === "home" && (
        <Landing
          onPilot={() => setDialog("pilot")}
          onPrivacy={() => setDialog("privacy")}
        />
      )}
      {route === "book" && (
        <Booking appointments={appointments} onAdd={addBooking} />
      )}
      {route === "dashboard" && (
        <Dashboard
          appointments={appointments}
          date={dashboardDate}
          setDate={setDashboardDate}
          onUpdate={updateBooking}
          onReset={() => {
            setAppointments(createSamples());
            setDashboardDate(todayKey());
          }}
        />
      )}
      {dialog === "pilot" && (
        <Modal
          title="A little less admin starts here."
          onClose={() => setDialog(null)}
        >
          <PilotForm />
        </Modal>
      )}
      {dialog === "privacy" && (
        <Modal title="Your details, with care." onClose={() => setDialog(null)}>
          <div className="prose">
            <p>
              The booking and dashboard demos use sample data. Details entered
              in those demos stay in memory in this browser tab and disappear
              when the page reloads. Please use fictional details.
            </p>
            <p>
              If you join the pilot, your name, business name, email, and
              consent version are stored in GroomerGo’s Base44 app. They are
              used to manage pilot interest and contact you about GroomerGo.
              They are not publicly listed.
            </p>
            <p>
              The pilot form does not enroll you in a paid subscription, collect
              payment details, or send an automated email or SMS. If invited to
              the pilot, you can ask to have your interest record removed by
              replying to that invitation.
            </p>
            <p>
              Hosting and storage are provided by Base44. Read{" "}
              <a
                href="https://base44.com/privacy-policy"
                target="_blank"
                rel="noreferrer"
              >
                Base44’s privacy policy
              </a>{" "}
              for its service practices.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
