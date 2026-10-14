// Jembatan fetch lintas domain untuk script di halaman *.erzap.com
// (dipakai olzap.js -> partdistro.com). Script (MAIN world) mengirim
//   window.postMessage({ aistimFetch: { id, url, opts } }, location.origin)
// dan menerima balasan
//   window.postMessage({ aistimFetchResult: { id, ok, status, text, error } }, location.origin)
// Host tujuan dibatasi lagi di background.js.
(function () {
  "use strict";
  if (!/(^|\.)erzap\.com$/i.test(location.hostname)) return;
  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data || !ev.data.aistimFetch) return;
    var q = ev.data.aistimFetch;
    if (!q.id || !q.url) return;
    try {
      chrome.runtime.sendMessage({ tipe: "x-fetch", url: q.url, opts: q.opts || {} }, function (res) {
        var err = chrome.runtime.lastError;
        var out = res || { ok: false, status: 0, error: err ? err.message : "tidak ada respons" };
        out.id = q.id;
        window.postMessage({ aistimFetchResult: out }, location.origin);
      });
    } catch (e) {
      window.postMessage({ aistimFetchResult: { id: q.id, ok: false, status: 0, error: String(e && e.message || e) } }, location.origin);
    }
  });
  // popup menanyakan script mana yang aktif di halaman ini
  try {
    chrome.runtime.onMessage.addListener(function (msg, _from, sendResponse) {
      if (!msg || (msg.tipe !== "aistim-aktif" && msg.tipe !== "devchain-aktif")) return;   // "devchain-*": nama lama, masa peralihan
      var d = document.documentElement;
      var a = ((d.getAttribute("data-aistim") || "") + "," + (d.getAttribute("data-devchain") || "")).split(",").filter(function (x, i, s) { return x && s.indexOf(x) === i; });
      sendResponse({ aktif: a, url: location.href });
    });
  } catch (e) { /* abaikan */ }
  // penanda supaya script tahu jembatan tersedia
  try { document.documentElement.setAttribute("data-aistim-xfetch", "1"); } catch (e) { /* abaikan */ }
})();
