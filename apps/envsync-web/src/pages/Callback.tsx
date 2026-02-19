import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Callback = () => {
  const [message, setMessage] = useState("Authenticating...");
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("access_token");

    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
      setMessage("Login successful! Redirecting...");
      navigate("/", { replace: true });
    } else {
      setMessage("Authentication failed. Redirecting...");
      setTimeout(() => navigate("/", { replace: true }), 2000);
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0f1a]">
      <div className="text-center space-y-4">
        <img
          src="/EnvSync.svg"
          alt="EnvSync"
          className="w-14 h-14 mx-auto animate-pulse"
        />
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  );
};

export default Callback;
