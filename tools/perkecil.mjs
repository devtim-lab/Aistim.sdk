// Pengecil JavaScript buatan sendiri, tanpa pemasangan paket apa pun.
// Memakai pengurai acorn yang sudah ada di dalam Node (butuh flag --expose-internals; build-scripts.mjs menyalakannya sendiri).
// Yang dilakukan hanya membuang komentar dan spasi/baris yang tidak perlu; nama variabel tidak diubah dan kode tetap terbaca.
// Keamanan: hasil diurai ulang dan pohon sintaksnya (AST) harus SAMA PERSIS dengan sumber. Kalau tidak, kode asli dipakai apa adanya.
import { createRequire } from "node:module";

let acorn = null;
try { acorn = createRequire(import.meta.url)("internal/deps/acorn/acorn/dist/acorn"); } catch { /* tanpa --expose-internals */ }
export const tersedia = !!acorn;

const OPSI = { ecmaVersion: "latest", sourceType: "script", allowHashBang: true, allowReturnOutsideFunction: true };
const ID = (c) => /[A-Za-z0-9_$]/.test(c) || c === String.fromCharCode(92) || c.charCodeAt(0) > 127;   // huruf/angka/_/$/escape/non-ASCII
const BARIS = new RegExp("[" + String.fromCharCode(10, 13, 0x2028, 0x2029) + "]");   // pemisah baris

function perluSpasi(prev, text) {
  const a = prev.text[prev.text.length - 1], b = text[0];
  if (ID(a) && ID(b)) return true;                                         // a b
  if ((a === "+" && b === "+") || (a === "-" && b === "-")) return true;   // a + +b
  if (a === "/" && (b === "/" || b === "*")) return true;                  // a / /re/
  if (a === "<" && b === "!") return true;                                 // a < !--b
  if (b === "." && /^[0-9]/.test(prev.text)) return true;                  // 1 .toString()
  return false;
}

function pemisah(prev, text, adaBaris) {
  if (adaBaris) {
    // baris baru tetap dipertahankan (menjaga aturan titik koma otomatis), kecuali di tempat yang pasti aman
    const aman = ";{([,".includes(prev.text) || "}])[,;".includes(text[0]) && text[0] !== "[";
    if (!aman) return "\n";
  }
  return perluSpasi(prev, text) ? " " : "";
}

function potong(kode) {
  let out = "", prev = null, prevEnd = 0;
  for (const tok of acorn.tokenizer(kode, OPSI)) {
    const text = kode.slice(tok.start, tok.end);
    if (prev) {
      const gap = kode.slice(prevEnd, tok.start);
      if (gap) out += pemisah(prev, text, BARIS.test(gap));
    }
    out += text;
    prev = { text };
    prevEnd = tok.end;
  }
  return out + "\n";
}

const polos = (ast) => JSON.stringify(ast, (k, v) => (k === "start" || k === "end" ? undefined : v));

/** Kembalikan { kode, diperkecil, alasan }. diperkecil=false berarti kode asli dikembalikan. */
export function perkecil(kode) {
  if (!acorn) return { kode, diperkecil: false, alasan: "acorn tidak tersedia (jalankan dengan --expose-internals)" };
  const sumber = kode.replace(/\r\n/g, "\n");
  let asal;
  try { asal = polos(acorn.parse(sumber, OPSI)); } catch (e) { return { kode: sumber, diperkecil: false, alasan: "sumber tidak bisa diurai: " + e.message }; }
  let hasil;
  try {
    hasil = potong(sumber);
    if (polos(acorn.parse(hasil, OPSI)) !== asal) return { kode: sumber, diperkecil: false, alasan: "pohon sintaks berbeda" };
  } catch (e) { return { kode: sumber, diperkecil: false, alasan: "hasil tidak bisa diurai: " + e.message }; }
  if (hasil.length >= sumber.length) return { kode: sumber, diperkecil: false, alasan: "tidak lebih kecil" };
  return { kode: hasil, diperkecil: true, alasan: "" };
}
