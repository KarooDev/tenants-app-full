// src/api/index.js
import { getJSON, postJSON } from "./core";
import * as Charges from "./charges"; // ok to import helpers

// Generic wrappers
async function get(path, params) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return getJSON(p, params);
}
async function post(path, body) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return postJSON(p, body);
}

const api = {
  get,
  post,

  // Auth / health
  health: () => get("/auth/health"),
  session: ({ idToken }) => post("/auth/session", { idToken }),
  linkUser: ({ idToken, username, invite_code, full_name }) =>
    post("/auth/link-user", { idToken, username, invite_code, full_name }),

  // Invitations
  invitations: {
    create: (payload) => post("/invitations/create", payload),
    list:   (params)  => get("/invitations/list", params),
    revoke: (payload) => post("/invitations/revoke", payload),
    lookup: (payload) => post("/invitations/lookup", payload),
  },

  // Units
  units: {
    list:      (params)  => get("/units/list", params),
    save:      (payload) => post("/units/save", payload),
    toggle:    (payload) => post("/units/toggle", payload),
    remove:    (payload) => post("/units/delete", payload),
    batchSave: (payload) => post("/units/batch-save", payload),
  },

  // Cash — REST endpoints on your Node server
  cash: {
    drawerSheet: (params)  => get("/cash/drawer_sheet", params),
    ledgerPeek:  (params)  => get("/cash/ledger_peek", params),
    ledger:      (params)  => get("/cash/ledger", params),
    collect:     (payload) => post("/cash/collect", payload),
    spend:       (payload) => post("/cash/spend", payload),
    adjust:      (payload) => post("/cash/adjust", payload),
  },

  buildings: { list:      (params)  => get("/buildings/list", params),
    save:      (payload) => post("/buildings/save", payload),           
    toggle:    (payload) => post("/buildings/toggle", payload),         
    remove:    (payload) => post("/buildings/delete", payload),         
    editBlocks:(payload) => post("/buildings/edit-blocks", payload),},
    
  issues:    { list: (params) => get("/issues/list", params) },
  ratings:   { list: (params) => get("/ratings/list", params) },

  // Wire charges helpers here so warmCache can call api.charges.list
  charges:   { list: (params) => Charges.charges.list(params) },
  users: {
    emailAvailability: (params) => get('/users/email-availability', params),
  },
};

export default api;
export { get, post, api };
