export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

// ✅ compatibility shim for older imports
export function getBase() {
  return API_BASE;
}

function buildUrl(path, params) {
  const url = new URL(path.startsWith('http') ? path : API_BASE + path);
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

export async function getJSON(path, params) {
  const url = buildUrl(path, params);
  const r = await fetch(url, { method: 'GET', credentials: 'include' });
  const j = await r.json().catch(() => ({}));
  return j;
}

export async function postJSON(path, body) {
  const url = buildUrl(path);
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  return j;
}
