// src/api/core.js
export const API_BASE = 'https://tenants-api.onrender.com';



// Build a URL like http://localhost:8080/<path>?<qs>
function buildUrl(path, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const qs = q.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

export async function getJSON(path, params) {
  const res = await fetch(buildUrl(path, params), { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `GET ${path} failed (${res.status})`);
  }
  return data;
}

export async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `POST ${path} failed (${res.status})`);
  }
  return data;
}

// Backwards-compatible aliases some files expect
export const getBase = () => API_BASE;
export const BASE = API_BASE;
