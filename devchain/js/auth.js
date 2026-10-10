// Autentikasi lokal berbasis user.json (tanpa Firebase).
// Login berarti PIN berhasil mendekripsi salah satu akun di user.json. Sesi hanya disimpan di memori: muat ulang halaman = keluar.
// Antarmuka (isAvailable, onUserChange, signIn, signOut) sama seperti
// versi Firebase, jadi modul lain tidak berubah.

import { decryptRecord, dummyDerive } from "./vault.js";

let session = null;
let secret = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(session));
}

function fail(code) {
  return Object.assign(new Error(code), { code });
}

/** Enkripsi WebCrypto hanya tersedia di HTTPS (atau localhost). */
export function isAvailable() {
  return Boolean(globalThis.crypto && globalThis.crypto.subtle);
}

/** Dipanggil saat status login berubah. callback(sesi | null). */
export function onUserChange(callback) {
  listeners.add(callback);
  queueMicrotask(() => callback(session));
  return () => listeners.delete(callback);
}

export async function loadUsers() {
  let res;
  try {
    res = await fetch("user.json", { cache: "no-store" });
  } catch (e) {
    throw fail("auth/network-request-failed");
  }
  if (!res.ok) throw fail("auth/network-request-failed");
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.users)) throw fail("auth/network-request-failed");
  return data.users;
}

/** Login hanya dengan PIN: PIN dicoba ke setiap akun (mode uji coba). */
export async function signIn(pin) {
  const users = await loadUsers();
  for (const record of users) {
    try {
      const payload = await decryptRecord(record, "", pin);
      session = { username: payload.username || "", data: payload };
      secret = pin; // hanya di memori; dipakai admin untuk menyusun user.json baru
      notify();
      return session;
    } catch {
      /* bukan akun ini, coba berikutnya */
    }
  }
  if (!users.length) await dummyDerive(pin);
  throw fail("auth/invalid-credential");
}

/** PIN sesi admin (untuk mengenkripsi ulang daftar akun). null kalau bukan admin. */
export function adminSecret() {
  return session && session.data.role === "admin" ? secret : null;
}

export async function signOut() {
  session = null;
  secret = null;
  notify();
}
