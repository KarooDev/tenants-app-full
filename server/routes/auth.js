// server/routes/auth.js
import { Router } from "express";
import { verifyFirebaseIdToken } from "../lib/authFirebase.js";
import { getAll, findRowIndexBy, getRowObj, setRowObj, appendObj, ok, bad } from "../lib/rows.js";
import { today } from "../lib/util.js";

const r = Router();

// Health lives here (or keep yours in app.js; both OK)
r.get("/health", (req, res) => res.json({ service: "tenants-app", ts: Date.now() }));

/**
 * POST /auth/session
 * body: { idToken }
 * Verifies Firebase, looks up the linked Users row by firebase_uid.
 * Returns the minimal session object the frontend expects.
 */
r.post("/session", async (req, res) => {
  try {
    const idToken = req.body?.idToken;
    if (!idToken) return bad(res, "missing_id_token");

    const fb = await verifyFirebaseIdToken(idToken); // { uid, email, emailVerified, ... }

    // Find the user in Sheets by firebase_uid
    const users = await getAll("Users");
    const idx = users.findIndex(u => String(u.firebase_uid || "") === String(fb.uid));
    const user = idx >= 0 ? users[idx] : null;

    if (!user) {
      return ok(res, { user: null, firebase: fb, linked: false, status: "UNLINKED" });
    }

    // Optional housekeeping
    const row = await findRowIndexBy("Users", "ID", user.ID);
    if (row > 0) {
      user.last_login_at = today();
      await setRowObj("Users", /*row=*/ idx + 2, user);
    }

    // Build a compact session
    const session = {
      ID: user.ID,
      role: String(user.role || "").toUpperCase(),
      username: user.username || "",
      email: user.email || "",
      full_name: user.full_name || "",
      building_id: user.building_id || "",
      unit_id: user.unit_id || "",
      email_verified: String(user.email_verified || "FALSE") === "TRUE",
      invite_status: user.invite_status || "",
      status: user.status || "",
    };

    return ok(res, { user: session, linked: true, firebase: { uid: fb.uid, email: fb.email, emailVerified: fb.emailVerified } });
  } catch (e) {
    return bad(res, e.message || "session_failed");
  }
});

/**
 * POST /auth/link-user
 * body: { idToken, username?, invite_code?, full_name? }
 * Verifies Firebase, then links/creates a Users row (writes firebase_uid).
 * You can expand this later with invite validation rules.
 */
r.post("/link-user", async (req, res) => {
  try {
    const { idToken, username, invite_code, full_name } = req.body || {};
    if (!idToken) return bad(res, "missing_id_token");

    const fb = await verifyFirebaseIdToken(idToken);
    const fbEmail = String(fb.email || "").toLowerCase();

    const users = await getAll("Users");
    let rowIdx = -1;

    if (invite_code)
      rowIdx = await findRowIndexBy("Users", "invite_code", invite_code);
    if (rowIdx < 0 && fbEmail)
      rowIdx = await findRowIndexBy("Users", "email", fbEmail);
    if (rowIdx < 0 && username)
      rowIdx = await findRowIndexBy("Users", "username", username);

    if (rowIdx < 0) return bad(res, "no_linked_user");

    const rowObj = await getRowObj("Users", rowIdx);
    const now = today();

    if (rowObj.firebase_uid && rowObj.firebase_uid !== fb.uid)
      return bad(res, "user_already_linked");

    rowObj.firebase_uid = fb.uid;
    rowObj.email = fbEmail || rowObj.email || "";
    rowObj.full_name = full_name || rowObj.full_name || "";
    rowObj.username = username || rowObj.username || "";
    rowObj.invite_status = "REGISTERED";
    rowObj.registered_at = rowObj.registered_at || now;
    rowObj.status = rowObj.status || "ACTIVE";

    await setRowObj("Users", rowIdx + 2, rowObj); // ✅ correct offset

    return ok(res, { user: rowObj });
  } catch (e) {
    console.error("link-user failed:", e);
    return bad(res, e.message || "link_failed");
  }
});


export default r;
