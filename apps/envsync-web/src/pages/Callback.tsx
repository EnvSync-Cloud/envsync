import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { exchangeWebLogin } from "@/lib/dpop-session";
import { readLoginMethod } from "@/lib/login-auth";
import { trackAction } from "@/telemetry";

function trackLoginFailed(reason: string) {
  trackAction("login_failed", {
    "envsync.event_name": "login_failed",
    "envsync.event_category": "auth",
    "envsync.surface": "web",
    "envsync.success": false,
    method: readLoginMethod(),
    reason,
  });
}

const Callback = () => {
  const [message, setMessage] = useState("Finishing sign-in...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const providerError = params.get("error");
    window.history.replaceState({}, "", "/auth/callback");

    if (providerError || !code || !state) {
      trackLoginFailed(providerError ? "provider_rejected" : "missing_callback");
      setFailed(true);
      setMessage("Sign-in did not complete. Start again from the login page.");
      return;
    }

    let cancelled = false;
    void exchangeWebLogin(code, state)
      .then(() => {
        if (cancelled) return;
        trackAction("login_completed", {
          "envsync.event_name": "login_completed",
          "envsync.event_category": "auth",
          "envsync.surface": "web",
          "envsync.success": true,
          method: readLoginMethod(),
        });
        window.location.assign("/");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        trackLoginFailed("exchange_failed");
        setFailed(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "Sign-in could not be completed.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0f1a]">
      <div className="text-center space-y-4">
        <img
          src="/EnvSync.svg"
          alt="EnvSync"
          className="w-14 h-14 mx-auto animate-pulse"
        />
        <p className="text-sm text-muted-foreground">{message}</p>
        {failed && (
          <Link
            to="/login"
            className="text-sm text-emerald-400 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        )}
      </div>
    </div>
  );
};

export default Callback;
