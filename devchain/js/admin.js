// Menyusun user.json baru di browser untuk admin: menambah akun (email + PIN)
// dan memperbarui daftar akun di record admin. Situs statis tidak bisa
// menulis berkas, jadi hasilnya diunduh/disalin lalu di-push ke repo.

import { encryptRecord, decryptRecord, userId } from "./vault.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(e) {
  return EMAIL_RE.test(String(e).trim()) && e.length <= 254;
}

function fail(msg) {
  return Object.assign(new Error(msg), { user: true });
}

/**
 * admin: payload admin yang sedang login. baru: { email, pin, script[] }.
 * deps: { users (isi user.json saat ini), adminPin (PIN admin) }.
 * Mengembalikan { json, akun } dengan json = isi user.json baru (string).
 */
export async function susunDenganAkunBaru(admin, baru, { users, adminPin }) {
  if (!adminPin) throw fail("Hanya admin yang bisa menambah akun.");
  const email = baru.email.trim().toLowerCase();
  if (!validEmail(email)) throw fail("Email tidak valid.");
  if (!/^\d{6}$/.test(baru.pin)) throw fail("PIN harus 6 angka.");

  const adminId = await userId(admin.username);
  const newId = await userId(email);
  if (users.some((u) => u.id === newId)) throw fail("Email itu sudah terdaftar.");
  // PIN dipakai untuk mencari akun saat login, jadi tidak boleh kembar
  for (const u of users) {
    try {
      await decryptRecord(u, "", baru.pin);
      throw fail("PIN itu sudah dipakai akun lain. Pilih PIN lain.");
    } catch (e) {
      if (e && e.user) throw e;
    }
  }

  const payload = {
    username: email, nama: email, role: "user",
    script: [...new Set(baru.script || [])], dibuat: new Date().toISOString(),
  };
  const ringkas = { nama: email, role: "user", script: payload.script };
  const akun = [...(admin.akun || []).filter((a) => a.nama !== email), ringkas];

  const adminBaru = { ...admin, akun };
  const recAdmin = await encryptRecord("", adminPin, adminBaru, undefined, admin.username);
  const recUser = await encryptRecord("", baru.pin, payload, undefined, email);

  const out = users.filter((u) => u.id !== adminId && u.id !== newId);
  out.push(recAdmin, recUser);
  return { json: JSON.stringify({ version: 1, users: out }, null, 2) + "\n", akun, ringkas };
}
