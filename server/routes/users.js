// server/routes/users.js
import { Router } from 'express';
import { getAll, ok, bad } from '../lib/rows.js';

const r = Router();

// GET /users/email-availability?email=
r.get('/email-availability', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return bad(res, 'missing_email');

    // Look in Users (and optionally Invitations if you want)
    const users = await getAll('Users');
    const exists = users.some(u => String(u.email || '').trim().toLowerCase() === email);

    return ok(res, { exists });
  } catch (e) { return bad(res, e.message || 'check_failed'); }
});

export default r;
