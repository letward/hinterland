# Smart Reading Companion (Neocrom Horizon Example Extension)

A complete showcase extension built for **Neocrom Horizon** using the `@neocrom/horizon-sdk`.

## Highlights

- **Manifest V3 Compliant**: Built strictly adhering to Neocrom Horizon's security and MV3 requirements.
- **Privacy-First**: Operates strictly within `['activeTab', 'storage']`. Never accesses broad browsing history, private user credentials, or form fields.
- **Shadow DOM Encapsulation**: The in-page reading HUD is rendered inside a closed `ShadowRoot` so host page scripts cannot inspect or tamper with it, and host CSS never breaks its layout.
- **Isolated Storage**: Extension settings and reading metrics are isolated to the extension's private namespace.
- **Popup Isolation**: Runs safely with Neocrom Horizon's sandboxed extension preload without exposing internal browser APIs.

## How to Load in Neocrom Horizon

1. Start Neocrom Horizon (`npm start` or installed app).
2. Open **Settings** > **Extensions**.
3. Toggle on **Allow Unpacked Extensions**.
4. Click **Install Unpacked Extension** and select this directory (`examples/smart-reader`).
5. Open any article website (e.g. Wikipedia, blog, news). Notice the clean reading HUD badge in the lower right corner showing estimated reading time!
