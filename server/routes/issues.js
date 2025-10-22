import { Router } from 'express';
import { getCaller } from '../lib/firebase.js';
import { getAll, ok, bad } from '../lib/rows.js';

const r = Router();

function role(u) { return String(u.role || '').toUpperCase(); }
function isAdmin(u) { return role(u) === 'ADMIN'; }
function isMgmt(u) { const R = role(u); return R === 'BUILDING_MGMT' || R === 'STAFF'; }

r.get('/list', async (req, res) => {
  try {
    const idToken = String(req.query.idToken || '');
    if (!idToken) return bad(res, 'missing_id_token');

    const caller = await getCaller(idToken);
    const issues = await getAll('Issues'); // expects an "Issues" sheet

    let items = issues;
    if (isAdmin(caller)) {
      // all issues
    } else if (isMgmt(caller)) {
      // mgmt can see issues in their building
      items = items.filter(i => String(i.building_id) === String(caller.building_id || ''));
    } else {
      // tenants/owners: issues for their building, or only their unit if your sheet has unit_id
      items = items.filter(i =>
        String(i.building_id) === String(caller.building_id || '') &&
        (!i.unit_id || String(i.unit_id) === String(caller.unit_id || ''))
      );
    }

    return ok(res, { items });
  } catch (e) {
    return bad(res, e.message || 'server_error');
  }
});

export default r;
