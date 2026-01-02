import { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import Button from "../UI/Button";
import { googleLogin } from "../../services/auth.service";

const GOOGLE_CLIENT_ID = "931297781110-pesce8f6hg2gdadrer9eef0vouj81sud.apps.googleusercontent.com";

export default function GoogleLoginButton({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize Google Sign-In
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
    }
  }, []);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setError(null);

    try {
      // Send token to backend
      const data = await googleLogin(response.credential);
      
      console.log("Login successful:", data);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || "Login failed");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (window.google) {
      // Render the Google Sign-In button
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large", text: "signin_with" }
      );
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {error && (
        <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded max-w-xs">
          ⚠️ {error}
        </div>
      )}
      
      <div id="google-signin-button"></div>
      
      <Button
        onClick={handleGoogleClick}
        loading={loading}
        className="gap-2"
      >
        <FcGoogle size={20} />
        {loading ? "Signing in..." : "Sign in with Google"}
      </Button>
    </div>
  );
}
