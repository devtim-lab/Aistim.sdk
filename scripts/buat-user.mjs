#!/usr/bin/env node
// Mengelola akun di devchain/user.json. PIN/kata sandi tidak pernah ditulis
// ke berkas atau riwayat perintah: diminta lewat input tersembunyi.
//
// Pemakaian:
//   node scripts/buat-user.mjs tambah <nama-pengguna> [--nama "Nama Tampil"]
//   node scripts/buat-user.mjs akses  <nama-pengguna> <id,id|->   (atur script yang boleh diakses)
//   node scripts/buat-user.mjs hapus  <nama-pengguna>
//   node scripts/buat-user.mjs daftar
// Opsi tambah: --nama, --role admin|user (default user), --script id,id
// Opsi: --file <path>  (default: devchain/user.json)
// Akun admin menyimpan daftar akun (nama, peran, akses) di dalam datanya yang
// terenkripsi; perubahan pada akun lain butuh PIN admin (DEVCHAIN_ADMIN_PIN
// untuk pengujian).
//
// Untuk pengujian otomatis, PIN boleh diberikan lewat variabel lingkungan
// DEVCHAIN_PIN (jangan dipakai untuk akun sungguhan).

import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.crypto ??= webcrypto;

const { encryptRecord, decryptRecord, userId } = await import("../devchain/js/vault.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultFile = path.join(here, "..", "devchain", "user.json");

function die(msg) {
  console.error("Error: " + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      opts[a.slice(2)] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}

function askHidden(prompt) {
  if (process.env.DEVCHAIN_PIN) return Promise.resolve(process.env.DEVCHAIN_PIN);
  if (!process.stdin.isTTY) {
    return Promise.reject(new Error("Butuh terminal interaktif untuk memasukkan PIN."));
  }
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") { cleanup(); return resolve(buf); }
        if (c === "\u0003") { cleanup(); return reject(new Error("Dibatalkan.")); }
        if (c === "\u007f" || c === "\b") { buf = buf.slice(0, -1); continue; }
        buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

function readDb(file) {
  if (!fs.existsSync(file)) return { version: 1, users: [] };
  const db = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!db || !Array.isArray(db.users)) die(`${file} bukan format user.json yang valid.`);
  return db;
}

function writeDb(file, db) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

const WARN_PIN =
  "Peringatan: kurang dari 12 karakter. Siapa pun yang mengunduh user.json bisa\n" +
  "menebak semua kemungkinan secara offline. Pakai hanya untuk uji coba.";

function parseList(s) {
  if (!s || s === "-") return [];
  return [...new Set(String(s).split(",").map((x) => x.trim()).filter(Boolean))];
}

async function askPin(label, envName) {
  if (envName && process.env[envName]) return process.env[envName];
  return askHidden(label);
}

/** Cari akun admin dengan mencoba PIN ke semua record. */
async function bukaAdmin(db, adminPin) {
  for (const rec of db.users) {
    try {
      const payload = await decryptRecord(rec, "", adminPin);
      if (payload.role === "admin") return { rec, payload };
    } catch { /* bukan akun ini */ }
  }
  return null;
}

/** Perbarui daftar akun di record admin. mutate(akun[]) -> akun[]. */
async function sinkronDaftar(db, mutate) {
  const adminPin = await askPin("PIN admin (untuk memperbarui daftar akun): ", "DEVCHAIN_ADMIN_PIN");
  const found = await bukaAdmin(db, adminPin);
  if (!found) die("PIN admin salah, atau belum ada akun admin.");
  const { rec, payload } = found;
  payload.akun = mutate(Array.isArray(payload.akun) ? payload.akun : []);
  // id (tag) dihitung ulang dari nama yang sama, jadi tetap sama dengan record lama
  const re = await encryptRecord("", adminPin, payload, undefined, payload.username);
  const idx = db.users.findIndex((u) => u.id === rec.id);
  db.users[idx] = re;
}

function ringkas(payload) {
  return { nama: payload.username, role: payload.role, script: payload.script || [] };
}

async function tambah(username, opts, file) {
  if (!username) die("Isi nama pengguna: tambah <nama-pengguna>");
  const role = opts.role === "admin" ? "admin" : "user";
  const pin = await askHidden("PIN: ");
  if (!process.env.DEVCHAIN_PIN) {
    const ulang = await askHidden("Ulangi PIN: ");
    if (pin !== ulang) die("PIN tidak sama.");
  }
  if (!/^\d{6}$/.test(pin)) console.warn("Peringatan: form login saat ini hanya menerima PIN 6 angka.");
  if (pin.length < 12) console.warn(WARN_PIN);
  const db = readDb(file);
  const payload = {
    username: username.trim(),
    nama: opts.nama || username.trim(),
    role,
    script: parseList(opts.script),
    dibuat: new Date().toISOString(),
  };
  if (role === "admin") {
    // Admin membawa daftar semua akun; mulai dari dirinya sendiri
    payload.akun = [ringkas(payload)];
  }
  console.log("Mengenkripsi (butuh beberapa detik)...");
  // Kunci hanya dari PIN (nama pengguna kosong); nama dipakai untuk tag pengelolaan
  const record = await encryptRecord("", pin, payload, undefined, username);
  const idx = db.users.findIndex((u) => u.id === record.id);
  if (idx >= 0) db.users[idx] = record;
  else db.users.push(record);
  // Admin baru menyimpan daftarnya sendiri; akun lain memperbarui daftar milik admin
  if (role !== "admin") {
    await sinkronDaftar(db, (akun) => [...akun.filter((a) => a.nama !== payload.username), ringkas(payload)]);
  }
  writeDb(file, db);
  console.log(`Akun "${username}" (${role}) ${idx >= 0 ? "diperbarui" : "ditambahkan"}. Total ${db.users.length} akun.`);
}

async function akses(username, daftarId, file) {
  if (!username || daftarId === undefined) die("Pemakaian: akses <nama-pengguna> <id,id|->");
  const id = await userId(username);
  const db = readDb(file);
  const rec = db.users.find((u) => u.id === id);
  if (!rec) die(`Akun "${username}" tidak ditemukan.`);
  const pin = await askPin(`PIN akun ${username}: `, "DEVCHAIN_PIN");
  let payload;
  try { payload = await decryptRecord(rec, "", pin); } catch { die("PIN salah."); }
  payload.script = parseList(daftarId);
  console.log("Mengenkripsi ulang...");
  if (payload.role === "admin") {
    payload.akun = (payload.akun || []).map((a) => (a.nama === payload.username ? ringkas(payload) : a));
  }
  db.users[db.users.findIndex((u) => u.id === id)] = await encryptRecord("", pin, payload, undefined, username);
  if (payload.role !== "admin") {
    await sinkronDaftar(db, (akun) => [...akun.filter((a) => a.nama !== payload.username), ringkas(payload)]);
  }
  writeDb(file, db);
  console.log(`Akses "${username}": ${payload.script.join(", ") || "(tidak ada)"}`);
}

async function hapus(username, file) {
  if (!username) die("Isi nama pengguna: hapus <nama-pengguna>");
  const id = await userId(username);
  const db = readDb(file);
  const rec = db.users.find((u) => u.id === id);
  if (!rec) die(`Akun "${username}" tidak ditemukan.`);
  db.users = db.users.filter((u) => u.id !== id);
  // Kalau admin yang dihapus, tidak ada daftar yang perlu diperbarui
  const adminPin = process.env.DEVCHAIN_ADMIN_PIN || (db.users.length ? await askHidden("PIN admin (untuk memperbarui daftar akun, kosongkan jika admin yang dihapus): ") : "");
  if (adminPin) {
    const found = await bukaAdmin(db, adminPin);
    if (found) {
      found.payload.akun = (found.payload.akun || []).filter((a) => a.nama !== username);
      const idx = db.users.findIndex((u) => u.id === found.rec.id);
      db.users[idx] = await encryptRecord("", adminPin, found.payload, undefined, found.payload.username);
    } else {
      console.warn("PIN admin tidak cocok; daftar akun di admin tidak diperbarui.");
    }
  }
  writeDb(file, db);
  console.log(`Akun "${username}" dihapus (${db.users.length} akun tersisa).`);
}

function daftar(file) {
  const db = readDb(file);
  console.log(`${db.users.length} akun di ${file}`);
  console.log("Nama pengguna tidak tersimpan di berkas (hanya hash). Admin melihat daftarnya setelah login.");
}

const { positional, opts } = parseArgs(process.argv.slice(2));
const [cmd, username, arg3] = positional;
const file = path.resolve(opts.file || defaultFile);

try {
  if (cmd === "tambah") await tambah(username, opts, file);
  else if (cmd === "akses") await akses(username, arg3, file);
  else if (cmd === "hapus") await hapus(username, file);
  else if (cmd === "daftar") daftar(file);
  else die("Perintah: tambah | akses | hapus | daftar");
} catch (err) {
  die(err.message);
}
