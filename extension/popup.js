// Popup extension Aistim Tool: login dengan private key secp256k1 memakai vault.json milik situs, lalu
// menampilkan akses script akun. Kode script tidak dijalankan di sini
// (Chrome melarang kode jarak jauh di extension); script dijalankan di situs.

import { buatRecord, bukaRecord, masukDenganKunci, normalisasiKunci, kunciBaru, pubDari, normalisasiPub, bangunVault } from "./kunci.js";
import { setPlan, clearPlan, getOff, setOff, getSembunyi, setSembunyi, getStatus, katalogInject, originsDibutuhkan, syncScripts, clearScripts, userScriptsReady } from "./sync.js";

const BASE = "https://devchain.web.app";
const KEY = "devchain.session";

const $ = (id) => document.getElementById(id);
let busy = false;
let sembunyi = new Set();
let halaman = null;   // { url, aktif:Set } untuk tab erzap yang sedang dibuka, atau null
let current = null;   // data akun yang sedang masuk
let katalogCache = [];

const store = {
  async get() {
    try { return (await chrome.storage.local.get(KEY))[KEY] || null; } catch { return null; }
  },
  async set(v) { try { await chrome.storage.local.set({ [KEY]: v }); } catch { /* abaikan */ } },
  async clear() { try { await chrome.storage.local.remove(KEY); } catch { /* abaikan */ } },
};

function say(text, kind = "") {
  const m = $("msg");
  m.textContent = text;
  m.className = kind;
}

async function katalog() {
  try {
    const res = await fetch(chrome.runtime.getURL("scripts/index.json"));
    const data = await res.json();
    return Array.isArray(data.scripts) ? data.scripts : [];
  } catch { return []; }
}

function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...children);
  return n;
}

async function showUser(data) {
  current = data;
  const admin = data.role === "admin";
  $("who").textContent = data.nama || data.username || "";
  $("role").textContent = admin ? "(admin)" : "";
  katalogCache = await katalog();
  $("tabs").hidden = !admin;
  $("logout").hidden = false;
  $("sync").hidden = false;
  renderAkun();
  selectTab("script");
  if (admin) setupAdmin();
  await setupInject(data);
  $("view-login").hidden = true;
  $("view-user").hidden = false;
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
  $("engine-judul").textContent = siap ? "Engine userScripts aktif" : "Engine belum aktif";
  $("engine-info").textContent = !siap ? "Aktifkan \"Izinkan skrip pengguna\" untuk Aistim Tool"
    : statusSync ? `Sinkron ${jam(statusSync.waktu)} · ${statusSync.ok} script berjalan` + (statusSync.lewat ? ` · ${statusSync.lewat} dilewati` : "")
    : "Belum disinkronkan";
  $("engine-help").hidden = siap;
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

function renderManager() {
  const q = $("cari-script").value.trim().toLowerCase();
  const items = injectDaftar.filter((s) => !sembunyi.has(s.id)).filter((s) => !q || s.nama.toLowerCase().includes(q) || s.matches.some((m) => m.toLowerCase().includes(q)));
  $("empty").hidden = injectDaftar.length > 0;
  $("cari-script").hidden = injectDaftar.length === 0;
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
    try { r = await chrome.tabs.sendMessage(tab.id, { tipe: "devchain-aktif" }); } catch { r = null; }
    halaman = { url: tab.url, aktif: new Set(r && Array.isArray(r.aktif) ? r.aktif : []), terjangkau: !!r };
  } catch { halaman = null; }
}

