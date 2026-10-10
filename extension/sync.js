// Sinkronisasi script injeksi (gaya Tampermonkey/Aistim) lewat chrome.userScripts.
// Dipakai popup (saat tombol ditekan) dan service worker (berkala), jadi
// script yang diubah admin di situs ikut berubah tanpa mengunduh extension.
//
// Keamanan: hanya script dari katalog situs, hanya untuk akun yang
// berhak, dan hanya untuk pola situs spesifik (tanpa wildcard host penuh).
// Situs erzap.com sudah diizinkan lewat manifest; situs lain meminta izin
// saat togel dinyalakan. Pengguna harus mengaktifkan "Izinkan skrip pengguna".
// Script berjalan secara bawaan (bisa dimatikan satu per satu).

export const BASE = "https://devchain.web.app";
export const PLAN_KEY = "devchain.plan";
export const OFF_KEY = "devchain.mati";
export const HIDE_KEY = "devchain.sembunyi";
export const STAT_KEY = "devchain.status";
import { bukaDenganKunci, bacaZip } from "./paket.js";
const PREFIX = "devchain-";
const MAX_CODE = 4 * 1024 * 1024;
const MATCH_RE = /^https?:\/\/(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?\/.*$/i;
const RUN_AT = new Set(["document_start", "document_end", "document_idle"]);

export function validMatches(m) {
  return Array.isArray(m) && m.length > 0 && m.length <= 20 && m.every((x) => typeof x === "string" && MATCH_RE.test(x));
}

export function injectable(s, plan) {
  if (!s || s.tipe !== "inject" || !/^[a-z0-9_-]+$/.test(s.id) || !/^[a-z0-9_-]+\.js$/.test(s.file)) return false;
  if (!validMatches(s.matches)) return false;
  return !!plan && (plan.admin || (plan.ids || []).includes(s.id));
}

export async function getPlan() {
  try { return (await chrome.storage.local.get(PLAN_KEY))[PLAN_KEY] || null; } catch { return null; }
}
export async function setPlan(plan) {
  try { await chrome.storage.local.set({ [PLAN_KEY]: plan }); } catch { /* di luar extension */ }
}

/** id script yang dimatikan pengguna lewat togel (bawaan: semua nyala). */
export async function getOff() {
  try { return (await chrome.storage.local.get(OFF_KEY))[OFF_KEY] || []; } catch { return []; }
}
/** id script yang disembunyikan (dihentikan dan tidak tampil) di browser ini. */
export async function getSembunyi() {
  try { return (await chrome.storage.local.get(HIDE_KEY))[HIDE_KEY] || []; } catch { return []; }
}
export async function setSembunyi(ids) {
  try { await chrome.storage.local.set({ [HIDE_KEY]: [...new Set(ids)] }); } catch { /* di luar extension */ }
}
export async function setOff(ids) {
  try { await chrome.storage.local.set({ [OFF_KEY]: [...new Set(ids)] }); } catch { /* di luar extension */ }
}

/** Ringkasan sinkron terakhir: { waktu, versi: {id: versi}, ok, lewat } */
export async function getStatus() {
  try { return (await chrome.storage.local.get(STAT_KEY))[STAT_KEY] || null; } catch { return null; }
}
async function setStatus(v) {
  try { await chrome.storage.local.set({ [STAT_KEY]: v }); } catch { /* di luar extension */ }
}

export const PAKET_KEY = "devchain.paket";   // paket script akun ini (sudah didekripsi saat login): { ver, files }
export async function getPaket() {
  try { return (await chrome.storage.local.get(PAKET_KEY))[PAKET_KEY] || null; } catch { return null; }
}
export async function setPaket(v) {
  try { await chrome.storage.local.set({ [PAKET_KEY]: v }); } catch { /* di luar extension */ }
}

export async function clearPlan() {
  try { await chrome.storage.local.remove([PLAN_KEY, OFF_KEY, HIDE_KEY, STAT_KEY, PAKET_KEY]); } catch { /* di luar extension */ }
}

/** Ambil file extension: dari paket akun (didekripsi saat login), kalau tidak ada dari salinan di dalam extension. */
export async function ambilFile(path) {
  const rel = path.replace(/^\//, "");
  if (rel.startsWith("scripts/")) {
    const p = await getPaket();
    const t = p && p.files && p.files[rel.slice(8)];
    if (typeof t === "string") return new Response(t, { status: 200, headers: { "Content-Type": rel.endsWith(".json") ? "application/json" : "text/javascript" } });
  }
  return fetch(chrome.runtime.getURL(rel));
}

async function fetchJson(path) {
  // Katalog dan script: dari paket akun, kalau tidak ada dari salinan di extension
  const res = await ambilFile(path);
  if (!res.ok) throw new Error(path + " " + res.status);
  return res.json();
}

/** Katalog script injeksi yang boleh dipakai akun ini. */
export async function katalogInject(plan) {
  const data = await fetchJson("/scripts/index.json");
  return (Array.isArray(data.scripts) ? data.scripts : []).filter((s) => injectable(s, plan));
}

export function userScriptsReady() {
  return typeof chrome !== "undefined" && typeof chrome.userScripts !== "undefined" && typeof chrome.userScripts.register === "function";
}

/** Pola situs yang dibutuhkan dan belum diizinkan browser. */
export async function originsDibutuhkan(daftar) {
  const need = [...new Set(daftar.flatMap((s) => s.matches))];
  const kurang = [];
  for (const o of need) {
    let ada = false;
    try { ada = await chrome.permissions.contains({ origins: [o] }); } catch { ada = false; }
    if (!ada) kurang.push(o);
  }
  return kurang;
}

/** Periksa paket terbaru di repo Auth; bila versinya berubah, unduh dan buka dengan kunci paket yang tersimpan. */
export async function segarkanPaket() {
  try {
    const p = await getPaket();
    if (!p || !p.k || !p.addr) return false;
    const base = "https://raw.githubusercontent.com/devtim-lab/Auth/main/paket/";
    const v = await (await fetch(base + "versi.json?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(4000) })).json();
    const baru = v[p.addr];
    if (!baru || baru === p.ver) return false;
    const r = await fetch(base + p.addr + ".bin?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return false;
    const files = bacaZip(await bukaDenganKunci(p.k, new Uint8Array(await r.arrayBuffer())));
    await setPaket({ ...p, ver: baru, files });
    return true;
  } catch { return false; }
}

/** Daftarkan script yang berhak dan menyala; hapus yang sudah tidak. */
async function syncScriptsInti() {
  await segarkanPaket();
  const plan = await getPlan();
  const lap = { ok: [], lewat: [], hapus: [], error: "" };
  if (!plan) { await clearScripts(); return lap; }
  if (!userScriptsReady()) { lap.error = "izin-skrip"; return lap; }
  let daftar;
  try { daftar = await katalogInject(plan); } catch { lap.error = "jaringan"; return lap; }
  const mati = new Set([...(await getOff()), ...(await getSembunyi())]);
  const sudah = (await chrome.userScripts.getScripts()).filter((s) => s.id.startsWith(PREFIX));
  const target = new Set();
  const versi = {};
  for (const s of daftar) {
    if (mati.has(s.id)) continue;
    if ((await originsDibutuhkan([s])).length) { lap.lewat.push(s.id); continue; }
    try {
      const res = await ambilFile("scripts/" + s.file);
      if (!res.ok) throw new Error();
      const code = await res.text();
      if (code.length > MAX_CODE) throw new Error();
      const def = {
        id: PREFIX + s.id,
        matches: s.matches,
        // penanda di DOM supaya popup bisa memeriksa script mana yang benar-benar aktif di halaman
        js: [{ code: `(function(){try{var d=document.documentElement,a=(d.getAttribute("data-devchain")||"").split(",").filter(Boolean);if(a.indexOf(${JSON.stringify(s.id)})<0)a.push(${JSON.stringify(s.id)});d.setAttribute("data-devchain",a.join(","));}catch(e){}})();` }, { code }],
        runAt: RUN_AT.has(s.runAt) ? s.runAt : "document_idle",
        world: s.world === "MAIN" ? "MAIN" : "USER_SCRIPT",
      };
      if (sudah.some((x) => x.id === def.id)) await chrome.userScripts.update([def]);
      else await chrome.userScripts.register([def]);
      target.add(def.id); lap.ok.push(s.id); versi[s.id] = s.versi;
    } catch { lap.lewat.push(s.id); }
  }
  const buang = sudah.filter((x) => !target.has(x.id)).map((x) => x.id);
  if (buang.length) { await chrome.userScripts.unregister({ ids: buang }); lap.hapus = buang; }
  await setStatus({ waktu: Date.now(), versi, ok: lap.ok.length, lewat: lap.lewat.length });
  return lap;
}

export async function clearScripts() {
  if (!userScriptsReady()) return;
  const ids = (await chrome.userScripts.getScripts()).filter((s) => s.id.startsWith(PREFIX)).map((s) => s.id);
  if (ids.length) await chrome.userScripts.unregister({ ids });
}

// Sinkron dijalankan satu per satu; perubahan beruntun (mis. menyembunyikan banyak script)
// tidak boleh saling menimpa.
let antrean = Promise.resolve();
export function syncScripts(...args) {
  const jalan = antrean.then(() => syncScriptsInti(...args));
  antrean = jalan.catch(() => {});
  return jalan;
}
