const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_STORAGE_KEY = "shams-elgroub-auth-token";
const USERNAME_STORAGE_KEY = "shams-elgroub-auth-username";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUsername() {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

export function setStoredAuth(token, username) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USERNAME_STORAGE_KEY, username ?? "");
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USERNAME_STORAGE_KEY);
  }
}

/**
 * Thin fetch wrapper. No AWS SDK, no credentials — the browser only ever
 * talks to our own backend now. Every request carries the auth token
 * (except login itself, which doesn't have one yet); a 401 means the
 * token is missing/expired, so it's cleared and the app is told to show
 * the login screen again instead of silently failing every request.
 */
async function request(path, options = {}) {
  const token = getStoredToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (response.status === 401) {
    setStoredAuth(null);
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Session expired — please log in again.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request to ${path} failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const apiClient = {
  get: (path) => request(path),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};
