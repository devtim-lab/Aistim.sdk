# Aistim.sdk

Extension Chrome **Aistim Tool** (Manifest V3): manajer userscript gaya Tampermonkey yang menjalankan script lewat
`chrome.userScripts`. Tidak ada login: semua script di katalog bisa dinyalakan atau dimatikan satu per satu.

Folder `extension/` siap dimuat di `chrome://extensions` (Developer mode → Load unpacked), lalu nyalakan **Izinkan skrip pengguna** di halaman Detail.

## Script

Sumber script ada di `scripts-src/` (header `// ==UserScript==` gaya Tampermonkey). Setelah push ke `main`:

1. Workflow **Minify scripts** membuat versi kecil di `extension/scripts/` (lengkap dengan `index.json`) dan menandatangani katalognya (lihat bagian terakhir).
2. Extension mengambil katalog dan script dari GitHub (terverifikasi) dan memakai salinan bawaan bila gagal.

Jadi menambah atau mengubah script tidak perlu rilis extension baru. Jangan mengedit `extension/scripts/` langsung, karena akan ditimpa.

Release (`release.yml`) membuat zip lengkap, termasuk salinan bawaan semua script.

## Rilis

Buat Release otomatis dengan menaikkan `version` di `extension/manifest.json`, commit, lalu push tag:

```
git tag v3.0.1 && git push origin v3.0.1
```

Atau tanpa terminal: tab Actions → Release extension → Run workflow (tag `v<versi>` dibuat otomatis dari versi manifest).

Workflow `release.yml` membuat Release berisi `aistim-tool-extension-v<versi>.zip` yang bisa diunduh dan dipasang manual.

## Sinkron script dari GitHub (terverifikasi)

Extension mengambil `extension/scripts/index.json` dan tiap script dari `raw.githubusercontent.com/devtim-lab/Aistim.sdk/main/extension/scripts/`,
tetapi hanya memakainya bila **tanda tangan katalog sah** (ECDSA P-256, kunci publik ada di `extension/sync.js`) dan **SHA-256 tiap file cocok**
dengan katalog. Kalau tidak, dipakai salinan bawaan di dalam extension. Popup menampilkan sumbernya ("GitHub ✓" atau "bawaan").

- Buat kunci (sekali): `node tools/tanda-tangan-katalog.mjs --buat-kunci <jalur/di/luar/repo/katalog-kunci.pem>`; tempel kunci publik yang dicetak ke `KUNCI_VERIF` di `extension/sync.js`.
- Tanda tangani setelah `node tools/build-scripts.mjs`: `node tools/tanda-tangan-katalog.mjs <katalog-kunci.pem>`; periksa: `node tools/tanda-tangan-katalog.mjs --cek`.
- Di GitHub Actions: isi secret `KATALOG_KUNCI` dengan isi berkas `.pem` (workflow Minify scripts menandatangani otomatis). Tanpa secret itu katalog tidak bertanda tangan dan extension memakai salinan bawaan.
- **Kunci pribadi jangan pernah di-commit.** Kalau hilang, katalog baru tidak bisa ditandatangani sampai kunci publik di extension diganti lewat rilis baru.

