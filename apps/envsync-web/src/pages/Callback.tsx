import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Callback = () => {
    const [message, setMessage] = useState("Redirecting...");
    const navigate = useNavigate();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get("access_token");

        if (accessToken) {
            localStorage.setItem("access_token", accessToken);
            setMessage("Login successful! Redirecting...");
            navigate("/", { replace: true });
        } else {
            setMessage("No access token found. Redirecting to home page...");
            navigate("/", { replace: true });
        }
    }, [navigate]);
    
    return (
        <div className="flex items-center justify-center h-screen text-white">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Callback Page</h1>
                <p>{message}</p>
            </div>
        </div>
    );
}

export default Callback;
