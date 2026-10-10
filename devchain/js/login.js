// Komponen Alpine untuk form login (hanya PIN 6 angka). Tampilan
// diatur lewat atribut di index.html; di sini hanya state dan aksi.

import * as auth from "./auth.js";
import { MESSAGES, loginMessage } from "./errors.js";

const PIN_LENGTH = 6;

export function loginComponent() {
  return {
    ready: false,      // true setelah status login pertama diketahui
    user: null,        // { username, name } kalau sudah masuk
    pin: "",
    shake: false,
    busy: false,
    disabled: false,
    message: "",
    kind: "",          // "error" | "ok" | ""

    init() {
      if (!auth.isAvailable()) {
        this.setMessage(MESSAGES.unsupported, "error");
        this.disabled = true;
        this.ready = true;
        return;
      }
      auth.onUserChange((s) => {
        this.user = s ? {
          username: s.username,
          name: s.data.nama || s.username,
          role: s.data.role === "admin" ? "admin" : "user",
          script: Array.isArray(s.data.script) ? s.data.script : [],
          akun: Array.isArray(s.data.akun) ? s.data.akun : [],
        } : null;
        this.ready = true;
        document.title = this.user ? "Aistim Tool" : "Masuk - Aistim Tool";
      });
    },

    setMessage(text, kind = "") {
      this.message = text;
      this.kind = kind;
    },

    /** Tombol angka (keypad layar atau papan ketik). Otomatis kirim di 6 digit. */
    press(d) {
      if (this.busy || this.disabled || this.pin.length >= PIN_LENGTH) return;
      this.pin += d;
      this.setMessage("");
      if (this.pin.length === PIN_LENGTH) this.submit();
    },

    back() {
      if (this.busy) return;
      this.pin = this.pin.slice(0, -1);
    },

    /** Papan ketik fisik: angka dan Backspace saat layar PIN tampil. */
    onKey(e) {
      if (!this.ready || this.user || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) this.press(e.key);
      else if (e.key === "Backspace") this.back();
    },

    async submit() {
      if (!this.pin) {
        this.setMessage(MESSAGES.fillBoth, "error");
        return;
      }
      if (this.pin.length !== PIN_LENGTH) {
        this.setMessage(MESSAGES.pinInvalid, "error");
        return;
      }
      this.setMessage("");
      this.busy = true;
      try {
        await auth.signIn(this.pin);
        this.pin = "";
      } catch (err) {
        this.setMessage(loginMessage(err), "error");
        this.pin = "";
        this.shake = true;
        setTimeout(() => (this.shake = false), 400);
      } finally {
        this.busy = false;
      }
    },

    async logout() {
      await auth.signOut();
    },
  };
}
