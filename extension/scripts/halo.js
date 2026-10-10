// ==UserScript==
// @name         Halo Dunia
// @version      1.0.0
// @description  Contoh script popup: menampilkan sapaan dan waktu.
// @tipe         popup
// ==/UserScript==
// Setiap script mengekspor run(konteks) dan mengembalikan teks hasil.
export function run({ user }) {
  return `Halo, ${user.name}! Sekarang ${new Date().toLocaleString("id-ID")}.`;
}
