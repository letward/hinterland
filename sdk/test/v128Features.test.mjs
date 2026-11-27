import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Neocrom Horizon v1.28.0 Features & Polish', () => {
  describe('Neocrom Horizon design tokens', () => {
    const tokensDesign = readFileSync(join(ROOT, 'design', 'tokens.css'), 'utf8');
    const tokensUi = readFileSync(join(ROOT, 'src', 'ui', 'css', 'tokens.css'), 'utf8');
    const tokensWeb = readFileSync(join(ROOT, 'website', 'tokens.css'), 'utf8');

    it('uses the same Neocrom palette and radii in the app and on the website', () => {
      for (const tokens of [tokensDesign, tokensUi, tokensWeb]) {
        assert.ok(tokens.includes('--radius: 10px'));
        assert.ok(tokens.includes('--radiusSmall: 7px'));
        assert.ok(tokens.includes('--bg: #090909'));
        assert.ok(tokens.includes('--accent: #f8f8f8'));
      }
    });

    it('uses shared radii in tabs and in the address bar', () => {
      const chromeCss = readFileSync(join(ROOT, 'src', 'ui', 'css', 'chrome.css'), 'utf8');
      assert.ok(chromeCss.includes('.tab {'));
      assert.ok(chromeCss.includes('border-radius: var(--radius) var(--radius) 0 0;'));
      assert.ok(chromeCss.includes('.omni {'));
      assert.ok(chromeCss.includes('border-radius: var(--radiusPill);'));
    });

    it('uses shared radii in the new tab search box and ecosystem cards', () => {
      const newtabCss = readFileSync(join(ROOT, 'src', 'ui', 'css', 'newtab.css'), 'utf8');
      assert.ok(newtabCss.includes('.heroLogo {'));
      assert.match(newtabCss, /\.searchBox \{[^}]+border-radius: var\(--radius\)/);
      assert.match(newtabCss, /\.ecosystemTile \{[^}]+border-radius: var\(--radiusLarge\)/);
      assert.ok(newtabCss.includes('.link {'));
      assert.ok(newtabCss.includes('.linkIcon {'));
    });
  });

  describe('Cloud Sync Engine: Search History Synchronization', () => {
    it('declares account.syncHistory setting in schema.js with default true', async () => {
      const schemaModule = await import('../../src/main/schema.js');
      const defaults = schemaModule.buildDefaults();
      assert.ok(defaults);
      assert.equal(defaults.account?.syncHistory, true);
    });

    it('exports mergeHistory and normalizeHistoryUrl in sync.js', async () => {
      const syncModule = await import('../../src/main/sync.js');
      assert.equal(typeof syncModule.mergeHistory, 'function');
      assert.equal(typeof syncModule.normalizeHistoryUrl, 'function');

      const norm = syncModule.normalizeHistoryUrl('HTTPS://Example.COM/Path/?foo=bar#hash');
      assert.equal(norm, 'https://example.com/Path/?foo=bar#hash');

      const local = [{ url: 'https://example.com', title: 'Example', visits: 1, time: 1000 }];
      const remote = [{ url: 'https://example.com/', title: 'Example New', visits: 3, time: 2000 }];
      const merged = syncModule.mergeHistory(local, remote);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].visits, 3);
      assert.equal(merged[0].time, 2000);
      assert.equal(merged[0].title, 'Example New');
    });

    it('exports mergeEntries on history in history.js', async () => {
      const historyModule = await import('../../src/main/history.js');
      assert.equal(typeof historyModule.history.mergeEntries, 'function');
    });

    it('handles history payloads in Vercel Serverless Sync API (website/api/sync.js)', () => {
      const syncApiPath = join(ROOT, 'website', 'api', 'sync.js');
      const syncApiSource = readFileSync(syncApiPath, 'utf8');
      assert.ok(syncApiSource.includes('mergeHistory'));
      assert.ok(syncApiSource.includes('history'));
    });

    it('handles Supabase GoTrue user payload resolution safely in website/api/_account.js', () => {
      const accountApiPath = join(ROOT, 'website', 'api', '_account.js');
      const accountApiSource = readFileSync(accountApiPath, 'utf8');
      assert.ok(accountApiSource.includes('data.id ? data : (data.user || null)'));
    });
  });

  describe('Internal Scheme UI Security (src/main/protocol.js)', () => {
    it('permits internal horizon scheme images in Content Security Policy', () => {
      const protocolPath = join(ROOT, 'src', 'main', 'protocol.js');
      const protocolSource = readFileSync(protocolPath, 'utf8');
      assert.ok(protocolSource.includes("img-src 'self' ${SCHEME}:") || protocolSource.includes("img-src 'self' horizon:"));
    });
  });

  describe('Locales Consistency for v1.28.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    const requiredKeys = [
      ['account', 'syncHistory'],
      ['account', 'syncHistoryDesc'],
      ['account', 'historySynced'],
      ['settings', 'account', 'syncHistory'],
      ['settings', 'account', 'syncHistoryDesc']
    ];

    for (const keyPath of requiredKeys) {
      it(`defines key path "${keyPath.join('.')}" in both en.json and de.json`, () => {
        let valEn = en;
        let valDe = de;
        for (const seg of keyPath) {
          assert.ok(valEn && typeof valEn === 'object' && seg in valEn, `en.json missing ${seg}`);
          assert.ok(valDe && typeof valDe === 'object' && seg in valDe, `de.json missing ${seg}`);
          valEn = valEn[seg];
          valDe = valDe[seg];
        }
        assert.equal(typeof valEn, 'string');
        assert.equal(typeof valDe, 'string');
      });
    }
  });

  describe('Official Website & Release Artefacts Completeness', () => {
    it('updates website/index.html to latest release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(/v1\.\d+\.\d+ · /.test(indexHtml));
      assert.ok(indexHtml.includes('releases/download/v1.47.0/Neocrom-Horizon-Setup-1.47.0.exe'));
    });
  });
});
