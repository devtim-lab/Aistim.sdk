#!/usr/bin/env node
// Membuat extension/scripts/ dari scripts-src/: katalog (index.json) lalu setiap script diperkecil (minify) dengan esbuild.
// Perlu: npm install esbuild. Berkas yang hasil minify-nya tidak lebih kecil dipakai apa adanya.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "scripts-src"), out = path.join(root, "extension", "scripts");

execFileSync("node", [path.join(root, "tools", "build-catalog.mjs")], { stdio: "inherit" });

const sumber = fs.readdirSync(src).filter((f) => f.endsWith(".js"));
for (const f of fs.readdirSync(out)) if (f.endsWith(".js") && !sumber.includes(f)) fs.unlinkSync(path.join(out, f));   // buang sisa script yang sudah dihapus

let sebelum = 0, sesudah = 0;
for (const f of sumber) {
  const kode = fs.readFileSync(path.join(src, f), "utf8");
  let hasil = kode;
  try {
    const m = transformSync(kode, { minify: true, charset: "utf8", legalComments: "none", target: "es2020" }).code;
    if (Buffer.byteLength(m) < Buffer.byteLength(kode)) hasil = m;
  } catch (e) {
    console.error(`Minify gagal untuk ${f}, dipakai apa adanya: ${e.message.split("\n")[0]}`);
  }
  fs.writeFileSync(path.join(out, f), hasil);
  sebelum += Buffer.byteLength(kode); sesudah += Buffer.byteLength(hasil);
}
console.log(`Script: ${sumber.length} berkas, ${(sebelum / 1024).toFixed(0)} KB -> ${(sesudah / 1024).toFixed(0)} KB`);
