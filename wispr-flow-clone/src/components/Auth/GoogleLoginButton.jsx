import { useState, useEffect, useRef } from "react";
import { FcGoogle } from "react-icons/fc";
import Button from "../UI/Button";
import { googleLogin } from "../../services/auth.service";
import { Loader, CheckCircle, AlertCircle } from "lucide-react";

const GOOGLE_CLIENT_ID = "987489441994-teokvsru5bvq88tut2j18fidjohikub5.apps.googleusercontent.com";

export default function GoogleLoginButton({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const hasRenderedRef = useRef(false);

  useEffect(() => {
    let attempts = 0;
    const initGoogle = () => {
      if (!window.google) return false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      if (!hasRenderedRef.current && googleButtonRef.current) {
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
        });
        hasRenderedRef.current = true;
      }

      setGoogleReady(true);
      return true;
    };

    if (initGoogle()) return;

    const timer = setInterval(() => {
      attempts += 1;
      if (initGoogle() || attempts > 20) {
        clearInterval(timer);
        if (attempts > 20) {
          setError("Google SDK failed to load. Check your network or ad blocker.");
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, []);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setError(null);

    try {
      // Send token to backend
      const data = await googleLogin(response.credential);
      
      console.log("Login successful:", data);
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(data);
      }, 800);
    } catch (err) {
      setError(err.message || "Login failed");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (!window.google || !googleReady) {
      setError("Google SDK not ready yet. Please try again.");
      return;
    }

    const button = googleButtonRef.current?.querySelector("div[role='button'], button");
    if (button) {
      button.click();
      return;
    }

    window.google.accounts.id.prompt();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      {error && (
        <div className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center backdrop-blur-sm animate-shake">
          <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
            <AlertCircle size={20} />
            <span className="font-semibold text-sm">Login Failed</span>
          </div>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="w-full p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center backdrop-blur-sm animate-bounce-once">
          <div className="flex items-center justify-center gap-2 text-green-400">
            <CheckCircle size={20} />
            <span className="font-semibold text-sm">Login Successful!</span>
          </div>
        </div>
      )}
      
      <div
        ref={googleButtonRef}
        className="absolute left-[-9999px] top-[-9999px] opacity-0"
        aria-hidden="true"
      ></div>
      
      <Button
        onClick={handleGoogleClick}
        loading={loading}
        className="gap-3 w-full"
        variant="google"
      >
        {loading ? (
          <>
            <Loader size={20} className="animate-spin" />
            <span>Signing in...</span>
          </>
        ) : success ? (
          <>
            <CheckCircle size={20} />
            <span>Signed in!</span>
          </>
        ) : (
          <>
            <FcGoogle size={24} />
            <span>Sign in with Google</span>
          </>
        )}
      </Button>
    </div>
  );
}
