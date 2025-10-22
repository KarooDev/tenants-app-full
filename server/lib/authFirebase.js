// server/lib/authFirebase.js
// ==========================
import fetch from 'node-fetch';
export async function verifyFirebaseIdToken(idToken) {
if (!idToken) throw new Error('missing_id_token');
const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(process.env.FIREBASE_API_KEY)}`;
const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
if (!resp.ok) throw new Error('token_invalid');
const data = await resp.json();
const user = data.users && data.users[0];
if (!user) throw new Error('no_user_for_token');
return {
uid: user.localId,
email: user.email || '',
emailVerified: !!user.emailVerified,
displayName: user.displayName || '',
disabled: !!user.disabled,
providerUserInfo: user.providerUserInfo || [],
lastLoginAt: user.lastLoginAt || null,
};
}