import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.38.0 Features & Polish', () => {
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Extensions Manager: Search Filter, Live Summary & Copy Extensions List', () => {
    it('declares extensions:copyList handler in src/main/ipc.js and preload bridge', () => {
      assert.ok(ipcSource.includes("handle('extensions:copyList'"));
      assert.ok(ipcSource.includes('toast.extensionsListCopied'));
      assert.ok(ipcSource.includes('toast.noExtensionsToCopy'));
      assert.ok(preloadSource.includes("copyList: () => ipcRenderer.invoke('extensions:copyList')"));
    });

    it('wires search filter, summary counter, Copy List button, and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().extensions.copyList()'));
      assert.ok(panelsSource.includes("t('extensions.summaryCount'"));
      assert.ok(panelsSource.includes("t('extensions.copyList')"));
      assert.ok(panelsSource.includes("t('extensions.noMatch')"));
      assert.ok(cpSource.includes("id: 'extensionsCopyList'"));
    });
  });

  describe('Recently Closed Tabs: Copy URLs & Live Count Badge', () => {
    it('declares tabs:copyRecentlyClosedUrls handler using copyUniqueUrls in src/main/ipc.js and preload', () => {
      assert.ok(ipcSource.includes('copyUniqueUrls'));
      assert.ok(ipcSource.includes("handle('tabs:copyRecentlyClosedUrls'"));
      assert.ok(ipcSource.includes('toast.recentlyClosedUrlsCopied'));
      assert.ok(ipcSource.includes('toast.noRecentlyClosedToCopy'));
      assert.ok(preloadSource.includes("copyRecentlyClosedUrls: (urls) => ipcRenderer.invoke('tabs:copyRecentlyClosedUrls', urls)"));
    });

    it('wires Copy URLs, live count badge, and Command Palette action for Recently Closed Tabs', () => {
      assert.ok(panelsSource.includes('api().tabs.copyRecentlyClosedUrls(lastFilteredUrls)'));
      assert.ok(panelsSource.includes("t('history.recentlyClosedCount'"));
      assert.ok(cpSource.includes("id: 'tabsCopyRecentlyClosedUrls'"));
    });
  });

  describe('Cookie Inspector: Copy JSON & Live Cookie Count Badge', () => {
    it('extracts buildCookiesPayload and declares site:copyCookiesJson handler', () => {
      assert.ok(ipcSource.includes('buildCookiesPayload'));
      assert.ok(ipcSource.includes("handle('site:copyCookiesJson'"));
      assert.ok(ipcSource.includes('toast.cookiesCopiedJson'));
      assert.ok(preloadSource.includes("copyCookiesJson: (url) => ipcRenderer.invoke('site:copyCookiesJson', url)"));
    });

    it('wires Copy JSON button and cookie count badge in Cookie Inspector panel', () => {
      assert.ok(panelsSource.includes('api().site.copyCookiesJson(targetUrl)'));
      assert.ok(panelsSource.includes("t('siteInfo.copyCookiesJson')"));
      assert.ok(panelsSource.includes("t('siteInfo.cookieCountBadge'"));
    });
  });

  describe('Keyboard Shortcuts: Copy Cheatsheet as Markdown & Live Count Badge', () => {
    it('declares shortcuts:copyMarkdown handler in src/main/ipc.js and preload bridge', () => {
      assert.ok(ipcSource.includes("handle('shortcuts:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.shortcutsCopied'));
      assert.ok(ipcSource.includes('toast.noShortcutsToCopy'));
      assert.ok(preloadSource.includes("copyMarkdown: (markdown) => ipcRenderer.invoke('shortcuts:copyMarkdown', markdown)"));
    });

    it('wires Copy Cheatsheet button and live count badge in Shortcuts panel', () => {
      assert.ok(panelsSource.includes('api().shortcuts.copyMarkdown('));
      assert.ok(panelsSource.includes("t('shortcuts.copyCheatsheet')"));
      assert.ok(panelsSource.includes("t('shortcuts.countBadge'"));
    });
  });

  describe('Tab Stash: Restore as Group & Copy All Stashed URLs', () => {
    it('declares stashes:restoreAsGroup and stashes:copyAllUrls handlers in src/main/ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('stashes:restoreAsGroup'"));
      assert.ok(ipcSource.includes('toast.stashRestoredAsGroup'));
      assert.ok(ipcSource.includes("handle('stashes:copyAllUrls'"));
      assert.ok(ipcSource.includes('toast.stashAllUrlsCopied'));
      assert.ok(preloadSource.includes("restoreAsGroup: (stashId) => ipcRenderer.invoke('stashes:restoreAsGroup', stashId)"));
      assert.ok(preloadSource.includes("copyAllUrls: () => ipcRenderer.invoke('stashes:copyAllUrls')"));
    });

    it('wires Restore as Group, Copy All URLs, and Command Palette action in Tab Stash panel', () => {
      assert.ok(panelsSource.includes('api().stashes.restoreAsGroup(stash.id)'));
      assert.ok(panelsSource.includes('api().stashes.copyAllUrls()'));
      assert.ok(panelsSource.includes("t('stash.restoreAsGroup')"));
      assert.ok(panelsSource.includes("t('stash.copyAllUrls')"));
      assert.ok(cpSource.includes("id: 'stashesCopyAllUrls'"));
    });
  });

  describe('Site Permissions & Shields: Copy Summary & Live Count Badge', () => {
    it('declares site:copySummary handler in src/main/ipc.js and preload bridge', () => {
      assert.ok(ipcSource.includes("handle('site:copySummary'"));
      assert.ok(ipcSource.includes('toast.siteSummaryCopied'));
      assert.ok(ipcSource.includes('toast.noSiteRulesToCopy'));
      assert.ok(preloadSource.includes("copySummary: () => ipcRenderer.invoke('site:copySummary')"));
    });

    it('wires Copy Summary button, count badge, and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().site.copySummary()'));
      assert.ok(panelsSource.includes("t('sitePermissions.copySummary')"));
      assert.ok(panelsSource.includes("t('sitePermissions.countBadge'"));
      assert.ok(cpSource.includes("id: 'siteCopySummary'"));
    });
  });

  describe('Locales Consistency for v1.38.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'commandPalette.extensionsCopyList',
      'commandPalette.tabsCopyRecentlyClosedUrls',
      'commandPalette.siteCopySummary',
      'commandPalette.stashesCopyAllUrls',
      'extensions.copyList',
      'extensions.noMatch',
      'extensions.summaryCount',
      'history.recentlyClosedCount',
      'shortcuts.copyCheatsheet',
      'shortcuts.countBadge',
      'siteInfo.cookieCountBadge',
      'siteInfo.copyCookiesJson',
      'sitePermissions.copySummary',
      'sitePermissions.countBadge',
      'stash.copyAllUrls',
      'stash.restoreAsGroup',
      'stash.restoreAsGroupDesc',
      'toast.noShortcutsToCopy',
      'toast.shortcutsCopied',
      'toast.noRecentlyClosedToCopy',
      'toast.recentlyClosedUrlsCopied',
      'toast.noExtensionsToCopy',
      'toast.extensionsListCopied',
      'toast.cookiesCopiedJson',
      'toast.noSiteRulesToCopy',
      'toast.siteSummaryCopied',
      'toast.stashRestoredAsGroup',
      'toast.stashAllUrlsCopied',
    ];

    for (const key of testKeys) {
      it(`defines key path "${key}" in both en.json and de.json`, () => {
        const enVal = getByPath(en, key);
        const deVal = getByPath(de, key);
        assert.ok(typeof enVal === 'string' && enVal.length > 0, `en missing ${key}`);
        assert.ok(typeof deVal === 'string' && deVal.length > 0, `de missing ${key}`);
      });
    }
  });

  describe('Official Documentation & Website Completeness', () => {
    it('documents v1.38.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Copy Summary'));
      assert.ok(guide.includes('Copy JSON'));
      assert.ok(guide.includes('Restore as Group'));
      assert.ok(guide.includes('Copy All URLs'));
      assert.ok(guide.includes('Copy Cheatsheet'));
      assert.ok(guide.includes('Copy Extensions List'));
    });

    it('updates website/index.html to v1.38.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(/v1\.\d+\.\d+ · Latest Release/.test(indexHtml));
      assert.ok(indexHtml.includes('v1.38.0 · Latest Release') || indexHtml.includes('v1.39.0 · Latest Release') || indexHtml.includes('v1.40.0 · Latest Release') || indexHtml.includes('v1.41.0 · Latest Release') || indexHtml.includes('v1.42.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.38.0.exe') || indexHtml.includes('Hinterland-Setup-1.39.0.exe') || indexHtml.includes('Hinterland-Setup-1.40.0.exe') || indexHtml.includes('Hinterland-Setup-1.41.0.exe') || indexHtml.includes('Hinterland-Setup-1.42.0.exe'));
    });

    it('updates website/api/sync.js to v1.38.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.38.0'") || syncJs.includes("version: '1.39.0'") || syncJs.includes("version: '1.40.0'") || syncJs.includes("version: '1.41.0'") || syncJs.includes("version: '1.42.0'"));
    });
  });
});
