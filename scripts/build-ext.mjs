#!/usr/bin/env node
// Menyusun extension: menyalin modul bersama, lalu membuat zip yang namanya
// memuat versi dari extension/manifest.json, dan menulis download/version.json
// supaya situs tahu nama berkas terbaru.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extDir = path.join(root, "extension");
const outDir = path.join(root, "devchain", "download");

const { version } = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));
if (!/^\d+(\.\d+){0,3}$/.test(version)) throw new Error("Versi manifest tidak valid: " + version);

// Modul kunci (secp256k1) dibundel supaya extension tidak butuh paket npm saat berjalan
execFileSync(path.join(root, "node_modules", ".bin", "esbuild"), [
  path.join(root, "devchain", "js", "kunci.js"), "--bundle", "--format=esm", "--minify",
  "--outfile=" + path.join(extDir, "kunci.js"),
], { stdio: "inherit" });
for (const f of ["vault.js", "admin.js"]) fs.rmSync(path.join(extDir, f), { force: true });

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const file = `devchain-extension-v${version}.zip`;
execFileSync("zip", ["-qr", path.join(outDir, file), "."], { cwd: extDir });
fs.writeFileSync(path.join(outDir, "version.json"), JSON.stringify({ version, file }) + "\n");
console.log(`Extension ${version} -> devchain/download/${file}`);
