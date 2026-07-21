const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Thin fetch wrapper. No AWS SDK, no credentials — the browser only ever
 * talks to our own backend now.
 */
async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

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
};
