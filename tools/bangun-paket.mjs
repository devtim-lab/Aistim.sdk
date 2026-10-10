// Membangun paket terenkripsi per akun ke folder Auth (checkout repo Auth ada di argv[2]).
// Pakai: node tools/bangun-paket.mjs <folder-auth>
import fs from "node:fs";
import path from "node:path";
import { buatZip, buatPaket, sha256Hex, turunkanKunci } from "../extension/paket.js";

const auth = path.resolve(process.argv[2] || "auth");
const sc = path.resolve("extension/scripts");
const akun = JSON.parse(fs.readFileSync(path.join(auth, "akun.json"), "utf8")).akun;
const index = JSON.parse(fs.readFileSync(path.join(sc, "index.json"), "utf8"));
const semua = index.scripts;
const out = path.join(auth, "paket");
fs.mkdirSync(out, { recursive: true });
const verPath = path.join(out, "versi.json");
let lama = {};
try { lama = JSON.parse(fs.readFileSync(verPath, "utf8")); } catch {}
const baru = {};
const seed = process.env.PAKET_SEED;
if (!seed || seed.length < 16) throw new Error("PAKET_SEED belum diisi");

for (const a of akun) {
  const boleh = a.role === "admin" || !a.script?.length ? semua : semua.filter((s) => a.script.includes(s.id));
  const files = { "index.json": JSON.stringify({ scripts: boleh }) };
  for (const s of boleh) files[s.file] = fs.readFileSync(path.join(sc, s.file), "utf8");
  const zip = buatZip(files);
  const ver = (await sha256Hex(zip)).slice(0, 16);
  const f = path.join(out, a.addr.toLowerCase() + ".bin");
  baru[a.addr.toLowerCase()] = ver;
  if (lama[a.addr.toLowerCase()] === ver && fs.existsSync(f)) { console.log(a.nama, "tidak berubah"); continue; }
  fs.writeFileSync(f, await buatPaket(a.pub, zip, await turunkanKunci(seed, a.addr)));
  console.log(a.nama, boleh.length, "script,", zip.length, "byte zip ->", ver);
}
// hapus paket akun yang sudah tidak ada
for (const f of fs.readdirSync(out)) if (f.endsWith(".bin") && !(f.slice(0, -4) in baru)) { fs.unlinkSync(path.join(out, f)); console.log("hapus", f); }
fs.writeFileSync(verPath, JSON.stringify(baru, null, 2) + "\n");
