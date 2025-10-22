// server/routes/units.js
import { Router } from 'express';
import { getAll, findRowIndexBy, getRowObj, setRowObj, appendObj, ok, bad } from '../lib/rows.js';
import { newId, today } from '../lib/util.js';

const r = Router();

/** GET /units/list?idToken=&building_id=&limit= */
r.get('/list', async (req, res) => {
  try {
    const { building_id = '', limit = 1000 } = req.query || {};
    const rows = await getAll('Units');
    const filtered = String(building_id)
      ? rows.filter(u => String(u.building_id || '') === String(building_id))
      : rows;

    const items = filtered.slice(0, Number(limit) || 1000).map(u => ({
      ID: u.ID,
      building_id: u.building_id || '',
      unit_code: u.unit_code || '',
      block_name: u.block_name || '',
      status: (u.status || 'AVAILABLE').toUpperCase(),
    }));

    return ok(res, { items });
  } catch (e) { return bad(res, e.message); }
});

/** POST /units/save { idToken, building_id, unit } */
r.post('/save', async (req, res) => {
  try {
    const { building_id, unit = {} } = req.body || {};
    if (!building_id) return bad(res, 'missing_building_id');

    const id = unit.ID || newId('UNT');
    const row = await findRowIndexBy('Units', 'ID', id);
    const obj = {
      ID: id,
      building_id,
      unit_code: unit.unit_code || '',
      block_name: unit.block_name || '',
      status: (unit.status || 'AVAILABLE').toUpperCase(),
      updated_at: today(),
    };
    if (row > 0) {
      const prev = await getRowObj('Units', row);
      await setRowObj('Units', row, { ...prev, ...obj });
    } else {
      await appendObj('Units', { ...obj, created_at: today() });
    }
    return ok(res, { item: obj });
  } catch (e) { return bad(res, e.message); }
});

/** POST /units/batch-save { idToken, building_id, units: [{unit_code, block_name, status}] } */
r.post('/batch-save', async (req, res) => {
  try {
    const { building_id, units = [] } = req.body || {};
    if (!building_id) return bad(res, 'missing_building_id');
    if (!Array.isArray(units) || units.length === 0) return ok(res, { created_units: 0 });

    let created = 0;
    for (const u of units) {
      const obj = {
        ID: newId('UNT'),
        building_id,
        unit_code: String(u.unit_code || ''),
        block_name: String(u.block_name || ''),
        status: String(u.status || 'AVAILABLE').toUpperCase(),
        created_at: today(),
        updated_at: today(),
      };
      await appendObj('Units', obj);
      created++;
    }
    return ok(res, { created_units: created });
  } catch (e) { return bad(res, e.message); }
});

/** (optional) POST /units/toggle { idToken, id } */
r.post('/toggle', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return bad(res, 'missing_id');
    const row = await findRowIndexBy('Units', 'ID', id);
    if (row < 0) return bad(res, 'not_found');
    const obj = await getRowObj('Units', row);
    const next = String(obj.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
    obj.status = next;
    obj.updated_at = today();
    await setRowObj('Units', row, obj);
    return ok(res, { item: { ID: id, status: next } });
  } catch (e) { return bad(res, e.message); }
});

/** (optional) POST /units/delete { idToken, id } - soft delete */
r.post('/delete', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return bad(res, 'missing_id');
    const row = await findRowIndexBy('Units', 'ID', id);
    if (row < 0) return bad(res, 'not_found');
    const obj = await getRowObj('Units', row);
    obj.deleted_at = today();
    await setRowObj('Units', row, obj);
    return ok(res, { ok: true });
  } catch (e) { return bad(res, e.message); }
});

export default r;
