# Neocrom Horizon Design

Horizon übernimmt Schwarz, Silber und die abgerundete Raute von Neocrom. Der Sonnenaufgang in der Mitte kennzeichnet den Browser.

## Prinzipien

1. **Klarheit vor Dekoration** — Inhalte stehen im Vordergrund, UI tritt zurück.
2. **Dunkel zuerst** — Standard ist Dark Mode; Light Mode ist gleichwertig unterstützt.
3. **Ruhige Bewegung** — Animationen sind kurz (≤ 200 ms), weich und respektieren `prefers-reduced-motion`.
4. **Zugänglichkeit** — Fokus-Ringe, Kontrast, Tastatur-Navigation sind Pflicht.
5. **Konsistenz** — Eine einzige Quelle der Wahrheit: `design/tokens.css`.

## Tokens

Alle Werte sind in `design/tokens.css` definiert und werden von `src/ui/css/tokens.css` und `website/tokens.css` gespiegelt.

- **Farben** auf dunklem Grund. Hintergrund `#090909`, Flächen `#141414`, Sekundärtext `#bdbdbd` und Akzent `#f8f8f8`.
- **Radien** für Bedienelemente (10px), kleine Flächen (7px) und Karten (16px).
- **Schatten:** `--shadow`, `--shadowSmall`.
- **Bewegung:** `--anim` (140ms). Reduziert auf 0ms bei `data-animations="off"`.
- **Typografie:** `--font` (System-Stack), `--fontMono`.
- **Blur:** `--blur` (18px) für Glas-Effekte.

## Themes

- Dark (default): `color-scheme: dark`
- Light: `html[data-theme="light"]`
- Animationen aus: `html[data-animations="off"]`

Beim Aktualisieren übernimmt ein Profil mit den bisherigen Standardfarben die Neocrom-Palette. Individuelle Farben und andere Einstellungen bleiben erhalten. Der Browser öffnet Marketplace, Community, Bibliothek und Pulse auf `neocrom.pro`. Die Horizon-Synchronisierung hat ihren eigenen Zugang.

## Komponenten

- **Buttons:** primär `--accent` mit `--onAccent`-Text, abgerundet `--radiusLarge`, Hover-Lift + Shine.
- **Cards:** `--surface` mit `--borderSoft`, `--radiusLarge`, subtiler Schatten.
- **Navbar:** geblurrt, sticky, Border erscheint beim Scrollen.
- **Modals/Sheets:** zentriert, `--shadow`, abgerundet.

## Motion

- Easing: `cubic-bezier(.2, 0, 0, 1)` für Eingänge, `ease` für Hover.
- Dauer: 140–240 ms für UI, 700 ms für Reveal.
- Respektiere `prefers-reduced-motion`.

## Barrierefreiheit

- `:focus-visible` mit 2px Accent-Outline.
- Scrollbars dezent, kontrastreich genug.
- Semantische HTML-Struktur, ARIA wo nötig.
