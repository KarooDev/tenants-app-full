// src/api/charges.js
import { api } from './client';

export const charges = {
  list({ idToken, building_id, status, due_from, due_to }) {
    const p = new URLSearchParams();
    if (idToken)     p.set('idToken', idToken);
    if (building_id) p.set('building_id', building_id);
    if (status)      p.set('status', status);
    if (due_from)    p.set('due_from', due_from);
    if (due_to)      p.set('due_to', due_to);
    return api(`/charges/list?${p.toString()}`, { method: 'GET' });
  },

  save({ idToken, charge }) {
    return api('/charges/save', {
      method: 'POST',
      body: JSON.stringify({ idToken, charge }),
    });
  },

  batchSave({ idToken, charges }) {
    return api('/charges/batch-save', {
      method: 'POST',
      body: JSON.stringify({ idToken, charges }),
    });
  },

  cancel({ idToken, id }) {
    return api('/charges/cancel', {
      method: 'POST',
      body: JSON.stringify({ idToken, id }),
    });
  },

  createBlock({ idToken, building_id, block_id, title, total_amount, currency, due_date, notes, exclude_unit_ids, invoice_image_url }) {
    return api('/charges/create-block', {
      method: 'POST',
      body: JSON.stringify({
        idToken, building_id, block_id, title, total_amount, currency, due_date, notes, exclude_unit_ids, invoice_image_url,
      }),
    });
  },
};

export default charges;
