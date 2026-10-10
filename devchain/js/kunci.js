// Vault berbasis private key secp256k1.
//
// Setiap akun punya private key sendiri. Data akun disimpan di vault.json dan
// dienkripsi ke PUBLIC key akun itu (ECDH + HKDF + AES-256-GCM, seperti ECIES):
//   record = { id, epk, iv, ct }
//   id  = hash public key (untuk mencari record, tanpa membuka semuanya)
//   epk = public key sementara milik pembuat record
// Hanya pemegang private key yang bisa membuka record. Admin bisa membuat ulang
// record akun lain kapan pun karena hanya butuh public key mereka, tanpa PIN.
// Private key 256-bit tidak bisa ditebak habis seperti PIN pendek.

import * as secp from "@noble/secp256k1";

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const SKRIP_RE = /^[a-z0-9_-]+$/;

export function normalisasiKunci(s) {
  const h = String(s || "").trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) throw Object.assign(new Error("Private key harus 64 karakter hex (boleh diawali 0x)."), { user: true });
  if (!secp.utils.isValidPrivateKey(unhex(h))) throw Object.assign(new Error("Private key tidak valid."), { user: true });
  return h;
}

/** Terima public key terkompresi (66 hex) atau tidak terkompresi (130 hex); kembalikan bentuk terkompresi. */
export function normalisasiPub(s) {
  const h = String(s || "").trim().replace(/^0x/i, "").toLowerCase();
  if (!/^(0[23][0-9a-f]{64}|04[0-9a-f]{128})$/.test(h)) throw Object.assign(new Error("Public key harus 66 karakter hex (diawali 02 atau 03)."), { user: true });
  try { return secp.ProjectivePoint.fromHex(h).toHex(true); }
  catch { throw Object.assign(new Error("Public key tidak valid."), { user: true }); }
}

export function pubDari(privHex) { return hex(secp.getPublicKey(unhex(privHex), true)); }

export function kunciBaru() { return hex(secp.utils.randomPrivateKey()); }

export async function idDari(pubHex) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("devchain:kunci:" + pubHex)));
  return hex(d.slice(0, 16));
}

async function kunciAes(sharedPoint, epk, id) {
  const ikm = await crypto.subtle.importKey("raw", sharedPoint.slice(1), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("devchain-v2"), info: enc.encode(epk + ":" + id) },
    ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Enkripsi payload ke public key. */
export async function buatRecord(pubHex, payload) {
  const pub = normalisasiPub(pubHex);
  const id = await idDari(pub);
  const esk = secp.utils.randomPrivateKey();
  const epk = hex(secp.getPublicKey(esk, true));
  const key = await kunciAes(secp.getSharedSecret(esk, unhex(pub), true), epk, id);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(id) }, key, enc.encode(JSON.stringify(payload))));
  return { id, epk, iv: b64(iv), ct: b64(ct) };
}

/** Buka record dengan private key; lempar error kalau bukan miliknya. */
export async function bukaRecord(privHex, rec) {
  const pub = pubDari(privHex);
  const id = await idDari(pub);
  if (!rec || rec.id !== id) throw new Error("bukan akun ini");
  const key = await kunciAes(secp.getSharedSecret(unhex(privHex), unhex(rec.epk), true), rec.epk, id);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(rec.iv), additionalData: enc.encode(id) }, key, unb64(rec.ct));
  return JSON.parse(dec.decode(plain));
}

/** Cari record milik private key lalu buka. Hasil: { status: "ok"|"belum", pub, data? } */
export async function masukDenganKunci(vault, privHex) {
  const pub = pubDari(privHex);
  const id = await idDari(pub);
  const rec = (vault && Array.isArray(vault.records) ? vault.records : []).find((r) => r.id === id);
  if (!rec) return { status: "belum", pub };
  const data = await bukaRecord(privHex, rec);
  return { status: "ok", pub, data };
}

/** Periksa dan rapikan daftar akun (sumber kebenaran vault). */
export function rapikanDaftar(daftar) {
  if (!Array.isArray(daftar)) throw new Error("Daftar akun tidak valid.");
  const nama = new Set(), pubs = new Set();
  const out = daftar.map((a) => {
    const n = String(a.nama || "").trim();
    if (!n || n.length > 40) throw Object.assign(new Error("Nama akun wajib diisi (maksimal 40 karakter)."), { user: true });
    if (nama.has(n.toLowerCase())) throw Object.assign(new Error(`Nama "${n}" sudah dipakai.`), { user: true });
    nama.add(n.toLowerCase());
    const pub = normalisasiPub(a.pub);
    if (pubs.has(pub)) throw Object.assign(new Error("Public key itu sudah terdaftar."), { user: true });
    pubs.add(pub);
    const role = a.role === "admin" ? "admin" : "user";
    const script = role === "admin" ? [] : [...new Set((a.script || []).filter((s) => SKRIP_RE.test(s)))];
    return { nama: n, pub, role, script, dibuat: a.dibuat || new Date().toISOString() };
  });
  if (!out.some((a) => a.role === "admin")) throw Object.assign(new Error("Harus ada minimal satu admin."), { user: true });
  return out;
}

/** Bangun vault.json dari daftar akun: tiap akun dapat record sendiri; admin membawa seluruh daftar. */
export async function bangunVault(daftar) {
  const akun = rapikanDaftar(daftar);
  const records = [];
  for (const a of akun) {
    const payload = { nama: a.nama, pub: a.pub, role: a.role, script: a.script, dibuat: a.dibuat };
    if (a.role === "admin") payload.akun = akun;
    records.push(await buatRecord(a.pub, payload));
  }
  // urutan stabil supaya perbedaan di git mudah dibaca
  records.sort((x, y) => (x.id < y.id ? -1 : 1));
  return { akun, vault: { version: 2, records } };
}
