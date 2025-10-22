import express from 'express';
import { ok, bad } from '../lib/http.js';
import { getCaller } from '../lib/firebase.js';
import { getAll, findRowIndexBy, getRowObj, setRowObj, appendObj } from '../lib/rows.js';
import { newId, today, addDays, generateInviteCode } from '../lib/util.js';
import { APP_ORIGIN, INVITES_ONLY } from '../lib/config.js';

const router = express.Router();

function role(u){ return String(u.role||'').toUpperCase(); }
function isAdmin(u){ return role(u)==='ADMIN'; }
function isMgmt(u){ const r = role(u); return r==='BUILDING_MGMT' || r==='STAFF'; }

async function isUnitInactive(unit_id){
  const idx = await findRowIndexBy('Units','ID', unit_id, false);
  if (idx < 0) return false;
  const u = await getRowObj('Units', idx);
  return String(u.status||'').toUpperCase() === 'INACTIVE';
}
async function hasActiveOccupant(unit_id, R){
  const users = await getAll('Users');
  const taken = users.find(u =>
    String(u.unit_id) === String(unit_id) &&
    String(u.role||'').toUpperCase() === R &&
    String(u.status||'').toUpperCase() === 'ACTIVE' &&
    String(u.invite_status||'').toUpperCase() === 'REGISTERED'
  );
  if (taken) return true;

  const idx = await findRowIndexBy('Units','ID', unit_id, false);
  if (idx > 0) {
    const rec = await getRowObj('Units', idx);
    const field = (R==='TENANT') ? 'current_tenant_user_id' : (R==='OWNER') ? 'current_owner_user_id' : null;
    if (field && String(rec[field]||'')) return true;
  }

  const occ = await getAll('Occupancies');
  const hasActive = occ.find(o =>
    String(o.unit_id) === String(unit_id) &&
    String(o.role||'').toUpperCase() === R &&
    String(o.is_active||'').toUpperCase() === 'TRUE'
  );
  return !!hasActive;
}
async function hasActiveInvite(unit_id, R){
  const invs = await getAll('Invitations');
  const todayStr = today();
  return invs.some(i => {
    if (String(i.unit_id) !== String(unit_id)) return false;
    if (String(i.role||'').toUpperCase() !== R) return false;
    if (String(i.invite_status||'').toUpperCase() !== 'INVITED') return false;
    if (!i.expires_at) return true;
    return new Date(todayStr) <= new Date(i.expires_at);
  });
}

// POST /invitations/create
router.post('/create', async (req, res) => {
  try {
    const body = req.body || {};
    const { idToken, role: roleIn, email, username, building_id, unit_id, expires_in_days } = body;
    if (!idToken || !roleIn || !username) return bad(res, 'missing_params');

    const caller = await getCaller(idToken);
    const R = String(roleIn).toUpperCase();
    const ROLES = ['ADMIN','STAFF','BUILDING_MGMT','TENANT','OWNER'];
    if (!ROLES.includes(R)) return bad(res, 'invalid_role');
    if (isMgmt(caller) && !(R==='TENANT' || R==='OWNER')) return bad(res, 'forbidden');
    if (!(isAdmin(caller) || isMgmt(caller))) return bad(res, 'forbidden');

    // building + unit checks (when inviting TENANT/OWNER)
    if (R==='TENANT' || R==='OWNER') {
      if (!building_id || !unit_id) return bad(res,'building_and_unit_required');

      const bRow = await findRowIndexBy('Buildings','ID', building_id, false);
      if (bRow < 0) return bad(res,'building_not_found');
      const bObj = await getRowObj('Buildings', bRow);

      if (isMgmt(caller)) {
        const myBid = String(caller.building_id || '');
        if (myBid && String(building_id) !== myBid) return bad(res,'out_of_scope_building');
        if (String(bObj.management_user_id) !== String(caller.ID)) return bad(res,'out_of_scope_building');
      }

      const uRow = await findRowIndexBy('Units','ID', unit_id, false);
      if (uRow < 0) return bad(res,'unit_not_found');
      const uObj = await getRowObj('Units', uRow);
      if (String(uObj.building_id) !== String(building_id)) return bad(res,'unit_not_in_building');

      if (await isUnitInactive(unit_id)) return bad(res,'unit_inactive');
      if (await hasActiveOccupant(unit_id, R)) return bad(res,'unit_already_assigned');
      if (await hasActiveInvite(unit_id, R)) return bad(res,'unit_already_has_invite');
    }

    // generate unique code
    const users = await getAll('Users');
    const invs = await getAll('Invitations');
    let code;
    for (let i=0;i<5;i++) {
      code = generateInviteCode();
      const usedInv = invs.some(x => String(x.invite_code||'').toLowerCase() === code.toLowerCase());
      const usedUsers = users.some(x => String(x.invite_code||'').toLowerCase() === code.toLowerCase());
      if (!usedInv && !usedUsers) break;
    }

    // seed/update matching user
    let existingRow = -1;
    if (email) existingRow = await findRowIndexBy('Users','email', email, true);
    if (existingRow < 0) existingRow = await findRowIndexBy('Users','username', username, true);

    if (existingRow > 0) {
      const existing = await getRowObj('Users', existingRow);
      if (String(existing.invite_status||'').toUpperCase()==='REGISTERED') {
        return bad(res,'user_already_registered');
      }
    }

    const now = today();
    const createdAt = existingRow > 0
      ? (await getRowObj('Users', existingRow)).created_at || now
      : now;

    const baseUser = {
      ID: existingRow > 0 ? (await getRowObj('Users', existingRow)).ID : newId('USR'),
      firebase_uid: '',
      role: R,
      full_name: '',
      email: email || '',
      username,
      email_verified: 'FALSE',
      phone: '',
      building_id: building_id || (isMgmt(caller) ? caller.building_id : ''),
      unit_id: unit_id || '',
      status: 'ACTIVE',
      invite_status: 'INVITED',
      invite_code: code,
      invited_by_user_id: caller.ID,
      invited_at: now,
      registered_at: '',
      last_login_at: '',
      created_at: createdAt,
    };

    if (existingRow > 0) await setRowObj('Users', existingRow, baseUser);
    else await appendObj('Users', baseUser);

    const inv = {
      ID: newId('INV'),
      email: email || '',
      username,
      role: R,
      building_id: baseUser.building_id || '',
      unit_id: baseUser.unit_id || '',
      invite_code: code,
      invite_status: 'INVITED',
      expires_at: addDays(Number(expires_in_days || 7)),
      sent_at: now,
      used_at: '',
      created_by_user_id: caller.ID,
      notes: '',
    };
    await appendObj('Invitations', inv);

    const signup_url = `${APP_ORIGIN}/sign-up?invite=${encodeURIComponent(code)}`;
    return ok(res, { invite: inv, signup_path: `/sign-up?invite=${encodeURIComponent(code)}`, signup_url });
  } catch (e) {
    return bad(res, e.message || 'server_error');
  }
});

