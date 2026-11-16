import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { exchangeWebLogin } from "@/lib/dpop-session";

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
      setFailed(true);
      setMessage("Sign-in did not complete. Start again from the login page.");
      return;
    }

    let cancelled = false;
    void exchangeWebLogin(code, state)
      .then(() => {
        if (!cancelled) window.location.assign("/");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
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
