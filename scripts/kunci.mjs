#!/usr/bin/env node
// Mengelola devchain/vault.json (login extension dengan private key secp256k1).
//
//   node scripts/kunci.mjs pub                              tampilkan public key dari private key (input tersembunyi)
//   node scripts/kunci.mjs awal <nama> --pub <hex>          buat vault dengan admin pertama
//   node scripts/kunci.mjs tambah <nama> --pub <hex>|--buat [--role admin] [--script id,id]
//   node scripts/kunci.mjs akses <nama> <id,id|->
//   node scripts/kunci.mjs hapus <nama>
//   node scripts/kunci.mjs daftar
// Opsi: --file <path> (default devchain/vault.json)
// Perintah selain pub/awal butuh private key admin: input tersembunyi, atau
// variabel DEVCHAIN_ADMIN_KEY (hanya untuk pengujian). Private key tidak pernah
// ditulis ke berkas. Dengan --buat, key baru dicetak SEKALI ke layar.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { kunciBaru, pubDari, normalisasiKunci, normalisasiPub, bangunVault, masukDenganKunci } =
  await import("../devchain/js/kunci.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultFile = path.join(here, "..", "devchain", "vault.json");

function die(msg) { console.error("Error: " + msg); process.exit(1); }

function parseArgs(argv) {
  const positional = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--buat") opts.buat = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  return { positional, opts };
}

function askHidden(prompt) {
  if (!process.stdin.isTTY) return Promise.reject(new Error("Butuh terminal interaktif untuk memasukkan private key."));
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    let buf = "";
    const cleanup = () => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); process.stdout.write("\n"); };
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

const parseList = (s) => (!s || s === "-" ? [] : [...new Set(String(s).split(",").map((x) => x.trim()).filter(Boolean))]);

function bacaVault(file) {
  if (!fs.existsSync(file)) return { version: 2, records: [] };
  const v = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!v || !Array.isArray(v.records)) die(`${file} bukan vault yang valid.`);
  return v;
}

function tulis(file, vault) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(vault, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/** Buka vault dengan private key admin dan ambil daftar akun. */
async function daftarAdmin(file) {
  const vault = bacaVault(file);
  const raw = process.env.DEVCHAIN_ADMIN_KEY || await askHidden("Private key admin: ");
  let r;
  try { r = await masukDenganKunci(vault, normalisasiKunci(raw)); } catch (e) { die(e.user ? e.message : "Private key admin salah."); }
  if (r.status !== "ok" || r.data.role !== "admin") die("Private key itu bukan milik admin yang terdaftar.");
  return r.data.akun;
}

async function simpan(file, daftar) {
  const { akun, vault } = await bangunVault(daftar);
  tulis(file, vault);
  return akun;
}

const { positional, opts } = parseArgs(process.argv.slice(2));
const [cmd, nama, arg3] = positional;
const file = path.resolve(opts.file || defaultFile);

try {
  if (cmd === "pub") {
    const raw = process.env.DEVCHAIN_ADMIN_KEY || await askHidden("Private key: ");
    console.log(pubDari(normalisasiKunci(raw)));
  } else if (cmd === "awal") {
    if (!nama) die("Pemakaian: awal <nama> --pub <hex>");
    if (bacaVault(file).records.length) die("Vault sudah berisi akun. Pakai perintah tambah.");
    if (!opts.pub) die("Isi --pub <public key>.");
    await simpan(file, [{ nama, pub: normalisasiPub(opts.pub), role: "admin" }]);
    console.log(`Vault dibuat dengan admin "${nama}".`);
  } else if (cmd === "tambah") {
    if (!nama) die("Pemakaian: tambah <nama> --pub <hex>|--buat");
    const daftar = await daftarAdmin(file);
    let pub = opts.pub, baru = null;
    if (opts.buat) { baru = kunciBaru(); pub = pubDari(baru); }
    if (!pub) die("Isi --pub <public key> atau pakai --buat.");
    daftar.push({ nama, pub: normalisasiPub(pub), role: opts.role === "admin" ? "admin" : "user", script: parseList(opts.script) });
    await simpan(file, daftar);
    console.log(`Akun "${nama}" ditambahkan (${daftar.length} akun).`);
    if (baru) console.log(`Private key (simpan sekarang, tidak ditampilkan lagi):\n${baru}`);
  } else if (cmd === "akses") {
    if (!nama || arg3 === undefined) die("Pemakaian: akses <nama> <id,id|->");
    const daftar = await daftarAdmin(file);
    const a = daftar.find((x) => x.nama.toLowerCase() === nama.toLowerCase());
    if (!a) die(`Akun "${nama}" tidak ditemukan.`);
    a.script = parseList(arg3);
    await simpan(file, daftar);
    console.log(`Akses "${a.nama}": ${a.script.join(", ") || "(tidak ada)"}`);
  } else if (cmd === "hapus") {
    if (!nama) die("Pemakaian: hapus <nama>");
    const daftar = await daftarAdmin(file);
    const sisa = daftar.filter((x) => x.nama.toLowerCase() !== nama.toLowerCase());
    if (sisa.length === daftar.length) die(`Akun "${nama}" tidak ditemukan.`);
    await simpan(file, sisa);
    console.log(`Akun "${nama}" dihapus (${sisa.length} akun tersisa).`);
  } else if (cmd === "daftar") {
    const daftar = await daftarAdmin(file);
    for (const a of daftar) console.log(`${a.role.padEnd(5)} ${a.nama}  ${a.pub.slice(0, 12)}…  ${a.role === "admin" ? "semua script" : (a.script.join(",") || "-")}`);
  } else die("Perintah: pub | awal | tambah | akses | hapus | daftar");
} catch (e) { die(e.user ? e.message : (e.message || String(e))); }
