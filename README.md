# Hinterland

Ein schneller, sicherer und frei anpassbarer Browser (Electron/Chromium).

[![Release](https://img.shields.io/github/v/release/letward/Hinterland)](https://github.com/letward/Hinterland/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Download:** https://hinterland-browser.vercel.app/

## Features

- Multi-Tab-Browsing mit privaten Tabs, Pinning, Tab-Gruppen und Tab-Stash
- Privacy: Tracker-Blocking, HTTPS-First, DNT, Referrer-Stripping, Site-Permissions
- Reader Mode, Quick Notes, Reading List, Media Controller / PiP
- Passwort-Manager (Zero-Knowledge AES-GCM Vault)
- Extension-Support (MV3) + eigenes Extension SDK (`@hinterland/extension-sdk`)
- Automatische Updates über GitHub Releases

## Repository-Struktur

```
Hinterland/
├── src/            # Browser-Quellcode (main, preload, ui, extensions)
├── sdk/            # Extension SDK + Tests
├── examples/       # Beispiel-Extensions
├── agent/          # Python Agent-Orchestrator
├── updater/        # Updater-Client (Signatur/Hash-Verifikation)
├── scripts/        # Build-/Icon-/Check-Skripte
├── build/          # Build-Assets (Icons)
├── docs/           # Architektur, SDK-, Security-Doku
├── website/        # Vercel-Website (Download + Changelog)  ← Root Directory auf Vercel
├── .github/        # CI/CD-Workflows
├── package.json
└── CHANGELOG.md
```

## Entwicklung

Voraussetzungen: Node.js >= 20.

```bash
npm install
npm start          # Browser starten
npm run dev        # Dev-Modus
npm run check      # Statische Prüfungen
npm test           # Checks + SDK-Tests
npm run dist       # Windows-Installer bauen
```

## Dokumentation

- [Architektur](docs/architecture.md)
- [Extension SDK](docs/extensions-sdk.md)
- [Extension Security](docs/extensions-security.md)
- [Operations](docs/operations.md)
- [Incident Response](docs/incident-response.md)
- [Security / Threat Model](docs/security/threat-model.md)
- [Release Policy](docs/security/release-policy.md)
- [Code Signing Policy](docs/security/code-signing-policy.md)
- [Multi-Platform Distribution ($0)](docs/distribution.md)

## Website (Vercel)

Der Ordner `website/` ist das Root Directory des Vercel-Projekts. Er zeigt Download-Button + neuesten Changelog. Änderungen an `CHANGELOG.md` auf `main` erscheinen dort automatisch.

## Plattformen, Signatur & Lizenzen

- **Windows:** 1-Klick-Installer (NSIS), Microsoft Store AppX (`build/electron-builder.store.json`) sowie Paket-Manifeste für WinGet, Scoop und Chocolatey (`packaging/`).
- **Linux & macOS:** AppImage, `.deb`, Flatpak-Manifest sowie `.dmg`/`.zip`.
- **Code-Signierung:** Free code signing provided by SignPath.io, certificate by SignPath Foundation.
- **Lizenzen & Datenschutz:** [LICENSE](LICENSE) (MIT), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) und [Privacy Policy](website/docs/privacy.html).

## Lizenz

MIT — siehe [LICENSE](LICENSE).