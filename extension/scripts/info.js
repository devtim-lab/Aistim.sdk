// ==UserScript==
// @name         Info Browser
// @version      1.0.0
// @description  Contoh script popup: menampilkan info layar dan bahasa.
// @tipe         popup
// ==/UserScript==
export function run() {
  return [
    `Layar: ${screen.width}x${screen.height}`,
    `Bahasa: ${navigator.language}`,
    `Zona waktu: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  ].join("\n");
}
