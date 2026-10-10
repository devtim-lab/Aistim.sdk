// Kartu unduhan extension: nama berkas dan versi terbaru dibaca dari
// download/version.json (dibuat saat build dari extension/manifest.json).

const FILE_RE = /^devchain-extension-v[\d.]+\.zip$/;

export function extensionComponent() {
  return {
    version: "",
    file: "",
    async init() {
      try {
        const res = await fetch("download/version.json", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (FILE_RE.test(d.file) && /^[\d.]+$/.test(d.version)) {
          this.version = d.version;
          this.file = d.file;
        }
      } catch { /* tombol tetap nonaktif */ }
    },
  };
}
