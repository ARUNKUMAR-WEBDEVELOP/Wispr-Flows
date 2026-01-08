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
    const res = await fetch(`${API_BASE}/auth/google/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: googleToken,
      }),
    });

    // Try to parse as JSON
    let data;
    try {
      data = await res.json();
    } catch (jsonError) {
      // If JSON parsing fails, the response is HTML (error page)
      const text = await res.text();
      console.error("Backend returned non-JSON response:", text);
      throw new Error("Backend server error. Check console for details.");
    }

    if (!res.ok) {
      throw new Error(data.error || "Google login failed");
    }

    // Store tokens
    if (data.tokens) {
      localStorage.setItem("access_token", data.tokens.access);
      localStorage.setItem("refresh_token", data.tokens.refresh);
    }
    
    return data;
  } catch (err) {
    console.error("Google login error:", err);
    throw err;
  }
}
