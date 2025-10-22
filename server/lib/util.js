export const CONFIG = {
    APP_ORIGIN: process.env.APP_ORIGIN || 'https://bineytna.com',
    TIMEZONE: 'Asia/Beirut',
  };
  export const CACHE = { ttl: 300, prefix: 'rows::' };
  
  export function newId(prefix) {
    const s4 = () => Math.random().toString(16).slice(2, 10);
    return `${prefix}_${s4()}`;
  }
  export function today() {
    const d = new Date();
    const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  export function addDays(days = 0) {
    const d = new Date(); d.setDate(d.getDate()+Number(days||0));
    const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  export function generateInviteCode() {
    const base = cryptoRandom(16).toUpperCase(); // fallback to Math.random if needed
    return `${base.slice(0,4)}-${base.slice(4,8)}`;
  }
  function cryptoRandom(n) {
    let s = '';
    while (s.length < n) s += Math.random().toString(36).slice(2);
    return s.slice(0, n);
  }
  