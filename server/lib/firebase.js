import { verifyFirebaseIdToken } from './authFirebase.js';
import { getAll, findRowIndexBy, getRowObj } from './rows.js';

export async function getCaller(idToken) {
  // verify token with Firebase
  const fb = await verifyFirebaseIdToken(idToken);

  // find linked user in Users by firebase_uid, then by email
  const users = await getAll('Users');
  let u = users.find(x => String(x.firebase_uid) === String(fb.uid));
  if (!u && fb.email) {
    u = users.find(x => String(x.email || '').toLowerCase() === String(fb.email).toLowerCase());
  }
  if (!u) throw new Error('no_linked_user');

  if (String(u.status || '').toUpperCase() !== 'ACTIVE') throw new Error('user_inactive');
  return u; // includes role, building scope, etc.
}
