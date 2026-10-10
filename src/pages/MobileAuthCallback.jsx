import React, { useEffect, useState } from "react";
import { getAccessToken } from "@base44/sdk";

const CALLBACK_SCHEME = "groomergo";

export default function MobileAuthCallback() {
  const [message, setMessage] = useState("Finishing secure sign in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state") || "";
    const token = getAccessToken();

    if (!token) {
      const returnTo = window.location.pathname + window.location.search;
      window.location.replace("/login?returnTo=" + encodeURIComponent(returnTo));
      return;
    }

    if (!state) {
      setMessage("This sign-in request is missing its security state. Return to GroomerGo and try again.");
      return;
    }

    const callback = new URL(CALLBACK_SCHEME + "://auth");
    callback.searchParams.set("token", token);
    callback.searchParams.set("state", state);
    window.location.replace(callback.toString());
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-amber-50 px-6">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-teal-800">GroomerGo</h1>
        <p className="mt-3 text-slate-600">{message}</p>
      </div>
    </main>
  );
}
