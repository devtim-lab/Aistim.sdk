// Panel setelah login: tab "Script" (menjalankan script yang boleh diakses)
// dan, khusus admin, tab "Akses" (melihat/menyusun akses script per akun).
//
// Catatan keamanan: situs ini statis, jadi daftar izin hanya mengatur
// tampilan. File script di /scripts tetap bisa diunduh siapa pun yang tahu
// alamatnya. Jangan taruh rahasia di dalam script.

import { susunDenganAkunBaru, validEmail } from "./admin.js";
import { loadUsers, adminSecret } from "./auth.js";

const FILE_RE = /^[a-z0-9_-]+\.js$/;

export function panelComponent() {
  return {
    tab: "script",
    katalog: [],
    katalogError: "",
    hasil: {},          // id -> teks hasil
    running: "",        // id yang sedang berjalan
    // combobox Akun (admin)
    query: "",
    open: false,
    active: 0,
    selected: null,     // { nama, role, script }
    draft: [],          // id script terpilih untuk akun terpilih
    copied: false,
    // form tambah akun
    tambahOpen: false,
    email: "",
    pinBaru: "",
    izinBaru: [],
    membuat: false,
    tambahMsg: "",
    tambahErr: false,
    hasilJson: "",

    async init() {
      // Panel tetap ada saat ganti akun, jadi bersihkan state tiap user berubah
      this.$watch("user?.username", () => {
        this.tab = "script";
        this.hasil = {};
        this.query = "";
        this.open = false;
        this.selected = null;
        this.draft = [];
        this.copied = false;
        this.tambahOpen = false; this.hasilJson = ""; this.tambahMsg = "";
        this.email = ""; this.pinBaru = "";
      });
      try {
        const res = await fetch("scripts/index.json", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        this.katalog = (data.scripts || []).filter((s) => FILE_RE.test(s.file));
      } catch {
        this.katalogError = "Daftar script tidak bisa dimuat.";
      }
    },

    scriptNama(id) {
      const s = this.katalog.find((x) => x.id === id);
      return s ? s.nama : id;
    },

    get isAdmin() { return this.user && this.user.role === "admin"; },

    /** Script yang boleh dilihat: admin semua, lainnya sesuai izin. */
    get dapat() {
      if (this.isAdmin) return this.katalog;
      const izin = new Set((this.user && this.user.script) || []);
      return this.katalog.filter((s) => izin.has(s.id));
    },

    async jalankan(s) {
      this.running = s.id;
      try {
        const mod = await import(new URL("../../scripts/" + s.file, import.meta.url).href);
        const out = await mod.run({ user: this.user });
        this.hasil[s.id] = String(out ?? "(selesai)");
      } catch (e) {
        this.hasil[s.id] = "Gagal: " + (e && e.message ? e.message : "kesalahan");
      } finally {
        this.running = "";
      }
    },

    // ---- tambah akun (email + PIN) ----
    bukaTambah() {
      this.tambahOpen = !this.tambahOpen;
      this.tambahMsg = ""; this.hasilJson = "";
    },
    cleanPinBaru() { this.pinBaru = this.pinBaru.replace(/\D/g, "").slice(0, 6); },
    async buatAkun() {
      this.tambahErr = true; this.hasilJson = "";
      if (!validEmail(this.email.trim())) { this.tambahMsg = "Email tidak valid."; return; }
      if (this.pinBaru.length !== 6) { this.tambahMsg = "PIN harus 6 angka."; return; }
      this.membuat = true; this.tambahMsg = "Mengenkripsi...";
      try {
        const r = await susunDenganAkunBaru(this.user, {
          email: this.email, pin: this.pinBaru, script: this.izinBaru,
        }, { users: await loadUsers(), adminPin: adminSecret() });
        this.user.akun = r.akun;       // daftar di combobox langsung diperbarui
        this.hasilJson = r.json;
        this.tambahErr = false;
        this.tambahMsg = "Akun siap. Unduh user.json, ganti berkas di repo, lalu push.";
        this.email = ""; this.pinBaru = ""; this.izinBaru = [];
      } catch (e) {
        this.tambahMsg = e && e.user ? e.message : "Gagal membuat akun.";
      } finally { this.membuat = false; }
    },
    unduhJson() {
      const url = URL.createObjectURL(new Blob([this.hasilJson], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "user.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async salinJson() {
      try { await navigator.clipboard.writeText(this.hasilJson); this.tambahMsg = "user.json tersalin."; this.tambahErr = false; } catch { /* abaikan */ }
    },

    // ---- combobox Akun ----
    get akun() { return (this.user && this.user.akun) || []; },
    get hasilCari() {
      const q = this.query.trim().toLowerCase();
      return this.akun.filter((a) => !q || a.nama.toLowerCase().includes(q));
    },
    buka() { this.open = true; this.active = 0; },
    pilih(a) {
      this.selected = a;
      this.query = a.nama;
      this.draft = [...(a.script || [])];
      this.open = false;
      this.copied = false;
    },
    onKey(e) {
      const n = this.hasilCari.length;
      if (e.key === "ArrowDown") { e.preventDefault(); this.open = true; this.active = n ? (this.active + 1) % n : 0; }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.active = n ? (this.active - 1 + n) % n : 0; }
      else if (e.key === "Enter" && this.open && n) { e.preventDefault(); this.pilih(this.hasilCari[this.active]); }
      else if (e.key === "Escape") { this.open = false; }
    },

    get perintah() {
      if (!this.selected) return "";
      const ids = this.draft.length ? this.draft.join(",") : "-";
      return `npm run user -- akses ${this.selected.nama} ${ids}`;
    },
    async salin() {
      try { await navigator.clipboard.writeText(this.perintah); this.copied = true; } catch { /* abaikan */ }
    },
  };
}
