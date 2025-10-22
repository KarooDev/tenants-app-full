// src/api/users.js
import { api } from './client';

// adjust these to the routes you’ve implemented on the Node server
export const usersApi = {
  pending: ({ idToken } = {}) => api(`/users/pending?idToken=${encodeURIComponent(idToken || '')}`, { method: 'GET' }),
  verify: (idToken, userId) => api('/users/verify', { method: 'POST', body: JSON.stringify({ idToken, user_id: userId }) }),
};

export default usersApi;
