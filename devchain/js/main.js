// Titik masuk: mendaftarkan komponen login ke Alpine.
// Berkas ini dimuat sebelum Alpine, jadi pendengar "alpine:init" sudah
// terpasang saat Alpine mulai berjalan.

import { loginComponent } from "./login.js";
import { panelComponent } from "./panel.js";
import { extensionComponent } from "./extension.js";

document.addEventListener("alpine:init", () => {
  window.Alpine.data("login", loginComponent);
  window.Alpine.data("panel", panelComponent);
  window.Alpine.data("extension", extensionComponent);
});