async function setupInject(data) {
  const plan = { admin: data.role === "admin", ids: Array.isArray(data.script) ? data.script : [] };
  await setPlan(plan);
  try { injectDaftar = await katalogInject(plan); } catch { injectDaftar = []; }
  nonaktif = new Set(await getOff());
  sembunyi = new Set(await getSembunyi());
  statusSync = await getStatus();
  await cekHalaman();
  $("cari-script").value = "";
  renderEngine(); renderManager();
  if (userScriptsReady()) await jalankanSync(true);
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

function renderAkun() {
  const nama = (id) => (katalogCache.find((s) => s.id === id) || { nama: id }).nama;
  const list = akunList();
  $("jumlah-akun").textContent = String(list.length);
  $("daftar-akun").replaceChildren(...list.map((a) => el("li", {},
    el("div", { className: "baris" }, el("span", { textContent: a.nama }), el("span", { textContent: a.role })),
    el("small", { textContent: a.role === "admin" ? "Akses semua script" : ((a.script || []).length ? a.script.map(nama).join(", ") : "Belum ada akses script") }))));
}

function selectTab(name) {
  $("pane-script").hidden = name !== "script";
  $("pane-akses").hidden = name !== "akses" || !(current && current.role === "admin");
  $("pane-akun").hidden = name !== "akun" || !(current && current.role === "admin");
  $("pane-enkripsi").hidden = name !== "enkripsi" || !(current && current.role === "admin");
  $("tab-enkripsi").setAttribute("aria-selected", String(name === "enkripsi"));
  $("tab-akun").setAttribute("aria-selected", String(name === "akun"));
  $("tab-script").setAttribute("aria-selected", String(name === "script"));
  $("tab-akses").setAttribute("aria-selected", String(name === "akses"));
}

// ---- panel admin: combobox Akun, tambah akun, akses script ----
let terpilih = null;
let aktif = 0;

function akunList() { return (current && Array.isArray(current.akun)) ? current.akun : []; }
function hasilCari() {
  const q = $("akun").value.trim().toLowerCase();
  return akunList().filter((a) => !q || a.nama.toLowerCase().includes(q));
}

function renderList() {
  const items = hasilCari();
  const ul = $("akun-list");
  if (!items.length) ul.replaceChildren(el("li", { className: "none", textContent: "Akun tidak ditemukan." }));
  else ul.replaceChildren(...items.map((a, i) => {
    const li = el("li", { className: i === aktif ? "on" : "" }, el("span", { textContent: a.nama }), el("span", { textContent: a.role }));
    li.setAttribute("role", "option");
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pilih(a); });
    return li;
  }));
}

function bukaList(v) {
  $("akun-list").hidden = !v;
  $("akun").setAttribute("aria-expanded", String(v));
  if (v) { aktif = 0; renderList(); }
}

function checkboxes(container, name, checked, onChange) {
  container.replaceChildren(...katalogCache.map((s) => {
    const cb = el("input", { type: "checkbox", value: s.id, checked: checked.includes(s.id) });
    cb.dataset.izin = name + "-" + s.id;
    cb.addEventListener("change", onChange);
    return el("label", {}, cb, s.nama);
  }));
}

function ids(container) {
  return [...container.querySelectorAll("input:checked")].map((c) => c.value);
}

let hasilVault = "";   // vault.json terbaru hasil perubahan admin (belum di-push)
let keBaru = null;     // private key akun yang baru dibuat lewat tombol "Buat key baru"

const sendiriAkun = (a) => a.pub === current.pub;

function tampilkanHasil(pesan) {
  $("hasil-vault").hidden = false;
  $("vmsg").textContent = pesan;
}

/** Tulis ulang vault dari daftar akun yang baru; perubahan disimpan di sesi dan siap diunduh. */
async function terapkanDaftar(daftar, pesan) {
  const { akun, vault } = await bangunVault(daftar);
  current.akun = akun;
  await store.set(current);
  hasilVault = JSON.stringify(vault, null, 2) + "\n";
  renderAkun();
  tampilkanHasil(pesan + " Unduh vault.json, ganti devchain/vault.json di repo, lalu push.");
  return akun;
}

function pilih(a) {
  terpilih = a;
  $("akun").value = a.nama;
  bukaList(false);
  // Form tambah akun dan daftar akses saling menggantikan
  $("form-tambah").hidden = true;
  $("tambah-akun").setAttribute("aria-expanded", "false");
  $("terpilih").hidden = false;
  $("terpilih-nama").textContent = a.nama;
  const sendiri = sendiriAkun(a);
  $("hapus-akun").textContent = "Hapus akun";
  if (sendiri) {
    // Akun sendiri: centang = tampil dan berjalan; tanpa centang = dihentikan dan disembunyikan di browser ini
    $("aksi-akun").hidden = true;
    checkboxes($("izin"), "p", katalogCache.map((s) => s.id).filter((id) => !sembunyi.has(id)), async (e) => {
      const id = e.target.value;
      if (e.target.checked) sembunyi.delete(id); else sembunyi.add(id);
      await setSembunyi([...sembunyi]);
      renderManager();
      if (userScriptsReady()) await jalankanSync(true);
    });
  } else if (a.role === "admin") {
    $("aksi-akun").hidden = false;
    $("simpan-akses").hidden = true;
    checkboxes($("izin"), "p", katalogCache.map((s) => s.id), () => {});
    $("izin").querySelectorAll("input").forEach((cb) => { cb.disabled = true; });
  } else {
    // Akun lain: admin mengatur akses lalu menyimpan
    $("aksi-akun").hidden = false;
    $("simpan-akses").hidden = false;
    checkboxes($("izin"), "p", a.script || [], () => {});
  }
}

