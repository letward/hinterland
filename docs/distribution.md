# Multi-Platform Distribution & $0 Code-Signing Guide — Hinterland Browser

This guide explains **why** Windows shows a security prompt on unsigned `.exe` downloads and how every step in this repository eliminates those warnings at **zero cost ($0)** across Microsoft Store, Windows package managers, Linux, and macOS.

---

## Why Windows Warned Users ("App not verified / Use Microsoft Store")

Windows 10/11 applies three defense layers to internet-downloaded installers (Mark-of-the-Web):
1. **Microsoft Defender SmartScreen**: Flags unsigned `.exe` binaries and brand-new file hashes as *"Unrecognized app"*.
2. **Windows 11 Smart App Control (SAC)**: Blocks unsigned executables or scripts unless signed by a recognized Certification Authority or distributed via the Microsoft Store.
3. **"Recommended apps / Store only" prompts**: Windows encourages installing via the Microsoft Store because Microsoft signs every Store MSIX/AppX package automatically for free.

---

## 1. Microsoft Store ($0 Total — Zero Security Warnings!)

Microsoft permanently waived the $19 individual developer registration fee.

1. **Register for free**: Open **https://storedeveloper.microsoft.com** (important: start from this URL to get the free individual flow; no credit card required — just personal Microsoft Account + ID/selfie check) and select **Individual developer (free)**.
2. **Reserve app name**: In Microsoft Partner Center, reserve `Hinterland` (or `Hinterland Browser`) and open **App management → Product identity** to copy:
   - `Identity/Name` → set as GitHub Repository Variable `MS_STORE_IDENTITY_NAME`
   - `Identity/Publisher` (`CN=...`) → set as GitHub Repository Variable `MS_STORE_PUBLISHER`
   - `Properties/PublisherDisplayName` → set as GitHub Repository Variable `MS_STORE_PUBLISHER_DISPLAY_NAME`
3. **Privacy Policy URL** (required by Store): `https://hinterland-browser.vercel.app/docs/privacy.html`
4. **Build or download the Store package**:
   - **CI (Recommended)**: `.github/workflows/release.yml` automatically builds and attaches `Hinterland-Store-<version>.appx` to every release on `windows-latest`.
   - **Locally**: `node node_modules/electron-builder/cli.js --win appx --config build/electron-builder.store.json --publish never` → creates `dist/Hinterland-Store-<version>.appx` (requires Windows *Developer Mode* enabled for `electron-builder`'s archive symlink extraction; auto-updater is automatically disabled via `process.windowsStore`, and reserved `http`/`https` AppX schemes are omitted per Store policy).
5. **Upload to Partner Center**: Upload the `.appx` package. Microsoft strips unsigned/dev signatures and **re-signs it with Microsoft's trusted Store certificate for free**, eliminating SmartScreen and Smart App Control warnings permanently.

---

## 2. SignPath Foundation ($0 Free Authenticode Signing for Direct `.exe` Downloads)

To also eliminate SmartScreen warnings on the direct `Hinterland-Setup-<version>.exe` GitHub/website installer:

1. Verify MFA is enabled on your GitHub account.
2. Apply for a free Open-Source account at **https://signpath.org** (project uses MIT license, public GitHub repo, `docs/security/code-signing-policy.md`, and SignPath credit in `README.md` — all prepared!).
3. Connect GitHub Actions in SignPath with organization ID and project slug `hinterland` (policy `release-signing`).
4. Add secrets in **GitHub Repository Settings → Secrets and variables → Actions**:
   - `SIGNPATH_API_TOKEN`
   - `SIGNPATH_ORGANIZATION_ID`
5. `.github/workflows/release.yml` automatically detects those secrets and submits `Hinterland-Setup-*.exe` to SignPath for hardware-HSM Authenticode signing.

---

## 3. Immediate False-Positive Clearance ($0 Microsoft Security Intelligence)

If Windows Defender flags any binary or heuristic false positive:
1. Go to **https://www.microsoft.com/en-us/wdsi/filesubmission**.
2. Select **Software developer**, upload `Hinterland-Setup-<version>.exe` (or point to the GitHub Release URL), and mark **Incorrectly detected as malware/PUA**.
3. Microsoft Security Intelligence updates Defender cloud definitions within 24–48 hours.

---

## 4. Free Distribution Across All Major Platforms & Package Managers

Ready-to-submit manifests for version `1.39.0` are checked into `packaging/`:

| Platform | Tool / Store | Cost | Location / Automation |
| :--- | :--- | :--- | :--- |
| **Windows (Store)** | Microsoft Store (AppX/MSIX) | **$0** | `build/electron-builder.store.json`, `build/appx/*`, `release.yml` |
| **Windows (WinGet)** | Microsoft `winget-pkgs` | **$0** | `packaging/winget/` + optional `WINGET_ACC_TOKEN` in `release.yml` |
| **Windows (Scoop)** | Scoop Extras / Bucket | **$0** | `packaging/scoop/hinterland.json` |
| **Windows (Chocolatey)** | Chocolatey Community | **$0** | `packaging/chocolatey/` (`choco pack` / `choco push`) |
| **Linux (Universal)** | AppImage & Debian `.deb` | **$0** | Built & attached automatically by `build-linux` in `release.yml` |
| **Linux (Flathub)** | Flathub / Flatpak | **$0** | `packaging/flatpak/` (submit PR to `flathub/flathub`) |
| **macOS** | `.dmg` & `.zip` | **$0*** | Built & attached automatically by `build-macos` in `release.yml` |

\* **macOS Gatekeeper Caveat ($0 Constraint)**: macOS `.dmg` and `.zip` builds are created cleanly on GitHub Releases at $0, **without Apple Notarization** (because Apple requires a paid $99/year Apple Developer Program membership). First-time macOS users may right-click → *Open* or run `xattr -cr /Applications/Hinterland.app`.
