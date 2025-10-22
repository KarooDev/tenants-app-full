// server/routes/charges.js
import { Router } from 'express';
import { ok, bad, getAll } from '../lib/rows.js';

const r = Router();

r.get('/list', async (req, res) => {
  try {
    // TODO: add auth + filtering later; return an empty list for now
    return ok(res, { items: [] });
  } catch (e) { return bad(res, e.message); }
});

export default r;
