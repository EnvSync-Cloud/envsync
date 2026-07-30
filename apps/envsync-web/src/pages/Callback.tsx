import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Callback = () => {
  const [message, setMessage] = useState("Finishing sign-in...");
  const navigate = useNavigate();

  useEffect(() => {
    setMessage("Login successful. Redirecting...");
    const timer = window.setTimeout(() => navigate("/", { replace: true }), 150);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0f1a]">
      <div className="text-center space-y-4">
        <img
          src="/EnvSync.svg"
          alt="EnvSync"
          className="w-14 h-14 mx-auto animate-pulse"
        />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default Callback;
