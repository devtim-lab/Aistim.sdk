#!/usr/bin/env node
// Menandatangani katalog extension/scripts/index.json supaya extension hanya mau menjalankan script dari GitHub
// yang benar-benar berasal dari pemilik kunci. Tiap script dicatat SHA-256-nya, lalu daftar script ditandatangani
// (ECDSA P-256 + SHA-256). Extension menyimpan kunci publik; kunci pribadi TIDAK PERNAH masuk repo.
//
//   node tools/tanda-tangan-katalog.mjs --buat-kunci <berkas.pem>   buat pasangan kunci (sekali saja), cetak kunci publik
//   node tools/tanda-tangan-katalog.mjs [<berkas.pem>]              tanda tangani katalog (atau env KATALOG_KUNCI berisi PEM)
//   node tools/tanda-tangan-katalog.mjs --cek                       periksa katalog dengan kunci publik di extension/sync.js
//
// Jalankan SETELAH tools/build-scripts.mjs (yang membuat ulang index.json tanpa tanda tangan).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "extension", "scripts");
const indexPath = path.join(dir, "index.json");
const arg = process.argv[2];

if (arg === "--buat-kunci") {
  const out = process.argv[3];
  if (!out) { console.error("Pakai: --buat-kunci <berkas.pem> (simpan di luar repo)"); process.exit(1); }
  if (fs.existsSync(out)) { console.error("Berkas sudah ada, tidak ditimpa: " + out); process.exit(1); }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  console.log("Kunci pribadi disimpan di: " + out + "  (RAHASIA, cadangkan, jangan commit)");
  console.log("Kunci publik (tempel ke KUNCI_VERIF di extension/sync.js):");
  console.log(publicKey.export({ type: "spki", format: "der" }).toString("base64"));
  process.exit(0);
}

if (arg === "--cek") {
  const { verifikasiKatalog } = await import("../extension/sync.js");
  const hasil = await verifikasiKatalog(fs.readFileSync(indexPath, "utf8"));
  if (!hasil) { console.error("GAGAL: tanda tangan katalog tidak cocok dengan kunci publik di extension."); process.exit(1); }
  for (const s of hasil.scripts) {
    const h = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, s.file))).digest("hex");
    if (h !== s.sha256) { console.error(`GAGAL: SHA-256 ${s.file} tidak cocok.`); process.exit(1); }
  }
  console.log(`OK: katalog valid, ${hasil.scripts.length} script cocok.`);
  process.exit(0);
}

let pem = process.env.KATALOG_KUNCI || "";
if (arg) pem = fs.readFileSync(arg, "utf8");
if (!pem.includes("PRIVATE KEY")) {
  console.warn("Tanda tangan dilewati: tidak ada kunci pribadi (argumen berkas .pem atau env KATALOG_KUNCI). Katalog tetap tanpa tanda tangan; extension memakai salinan bawaan.");
  process.exit(0);
}
const data = JSON.parse(fs.readFileSync(indexPath, "utf8"));
delete data.tandatangan;
for (const s of data.scripts) s.sha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, s.file))).digest("hex");
const badan = JSON.stringify(data.scripts);
// ECDSA menghasilkan tanda tangan berbeda tiap kali. Kalau isi katalog sama dengan versi di commit terakhir,
// pakai ulang tanda tangan lama (masih sah untuk isi yang sama) supaya tidak ada commit otomatis tanpa perubahan.
let lama = null;
try {
  const prev = JSON.parse(execFileSync("git", ["show", "HEAD:extension/scripts/index.json"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8"));
  if (prev && typeof prev.tandatangan === "string" && JSON.stringify(prev.scripts) === badan) lama = prev.tandatangan;
} catch { /* belum ada versi sebelumnya */ }
data.tandatangan = lama || crypto.sign("sha256", Buffer.from(badan), { key: pem, dsaEncoding: "ieee-p1363" }).toString("base64");
fs.writeFileSync(indexPath, JSON.stringify(data, null, 2) + "\n");
console.log(lama ? `Katalog tidak berubah: tanda tangan lama dipakai ulang (${data.scripts.length} script).` : `Katalog ditandatangani: ${data.scripts.length} script.`);
