// src/api/sheets.js
import { api } from "./client";
import { auth } from "../lib/firebase";

async function withToken(fn) {
  const fb = auth.currentUser;
  if (!fb) throw new Error("not_authenticated");
  const token = await fb.getIdToken(true);
  return fn(token);
}
export function listUnits(params) {
  const q = new URLSearchParams(params).toString();
  return api(`/units/list?${q}`, { method: 'GET' });
}

export function createInvite(payload) {
  return api('/invitations/create', { method: 'POST', body: JSON.stringify(payload) });
}
// NEXT STEPS: real endpoints once we add them in Apps Script
export const sheetsApi = {
  // listBuildings: (params) => withToken(idToken => api.listBuildings(idToken, params)),
};
