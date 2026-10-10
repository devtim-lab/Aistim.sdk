#!/usr/bin/env node
// Membuat extension/scripts/index.json dari header ==UserScript== di setiap
// scripts-src/*.js (gaya Tampermonkey). Menambah script cukup menaruh
// satu berkas .js di folder itu; tidak ada daftar yang diedit manual.
//
// Header yang dipakai: @name, @version (x.y.z), @description, @match
// (boleh banyak), @world main, @run-at, dan @tipe popup (script yang
// dijalankan lewat tombol di situs, bukan disuntik ke halaman).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "scripts-src");                      // sumber script (terbaca)
const outDir = path.join(root, "extension", "scripts");         // hasil (dipakai extension)
const RUN_AT = { "document-start": "document_start", "document-end": "document_end", "document-idle": "document_idle" };
const MATCH_RE = /^https?:\/\/(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?\/.*$/i;

function fail(msg) { console.error("Katalog script: " + msg); process.exit(1); }

function parseHeader(src, file) {
  const m = src.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!m) fail(`${file}: header ==UserScript== tidak ada`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^\s*\/\/\s*@([\w-]+)\s*(.*?)\s*$/);
    if (!kv) continue;
    (meta[kv[1]] ||= []).push(kv[2]);
  }
  return meta;
}

const scripts = [];
const names = new Set();
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort()) {
  const id = file.slice(0, -3);
  if (!/^[a-z0-9_-]+$/.test(id)) fail(`${file}: nama berkas hanya huruf kecil, angka, _ dan -`);
  const meta = parseHeader(fs.readFileSync(path.join(dir, file), "utf8"), file);
  const nama = (meta.name || [])[0];
  const versi = (meta.version || [])[0];
  if (!nama) fail(`${file}: @name wajib`);
  if (!/^\d+\.\d+\.\d+$/.test(versi || "")) fail(`${file}: @version harus x.y.z (ada: ${versi})`);
  if (names.has(nama)) fail(`${file}: @name "${nama}" kembar`);
  names.add(nama);
  const tipe = (meta.tipe || [])[0] === "popup" ? "popup" : "inject";
  const entry = { id, tipe, nama, versi, deskripsi: (meta.description || [""])[0], file };
  if (tipe === "inject") {
    const matches = meta.match || [];
    if (!matches.length) fail(`${file}: minimal satu @match`);
    for (const x of matches) if (!MATCH_RE.test(x)) fail(`${file}: @match tidak valid: ${x}`);
    entry.matches = matches;
    entry.world = (meta.world || [])[0] === "main" ? "MAIN" : "USER_SCRIPT";
    entry.runAt = RUN_AT[(meta["run-at"] || [])[0]] || "document_idle";
  }
  scripts.push(entry);
}
scripts.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ scripts }, null, 2) + "\n");
console.log(`Katalog: ${scripts.length} script (${scripts.filter((s) => s.tipe === "inject").length} injeksi)`);
