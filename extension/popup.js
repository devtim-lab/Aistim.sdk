// Popup extension Aistim Tool: manajer script gaya Tampermonkey. Menampilkan script dari katalog, status engine userScripts,
// dan menyinkronkan script ke Chrome. Kode script tidak dijalankan di sini; script dijalankan di situs.

import { migrasiKunci, ambilFile, getOff, setOff, getSembunyi, getStatus, katalogInject, originsDibutuhkan, syncScripts, userScriptsReady } from "./sync.js";

const $ = (id) => document.getElementById(id);
let sembunyi = new Set();
let halaman = null;   // { url, aktif:Set } untuk tab erzap yang sedang dibuka, atau null

function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...children);
  return n;
}

// ---- manajer script (gaya Tampermonkey/Aistim) ----
let injectDaftar = [];
let nonaktif = new Set();
let statusSync = null;
function imsg(text, kind = "") { const m = $("pesan"); m.textContent = text; m.className = kind; }

function ringkasMatch(m) { return m.replace(/^https?:\/\/(\*\.)?/, ""); }
function jam(t) { return new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }

function renderEngine() {
  const siap = userScriptsReady();
  const e = $("engine");
  e.className = "kartu " + (siap ? "ok" : "warn");
  $("engine-judul").textContent = siap ? "Engine Aktif" : "Engine belum aktif";
  $("engine-info").textContent = !siap ? "Aktifkan \"Izinkan skrip pengguna\" untuk Aistim Tool"
    : statusSync ? `Sinkron ${jam(statusSync.waktu)} · ${statusSync.ok} script berjalan` + (statusSync.lewat ? ` · ${statusSync.lewat} dilewati` : "") + (statusSync.sumber === "github" ? " · GitHub ✓" : statusSync.sumber ? " · bawaan" : "")
    : "Belum disinkronkan";
  $("engine-help").hidden = siap;
  $("buka-detail").hidden = siap;
  const h = $("engine-halaman");
  if (h) {
    h.hidden = !(siap && halaman);
    if (halaman) {
      const n = halaman.aktif.size;
      h.className = n ? "ok" : "warn";
      h.textContent = !halaman.terjangkau ? "Halaman erzap ini belum bisa diperiksa. Muat ulang halaman."
        : n ? `Aktif di halaman ini: ${n} script` : "Belum ada script aktif di halaman ini. Muat ulang halaman.";
    }
  }
}

// Script yang selalu paling atas di daftar (id "rekam" = devtool)
const PIN = ["rekam"];
const urutPin = (arr) => [...arr].sort((a, b) => (PIN.includes(b.id) ? 1 : 0) - (PIN.includes(a.id) ? 1 : 0));

function renderManager() {
  const q = $("cari-script").value.trim().toLowerCase();
  const items = urutPin(injectDaftar).filter((s) => !sembunyi.has(s.id)).filter((s) => !q || s.nama.toLowerCase().includes(q) || s.matches.some((m) => m.toLowerCase().includes(q)));
  $("empty").hidden = injectDaftar.length > 0;
  $("cari-combo").hidden = injectDaftar.length === 0;
  $("manager").replaceChildren(...items.map((s) => {
    const nyala = !nonaktif.has(s.id);
    const cb = el("input", { type: "checkbox", checked: nyala });
    cb.setAttribute("role", "switch");
    cb.setAttribute("aria-label", "Aktifkan " + s.nama);
    cb.dataset.id = s.id;
    cb.addEventListener("change", () => ubahInject(s, cb));
    const aktifDisini = halaman && halaman.aktif.has(s.id);
    const harusAktif = halaman && nyala && s.matches.some((m) => cocokUrl(m, halaman.url));
    const terpasang = statusSync && statusSync.versi && statusSync.versi[s.id];
    const chips = s.matches.slice(0, 2).map((m) => el("span", { className: "chip", textContent: ringkasMatch(m), title: m }));
    if (s.matches.length > 2) chips.push(el("span", { className: "chip", textContent: `+${s.matches.length - 2}` }));
    const li = el("li", { className: (nyala ? "on" : "off") + (aktifDisini ? " live" : harusAktif ? " tunggu" : "") },
      el("div", { className: "isi" },
        el("div", { className: "baris" },
          el("span", { className: "nama", textContent: s.nama })),
        el("div", { className: "chips" }, ...chips)),
      el("div", { className: "kanan" },
        el("span", { className: "ver", textContent: "v" + (terpasang || s.versi) }),
        el("label", { className: "switch" }, cb, el("span"))));
    li.dataset.id = s.id;
    return li;
  }));
}

