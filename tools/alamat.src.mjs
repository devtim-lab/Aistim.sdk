// Sumber modul alamat akun (bundel ke extension/alamat.js).
// Build: lihat README ("Membangun alamat.js"). Alamat = 20 byte terakhir keccak256(pubkey tanpa kompresi), gaya Ethereum.
import * as secp from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => Uint8Array.from(s.match(/../g).map((x) => parseInt(x, 16)));
const enc = new TextEncoder();

export function alamatDariPub(pubHex) {
  const raw = secp.ProjectivePoint.fromHex(pubHex).toRawBytes(false).slice(1);
  return "0x" + hex(keccak_256(raw).slice(-20));
}

export function pesanMasuk(extId) { return "aistim-login:" + extId; }

/** Tanda tangani pesan login (hanya di memori), lalu pulihkan alamat dari signature. Signature tidak disimpan. */
export async function alamatDariTandaTangan(privHex, extId) {
  const h = keccak_256(enc.encode(pesanMasuk(extId)));
  const sig = await secp.signAsync(h, unhex(privHex));
  return alamatDariPub(sig.recoverPublicKey(h).toHex(true));
}

/** Tanda tangan perubahan akun.json: kembalikan 128 hex (compact) + 2 hex (recovery). Pesan: aistim-akun:<base>:<sha256 isi baru> */
export async function tandatanganiAkun(privHex, base, shaBaru) {
  const h = keccak_256(enc.encode("aistim-akun:" + base + ":" + shaBaru));
  const sig = await secp.signAsync(h, unhex(privHex));
  return sig.toCompactHex() + sig.recovery.toString(16).padStart(2, "0");
}
