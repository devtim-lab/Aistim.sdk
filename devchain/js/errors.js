// Mengubah kode error menjadi pesan bahasa Indonesia.

const LOGIN_MESSAGES = {
  // Nama pengguna tidak ada dan PIN salah memakai pesan yang sama, supaya
  // orang tidak bisa menebak nama mana yang terdaftar.
  "auth/invalid-credential": "PIN salah.",
  "auth/network-request-failed": "Daftar akun tidak bisa dimuat. Periksa internetmu.",
};

export const MESSAGES = {
  fillBoth: "Isi PIN.",
  pinInvalid: "PIN harus 6 angka.",
  unsupported: "Peramban ini tidak mendukung enkripsi (butuh HTTPS). Muat ulang halaman.",
  loginFailed: "Gagal masuk. Coba lagi.",
};

/** Pesan untuk kegagalan login. */
export function loginMessage(err) {
  return LOGIN_MESSAGES[err && err.code] || MESSAGES.loginFailed;
}
