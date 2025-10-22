// src/api/payments.js
import { api } from './client';

export const payments = {
  record({ idToken, payment }) {
    return api('/payments/record', {
      method: 'POST',
      body: JSON.stringify({ idToken, payment }),
    });
  },
};

export default payments;