/** Cocokkan URL dengan pola match userscript (*://host/path*). */
function cocokUrl(pola, url) {
  try {
    const m = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pola);
    if (!m) return false;
    const u = new URL(url);
    if (m[1] !== "*" && m[1] + ":" !== u.protocol) return false;
    const host = m[2];
    if (host === "*") { /* semua host */ }
    else if (host.startsWith("*.")) { const b = host.slice(2); if (u.hostname !== b && !u.hostname.endsWith("." + b)) return false; }
    else if (u.hostname !== host) return false;
    const re = new RegExp("^" + m[3].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return re.test(u.pathname + u.search);
  } catch { return false; }
}

/** Periksa tab yang sedang dibuka: script mana yang benar-benar aktif di sana. */
async function cekHalaman() {
  halaman = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https:\/\/([^/]+\.)?erzap\.com\//.test(tab.url || "")) return;
    let r = null;
    try { r = await chrome.tabs.sendMessage(tab.id, { tipe: "aistim-aktif" }); } catch { r = null; }
    // tab yang dibuka sebelum extension diperbarui masih memakai content script lama (nama pesan lama)
    if (!r) { try { r = await chrome.tabs.sendMessage(tab.id, { tipe: "devchain-aktif" }); } catch { r = null; } }
    halaman = { url: tab.url, aktif: new Set(r && Array.isArray(r.aktif) ? r.aktif : []), terjangkau: !!r };
  } catch { halaman = null; }
}


async function setupInject() {
  let galat = "";
  try { injectDaftar = await katalogInject(true); } catch (e) { injectDaftar = []; galat = String(e && e.message || e); }
  nonaktif = new Set(await getOff());
  sembunyi = new Set(await getSembunyi());
  statusSync = await getStatus();
  await cekHalaman();
  $("cari-script").value = "";
  renderEngine(); renderManager();
  if (!injectDaftar.length) $("empty").textContent = "Katalog script tidak terbaca" + (galat ? " (" + galat + ")" : "") + ". Muat ulang extension.";
}

/** Perbarui daftar dari GitHub (terverifikasi) setelah popup tampil; bila gagal, daftar bawaan tetap dipakai. */
async function segarkanDaftar() {
  try {
    const d = await katalogInject();
    if (d.length && JSON.stringify(d) !== JSON.stringify(injectDaftar)) { injectDaftar = d; renderManager(); renderEngine(); }
  } catch { /* tetap pakai daftar bawaan */ }
}

async function jalankanSync(diam = false) {
  const tombol = $("sync");
  tombol.classList.add("putar");
  if (!diam) imsg("Menyinkronkan...");
  try {
    const lap = await syncScripts();
    statusSync = await getStatus();
    await cekHalaman();
    renderEngine(); renderManager();
    if (lap.error === "izin-skrip") imsg("Aktifkan \"Izinkan skrip pengguna\" untuk extension ini.", "err");
    else if (lap.error) imsg("Tidak bisa memuat script. Periksa internetmu.", "err");
    else if (!diam) imsg(`${lap.ok.length} script berjalan` + (lap.lewat.length ? `, ${lap.lewat.length} dilewati` : "") + ".", "ok");
    else imsg("");
  } finally { tombol.classList.remove("putar"); }
}

async function ubahInject(s, cb) {
  const nyala = cb.checked;
  cb.disabled = true;
  try {
    if (nyala && userScriptsReady()) {
      const kurang = await originsDibutuhkan([s]);
      if (kurang.length) {
        let ok = false;
        try { ok = await chrome.permissions.request({ origins: kurang }); } catch { ok = false; }
        if (!ok) { cb.checked = false; imsg("Izin akses situs ditolak.", "err"); return; }
      }
    }
    if (nyala) nonaktif.delete(s.id); else nonaktif.add(s.id);
    await setOff([...nonaktif]);
    if (!userScriptsReady()) { imsg("Pilihan disimpan. Aktifkan dulu \"Izinkan skrip pengguna\".", "err"); renderManager(); return; }
    imsg("Menyinkronkan...");
    await jalankanSync(true);
    imsg(nyala ? `${s.nama} dinyalakan.` : `${s.nama} dimatikan.`, "ok");
  } finally { cb.disabled = false; }
}

