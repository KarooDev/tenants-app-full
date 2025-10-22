// src/api/cash.js
import { getBase } from "./core";

/* ------------------- tiny fetch helper ------------------- */
async function httpJson(url, init) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) throw new Error(String(j?.error || "request_failed"));
  return j;
}
const pick = (obj, ...keys) => keys.find((k) => obj && obj[k] != null);

/* ------------------- Normalize helpers ------------------- */
function normalizeDrawer(j) {
  const drawer = j.drawer || j.data?.drawer || (typeof j.data === "object" ? j.data : null) || null;
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  if (drawer && (drawer.balance != null || drawer.currency != null)) {
    return {
      balance: toNum(drawer.balance ?? drawer.current_balance ?? drawer.balance_after),
      currency: drawer.currency ?? drawer.curr ?? "USD",
    };
  }
  const balanceKey = pick(j, "balance", "current_balance", "balance_after");
  const currencyKey = pick(j, "currency", "curr");
  return {
    balance: toNum(balanceKey != null ? j[balanceKey] : 0),
    currency: currencyKey != null ? j[currencyKey] : "USD",
  };
}

function normalizeLedgerRow(r = {}) {
  const id =
    r.ID ??
    r.id ??
    r.entry_id ??
    `${String(r.entry_type || r.type || "row")}-${String(r.entry_date || r.date || r.created_at || Date.now())}`;

  const entry_date = r.entry_date ?? r.date ?? r.created_at ?? r.posted_at ?? "";
  const entry_type = r.entry_type ?? r.type ?? r.kind ?? "";
  const category = r.category ?? r.cat ?? "";
  const note = r.note ?? r.notes ?? r.comment ?? "";
  const amount = r.amount ?? r.delta ?? r.value ?? 0;
  const balance_after = r.balance_after ?? r.balance ?? r.current_balance ?? r.running_balance ?? null;

  return { ID: id, entry_date, entry_type, category, note, amount, balance_after };
}

/* ------------------- Drawer meta (primary API) ------------------- */
export async function fetchCashDrawer({ idToken, building_id }) {
  const j = await httpJson(`${getBase()}/cash/drawer_sheet?` +
  new URLSearchParams({ idToken, building_id }).toString(), { method: "GET" });
  return normalizeDrawer(j);
}

/* ------------------- Drawer meta (SHEET first-choice) ------------------- */
export async function fetchCashDrawerFromSheet({ idToken, building_id }) {
   const j = await httpJson(`${getBase()}/cash/drawer_sheet?` +
     new URLSearchParams({ idToken, building_id }).toString(), { method: "GET" });
  return normalizeDrawer(j);
}

/* ------------------- Drawer meta (peek latest ledger) ------------------- */
export async function fetchDrawerFromLedgerPeek({ idToken, building_id }) {
  const j = await httpJson(`${getBase()}/cash/ledger_peek?` +
  new URLSearchParams({ idToken, building_id }).toString(), { method: "GET" });

  const raw = j.data ?? j.peek ?? j.row ?? j;
  const balance = raw?.balance_after ?? raw?.current_balance ?? raw?.balance ?? null;
  const currency = raw?.currency ?? raw?.curr ?? "USD";
  if (balance == null) return null;
  return { balance, currency };
}

/* ------------------- Ledger list ------------------- */
export async function fetchCashLedger({ idToken, building_id, date_from = "", date_to = "", limit = 50, cursor = "" }) {
  const params = new URLSearchParams({ idToken, building_id });
  if (date_from) params.set("date_from", date_from);
  if (date_to) params.set("date_to", date_to);
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const j = await httpJson(`${getBase()}/cash/ledger?${params.toString()}`, { method: "GET" });

  const raw =
    j.items || j.entries || j.ledger || j.rows ||
    j.data?.items || j.data?.entries || j.data?.ledger || j.data?.rows || [];
  const next = j.next_cursor ?? j.cursor ?? j.data?.next_cursor ?? j.data?.cursor ?? null;

  const items = Array.isArray(raw) ? raw.map(normalizeLedgerRow) : [];
  return { items, next_cursor: next || null };
}

/* ------------------- Mutations ------------------- */
async function postCash(path, payload) {
  const url = `${getBase()}/cash/${path}`;
  const r = await httpJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // avoids preflight for Apps Script
    body: JSON.stringify(payload || {})
  });
  return r;
}

export async function collectCash({ idToken, building_id, amount, entry_date, note }) {
  return postCash("collect", { idToken, building_id, amount: Number(amount || 0), entry_date, note });
}
export async function spendCash({ idToken, building_id, amount, entry_date, category, note }) {
  return postCash("spend", { idToken, building_id, amount: Number(amount || 0), entry_date, category, note });
}
export async function adjustCash({ idToken, building_id, amount, entry_date, note }) {
  return postCash("adjust", { idToken, building_id, amount: Number(amount || 0), entry_date, note });
}

/* default bundle (optional) */
const cashApi = {
  fetchCashDrawer,
  fetchCashDrawerFromSheet,
  fetchDrawerFromLedgerPeek,
  fetchCashLedger,
  collectCash,
  spendCash,
  adjustCash,
};
export default cashApi;
