// server/routes/cash.js
import { Router } from 'express';
import { getAll, findRowIndexBy, getRowObj, setRowObj, appendObj, ok, bad } from '../lib/rows.js';
import { newId, today } from '../lib/util.js';

const r = Router();

function role(u){ return String(u.role||'').toUpperCase(); }

async function canReadBuilding(u, building_id){
  const R = role(u);
  if (R === 'ADMIN') return true;
  if (R === 'BUILDING_MGMT' || R === 'STAFF'){
    const bRow = await findRowIndexBy('Buildings','ID', building_id, false);
    if (bRow < 0) return false;
    const b = await getRowObj('Buildings', bRow);
    return (String(b.management_user_id)===String(u.ID)) ||
           (u.building_id && String(u.building_id)===String(building_id));
  }
  if (R === 'TENANT' || R === 'OWNER') return String(u.building_id||'')===String(building_id);
  return false;
}

async function ensureDrawer(building_id, currency='USD'){
  const drawers = await getAll('CashDrawers');
  let d = drawers.find(x => String(x.building_id)===String(building_id));
  if (d) return d;
  const now = today();
  d = { ID: newId('CDR'), building_id, currency, opening_balance: '0', balance: '0', created_at: now, updated_at: now };
  await appendObj('CashDrawers', d);
  return d;
}

// GET /cash/drawer_sheet?idToken=...&building_id=...
r.get('/drawer_sheet', async (req, res) => {
  try {
    const idToken = String(req.query.idToken||'');
    const building_id = String(req.query.building_id||'');
    if (!idToken || !building_id) return bad(res, 'missing_params');

    // TEMP caller resolution (replace with Firebase verify)
    const users = await getAll('Users');
    const caller = users.find(u => u.firebase_uid===idToken) || null;
    if (!caller) return bad(res, 'unauthorized');
    if (!(await canReadBuilding(caller, building_id))) return bad(res, 'forbidden');

    const d = await ensureDrawer(building_id, 'USD');
    return ok(res, { drawer: { balance: Number(d.balance||0), currency: d.currency||'USD' } });
  } catch (e) { return bad(res, e.message); }
});

// GET /cash/ledger_peek
r.get('/ledger_peek', async (req, res) => {
  try { return ok(res, { peek: null }); }
  catch (e) { return bad(res, e.message); }
});

// GET /cash/ledger
r.get('/ledger', async (req, res) => {
  try { return ok(res, { items: [], next_cursor: null }); }
  catch (e) { return bad(res, e.message); }
});

export default r;