// POST /invitations/revoke
router.post('/revoke', async (req, res) => {
  try {
    const { idToken, invite_code } = req.body || {};
    if (!idToken || !invite_code) return bad(res,'missing_params');

    const caller = await getCaller(idToken);
    const invRow = await findRowIndexBy('Invitations','invite_code', invite_code, true);
    if (invRow < 0) return bad(res,'invite_not_found');
    const inv = await getRowObj('Invitations', invRow);

    if (isMgmt(caller)) {
      const myBid = String(caller.building_id || '');
      const r = String(inv.role||'').toUpperCase();
      if (!(r==='TENANT' || r==='OWNER')) return bad(res,'forbidden');
      if (myBid && String(inv.building_id)!==myBid) return bad(res,'out_of_scope_building');
    }

    inv.invite_status = 'CANCELLED';
    await setRowObj('Invitations', invRow, inv);

    const uRow = await findRowIndexBy('Users','invite_code', invite_code, true);
    if (uRow > 0) {
      const u = await getRowObj('Users', uRow);
      if (String(u.invite_status||'').toUpperCase()==='INVITED') {
        u.invite_code = '';
        await setRowObj('Users', uRow, u);
      }
    }
    return ok(res,{ invite: inv });
  } catch (e) {
    return bad(res, e.message || 'server_error');
  }
});

// POST /invitations/lookup
router.post('/lookup', async (req, res) => {
  try {
    const code = String(req.body?.invite_code || '').trim();
    if (!code) return bad(res,'missing_code');

    const invs = await getAll('Invitations');
    const inv = invs.find(i => String(i.invite_code||'').toLowerCase() === code.toLowerCase());
    if (!inv) return bad(res,'invite_not_found');

    const st = String(inv.invite_status||'').toUpperCase();
    if (st==='CANCELLED' || st==='USED') return bad(res,'invite_inactive');

    if (inv.expires_at) {
      if (new Date(today()) > new Date(inv.expires_at)) return bad(res,'invite_expired');
    }

    const users = await getAll('Users');
    let seeded = users.find(u => String(u.invite_code||'').toLowerCase() === code.toLowerCase());
    if (!seeded && inv.email) seeded = users.find(u => String(u.email||'').toLowerCase() === String(inv.email).toLowerCase());
    if (!seeded && inv.username) seeded = users.find(u => String(u.username||'').toLowerCase() === String(inv.username).toLowerCase());

    const signup_url = `${APP_ORIGIN}/sign-up?invite=${encodeURIComponent(code)}`;
    return ok(res, {
      invite: {
        ID: inv.ID, invite_code: inv.invite_code, role: inv.role,
        building_id: inv.building_id, unit_id: inv.unit_id,
        invite_status: inv.invite_status, expires_at: inv.expires_at,
        signup_url
      },
      seeded_user: seeded ? {
        full_name: seeded.full_name || '',
        email: seeded.email || '',
        username: seeded.username || ''
      } : null
    });
  } catch (e) {
    return bad(res, e.message || 'server_error');
  }
});

// GET /invitations/list
router.get('/list', async (req, res) => {
  try {
    const idToken = String(req.query.idToken || '');
    const caller = await getCaller(idToken);
    const admin = isAdmin(caller);

    const invs = await getAll('Invitations');
    const out = invs
      .map(o => ({ ...o, signup_url: `${APP_ORIGIN}/sign-up?invite=${encodeURIComponent(o.invite_code)}` }))
      .filter(o => (admin ? true : (String(o.created_by_user_id) === String(caller.ID))));

    return ok(res,{ items: out });
  } catch (e) {
    return bad(res, e.message || 'server_error');
  }
});

export default router;
