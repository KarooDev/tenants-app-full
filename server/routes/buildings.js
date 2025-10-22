// server/routes/buildings.js
import { Router } from 'express';
import { getAll, headers, findRowIndexBy, getRowObj, setRowObj, appendObj, ok, bad } from '../lib/rows.js';
import { newId, today } from '../lib/util.js';

const r = Router();

// GET /buildings/list?idToken=...
r.get('/list', async (req, res) => {
  try {
    // TODO: enforce auth/permissions using idToken if needed
    const rows = await getAll('Buildings');
    // normalize a bit for the UI
    const items = rows.map(b => ({
      ID: b.ID,
      name: b.name || b.Name || '',
      address: b.address || '',
      city: b.city || '',
      country: b.country || '',
      status: (b.status || 'ACTIVE').toUpperCase(),
      units: Number(b.units || 0) || 0,
      units_active: Number(b.units_active || 0) || 0,
      management_user_id: b.management_user_id || '',
    }));
    return ok(res, { items });
  } catch (e) { return bad(res, e.message); }
});

// POST /buildings/save  { idToken, building }
r.post('/save', async (req, res) => {
  try {
    const b = req.body?.building || {};
    const id = b.ID || newId('BLD');
    const now = today();

    // fetch headers to keep column order
    const hdr = await headers('Buildings');
    const asRow = (obj) => {
      const o = {};
      hdr.forEach(h => o[h] = obj[h] ?? obj[h.toLowerCase()] ?? '');
      return o;
    };

    const existingRow = await findRowIndexBy('Buildings', 'ID', id);
    const normalized = asRow({
      ID: id,
      name: b.name || '',
      address: b.address || '',
      city: b.city || '',
      country: b.country || '',
      status: (b.status || 'ACTIVE').toUpperCase(),
      management_user_id: b.management_user_id || '',
      updated_at: now,
      created_at: existingRow > 0 ? (b.created_at || '') : now,
    });

    if (existingRow > 0) {
      await setRowObj('Buildings', existingRow, normalized);
    } else {
      await appendObj('Buildings', normalized);
    }

    return ok(res, { item: normalized });
  } catch (e) { return bad(res, e.message); }
});

// POST /buildings/toggle { idToken, id }
r.post('/toggle', async (req, res) => {
  try {
    const id = req.body?.id;
    if (!id) return bad(res, 'missing_id');

    const row = await findRowIndexBy('Buildings', 'ID', id);
    if (row < 0) return bad(res, 'not_found');

    const obj = await getRowObj('Buildings', row);
    const next = (String(obj.status || 'ACTIVE').toUpperCase() === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
    obj.status = next;
    obj.updated_at = today();
    await setRowObj('Buildings', row, obj);

    return ok(res, { item: { ID: id, status: next } });
  } catch (e) { return bad(res, e.message); }
});

// POST /buildings/delete { idToken, id }
r.post('/delete', async (req, res) => {
  try {
    const id = req.body?.id;
    if (!id) return bad(res, 'missing_id');
    // Soft-delete by marking status, or implement a hard delete if you have a helper.
    const row = await findRowIndexBy('Buildings', 'ID', id);
    if (row < 0) return bad(res, 'not_found');
    const obj = await getRowObj('Buildings', row);
    obj.status = 'INACTIVE';
    obj.deleted_at = today();
    await setRowObj('Buildings', row, obj);
    return ok(res, { ok: true });
  } catch (e) { return bad(res, e.message); }
});

// POST /buildings/edit-blocks { idToken, building_id, upserts: [{ID?,name,floors}], deletes: [id] }
r.post('/edit-blocks', async (req, res) => {
  try {
    const { building_id, upserts = [], deletes = [] } = req.body || {};
    if (!building_id) return bad(res, 'missing_building_id');

    // naive implementation: upsert by ID or create; we won’t hard-delete here.
    const failed_deletes = [];
    for (const dId of deletes) {
      const row = await findRowIndexBy('Blocks', 'ID', dId);
      if (row > 0) {
        const obj = await getRowObj('Blocks', row);
        obj.deleted_at = today();
        await setRowObj('Blocks', row, obj);
      } else {
        failed_deletes.push({ id: dId });
      }
    }

    for (const blk of upserts) {
      const isUpdate = blk.ID;
      if (isUpdate) {
        const row = await findRowIndexBy('Blocks', 'ID', blk.ID);
        if (row > 0) {
          const obj = await getRowObj('Blocks', row);
          obj.name = blk.name || obj.name || '';
          obj.floors = blk.floors || obj.floors || '';
          obj.updated_at = today();
          await setRowObj('Blocks', row, obj);
          continue;
        }
      }
      // create
      const obj = {
        ID: newId('BLK'),
        building_id,
        name: blk.name || '',
        floors: blk.floors || '',
        created_at: today(),
        updated_at: today(),
      };
      await appendObj('Blocks', obj);
    }

    return ok(res, { ok: true, failed_deletes });
  } catch (e) { return bad(res, e.message); }
});

export default r;