function setupAdmin() {
  terpilih = null;
  keBaru = null;
  $("akun").value = "";
  $("terpilih").hidden = true;
  $("form-tambah").hidden = true;
  $("hasil-vault").hidden = true;
  hasilVault = "";
  $("key-baru").hidden = true;
  $("tambah-akun").setAttribute("aria-expanded", "false");
  $("akun-kosong").hidden = akunList().length > 0;
  $("t-msg").textContent = "";
  checkboxes($("t-izin"), "t", [], () => {});
}

function tmsg(text, kind = "") { const m = $("t-msg"); m.textContent = text; m.className = kind; }

async function buatAkun(e) {
  e.preventDefault();
  const nama = $("t-nama").value.trim();
  const admin = $("t-admin-role").checked;
  let pub;
  try { pub = normalisasiPub($("t-pub").value); } catch (err) { return tmsg(err.message, "err"); }
  $("t-buat").disabled = true; tmsg("Mengenkripsi...");
  try {
    const daftar = [...akunList(), { nama, pub, role: admin ? "admin" : "user", script: admin ? [] : ids($("t-izin")) }];
    await terapkanDaftar(daftar, `Akun "${nama}" ditambahkan.`);
    $("akun-kosong").hidden = true;
    $("t-nama").value = ""; $("t-pub").value = ""; $("t-admin-role").checked = false;
    checkboxes($("t-izin"), "t", [], () => {});
    tmsg(`Akun "${nama}" siap.`, "ok");
  } catch (err) {
    tmsg(err && err.user ? err.message : "Gagal membuat akun.", "err");
  } finally { $("t-buat").disabled = false; }
}

function showLogin() {
  $("kunci").value = ""; say("");
  $("belum").hidden = true;
  $("view-user").hidden = true;
  $("view-login").hidden = false;
}

