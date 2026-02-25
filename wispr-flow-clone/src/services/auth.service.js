const API_BASE = "https://wispr-flows-3adt.onrender.com/api";

export function isAuthenticated() {
  return !!localStorage.getItem("access_token");
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export async function getUserProfile() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.error("Failed to get user profile", res.status);
      return null;
    }
    
    return await res.json();
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

export async function googleLogin(googleToken) {
  // Send Google ID token to backend for verification and JWT generation
  try {
    console.log("[Auth] Attempting Google login...");
    console.log("[Auth] Backend URL:", API_BASE);
    
    const res = await fetch(`${API_BASE}/auth/google/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important for CORS with credentials
      body: JSON.stringify({
        token: googleToken,
      }),
    });

    console.log("[Auth] Google login response status:", res.status);
    console.log("[Auth] Response headers - Access-Control-Allow-Origin:", res.headers.get("Access-Control-Allow-Origin"));

    // Try to parse as JSON
    let data;
    try {
      data = await res.json();
    } catch (jsonError) {
      // If JSON parsing fails, the response is HTML (error page)
      const text = await res.text();
      console.error("[Auth] Backend returned non-JSON response:", text.substring(0, 500));
      
      if (res.status === 0 || res.type === 'opaque') {
        throw new Error("CORS error: Backend is blocking the request. Check that your origin is allowed and the backend is configured correctly.");
      }
      throw new Error("Backend server error. Check network tab for details.");
    }

    if (!res.ok) {
      console.error("[Auth] Login error:", data);
      throw new Error(data.error || data.detail || "Google login failed");
    }

    // Store tokens
    if (data.tokens) {
      localStorage.setItem("access_token", data.tokens.access);
      localStorage.setItem("refresh_token", data.tokens.refresh);
      console.log("[Auth] Login successful, tokens stored");
    } else {
      throw new Error("No tokens received from backend");
    }
    
    return data;
  } catch (err) {
    console.error("[Auth] Google login error:", err.message);
    throw err;
  }
}
