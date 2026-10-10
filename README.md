# Aistim.sdk

Extension Chrome **Aistim Tool** (Manifest V3): login dengan private key secp256k1 dan
menjalankan userscript lewat `chrome.userScripts`.

Folder `extension/` siap dimuat di `chrome://extensions` (Developer mode → Load unpacked).
`extension/kunci.js` adalah hasil bundle modul enkripsi (dibuat dari proyek devchain).

## Script

Script ada di dalam paket extension: `extension/scripts/*.js` (header `// ==UserScript==` gaya Tampermonkey).
Menambah atau mengubah script cukup edit berkas di folder itu, jalankan `node tools/build-catalog.mjs`
(membuat `extension/scripts/index.json`), naikkan `version` di `extension/manifest.json`, lalu rilis.
Script tidak lagi diambil dari situs devchain, jadi pembaruan script datang bersama versi extension baru.

## Rilis

Buat Release otomatis dengan menaikkan `version` di `extension/manifest.json`, commit, lalu push tag:

```
git tag v3.0.1 && git push origin v3.0.1
```

Atau tanpa terminal: tab Actions → Release extension → Run workflow (tag `v<versi>` dibuat otomatis dari versi manifest).

Workflow `release.yml` membuat Release berisi `aistim-tool-extension-v<versi>.zip` yang bisa diunduh dan dipasang manual.

## Akun dan login

`extension/akun.json` berisi daftar akun (`nama`, `addr`, `pub`, `role`, `script`). Saat login, private key menandatangani `aistim-login:<id extension>` di memori, alamat dipulihkan dari signature, lalu dicocokkan dengan `addr`. Signature dan key tidak disimpan.

Membangun `extension/alamat.js` (hanya perlu bila `tools/alamat.src.mjs` berubah): pasang `@noble/secp256k1@2.2.3`, `@noble/hashes@1.8.0` dan `esbuild`, lalu `esbuild tools/alamat.src.mjs --bundle --minify --format=esm --outfile=extension/alamat.js`.

## Menambah atau mengubah script

Taruh atau ubah script (gaya Tampermonkey, dengan header `==UserScript==`) di **`scripts-src/`**. Setelah push ke `main`, workflow **Minify scripts** otomatis membuat versi kecil di `extension/scripts/` (yang dipakai extension) lengkap dengan `index.json`. Jangan mengedit `extension/scripts/` langsung, karena akan ditimpa.

Menjalankan sendiri: `npm install esbuild` lalu `node tools/build-scripts.mjs`.