async function submit(e) {
  e.preventDefault();
  if (busy) return;
  $("belum").hidden = true;
  let priv;
  try { priv = normalisasiKunci($("kunci").value); } catch (err) { return say(err.message, ""); }
  busy = true; $("masuk").disabled = true;
  say("Memproses...", "busy");
  try {
    let res;
    try {
      res = await fetch(BASE + "/vault.json", { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error("net"), { net: true });
    } catch { throw Object.assign(new Error("net"), { net: true }); }
    const vault = await res.json();
    const r = await masukDenganKunci(vault, priv);
    if (r.status === "belum") {
      say("");
      $("pub-kamu").textContent = r.pub;
      $("belum").hidden = false;
      return;
    }
    const data = r.data;
    data.username = data.nama;
    await store.set(data);
    $("kunci").value = "";
    await showUser(data);
  } catch (err) {
    say(err && err.net ? "Tidak bisa memuat daftar akun. Periksa internetmu." : "Private key tidak cocok dengan akun mana pun.", "");
  } finally {
    busy = false; $("masuk").disabled = false;
  }
}

$("logout").addEventListener("click", async () => { await clearScripts().catch(() => {}); await clearPlan().catch(() => {}); await store.clear(); current = null; hasilVault = ""; $("logout").hidden = true; $("sync").hidden = true; showLogin(); });
$("tab-script").addEventListener("click", () => selectTab("script"));
$("sync").addEventListener("click", () => jalankanSync(false));
$("cari-script").addEventListener("input", renderManager);
$("tab-akses").addEventListener("click", () => selectTab("akses"));
$("tab-akun").addEventListener("click", () => selectTab("akun"));
$("tab-enkripsi").addEventListener("click", () => { isiAkunEnkripsi(); selectTab("enkripsi"); });

// ---- tab Enkripsi (admin): enkripsi/dekripsi teks dengan public key akun ----
const PREFIX = "aistim1:";
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
function emsg(text, kind = "") { const m = $("e-msg"); m.textContent = text; m.className = "kecil " + kind; }
function isiAkunEnkripsi() {
  const sel = $("e-akun"), lama = sel.value;
  sel.replaceChildren(...akunList().map((a) => el("option", { value: a.pub, textContent: a.nama + (a.role === "admin" ? " (admin)" : "") })));
  if (lama) sel.value = lama;
}
$("e-enkripsi").addEventListener("click", async () => {
  const teks = $("e-teks").value;
  if (!teks) return emsg("Isi teks dulu.", "err");
  if (!$("e-akun").value) return emsg("Pilih akun tujuan.", "err");
  try {
    const rec = await buatRecord($("e-akun").value, { t: teks });
    $("e-hasil").value = PREFIX + b64(JSON.stringify(rec));
    $("e-hasil").hidden = false; $("e-salin").hidden = false;
    emsg("Terenkripsi. Hanya pemilik private key akun itu yang bisa membukanya.");
  } catch { emsg("Gagal mengenkripsi.", "err"); }
});
$("e-salin").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("e-hasil").value); emsg("Hasil disalin."); } catch { $("e-hasil").select(); emsg("Pilih lalu salin manual.", "err"); }
});
$("d-dekripsi").addEventListener("click", async () => {
  const raw = $("d-teks").value.trim();
  $("d-hasil").hidden = true;
  if (!raw.startsWith(PREFIX)) return emsg("Format teks tidak dikenali.", "err");
  try {
    const kunci = normalisasiKunci($("d-kunci").value);
    const data = await bukaRecord(kunci, JSON.parse(unb64(raw.slice(PREFIX.length))));
    $("d-hasil").value = String(data.t ?? ""); $("d-hasil").hidden = false;
    $("d-kunci").value = "";
    emsg("Berhasil didekripsi.");
  } catch (err) { emsg(err && err.user ? err.message : "Private key tidak cocok atau teks rusak.", "err"); }
});
$("akun").addEventListener("focus", () => bukaList(true));
$("akun").addEventListener("input", () => {
  // Kolom dikosongkan atau diubah: sembunyikan daftar script akun sebelumnya
  if (terpilih && $("akun").value.trim() !== terpilih.nama) { terpilih = null; $("terpilih").hidden = true; }
  bukaList(true);
});
$("akun").addEventListener("keydown", (e) => {
  const n = hasilCari().length;
  if (e.key === "ArrowDown") { e.preventDefault(); if ($("akun-list").hidden) bukaList(true); else { aktif = n ? (aktif + 1) % n : 0; renderList(); } }
  else if (e.key === "ArrowUp") { e.preventDefault(); aktif = n ? (aktif - 1 + n) % n : 0; renderList(); }
  else if (e.key === "Enter" && !$("akun-list").hidden && n) { e.preventDefault(); pilih(hasilCari()[aktif]); }
  else if (e.key === "Escape") bukaList(false);
});
document.addEventListener("click", (e) => { if (!e.target.closest(".combo")) bukaList(false); });
$("tambah-akun").addEventListener("click", () => {
  const open = $("form-tambah").hidden;
  $("form-tambah").hidden = !open;
  $("tambah-akun").setAttribute("aria-expanded", String(open));
  if (open) { terpilih = null; $("terpilih").hidden = true; $("akun").value = ""; bukaList(false); }
  tmsg("");
});
$("form-tambah").addEventListener("submit", buatAkun);
$("form-login").addEventListener("submit", submit);
// Tekan lama pada kolom: muncul menu "Tempel" seperti di aplikasi lain
// (menu tempel bawaan browser sering tidak muncul di popup).
{
  const menu = $("menu-tempel"), tombol = menu.querySelector("button");
  let target = null, timer = null, mulai = null;
  const tutup = () => { menu.hidden = true; target = null; };
  const buka = (input) => {
    target = input;
    const r = input.getBoundingClientRect();
    menu.hidden = false;
    const w = menu.offsetWidth || 90;
    menu.style.left = Math.max(8, Math.min(r.left + 16, window.innerWidth - w - 8)) + "px";
    menu.style.top = Math.max(8, r.top - 50) + "px";
  };
  for (const input of document.querySelectorAll("input[data-tempel]")) {
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
  }
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !e.target.closest("#menu-tempel") && !e.target.matches("input[data-tempel]")) tutup(); });
  window.addEventListener("scroll", tutup, true);
  tombol.addEventListener("click", async () => {
    const input = target;
    if (!input) return tutup();
    try {
      const teks = (await navigator.clipboard.readText()).trim();
      if (!teks) throw new Error("kosong");
      input.value = teks;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      tutup();
      input.focus();
    } catch {
      tombol.textContent = "Clipboard kosong";
      setTimeout(() => { tombol.textContent = "Tempel"; tutup(); }, 1200);
    }
  });
}
$("lihat-kunci").addEventListener("click", (e) => {
  const b = e.currentTarget;
  const tampil = $("kunci").type === "password";
  $("kunci").type = tampil ? "text" : "password";
  b.querySelector(".mata").hidden = tampil;
  b.querySelector(".mata-coret").hidden = !tampil;
  b.setAttribute("aria-pressed", String(tampil));
  b.setAttribute("aria-label", tampil ? "Sembunyikan private key" : "Tampilkan private key");
});
$("t-buat-key").addEventListener("click", () => {
  keBaru = kunciBaru();
  $("t-pub").value = pubDari(keBaru);
  $("key-baru-isi").textContent = keBaru;
  $("key-baru").hidden = false;
});
const salinKe = async (teks, tombol, normal) => {
  try { await navigator.clipboard.writeText(teks); tombol.textContent = "Tersalin"; } catch { tombol.textContent = "Gagal menyalin"; }
  setTimeout(() => { tombol.textContent = normal; }, 1200);
};
$("salin-key").addEventListener("click", (e) => salinKe(keBaru || "", e.target, "Salin private key"));
$("salin-pub").addEventListener("click", (e) => salinKe($("pub-kamu").textContent, e.target, "Salin public key"));
$("v-salin").addEventListener("click", (e) => salinKe(hasilVault, e.target, "Salin"));
$("v-unduh").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([hasilVault], { type: "application/json" }));
  const a = el("a", { href: url, download: "vault.json" }); a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("simpan-akses").addEventListener("click", async () => {
  if (!terpilih) return;
  const nama = terpilih.nama, script = ids($("izin"));
  $("simpan-akses").disabled = true;
  try {
    const daftar = akunList().map((a) => (a.pub === terpilih.pub ? { ...a, script } : a));
    const akun = await terapkanDaftar(daftar, `Akses "${nama}" disimpan.`);
    pilih(akun.find((a) => a.nama === nama));
  } catch (err) { tampilkanHasil(err && err.user ? err.message : "Gagal menyimpan."); }
  finally { $("simpan-akses").disabled = false; }
});
let konfirmasiHapus = null;
$("hapus-akun").addEventListener("click", async (e) => {
  if (!terpilih) return;
  if (konfirmasiHapus !== terpilih.pub) {
    konfirmasiHapus = terpilih.pub;
    e.target.textContent = `Yakin hapus ${terpilih.nama}? Tekan lagi`;
    setTimeout(() => { if (konfirmasiHapus === terpilih?.pub) { konfirmasiHapus = null; e.target.textContent = "Hapus akun"; } }, 4000);
    return;
  }
  konfirmasiHapus = null; e.target.textContent = "Hapus akun";
  const nama = terpilih.nama;
  try {
    await terapkanDaftar(akunList().filter((a) => a.pub !== terpilih.pub), `Akun "${nama}" dihapus.`);
    const vaultBaru = hasilVault, pesan = $("vmsg").textContent;
    setupAdmin();
    hasilVault = vaultBaru;
    tampilkanHasil(pesan);
  } catch (err) { tampilkanHasil(err && err.user ? err.message : "Gagal menghapus."); }
});

try { $("ver").textContent = "v" + chrome.runtime.getManifest().version; } catch { /* di luar extension */ }
let saved = await store.get();
// Sesi lama (login PIN) tidak punya public key: minta masuk lagi dengan private key
if (saved && !saved.pub) { await store.clear(); await clearPlan().catch(() => {}); saved = null; }
if (saved) await showUser(saved); else showLogin();

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
