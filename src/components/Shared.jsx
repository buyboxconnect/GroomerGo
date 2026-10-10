import { useEffect, useRef } from "react";
import { ArrowRight, PawPrint, X, Scissors, Droplet } from "lucide-react";

export function Brand() {
  return (
    <a className="brand" href="#" aria-label="GroomerGo home">
      <PawPrint aria-hidden="true" />
      <span>GroomerGo</span>
    </a>
  );
}
export function Header({ home }) {
  return (
    <header className="site-header container">
      <Brand />
      {home ? (
        <>
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="button outline header-cta" href="#/dashboard">
            Explore demo
          </a>
        </>
      ) : (
        <a className="back-link" href="#">
          Back to website <ArrowRight size={18} aria-hidden="true" />
        </a>
      )}
    </header>
  );
}
export function ServiceIcon({ service, ...props }) {
  const Icon =
    service.icon === "scissors"
      ? Scissors
      : service.icon === "droplets"
        ? Droplet
        : PawPrint;
  return <Icon aria-hidden="true" strokeWidth={1.6} {...props} />;
}
export function Avatar({ name, index = 0 }) {
  return (
    <span className={`avatar tone-${index % 3}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const box = ref.current.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Notice({ children }) {
  return <div className="demo-notice">{children}</div>;
}