$("sync").addEventListener("click", () => jalankanSync(false));
$("cari-script").addEventListener("input", renderManager);
// Pintasan ke halaman Detail extension (tempat tombol "Izinkan skrip pengguna")
$("buka-detail").addEventListener("click", () => { chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id }); });

// Scrollbar daftar script: muncul saat digulir atau kursor di atas daftar, hilang sendiri setelah berhenti
{
  let t = 0;
  $("manager").addEventListener("scroll", () => {
    $("manager").classList.add("gulir");
    clearTimeout(t);
    t = setTimeout(() => $("manager").classList.remove("gulir"), 900);
  }, { passive: true });
}

// ---- combobox Cari script: ketik untuk menyaring daftar, atau buka dropdown untuk memilih satu script ----
{
  const inp = $("cari-script"), list = $("cari-list"), btn = $("cari-buka"), box = $("cari-combo");
  let aktif = -1;
  const opsi = (q) => urutPin(injectDaftar).filter((s) => !sembunyi.has(s.id)).filter((s) => !q || s.nama.toLowerCase().includes(q));
  const tutup = () => { list.hidden = true; inp.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-expanded", "false"); aktif = -1; };
  const pilih = (s) => { inp.value = s.nama; tutup(); renderManager(); };
  function buka(semua) {
    const o = opsi(semua ? "" : inp.value.trim().toLowerCase());
    list.replaceChildren(...(o.length ? o.map((s) => {
      const li = el("li", { textContent: s.nama }, el("span", { textContent: "v" + s.versi }));
      li.setAttribute("role", "option");
      li.addEventListener("mousedown", (e) => { e.preventDefault(); pilih(s); });
      return li;
    }) : [el("li", { className: "none", textContent: "Tidak ada script" })]));
    list.hidden = false; aktif = -1;
    inp.setAttribute("aria-expanded", "true"); btn.setAttribute("aria-expanded", "true");
  }
  const sorot = (i) => {
    const li = [...list.querySelectorAll("li:not(.none)")];
    if (!li.length) return;
    aktif = (i + li.length) % li.length;
    li.forEach((n, k) => n.classList.toggle("aktif", k === aktif));
    li[aktif].scrollIntoView({ block: "nearest" });
  };
  inp.addEventListener("input", () => buka(false));
  inp.addEventListener("focus", () => buka(false));
  btn.addEventListener("mousedown", (e) => { e.preventDefault(); if (list.hidden) { inp.focus(); buka(true); } else tutup(); });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) buka(false); sorot(aktif + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (list.hidden) buka(false); sorot(aktif - 1); }
    else if (e.key === "Enter" && aktif >= 0) { e.preventDefault(); const o = opsi(inp.value.trim().toLowerCase()); if (o[aktif]) pilih(o[aktif]); }
    else if (e.key === "Escape") tutup();
  });
  document.addEventListener("mousedown", (e) => { if (!box.contains(e.target)) tutup(); });
}

