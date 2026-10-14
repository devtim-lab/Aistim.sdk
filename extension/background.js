// Service worker: sinkronkan script injeksi secara berkala agar perubahan di
// situs ikut terbawa tanpa mengunduh ulang extension.
import { syncScripts } from "./sync.js";

const ALARM = "aistim-sync";
const X_FETCH_ALLOW = ["partdistro.com"]; // host yang boleh diakses lewat jembatan x-fetch

function jadwal() {
  chrome.alarms.clear("devchain-sync");   // nama alarm lama
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });   // cek pembaruan tiap menit (yang tidak berubah tidak diunduh ulang)
}

chrome.runtime.onInstalled.addListener(() => { jadwal(); syncScripts().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { jadwal(); syncScripts().catch(() => {}); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncScripts().catch(() => {}); });

// Sinkron sesuai permintaan (popup atau pengujian); hasilnya dikirim balik.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.tipe !== "sync") return false;
  syncScripts().then(sendResponse, () => sendResponse({ error: "gagal" }));
  return true;
});

// Jembatan fetch lintas domain (content.js -> sini). Hanya dari halaman
// *.erzap.com dan hanya ke host di X_FETCH_ALLOW, supaya extension tidak
// jadi proxy terbuka untuk situs lain.
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (!req || req.tipe !== "x-fetch") return false;
  (async () => {
    try {
      if (sender.id !== chrome.runtime.id) throw new Error("pengirim tidak dikenal");
      const asal = sender.url ? new URL(sender.url) : null;
      if (!asal || !/(^|\.)erzap\.com$/i.test(asal.hostname)) throw new Error("asal tidak diizinkan");
      const target = new URL(req.url);
      if (target.protocol !== "https:" || !X_FETCH_ALLOW.some((h) => target.hostname === h || target.hostname.endsWith("." + h))) {
        throw new Error("host tidak diizinkan: " + target.hostname);
      }
      // Dibatasi ketat: hanya GET ke jalur pencarian, tanpa body, dan hanya dua header yang dikenal.
      if (!target.pathname.startsWith("/main/pencarian")) throw new Error("jalur tidak diizinkan");
      const opts = req.opts || {};
      if (opts.method && String(opts.method).toUpperCase() !== "GET") throw new Error("metode tidak diizinkan");
      const headers = {};
      for (const k of ["Accept", "X-Requested-With"]) { const v = (opts.headers || {})[k]; if (typeof v === "string" && v.length < 100) headers[k] = v; }
      const res = await fetch(target.href, { method: "GET", headers, credentials: "include", cache: "no-store", redirect: "follow" });
      sendResponse({ ok: res.ok, status: res.status, url: res.url, text: await res.text() });
    } catch (e) {
      sendResponse({ ok: false, status: 0, error: String(e && e.message || e) });
    }
  })();
  return true;
});
