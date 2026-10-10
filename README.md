# Aistim.sdk

Extension Chrome **Aistim Tool** (Manifest V3): login dengan private key secp256k1 dan
menjalankan userscript lewat `chrome.userScripts`.

Folder `extension/` siap dimuat di `chrome://extensions` (Developer mode → Load unpacked).
`extension/kunci.js` adalah hasil bundle modul enkripsi (dibuat dari proyek devchain).

## Script

Sumber script ada di `scripts-src/` (header `// ==UserScript==` gaya Tampermonkey). Setelah push ke `main`:

1. Workflow **Minify scripts** membuat versi kecil di `extension/scripts/` (lengkap dengan `index.json`).
2. Workflow **Bangun paket script per akun** membuat satu paket terenkripsi per akun (hanya script yang boleh dipakai akun itu) dan menyimpannya di repo `Auth` (`paket/<addr>.bin`).
3. Extension mengunduh paket akunnya saat login dan memeriksa pembaruan setiap sinkron.

Jadi menambah atau mengubah script tidak perlu rilis extension baru. Jangan mengedit `extension/scripts/` langsung, karena akan ditimpa.

Workflow paket butuh secret `AUTH_TOKEN` (tulis ke repo Auth) dan `PAKET_SEED` (string acak, bahan kunci paket). Setelah mengubah akses akun di `akun.json`, jalankan workflow paket sekali (Actions → Run workflow).

Release (`release.yml`) membuat zip ringan tanpa folder `scripts`.

## Rilis

Buat Release otomatis dengan menaikkan `version` di `extension/manifest.json`, commit, lalu push tag:

```
git tag v3.0.1 && git push origin v3.0.1
```

Atau tanpa terminal: tab Actions → Release extension → Run workflow (tag `v<versi>` dibuat otomatis dari versi manifest).

Workflow `release.yml` membuat Release berisi `aistim-tool-extension-v<versi>.zip` yang bisa diunduh dan dipasang manual.

## Akun dan login

`extension/akun.json` berisi daftar akun (`nama`, `addr`, `pub`, `role`, `script`). Saat login, private key menandatangani `aistim-login:kfgpijjlmocfnlmkjfaecllloniellmp` (ID tetap, tidak bergantung ID extension yang terpasang) di memori, alamat dipulihkan dari signature, lalu dicocokkan dengan `addr`. Signature dan key tidak disimpan.

Membangun `extension/alamat.js` (hanya perlu bila `tools/alamat.src.mjs` berubah): pasang `@noble/secp256k1@2.2.3`, `@noble/hashes@1.8.0` dan `esbuild`, lalu `esbuild tools/alamat.src.mjs --bundle --minify --format=esm --outfile=extension/alamat.js`.
