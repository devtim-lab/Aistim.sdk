// Paket script per akun: zip berisi script yang boleh dipakai akun itu, dienkripsi ke public key akun.
// Format berkas .bin: [4 byte panjang header (big-endian)] [header JSON] [ciphertext AES-256-GCM]
// Header: { v: 3, w: <record ECIES berisi kunci AES>, iv: <base64> }. Kunci AES dibungkus ke public key akun (kunci.js).
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { buatRecord, bukaRecord } from "./kunci.js";

const b64 = (u) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aesKey = (raw, usage) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);

/** files: { nama: string }. Urutan dan waktu tetap supaya hasil zip sama untuk isi yang sama (dipakai membandingkan versi). */
export function buatZip(files) {
  const o = {};
  for (const k of Object.keys(files).sort()) o[k] = [strToU8(files[k]), { level: 9, mtime: new Date("2000-01-01T00:00:00Z") }];
  return zipSync(o);
}

export function bacaZip(bytes) {
  const o = unzipSync(bytes), r = {};
  for (const k of Object.keys(o)) r[k] = strFromU8(o[k]);
  return r;
}

export async function buatPaket(pubHex, zip, rawKey) {
  const raw = rawKey || crypto.getRandomValues(new Uint8Array(32));
  const w = await buatRecord(pubHex, { k: b64(raw) });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: strToU8(w.id) }, await aesKey(raw, "encrypt"), zip));
  const head = strToU8(JSON.stringify({ v: 3, w, iv: b64(iv) }));
  const out = new Uint8Array(4 + head.length + ct.length);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4); out.set(ct, 4 + head.length);
  return out;
}

function pisah(bytes) {
  const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (n < 2 || n > 65536 || 4 + n > bytes.length) throw new Error("paket rusak");
  const head = JSON.parse(strFromU8(bytes.subarray(4, 4 + n)));
  if (head.v !== 3) throw new Error("versi paket tidak dikenal");
  return { head, ct: bytes.subarray(4 + n) };
}

/** Ambil kunci paket (base64) dengan private key akun. Kunci ini yang disimpan agar pembaruan tidak butuh private key. */
export async function kunciPaket(privHex, bytes) {
  const { k } = await bukaRecord(privHex, pisah(bytes).head.w);
  return k;
}

export async function bukaDenganKunci(kB64, bytes) {
  const { head, ct } = pisah(bytes);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(head.iv), additionalData: strToU8(head.w.id) }, await aesKey(unb64(kB64), "decrypt"), ct));
}

export async function bukaPaket(privHex, bytes) {
  return bukaDenganKunci(await kunciPaket(privHex, bytes), bytes);
}

/** Kunci paket tetap per akun, diturunkan dari rahasia builder, supaya pembaruan paket memakai kunci yang sama. */
export async function turunkanKunci(seed, addr) {
  const k = await crypto.subtle.importKey("raw", strToU8(seed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, strToU8("aistim-paket:" + addr.toLowerCase())));
}

export async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", u8))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
