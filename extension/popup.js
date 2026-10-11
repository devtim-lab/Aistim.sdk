// Popup extension Aistim Tool: login dengan private key secp256k1 memakai daftar akun di akun.json (ikut paket extension), lalu
// menampilkan akses script akun. Kode script tidak dijalankan di sini
// (Chrome melarang kode jarak jauh di extension); script dijalankan di situs.

import { alamatDariPub, alamatDariTandaTangan, tandatanganiAkun } from "./alamat.js";
import { kunciPaket, bukaDenganKunci, bacaZip } from "./paket.js";
import { buatRecord, bukaRecord, idDari, normalisasiKunci, kunciBaru, pubDari, normalisasiPub, rapikanDaftar } from "./kunci.js";
import { ambilFile, getPaket, setPaket, setPlan, clearPlan, getOff, setOff, getSembunyi, setSembunyi, getStatus, katalogInject, originsDibutuhkan, syncScripts, clearScripts, userScriptsReady } from "./sync.js";

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
    const res = await ambilFile("scripts/index.json");
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
  $("view-memuat").hidden = true;
  $("view-user").hidden = false;
  // sinkron script berjalan di latar belakang (tombol sinkron berputar), tidak menahan tampilan
  if (userScriptsReady()) jalankanSync(true).catch(() => {});
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
  const ikonKunci = () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "18"); s.setAttribute("height", "18"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true"); const d = document.createElementNS("http://www.w3.org/2000/svg", "path"); d.setAttribute("d", "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"); s.append(d); return s; };
  $("daftar-akun").replaceChildren(...list.map((a) => {
    const btn = el("button", { type: "button", className: "ikon-btn", title: "Ubah akun / ganti key", onclick: () => bukaGanti(a) }, ikonKunci());
    btn.setAttribute("aria-label", "Ubah akun " + a.nama);
    return el("li", {},
      el("div", { className: "kiri" },
        el("span", { className: "nama", textContent: a.nama }),
        el("small", { textContent: a.role === "admin" ? "Akses semua script" : ((a.script || []).length ? a.script.map(nama).join(", ") : "Belum ada akses script") })),
      el("div", { className: "kanan" }, el("span", { className: "peran", textContent: a.role }), btn));
  }));
}

// ---- ganti key akun: public key (dan alamat) akun diganti, nama/role/akses tetap ----
let gantiAkun = null, gantiKey = "";
function gmsg(text, kind = "") { const m = $("g-msg"); m.textContent = text; m.className = "kecil " + kind; }
function bukaGanti(a) {
  gantiAkun = a; gantiKey = "";
  $("g-nama").value = a.nama; $("g-pub").value = ""; $("g-key").hidden = true; $("g-key-isi").textContent = "";
  gmsg(""); $("g-simpan").disabled = false;
  $("modal-ganti").hidden = false;
}
const tutupGanti = () => { $("modal-ganti").hidden = true; gantiAkun = null; gantiKey = ""; $("g-key-isi").textContent = ""; $("g-pub").value = ""; };
$("g-batal").addEventListener("click", tutupGanti);
$("modal-ganti").addEventListener("pointerdown", (e) => { if (e.target.id === "modal-ganti") tutupGanti(); });
$("g-buat").addEventListener("click", () => {
  gantiKey = kunciBaru();
  $("g-key-isi").textContent = gantiKey; $("g-key").hidden = false;
  $("g-pub").value = pubDari(gantiKey);
  gmsg("Key baru dibuat. Simpan private key-nya sebelum menekan Simpan.");
});
$("g-salin").addEventListener("click", (e) => salinKe(gantiKey, e.target, "Salin private key"));
$("g-simpan").addEventListener("click", async () => {
  if (!gantiAkun) return;
  const namaBaru = $("g-nama").value.trim();
  if (!namaBaru || namaBaru.length > 40) return gmsg("Nama 1–40 karakter.", "err");
  if (akunList().some((x) => x.pub !== gantiAkun.pub && x.nama.toLowerCase() === namaBaru.toLowerCase())) return gmsg("Nama sudah dipakai akun lain.", "err");
  let pubBaru = gantiAkun.pub;
  if ($("g-pub").value.trim()) {
    try { pubBaru = normalisasiPub($("g-pub").value); } catch (err) { return gmsg(err.message, "err"); }
    if (akunList().some((x) => x.pub !== gantiAkun.pub && x.pub === pubBaru)) return gmsg("Public key itu sudah dipakai akun lain.", "err");
  }
  const gantiNama = namaBaru !== gantiAkun.nama, gantiPub = pubBaru !== gantiAkun.pub;
  if (!gantiNama && !gantiPub) return gmsg("Tidak ada yang diubah.", "err");
  const dirinya = gantiAkun.pub === current.pub, lama = gantiAkun.nama;
  $("g-simpan").disabled = true;
  try {
    const daftar = akunList().map((x) => x.pub === gantiAkun.pub ? { ...x, nama: namaBaru, pub: pubBaru } : x);
    tutupGanti();
    const info = [gantiNama ? `nama jadi "${namaBaru}"` : "", gantiPub ? "key diganti" : ""].filter(Boolean).join(", ");
    await terapkanDaftar(daftar, `Akun "${lama}": ${info}.` + (dirinya && gantiPub ? " Setelah upload kamu harus login lagi dengan key baru." : ""));
    if (dirinya && gantiNama) { current.nama = namaBaru; current.username = namaBaru; await store.set(current); $("who").textContent = namaBaru; }
  } catch (err) {
    $("g-simpan").disabled = false;
    gmsg(err && err.user ? err.message : "Gagal mengubah akun.", "err");
  }
});

