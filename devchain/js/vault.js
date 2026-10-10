// Brankas akun: enkripsi per akun dengan kunci turunan dari nama pengguna
// dan PIN/kata sandi. Dipakai oleh browser (login) dan skrip Node
// (scripts/buat-user.mjs), jadi hanya memakai WebCrypto standar.
//
// Format satu akun di user.json:
// {
//   "id":     tag pencarian (hash nama pengguna, bukan nama aslinya),
//   "kdf":    { "name": "PBKDF2-SHA256", "iterations": 600000, "salt": base64 },
//   "cipher": { "name": "AES-256-GCM", "iv": base64, "data": base64 }
// }
// Tidak ada hash kata sandi yang disimpan. "Login berhasil" berarti dekripsi
// berhasil (tag autentikasi GCM cocok). Kekuatannya = kekuatan kata sandi x
// biaya KDF. PIN 6 angka bisa ditebak habis oleh siapa pun yang mengunduh
// file ini, jadi PIN hanya untuk uji coba.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const KDF_NAME = "PBKDF2-SHA256";
export const CIPHER_NAME = "AES-256-GCM";
export const DEFAULT_ITERATIONS = 600000; // rekomendasi OWASP untuk PBKDF2-SHA256
const MIN_ITERATIONS = 100000;
const MAX_ITERATIONS = 5000000;

export function toB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toB64Url(bytes) {
  return toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function normalizeUsername(name) {
  return String(name).normalize("NFKC").trim().toLowerCase();
}

/** Tag pencarian akun: hash nama pengguna (bukan nama aslinya). */
export async function userId(username) {
  const data = enc.encode("devchain:uid:" + normalizeUsername(username));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return toB64Url(digest.slice(0, 16));
}

async function deriveKey(username, secret, salt, iterations) {
  const input = normalizeUsername(username) + "\u0000" + String(secret).normalize("NFKC");
  const material = await crypto.subtle.importKey(
    "raw", enc.encode(input), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function invalid() {
  return Object.assign(new Error("invalid credential"), { code: "auth/invalid-credential" });
}

/** Membuat satu akun terenkripsi. payload = objek JSON apa pun. */
export async function encryptRecord(username, secret, payload, iterations = DEFAULT_ITERATIONS, idName = username) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const id = await userId(idName); // tag pengelolaan; boleh beda dari masukan kunci
  const key = await deriveKey(username, secret, salt, iterations);
  const data = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(id) },
      key,
      enc.encode(JSON.stringify(payload))
    )
  );
  return {
    id,
    kdf: { name: KDF_NAME, iterations, salt: toB64(salt) },
    cipher: { name: CIPHER_NAME, iv: toB64(iv), data: toB64(data) },
  };
}

/** Membuka satu akun. Melempar { code: "auth/invalid-credential" } kalau gagal. */
export async function decryptRecord(record, username, secret) {
  try {
    const { kdf, cipher } = record;
    if (kdf.name !== KDF_NAME || cipher.name !== CIPHER_NAME) throw invalid();
    if (!(kdf.iterations >= MIN_ITERATIONS && kdf.iterations <= MAX_ITERATIONS)) throw invalid();
    const key = await deriveKey(username, secret, fromB64(kdf.salt), kdf.iterations);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(cipher.iv), additionalData: enc.encode(record.id) },
      key,
      fromB64(cipher.data)
    );
    return JSON.parse(dec.decode(plain));
  } catch (err) {
    throw invalid();
  }
}

/**
 * Menghabiskan waktu yang sama seperti login sungguhan, dipakai saat nama
 * pengguna tidak ditemukan supaya keberadaan akun tidak bisa ditebak dari
 * lamanya respons.
 */
export async function dummyDerive(secret) {
  await deriveKey("tidak-ada", secret, new Uint8Array(16), DEFAULT_ITERATIONS);
}
