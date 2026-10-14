// Sinkronisasi script injeksi (gaya Tampermonkey/Aistim) lewat chrome.userScripts.
// Dipakai popup (saat tombol ditekan) dan service worker (berkala), jadi
// script yang diubah admin di situs ikut berubah tanpa mengunduh extension.
//
// Keamanan: hanya script dari katalog bertanda tangan (atau salinan bawaan), dan hanya untuk pola situs
// spesifik (tanpa wildcard host penuh).
// Situs erzap.com sudah diizinkan lewat manifest; situs lain meminta izin
// saat togel dinyalakan. Pengguna harus mengaktifkan "Izinkan skrip pengguna".
// Script berjalan secara bawaan (bisa dimatikan satu per satu).

export const OFF_KEY = "aistim.mati";
export const HIDE_KEY = "aistim.sembunyi";
export const STAT_KEY = "aistim.status";
const PREFIX = "aistim-";
const PREFIX_LAMA = "devchain-";   // nama lama (sebelum diganti Aistim): dibersihkan saat sync
const MAX_CODE = 4 * 1024 * 1024;
const MATCH_RE = /^https?:\/\/(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?\/.*$/i;
const RUN_AT = new Set(["document_start", "document_end", "document_idle"]);

export function validMatches(m) {
  return Array.isArray(m) && m.length > 0 && m.length <= 20 && m.every((x) => typeof x === "string" && MATCH_RE.test(x));
}

export function injectable(s) {
  if (!s || s.tipe !== "inject" || !/^[a-z0-9_-]+$/.test(s.id) || !/^[a-z0-9_-]+\.js$/.test(s.file)) return false;
  if (!validMatches(s.matches)) return false;
  return true;
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

// ---- Sumber script dari GitHub, diverifikasi: tanda tangan katalog (ECDSA P-256) + SHA-256 tiap file ----
// Script hanya dipakai kalau katalognya ditandatangani kunci pemilik dan hash filenya cocok.
// Kalau GitHub tak terjangkau atau verifikasi gagal, dipakai salinan bawaan di dalam extension.
const SUMBER = "https://raw.githubusercontent.com/devtim-lab/Aistim.sdk/main/extension/scripts/";
const KUNCI_VERIF = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEjjmlHJGsGqYr2uyEVEMBpygmhKnVuSHBZ8UgkhWAsz2ejGYG9LUNbyGbTVBgbFu7GwWbU0FHie4aiw07ig4f8w==";   // kunci publik (SPKI base64); kunci pribadinya dipegang pemilik, tidak ada di repo
const dariB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const keHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Kembalikan katalog (objek) bila tanda tangannya sah, selain itu null. */
export async function verifikasiKatalog(teks) {
  try {
    const d = JSON.parse(teks);
    if (!d || !Array.isArray(d.scripts) || typeof d.tandatangan !== "string") return null;
    const kunci = await crypto.subtle.importKey("spki", dariB64(KUNCI_VERIF), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const sah = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kunci, dariB64(d.tandatangan), new TextEncoder().encode(JSON.stringify(d.scripts)));
    return sah ? d : null;
  } catch { return null; }
}

let remote = { waktu: 0, katalog: null, teks: "" };
async function katalogRemote() {
  if (Date.now() - remote.waktu < 60000) return remote;
  remote = { waktu: Date.now(), katalog: null, teks: "" };
  try {
    const r = await fetch(SUMBER + "index.json?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const teks = await r.text();
      const katalog = await verifikasiKatalog(teks);
      if (katalog) remote = { waktu: Date.now(), katalog, teks };
    }
  } catch { /* pakai salinan bawaan */ }
  return remote;
}

/** Teks script dari GitHub bila hash-nya cocok dengan katalog bertanda tangan; selain itu null. */
async function fileRemote(nama) {
  const { katalog } = await katalogRemote();
  const s = katalog && katalog.scripts.find((x) => x.file === nama);
  if (!s || !/^[0-9a-f]{64}$/.test(s.sha256 || "")) return null;
  try {
    const r = await fetch(SUMBER + nama + "?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const bytes = await r.arrayBuffer();
    if (keHex(await crypto.subtle.digest("SHA-256", bytes)) !== s.sha256) return null;
    return new TextDecoder().decode(bytes);
  } catch { return null; }
}

export async function sumberAktif() { return (await katalogRemote()).katalog ? "github" : "bawaan"; }

/** Ambil file extension: dari GitHub (terverifikasi tanda tangan + hash) bila bisa, kalau tidak dari salinan di dalam extension. */
export async function ambilFile(path, lokal = false) {
  const rel = path.replace(/^\//, "");
  if (!lokal && rel.startsWith("scripts/")) {
    const nama = rel.slice(8);
    const teks = nama === "index.json" ? (await katalogRemote()).teks : await fileRemote(nama);
    if (teks) return new Response(teks, { status: 200, headers: { "Content-Type": nama.endsWith(".json") ? "application/json" : "text/javascript" } });
  }
  return fetch(chrome.runtime.getURL(rel));
}

async function fetchJson(path, lokal = false) {
  // Katalog dan script: dari GitHub yang terverifikasi, kalau tidak ada dari salinan di extension
  const res = await ambilFile(path, lokal);
  if (!res.ok) throw new Error(path + " " + res.status);
  return res.json();
}

/** Katalog script injeksi yang boleh dijalankan. */
/** lokal=true: hanya salinan di dalam extension (cepat, tanpa jaringan). */
export async function katalogInject(lokal = false) {
  const data = await fetchJson("/scripts/index.json", lokal);
  return (Array.isArray(data.scripts) ? data.scripts : []).filter((s) => injectable(s));
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

/** Daftarkan script yang berhak dan menyala; hapus yang sudah tidak. */
async function syncScriptsInti() {
  await migrasiKunci();
  const lap = { ok: [], lewat: [], hapus: [], error: "" };
  if (!userScriptsReady()) { lap.error = "izin-skrip"; return lap; }
  let daftar;
  try { daftar = await katalogInject(); } catch { lap.error = "jaringan"; return lap; }
  const mati = new Set([...(await getOff()), ...(await getSembunyi())]);
  const lama = (await chrome.userScripts.getScripts()).filter((s) => s.id.startsWith(PREFIX_LAMA)).map((s) => s.id);
  if (lama.length) await chrome.userScripts.unregister({ ids: lama });
  const sudah = (await chrome.userScripts.getScripts()).filter((s) => s.id.startsWith(PREFIX));
  const target = new Set();
  const versi = {};
  // Sync berjalan tiap menit: script yang kodenya (SHA-256) dan pengaturannya tidak berubah tidak diunduh/didaftarkan ulang.
  const kunciLama = ((await getStatus()) || {}).kunci || {};
  const kunciBaru = {};
  const kunciDari = (x) => (x.sha256 ? x.sha256 + "|" + JSON.stringify([x.matches, x.runAt, x.world]) : "");
  for (const s of daftar) {
    if (mati.has(s.id)) continue;
    if ((await originsDibutuhkan([s])).length) { lap.lewat.push(s.id); continue; }
    const kunci = kunciDari(s);
    if (kunci && kunciLama[s.id] === kunci && sudah.some((x) => x.id === PREFIX + s.id)) {
      target.add(PREFIX + s.id); lap.ok.push(s.id); versi[s.id] = s.versi; kunciBaru[s.id] = kunci;
      continue;
    }
    try {
      const res = await ambilFile("scripts/" + s.file);
      if (!res.ok) throw new Error();
      const code = await res.text();
      if (code.length > MAX_CODE) throw new Error();
      const def = {
        id: PREFIX + s.id,
        matches: s.matches,
        // penanda di DOM supaya popup bisa memeriksa script mana yang benar-benar aktif di halaman
        js: [{ code: `(function(){try{var d=document.documentElement,a=(d.getAttribute("data-aistim")||"").split(",").filter(Boolean);if(a.indexOf(${JSON.stringify(s.id)})<0)a.push(${JSON.stringify(s.id)});d.setAttribute("data-aistim",a.join(","));}catch(e){}})();` }, { code }],
        runAt: RUN_AT.has(s.runAt) ? s.runAt : "document_idle",
        world: s.world === "MAIN" ? "MAIN" : "USER_SCRIPT",
      };
      if (sudah.some((x) => x.id === def.id)) await chrome.userScripts.update([def]);
      else await chrome.userScripts.register([def]);
      target.add(def.id); lap.ok.push(s.id); versi[s.id] = s.versi;
      if (kunci && keHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))) === s.sha256) kunciBaru[s.id] = kunci;   // hanya bila kode yang dipasang sama dengan katalog
    } catch { lap.lewat.push(s.id); }
  }
  const buang = sudah.filter((x) => !target.has(x.id)).map((x) => x.id);
  if (buang.length) { await chrome.userScripts.unregister({ ids: buang }); lap.hapus = buang; }
  await setStatus({ waktu: Date.now(), versi, kunci: kunciBaru, ok: lap.ok.length, lewat: lap.lewat.length, sumber: await sumberAktif() });
  return lap;
}

/** Salin data bernama lama ("devchain.*") ke nama baru ("aistim.*") sekali; hapus sisa data login/paket yang sudah tidak dipakai. */
export async function migrasiKunci() {
  const peta = { "devchain.mati": "aistim.mati", "devchain.sembunyi": "aistim.sembunyi", "devchain.status": "aistim.status" };
  const sisa = ["devchain.session", "devchain.plan", "devchain.paket", "aistim.session", "aistim.plan", "aistim.paket"];
  try {
    const lama = await chrome.storage.local.get(Object.keys(peta));
    const baru = {};
    for (const [k, v] of Object.entries(lama)) if (v !== undefined) baru[peta[k]] = v;
    if (Object.keys(baru).length) await chrome.storage.local.set(baru);
    await chrome.storage.local.remove([...Object.keys(peta), ...sisa]);
    await chrome.storage.session.remove(["aistim.tok", "aistim.toksdk"]);
  } catch { /* di luar extension */ }
}

export async function clearScripts() {
  if (!userScriptsReady()) return;
  const ids = (await chrome.userScripts.getScripts()).filter((s) => s.id.startsWith(PREFIX) || s.id.startsWith(PREFIX_LAMA)).map((s) => s.id);
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