function selectTab(name) {
  $("pane-script").hidden = name !== "script";
  $("pane-akses").hidden = name !== "akses" || !(current && current.role === "admin");
  $("pane-akun").hidden = name !== "akun" || !(current && current.role === "admin");
  $("pane-enkripsi").hidden = name !== "enkripsi" || !(current && current.role === "admin");
  $("pane-dekripsi").hidden = name !== "dekripsi" || !(current && current.role === "admin");
  $("tab-dekripsi").setAttribute("aria-selected", String(name === "dekripsi"));
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

const REPO = "devtim-lab/Auth", PATH_AKUN = "akun.json", TOK_KEY = "devchain.tok";   // repo publik: akun.json dan token terenkripsi
const PUBLIK = "https://raw.githubusercontent.com/devtim-lab/Auth/main/";

/** Ambil file dari repo publik Auth (terbaru); kalau gagal pakai salinan di paket extension. */
async function ambilPublik(nama, ketat = false) {
  try {
    const r = await fetch(PUBLIK + nama + "?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (r.ok) return await r.json();
  } catch { /* pakai salinan di paket */ }
  if (ketat) throw new Error(nama);   // tanpa salinan paket: salinan itu bisa lebih lama dari sesi yang tersimpan
  const r = await fetch(chrome.runtime.getURL(nama), { cache: "no-store" });
  if (!r.ok) throw new Error(nama);
  return r.json();
}
async function getTok() { try { return (await chrome.storage.session.get(TOK_KEY))[TOK_KEY] || ""; } catch { return ""; } }
async function setTok(t) { try { if (t) await chrome.storage.session.set({ [TOK_KEY]: t }); else await chrome.storage.session.remove(TOK_KEY); } catch { /* abaikan */ } }
const ghHeaders = (tok) => ({ Authorization: "Bearer " + tok, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
const ghUrl = `https://api.github.com/repos/${REPO}/contents/${PATH_AKUN}`;

/** Buka token GitHub terenkripsi (file di paket) dengan private key; hanya disimpan di sesi browser (hilang saat browser ditutup). */
async function bukaTokenDari(file, priv) {
  try {
    const raw = String((await ambilPublik(file)).token || "").trim();
    const dua = raw.startsWith("aistim2:");
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.slice(8)), (c) => c.charCodeAt(0))));
    const id = await idDari(pubDari(priv));
    const rec = (dua ? obj.r : [obj]).find((x) => x && x.id === id);
    return rec ? String((await bukaRecord(priv, rec)).t || "").trim() : "";
  } catch { return ""; }
}

const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");
const gagalUser = (m) => Object.assign(new Error(m), { user: true });