// Tekan lama pada kolom isian: muncul menu Tempel / Salin / Potong / Pilih semua
// (menu bawaan browser sering tidak muncul di popup). Berlaku untuk semua kolom teks.
{
  const menu = $("menu-tempel");
  const KOLOM = "input[type=text], input[type=password], input[type=search], textarea:not([readonly])";
  let target = null, timer = null, mulai = null;
  const tutup = () => { menu.hidden = true; target = null; };
  const tombolAksi = (a) => menu.querySelector(`[data-aksi="${a}"]`);
  const buka = (input) => {
    target = input;
    const sandi = input.type === "password";
    tombolAksi("salin").hidden = sandi; tombolAksi("potong").hidden = sandi;   // isi kolom sandi/private key tidak disalin
    for (const b of menu.querySelectorAll("button")) b.textContent = { tempel: "Tempel", salin: "Salin", potong: "Potong", semua: "Pilih semua" }[b.dataset.aksi];
    const r = input.getBoundingClientRect();
    menu.hidden = false;
    const w = menu.offsetWidth || 90;
    menu.style.left = Math.max(8, Math.min(r.left + 8, window.innerWidth - w - 8)) + "px";
    menu.style.top = Math.max(8, r.top - 50) + "px";
  };
  const pasang = (input) => {
    if (input.dataset.menu) return;
    input.dataset.menu = "1";
    input.addEventListener("contextmenu", (e) => { e.preventDefault(); buka(input); });
    input.addEventListener("pointerdown", (e) => {
      mulai = { x: e.clientX, y: e.clientY };
      clearTimeout(timer);
      timer = setTimeout(() => buka(input), 500);
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) input.addEventListener(ev, () => clearTimeout(timer));
    input.addEventListener("pointermove", (e) => {
      if (mulai && Math.hypot(e.clientX - mulai.x, e.clientY - mulai.y) > 10) clearTimeout(timer);
    });
  };
  document.querySelectorAll(KOLOM).forEach(pasang);
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !e.target.closest("#menu-tempel") && !e.target.matches(KOLOM)) tutup(); });
  window.addEventListener("scroll", tutup, true);
  const pesan = (a, teks) => { const b = tombolAksi(a); b.textContent = teks; setTimeout(tutup, 900); };
  const salinTeks = async (teks) => {
    try { await navigator.clipboard.writeText(teks); return true; } catch { /* coba cara lama */ }
    try { return document.execCommand("copy"); } catch { return false; }
  };
  const terpilih = (el) => {
    const a = el.selectionStart ?? 0, b = el.selectionEnd ?? 0;
    return b > a ? el.value.slice(a, b) : el.value;   // tanpa blok: seluruh isi kolom
  };
  menu.addEventListener("pointerdown", (e) => e.preventDefault());   // jangan melepas fokus/blok kolom
  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    const el = target;
    if (!btn || !el) return;
    const aksi = btn.dataset.aksi;
    if (aksi === "semua") { el.focus(); el.select(); return tutup(); }
    if (aksi === "salin" || aksi === "potong") {
      const teks = terpilih(el);
      if (!teks) return pesan(aksi, "Kosong");
      if (!(await salinTeks(teks))) return pesan(aksi, "Gagal menyalin");
      if (aksi === "potong") {
        const a = el.selectionStart ?? 0, b = el.selectionEnd ?? 0;
        if (b > a) el.setRangeText("", a, b, "end"); else el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return pesan(aksi, "Tersalin");
    }
    try {
      const teks = (await navigator.clipboard.readText()).trim();
      if (!teks) throw new Error("kosong");
      if (el.tagName === "TEXTAREA") el.setRangeText(teks, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end");
      else el.value = teks;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      tutup();
      el.focus();
    } catch {
      pesan("tempel", "Clipboard kosong");
    }
  });
}

// ---- mulai ----
try { $("ver").textContent = "v" + chrome.runtime.getManifest().version; } catch { /* di luar extension */ }
await migrasiKunci();
$("sync").hidden = false;
try { await setupInject(); } catch { /* tampilkan saja */ }
$("view-memuat").hidden = true;
$("view-user").hidden = false;
segarkanDaftar();
// sinkron script berjalan di latar belakang (tombol sinkron berputar), tidak menahan tampilan
if (userScriptsReady()) jalankanSync(true).catch(() => {});

// ---- salin teks yang diblok (menu salin bawaan browser sering tidak muncul di popup) ----
{
  const tombol = $("salin-pilihan");
  let teks = "";
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    const t = sel ? sel.toString().trim() : "";
    if (t) { teks = t; tombol.textContent = "Salin teks terpilih"; tombol.hidden = false; }
    else if (document.activeElement !== tombol) tombol.hidden = true;
  });
  // jangan sampai menekan tombol menghapus blok
  tombol.addEventListener("pointerdown", (e) => e.preventDefault());
  tombol.addEventListener("click", async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(teks); ok = true; } catch { /* coba cara lama */ }
    if (!ok) { try { ok = document.execCommand("copy"); } catch { ok = false; } }
    tombol.textContent = ok ? "Tersalin" : "Gagal menyalin";
    setTimeout(() => { tombol.hidden = true; }, 1100);
  });
}
