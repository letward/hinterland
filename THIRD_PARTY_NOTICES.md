# Third-Party Open Source Notices — Hinterland Browser

Hinterland is licensed under the **MIT License** (see [LICENSE](LICENSE)).
Binary distributions bundle or depend on the following open-source components whose respective licenses permit free redistribution without commercial royalties when notices are preserved:

| Component | Version / Scope | License | Upstream Project |
| :--- | :--- | :--- | :--- |
| **Hinterland** | Desktop Browser & Extension SDK | MIT | https://github.com/letward/Hinterland |
| **Electron** | `^44.9.0` (Application Shell) | MIT | https://github.com/electron/electron |
| **Chromium & Blink** | Bundled inside Electron | BSD-3-Clause (plus component notices) | https://www.chromium.org |
| **Node.js & V8** | Bundled inside Electron | MIT / BSD-3-Clause | https://nodejs.org |
| **electron-updater** | `^6.3.9` (Auto-update client for standalone NSIS builds; disabled on Microsoft Store builds via `process.windowsStore`) | MIT | https://github.com/electron-userland/electron-builder |

## Full Chromium & Electron Runtime Notices
When packaged by Electron / `electron-builder`, Chromium's full aggregated open-source acknowledgements (`LICENSES.chromium.html`) and `LICENSE.electron.txt` are included directly alongside the application executable inside the installation directory.

## Proprietary DRM Notice
Hinterland uses standard upstream Electron without proprietary Widevine CDM licensing binaries.
