#!/usr/bin/env node
// Membuat extension/scripts/ dari scripts-src/: katalog (index.json) lalu setiap script diperkecil dengan tools/perkecil.mjs.
// Tidak perlu memasang paket apa pun. Berkas yang tidak bisa diperkecil dengan aman dipakai apa adanya.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

// perkecil.mjs memakai acorn bawaan Node, yang butuh --expose-internals: jalankan ulang diri sendiri dengan flag itu.
if (!process.execArgv.includes("--expose-internals")) {
  const r = spawnSync(process.execPath, ["--expose-internals", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
const { perkecil, tersedia } = await import("./perkecil.mjs");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "scripts-src"), out = path.join(root, "extension", "scripts");

execFileSync("node", [path.join(root, "tools", "build-catalog.mjs")], { stdio: "inherit" });

const sumber = fs.readdirSync(src).filter((f) => f.endsWith(".js"));
for (const f of fs.readdirSync(out)) if (f.endsWith(".js") && !sumber.includes(f)) fs.unlinkSync(path.join(out, f));   // buang sisa script yang sudah dihapus

if (!tersedia) console.warn("Peringatan: acorn bawaan Node tidak tersedia; semua script disalin tanpa diperkecil.");
let sebelum = 0, sesudah = 0;
for (const f of sumber) {
  const kode = fs.readFileSync(path.join(src, f), "utf8").replace(/\r\n/g, "\n");   // akhir baris selalu LF supaya hash sama di mana pun
  const r = perkecil(kode);
  if (!r.diperkecil && r.alasan && r.alasan !== "tidak lebih kecil") console.log(`  ${f}: dipakai apa adanya (${r.alasan})`);
  fs.writeFileSync(path.join(out, f), r.kode);
  sebelum += Buffer.byteLength(kode); sesudah += Buffer.byteLength(r.kode);
}
console.log(`Script: ${sumber.length} berkas, ${(sebelum / 1024).toFixed(0)} KB -> ${(sesudah / 1024).toFixed(0)} KB`);
