// src/api/auth.js
import { api } from './client';
let inflightSession = null;



export function session(idTokenOrObj) {
  const idToken = typeof idTokenOrObj === 'string'
    ? idTokenOrObj
    : idTokenOrObj?.idToken;

  if (!inflightSession) {
    inflightSession = api('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }).finally(() => { inflightSession = null; });
  }
  return inflightSession;
}
/** POST /auth/link-user */
export function linkUser({ idToken, username, invite_code, full_name }) {
  return api('/auth/link-user', {
    method: 'POST',
    body: JSON.stringify({
      idToken,
      username: username || undefined,
      invite_code: invite_code || undefined,
      full_name: full_name || undefined,
    }),
  });
}

/** POST /auth/session */
// export function session(idTokenOrObj) {
//   const idToken = typeof idTokenOrObj === 'string' ? idTokenOrObj : idTokenOrObj?.idToken;
//   return api('/auth/session', {
//     method: 'POST',
//     body: JSON.stringify({ idToken }),
//   });
// }

export const authApi = { linkUser, session };
export default authApi;
