// server/lib/rows.js  (ensure these are exported)
import { readRange, writeRange, appendRange } from "./sheetsClient.js";
import { get as cget, put as cput } from "./cache.js";
import { CACHE } from "./util.js";
import { del } from "./cache.js";



export async function headers(sheet) {
  const ck = `${CACHE.prefix}${sheet}:hdr`;
  const hit = cget(ck);
  if (hit) return hit;
  const [hdr = []] = await readRange(`${sheet}!A1:ZZ1`);
  cput(ck, hdr, 60); // 60s
  return hdr;
}

export async function getAll(sheet) {
  const ck = `${CACHE.prefix}${sheet}:all`;
  const hit = cget(ck);
  if (hit) return hit;
  const hdr = await headers(sheet);
  const rows = await readRange(`${sheet}!A2:ZZ`);
  const out = (rows || []).map(r => {
    const o = {}; hdr.forEach((h,i)=> o[h] = r[i] ?? "");
    return o;
  });
  cput(ck, out, 30); // 30s
  return out;
}

export async function findRowIndexBy(sheet, colName, value, caseInsensitive = false) {
  const hdr = await headers(sheet);
  const idx = hdr.indexOf(colName);
  if (idx < 0) return -1;
  const rows = await readRange(`${sheet}!A2:ZZ`);
  const needle = String(value ?? "").trim();
  const N = caseInsensitive ? needle.toLowerCase() : needle;
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i][idx] ?? "").trim();
    const C = caseInsensitive ? cell.toLowerCase() : cell;
    if (C === N) return i + 2; // 1-based (header is row 1)
  }
  return -1;
}
export async function getRowObj(sheet, row) {
  const hdr = await headers(sheet);
  const [vals = []] = await readRange(`${sheet}!A${row}:ZZ${row}`);
  const o = {};
  hdr.forEach((h, i) => (o[h] = vals[i] ?? ""));
  return o;
}
export async function setRowObj(sheet, row, obj) {
  const hdr = await headers(sheet);
  const arr = hdr.map(h => (h in obj ? obj[h] : ""));
  await writeRange(`${sheet}!A${row}:ZZ${row}`, [arr]);
  del(CACHE.prefix + sheet);
}
export async function appendObj(sheet, obj) {
  const hdr = await headers(sheet);
  const arr = hdr.map(h => (h in obj ? obj[h] : ""));
  await appendRange(`${sheet}!A:ZZ`, [arr]);
  del(CACHE.prefix + sheet);
}
// Small HTTP helpers
export function ok(res, data) { res.json({ ok: true, ...(data || {}) }); }
export function bad(res, msg) { res.status(400).json({ ok: false, error: String(msg || "bad_request") }); }
