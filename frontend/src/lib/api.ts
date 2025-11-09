const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshToken(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  
  // Store original body for retry
  const originalBody = options.body;
  
  // First attempt
  let headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  let res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    body: options.body,
    headers,
    cache: "no-store",
  });

  // If unauthorized, try refreshing token
  if (res.status === 401 && typeof window !== "undefined") {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry with new token
      headers = {
        ...getAuthHeader(),
        ...(options.headers as Record<string, string> | undefined),
      };
      if (!isFormData) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method,
        body: originalBody, // Use original body
        headers,
        cache: "no-store",
      });
    } else {
      // Refresh failed, redirect to login
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please login again.");
    }
  }

  // Handle 204 No Content or empty responses safely
  if (res.status === 204) return undefined as unknown as T;
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw || `Request failed with ${res.status}`);
  }
  if (!raw) return undefined as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Fallback if server returned non-JSON payload
    return raw as unknown as T;
  }
}


