# Aistim.sdk

Extension Chrome **Aistim Tool** (Manifest V3): login dengan private key secp256k1 dan
menjalankan userscript lewat `chrome.userScripts`.

Folder `extension/` siap dimuat di `chrome://extensions` (Developer mode → Load unpacked).
`extension/kunci.js` adalah hasil bundle modul enkripsi (dibuat dari proyek devchain).

## Rilis

Buat Release otomatis dengan menaikkan `version` di `extension/manifest.json`, commit, lalu push tag:

```
git tag v3.0.1 && git push origin v3.0.1
```

Atau tanpa terminal: tab Actions → Release extension → Run workflow (tag `v<versi>` dibuat otomatis dari versi manifest).

Workflow `release.yml` membuat Release berisi `aistim-tool-extension-v<versi>.zip` yang bisa diunduh dan dipasang manual.