/** Kirim perubahan akun.json: ditandatangani private key admin, lalu memicu workflow update-akun di repo Auth yang memverifikasi dan commit. */
async function unggahAkun(isi, kunci) {
  let priv;
  try { priv = normalisasiKunci(kunci); } catch (err) { throw gagalUser(err.message); }
  if (alamatDariPub(pubDari(priv)) !== String(current.addr || "").toLowerCase()) throw gagalUser("Private key itu bukan milik akun admin yang sedang masuk.");
  let tok = await getTok();
  if (!tok) {   // token hilang (mis. extension dimuat ulang): buka lagi dengan key yang sama
    tok = await bukaTokenDari("token.json", priv);
    if (!tok) throw gagalUser("Token tidak bisa dibuka dengan key ini.");
    await setTok(tok);
  }
  let base;
  try {
    // Baca lewat API GitHub (langsung dari repo). raw.githubusercontent bisa tertinggal beberapa menit setelah commit,
    // dan base yang usang membuat workflow menolak perubahan.
    let teks = null;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH_AKUN}?ref=main&t=${Date.now()}`, { headers: { ...ghHeaders(tok), Accept: "application/vnd.github.raw+json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (r.ok) teks = await r.text();
    } catch { /* coba lewat raw */ }
    if (teks === null) {
      const r = await fetch(PUBLIK + "akun.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error();
      teks = await r.text();
    }
    base = await sha256(teks);
  } catch { throw gagalUser("Tidak bisa membaca akun.json dari GitHub."); }
  const sig = await tandatanganiAkun(priv, base, await sha256(isi));
  const urlRuns = `https://api.github.com/repos/${REPO}/actions/workflows/update-akun.yml/runs?event=workflow_dispatch&per_page=5`;
  const runTerakhir = async () => {
    try {
      const r = await fetch(urlRuns + "&t=" + Date.now(), { headers: ghHeaders(tok), cache: "no-store" });
      return r.ok ? (await r.json()).workflow_runs || [] : [];
    } catch { return []; }
  };
  const idLama = Math.max(0, ...(await runTerakhir()).map((x) => x.id));
  let p;
  try {
    p = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/update-akun.yml/dispatches`, {
      method: "POST", headers: { ...ghHeaders(tok), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { akun: isi, base, sig } }),
    });
  } catch { throw gagalUser("Tidak bisa menghubungi GitHub."); }
  if (p.status === 401) throw gagalUser("Token ditolak GitHub (kedaluwarsa atau salah).");
  if (p.status === 403 || p.status === 404) throw gagalUser("Token tidak punya izin Actions (Read and write) untuk repo Auth.");
  if (p.status !== 204) throw gagalUser("GitHub menolak permintaan (" + p.status + ").");
  // tunggu workflow baru selesai (status resmi dari GitHub)
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const run = (await runTerakhir()).find((x) => x.id > idLama);
    if (run && run.status === "completed") return run.conclusion === "success" ? "ok" : "gagal";
  }
  return "belum";
}

let konfirmasiUpload = false, dibukaPada = 0;
const bukaModal = () => { $("mu-msg").textContent = ""; $("mu-kirim").textContent = "Upload"; $("mu-kirim").disabled = false; $("mu-kirim").classList.remove("memuat"); $("mu-batal").disabled = false; konfirmasiUpload = false; dibukaPada = Date.now(); $("modal-upload").hidden = false; setTimeout(() => $("mu-kunci").focus(), 50); };
const tutupModal = () => {
  $("modal-upload").hidden = true; $("mu-kunci").value = ""; konfirmasiUpload = false;
  if (hasilVault && current && current.role === "admin") {   // dibatalkan: perubahan masih menunggu upload
    $("hasil-vault").hidden = false; $("v-upload").hidden = false;
    $("vmsg").textContent = "Perubahan belum diupload.";
  }
};
function tampilkanHasil(pesan) {
  const b = $("v-upload");
  $("hasil-vault").hidden = false;
  $("vmsg").textContent = pesan;
  const admin = !!current && current.role === "admin";
  b.hidden = !admin || !hasilVault;
  if (admin && hasilVault) { $("hasil-vault").hidden = true; bukaModal(); }   // langsung tampil di tengah untuk menandatangani dan upload (token dibuka otomatis bila perlu)
}

/** Tulis ulang vault dari daftar akun yang baru; perubahan disimpan di sesi dan siap diunduh. */
async function terapkanDaftar(daftar, pesan) {
  const akun = rapikanDaftar(daftar).map((a) => ({ nama: a.nama, addr: alamatDariPub(a.pub), pub: a.pub, role: a.role, script: a.script, dibuat: a.dibuat }));
  current.akun = akun;
  await store.set(current);
  hasilVault = JSON.stringify({ version: 1, akun }, null, 2) + "\n";
  renderAkun();
  tampilkanHasil(pesan + " Tekan Simpan & upload untuk mengirim ke GitHub.");
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
    $("t-nama").value = ""; $("t-pub").value = ""; $("t-admin-role").checked = false; $("t-bagian-izin").hidden = false;
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
  $("view-memuat").hidden = true;
  $("view-login").hidden = false;
}

/** Unduh paket script akun ini, buka dengan private key, simpan isinya di browser. Tanpa paket → pakai cara lama. */
async function muatPaket(priv, addr) {
  const a = addr.toLowerCase();
  try {
    const [v, r] = await Promise.all([
      ambilPublik("paket/versi.json"),
      fetch(PUBLIK + "paket/" + a + ".bin?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(15000) }),
    ]);
    if (!r.ok) throw new Error("tidak ada paket");
    const bin = new Uint8Array(await r.arrayBuffer());
    const k = await kunciPaket(priv, bin);   // yang disimpan hanya kunci paket, bukan private key
    const files = bacaZip(await bukaDenganKunci(k, bin));
    await setPaket({ ver: v[a] || "", k, addr: a, files });
    return true;
  } catch { return false; }
}

// ID tetap untuk tanda tangan login (ID tetap). Dengan begini alamat akun tidak berubah
// walau extension dipasang dari Web Store, zip, atau punya ID lain. Tanda tangan tidak disimpan atau dikirim ke mana pun.
const ID_LOGIN = "jmgenkikiinjmkjebhgbgilfjgifnbbl";

async function submit(e) {
  e.preventDefault();
  if (busy) return;
  $("belum").hidden = true;
  let priv;
  try { priv = normalisasiKunci($("kunci").value); } catch (err) { return say(err.message, ""); }
  busy = true; $("masuk").disabled = true;
  say("Memproses...", "busy");
  try {
    let daftar;
    try {
      daftar = (await ambilPublik("akun.json")).akun;
      if (!Array.isArray(daftar)) throw new Error("format");
    } catch { throw Object.assign(new Error("net"), { net: true }); }
    const addr = await alamatDariTandaTangan(priv, ID_LOGIN);   // signature hanya di memori, tidak disimpan
    const a = daftar.find((x) => String(x.addr || "").toLowerCase() === addr);
    if (!a) {
      say("");
      $("pub-kamu").textContent = pubDari(priv);
      $("belum").hidden = false;
      return;
    }
    say("Mengambil script...", "busy");
    const adaPaket = await muatPaket(priv, a.addr);
    if (!adaPaket) await setPaket(null);
    if (a.role === "admin") await setTok(await bukaTokenDari("token.json", priv)); else await setTok("");
    const r = { data: { nama: a.nama, addr: a.addr, pub: a.pub, role: a.role, script: a.script || [], dibuat: a.dibuat, ...(a.role === "admin" ? { akun: daftar } : {}) } };
    const data = r.data;
    data.username = data.nama;
    await store.set(data);
    $("kunci").value = "";
    await showUser(data);
  } catch (err) {
    say(err && err.net ? "Gagal membaca akun.json." : "Gagal masuk.", "");
  } finally {
    busy = false; $("masuk").disabled = false;
  }
}

$("logout").addEventListener("click", async () => { await setTok(""); await clearScripts().catch(() => {}); await clearPlan().catch(() => {}); await store.clear(); current = null; hasilVault = ""; $("logout").hidden = true; $("sync").hidden = true; showLogin(); });
$("tab-script").addEventListener("click", () => selectTab("script"));
$("sync").addEventListener("click", () => jalankanSync(false));
$("cari-script").addEventListener("input", renderManager);
$("tab-akses").addEventListener("click", () => selectTab("akses"));
$("tab-akun").addEventListener("click", () => selectTab("akun"));
$("tab-enkripsi").addEventListener("click", () => { isiPenerima(); selectTab("enkripsi"); });
$("tab-dekripsi").addEventListener("click", () => selectTab("dekripsi"));

// ---- popup hasil: teks hasil enkripsi/dekripsi, mudah disalin ----
function bukaHasil(judul, teks) {
  $("mh-judul").textContent = judul; $("mh-isi").value = teks; $("mh-msg").textContent = ""; $("mh-salin").textContent = "Salin";
  $("modal-hasil").hidden = false;
  $("mh-isi").focus(); $("mh-isi").select();
}
const tutupHasil = () => { $("modal-hasil").hidden = true; $("mh-isi").value = ""; };
$("mh-tutup").addEventListener("click", tutupHasil);
$("modal-hasil").addEventListener("pointerdown", (e) => { if (e.target.id === "modal-hasil") tutupHasil(); });
$("mh-salin").addEventListener("click", async () => {
  const t = $("mh-isi").value;
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch { try { $("mh-isi").select(); ok = document.execCommand("copy"); } catch { ok = false; } }
  $("mh-salin").textContent = ok ? "Tersalin" : "Salin";
  $("mh-msg").textContent = ok ? "" : "Teks sudah terpilih, salin manual.";
});

// ---- tab Enkripsi (admin): enkripsi/dekripsi teks dengan public key akun ----
const PREFIX = "aistim1:";    // satu penerima: record tunggal
const PREFIX2 = "aistim2:";   // banyak penerima: { v:2, r:[record, ...] }
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
function emsg(text, kind = "", id = "e-msg") { const m = $(id); m.textContent = text; m.className = "kecil " + kind; }
function isiPenerima() {
  const dicentang = new Set([...$("e-penerima").querySelectorAll("input:checked")].map((i) => i.value));
  const list = akunList();
  $("e-penerima").replaceChildren(...(list.length ? list.map((a) => el("label", {},
    el("input", { type: "checkbox", value: a.pub, checked: dicentang.has(a.pub) }),
    el("span", { textContent: a.nama + (a.pub === current?.pub ? " (kamu)" : "") }))) : [el("small", { textContent: "Belum ada akun." })]));
}
$("e-buat-key").addEventListener("click", () => { $("e-kunci").value = kunciBaru(); emsg("Key baru dibuat. Simpan sebelum menutup popup."); });
$("e-enkripsi").addEventListener("click", async () => {
  const teks = $("e-teks").value;
  if (!teks) return emsg("Isi teks dulu.", "err");
  try {
    const pubs = new Set([...$("e-penerima").querySelectorAll("input:checked")].map((i) => i.value));
    if ($("e-kunci").value.trim()) pubs.add(pubDari(normalisasiKunci($("e-kunci").value)));
    if (!pubs.size) { $("e-kunci").value = kunciBaru(); pubs.add(pubDari($("e-kunci").value)); }
    const r = [];
    for (const p of pubs) r.push(await buatRecord(p, { t: teks }));
    $("e-hasil").value = PREFIX2 + b64(JSON.stringify({ v: 2, r }));
    bukaHasil("Hasil enkripsi", $("e-hasil").value);
    emsg(`Terenkripsi untuk ${r.length} penerima. Masing-masing membukanya dengan private key sendiri.`);
  } catch (err) { emsg(err && err.user ? err.message : "Gagal mengenkripsi.", "err"); }
});
$("e-salin").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("e-hasil").value); emsg("Hasil disalin."); } catch { $("e-hasil").select(); emsg("Pilih lalu salin manual.", "err"); }
});
$("d-dekripsi").addEventListener("click", async () => {
  const raw = $("d-teks").value.trim();
  $("d-hasil").hidden = true;
  const dua = raw.startsWith(PREFIX2);
  if (!dua && !raw.startsWith(PREFIX)) return emsg("Format teks tidak dikenali.", "err", "d-msg");
  try {
    const kunci = normalisasiKunci($("d-kunci").value);
    const obj = JSON.parse(unb64(raw.slice((dua ? PREFIX2 : PREFIX).length)));
    const daftar = dua ? obj.r : [obj];
    const id = await idDari(pubDari(kunci));
    const rec = daftar.find((x) => x && x.id === id);
    if (!rec) return emsg("Teks ini bukan untuk private key tersebut.", "err", "d-msg");
    const data = await bukaRecord(kunci, rec);
    $("d-hasil").value = String(data.t ?? ""); bukaHasil("Hasil dekripsi", $("d-hasil").value);
    emsg("Berhasil didekripsi.", "", "d-msg");
  } catch (err) { emsg(err && err.user ? err.message : "Private key tidak cocok atau teks rusak.", "err", "d-msg"); }
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
const tutupTambah = () => { $("form-tambah").hidden = true; $("tambah-akun").setAttribute("aria-expanded", "false"); };
$("t-tutup").addEventListener("click", tutupTambah);
$("t-batal").addEventListener("click", tutupTambah);
$("form-tambah").addEventListener("pointerdown", (e) => { if (e.target.id === "form-tambah") tutupTambah(); });
$("t-admin-role").addEventListener("change", () => { $("t-bagian-izin").hidden = $("t-admin-role").checked; });
$("form-login").addEventListener("submit", submit);
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
$("v-upload").addEventListener("click", bukaModal);
$("mu-batal").addEventListener("click", tutupModal);
$("modal-upload").addEventListener("pointerdown", (e) => { if (e.target.id === "modal-upload" && !$("mu-kirim").disabled && Date.now() - dibukaPada > 500) tutupModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal-upload").hidden && !$("mu-kirim").disabled) tutupModal(); });
$("mu-kirim").addEventListener("click", async (e) => {
  const b = e.currentTarget, msg = $("mu-msg");
  if (!$("mu-kunci").value.trim()) { msg.textContent = "Isi private key admin dulu."; msg.className = "kecil err"; return; }
  msg.className = "kecil";
  if (!konfirmasiUpload) {
    konfirmasiUpload = true; b.textContent = "Yakin? Tekan lagi";
    setTimeout(() => { if (konfirmasiUpload && !b.disabled) { konfirmasiUpload = false; b.textContent = "Upload"; } }, 4000);
    return;
  }
  konfirmasiUpload = false; b.disabled = true; b.classList.add("memuat"); b.textContent = "Mengupload...";
  $("mu-batal").disabled = true;
  msg.textContent = "Menandatangani dan mengirim. Tunggu workflow selesai...";
  try {
    const hasil = await unggahAkun(hasilVault, $("mu-kunci").value);
    if (hasil === "gagal") throw gagalUser("Workflow menolak perubahan. Lihat log di tab Actions repo Auth (Update akun).");
    hasilVault = "";
    tutupModal();
    $("v-upload").hidden = true;
    $("vmsg").textContent = hasil === "ok"
      ? "Tersimpan di repo Auth. Pengguna menerima daftar baru saat membuka popup atau login, tanpa rilis."
      : "Perubahan terkirim, tapi workflow belum selesai. Periksa tab Actions di repo Auth (Update akun).";
    setTimeout(() => { if (!hasilVault) $("hasil-vault").hidden = true; }, 6000);
  } catch (err) {
    b.disabled = false; b.classList.remove("memuat"); b.textContent = "Upload"; $("mu-batal").disabled = false;
    msg.textContent = err && err.user ? err.message : "Upload gagal."; msg.className = "kecil err";
  }
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
// Segarkan sesi dari akun.json terbaru di paket (daftar akun, role, dan akses script bisa berubah sejak login)
if (saved) {
  try {
    const daftar = (await ambilPublik("akun.json", true)).akun;
    const a = Array.isArray(daftar) && daftar.find((x) => x.pub === saved.pub);
    if (Array.isArray(daftar)) {
      if (!a) { await clearScripts().catch(() => {}); await clearPlan().catch(() => {}); await store.clear(); saved = null; }
      else {
        saved = { ...saved, nama: a.nama, username: a.nama, addr: a.addr, role: a.role, script: a.script || [] };
        if (a.role === "admin") saved.akun = daftar; else delete saved.akun;
        await store.set(saved);
      }
    }
  } catch { /* pakai sesi tersimpan */ }
}
try { if (saved) await showUser(saved); else showLogin(); } catch { showLogin(); }

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
