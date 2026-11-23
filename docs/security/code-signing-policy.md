# Code Signing Policy — Hinterland Browser

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

## Purpose & Scope
This policy governs how official Windows release binaries and installers for **Hinterland** are built, verified, signed, and distributed to protect users against tampering and eliminate Windows Defender SmartScreen warnings.

## Roles & Responsibilities
- **Authors / Contributors**: Submit changes via pull requests to `https://github.com/letward/Hinterland`. Contributors never handle signing keys or trigger release tags directly.
- **Reviewers / Maintainers**: Review code changes, verify CI status checks (`PR Checks`, `CodeQL`, `SDK Tests`), create release tags (`v*`), and approve release signing requests inside SignPath.
- **Approvers**: Only repository maintainers with Multi-Factor Authentication (MFA) enabled on both GitHub and SignPath may approve release signatures.

## Privacy Policy & Software Security Guarantees
- Hinterland stores browsing history, bookmarks, notes, reading lists, and zero-knowledge encrypted passwords (`AES-256-GCM`) locally on the user's device.
- Optional cloud synchronization is strictly opt-in and uses end-to-end zero-knowledge encryption where chosen.
- Hinterland does **not** transmit unencrypted browsing history, telemetry profiles, or credentials to SignPath, third-party ad networks, or unauthorized external services.
- Full Privacy Policy: https://hinterland-browser.vercel.app/docs/privacy.html

## Build Integrity & Provenance
1. Release artifacts are compiled exclusively on clean, ephemeral GitHub-hosted runners (`windows-latest`, `ubuntu-latest`, `macos-latest`) triggered by a `v*` tag push or manual maintainer dispatch in `.github/workflows/release.yml`.
2. Private signing keys never leave SignPath's Hardware Security Module (HSM) and are never stored in the repository, CI secrets, or agent environments.
3. Every release publishes SHA-256 checksum manifests (`SHA256SUMS-*.txt`) and GitHub SLSA Build Provenance Attestations (`actions/attest-build-provenance`).
4. Extensions run in isolated sandboxes under `EXTENSION_PRELOAD` with strict Content Security Policy enforcement (`docs/extensions-security.md`).
