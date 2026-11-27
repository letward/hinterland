# @neocrom/horizon-sdk

> Official SDK for creating secure, high-performance, Manifest V3 extensions for **Neocrom Horizon**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/WebExtension-Manifest%20V3-brightgreen.svg)]()
[![Security Audited](https://img.shields.io/badge/Security-Sandboxed%20%26%20Isolated-success.svg)]()

---

## Features

- **Zero-Trust User Data Protection**: Isolated sandboxed preloads prevent untrusted extensions from accessing internal browser controls, user history, saved passwords, or settings.
- **Manifest V3 First**: Strict validation and typed builders (`defineManifest`) ensuring full Chromium MV3 compliance.
- **Built-in Security & Sanitization**: `sanitizeHtml`, `safeHtml` tagged templates, and automated AST security scanner preventing XSS and injection attacks.
- **Encrypted & Namespaced Storage**: `createSecureStorage` with namespacing, schema validation, prototype pollution defense, and optional hardware-accelerated AES-GCM encryption.
- **Typed, Origin-Verified Message Bus**: `createMessageBus` with sender verification preventing message spoofing and origin hijacking.
- **Encapsulated Content Scripts**: `ContentHelper` with closed Shadow DOM mounting to protect extension UI from host page inspection and CSS collisions.
- **Neocrom Design System**: Pre-styled UI components (`UIHelper`, `createButton`, `createSwitch`, `createCard`, `createBadge`) matching Neocrom Horizon’s obsidian monochrome dark/light aesthetics.
- **Zero External Dependencies**: Pure standard Node.js & Web standards. Fast, lightweight, zero bloat.
- **Developer CLI (`horizon-sdk`)**: Instant scaffolding (`init`), security audits (`validate`), and pure Node zip packaging (`pack`).

---

## Quick Start (5 Minutes)

### Connect a developer tool to Neocrom ID

Use `@neocrom/horizon-sdk/neocrom-id` from a Node.js developer tool. Call `createNeocromIdClient().connect()` and display the returned `userCode`. Open `verificationUrlComplete` when available to prefill the code at ocrom.net, with `verificationUrl` as the manual-entry fallback. The developer reviews the requesting app and approves it with the Ocrom ID they already use on the website and in Ocrom Horizon. Call `poll(deviceCode)` no more often than the returned `interval` in seconds until the connection succeeds or `expiresIn` elapses.

The resulting token authorizes `profile(token)` and `pulseProject(token)`. The Pulse response contains the account's project ID and ingest endpoint when configured. The Pulse dashboard issues the separate ingest key for a game. Keep the developer token in the tool's secure storage and call `disconnect(token)` to revoke it. Extensions and shipped game builds should not receive this token.

### 1. Scaffold a New Extension

```bash
npx horizon-sdk init my-reader-extension
cd my-reader-extension
```

This creates a ready-to-run Manifest V3 extension structure:
```
my-reader-extension/
├── manifest.json       # Compliant MV3 configuration
├── background.js       # Background service worker
├── content.js          # In-page content script
├── content.css         # Scoped styles
├── popup.html          # Browser action popup
├── popup.js            # Popup logic
├── popup.css           # Neocrom Horizon theme styles
└── README.md
```

### 2. Validate & Audit for Security

```bash
npx horizon-sdk validate .
```

The linter audits permissions, verifies file references, and scans code for dangerous functions like `eval()`, `new Function()`, or unsanitized `innerHTML`.

### 3. Load in Neocrom Horizon

1. Launch Neocrom Horizon.
2. Navigate to **Settings** > **Extensions**.
3. Toggle on **Allow Unpacked Extensions**.
4. Click **Install Unpacked Extension** and select your directory.

### 4. Package for Distribution

```bash
npx horizon-sdk pack .
```

Generates a clean `.zip` archive ready for publishing or sharing.

---

## SDK Module Reference

### Manifest Builder (`@neocrom/horizon-sdk/manifest`)

```javascript
import { defineManifest } from '@neocrom/horizon-sdk/manifest';

export default defineManifest({
  name: 'Focus Companion',
  version: '1.0.0',
  description: 'Quiet distraction-free reading',
  permissions: ['activeTab', 'storage'],
  action: {
    default_title: 'Toggle Focus',
    default_popup: 'popup.html'
  },
  background: {
    service_worker: 'background.js'
  }
});
```

### Safe Storage (`@neocrom/horizon-sdk/security`)

```javascript
import { createSecureStorage } from '@neocrom/horizon-sdk/security';

const storage = createSecureStorage({
  namespace: 'my_ext',
  encryptionKey: 'user-passphrase' // Optional AES-GCM encryption
});

// Write with automatic sanitization and optional encryption
await storage.set('authToken', 'secret-token-1234', { encrypt: true });

// Read safely
const token = await storage.get('authToken', null);
```

### Safe HTML & XSS Prevention (`@neocrom/horizon-sdk/security`)

```javascript
import { safeHtml, sanitizeHtml } from '@neocrom/horizon-sdk/security';

// Untrusted user input is automatically escaped
const userText = '<img src=x onerror=alert(1)>';
const domString = safeHtml`<div class="comment">${userText}</div>`;

// Sanitize rich HTML from third-party APIs
const clean = sanitizeHtml(dirtyApiResponseHtml);
```

### Message Bus (`@neocrom/horizon-sdk/messaging`)

```javascript
import { createMessageBus } from '@neocrom/horizon-sdk/messaging';

const bus = createMessageBus();

// Listen with automatic sender origin verification
bus.on('GET_DATA', async (payload, sender) => {
  return { status: 'ok', timestamp: Date.now() };
});

// Send message to background service worker
const response = await bus.sendToBackground('GET_DATA');
```

### Content Helper (`@neocrom/horizon-sdk/content`)

```javascript
import { ContentHelper } from '@neocrom/horizon-sdk/content';

// Mount isolated UI in closed Shadow DOM
const host = document.createElement('div');
document.body.appendChild(host);
const shadow = ContentHelper.mountShadowRoot(host, { mode: 'closed' });

// Extract article text while safely ignoring passwords, forms, and hidden fields
const { title, wordCount, readingTimeMinutes } = ContentHelper.extractSafeArticleText();
```

---

## Security Model

Neocrom Horizon enforces strict runtime boundaries:

1. **Preload Isolation**: Extension popups use `EXTENSION_PRELOAD` which exposes only scoped popup controls. The browser's internal privileged API (`window.horizon`) is **never** accessible to extensions.
2. **Permission Guardrails**: Forbidden permissions (`debugger`, `nativeMessaging`, `management`, `proxy`, `privacy`) are rejected by the browser loader.
3. **Storage Partitioning**: Extensions cannot read or write to other extensions' storage, nor can they access Neocrom Horizon's storage files.
4. **Content Security Policy**: Extension pages require `script-src 'self'`. Dynamic code execution (`unsafe-eval`) is blocked.

---

## License

MIT © Neocrom Horizon Team
