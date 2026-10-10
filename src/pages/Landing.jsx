import { ArrowRight, CalendarDays, Check, ChevronDown } from "lucide-react";
import { Avatar } from "../components/Shared";
import { createSamples, dateLabel, todayKey } from "../lib/booking";

export default function Landing({ onPilot, onPrivacy }) {
  return (
    <main id="main">
      <section className="hero container">
        <div className="hero-copy">
          <h1>
            Less admin.
            <br />
            More happy
            <br />
            tails.
          </h1>
          <p>
            A calmer calendar for solo groomers. Try pet intake, appointment
            planning, and a booking link your clients can open anywhere.
          </p>
          <div className="hero-actions">
            <a className="button" href="#/book">
              Try the booking demo <ArrowRight size={22} aria-hidden="true" />
            </a>
            <a className="text-link" href="#/dashboard">
              Explore the dashboard
            </a>
          </div>
          <p className="fine-print">
            Interactive preview. No real bookings or payments.
          </p>
        </div>
        <div className="hero-preview">
          <div className="peach-circle" aria-hidden="true" />
          <div className="schedule-preview panel">
            <div className="preview-heading">
              <h2>A little more room in your day.</h2>
              <p>
                <strong>Sample schedule</strong>
                <br />
                {dateLabel(todayKey())}
              </p>
            </div>
            <div className="preview-rows">
              {createSamples().map((item, index) => (
                <div className="preview-row" key={item.id}>
                  <span className="preview-time">
                    {String(Math.floor(item.start / 60)).padStart(2, "0")}:00
                  </span>
                  <Avatar name={item.pet} index={index} />
                  <strong>{item.pet}</strong>
                  <span>{item.serviceName}</span>
                  <span>{item.minutes} min</span>
                </div>
              ))}
            </div>
            <div className="preview-foot">
              <CalendarDays size={28} strokeWidth={1.5} aria-hidden="true" />
              <span>Your next appointment, at a glance.</span>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="journey">
        <div className="container">
          <h2>One link. A simpler booking journey.</h2>
          <div className="journey-steps">
            <div>
              <span className="step-number">01</span>
              <h3>Choose a service</h3>
              <p>
                Show the services you offer,
                <br className="desktop-only" /> in your own words.
              </p>
            </div>
            <div>
              <span className="step-number">02</span>
              <h3>Find a time</h3>
              <p>
                Try choosing a time in the demo
                <br className="desktop-only" /> and see the flow for yourself.
              </p>
            </div>
            <div>
              <span className="step-number">03</span>
              <h3>Share pet details</h3>
              <p>
                A few quick details help you
                <br className="desktop-only" /> prepare for a great visit.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section id="pricing" className="pricing container">
        <div className="pricing-copy">
          <h2>
            Small business.
            <br />
            Simple pricing.
          </h2>
          <p>
            A single plan for a solo groomer. Help shape the first release
            before paid plans launch.
          </p>
          <p className="pricing-note">
            Proposed launch pricing. Pilot signup is free.
          </p>
        </div>
        <div className="price-panel panel">
          <h3>Solo groomer</h3>
          <p className="price">
            <strong>$19.99</strong>
            <span>/ month</span>
          </p>
          <p>Planned at launch</p>
          <ul>
            {[
              "Appointment calendar",
              "Client & pet records",
              "Shareable booking page",
              "Prep instructions",
            ].map((item) => (
              <li key={item}>
                <span className="check-icon">
                  <Check size={16} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <button className="button full" onClick={onPilot}>
            Join the pilot
          </button>
          <p className="fine-print">
            Payments, SMS, and iPhone sync are still in development.
          </p>
        </div>
      </section>
      <section id="faq" className="faq container">
        <h2>A few good questions.</h2>
        {[
          [
            "Do clients need to download an app?",
            "No. The client booking portal opens in a browser.",
          ],
          [
            "Can I collect deposits today?",
            "Not yet. The current booking demo shows example deposit amounts without collecting payment details or charging anyone. Live Stripe deposits are still in development.",
          ],
          [
            "Is the iPhone app available yet?",
            "The native iPhone app is being built. This website previews the workflow; live iPhone sync and an App Store release are not available yet.",
          ],
        ].map(([question, answer], index) => (
          <details key={question} open={index === 0 ? true : undefined}>
            <summary>
              {question}
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <span className="footer-brand">GroomerGo</span>
            <p>Made for the person behind the clippers.</p>
          </div>
          <div className="footer-links">
            <button className="plain-button" onClick={onPrivacy}>
              Privacy
            </button>
            <a className="button outline" href="#/book">
              Try the demo
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
