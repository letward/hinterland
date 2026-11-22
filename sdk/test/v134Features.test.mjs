import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.34.0 Features & Polish', () => {
  describe('Copy All Open Tabs as Markdown', () => {
    it('declares tabs:copyAllMarkdown handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:copyAllMarkdown'"));
      assert.ok(ipcSource.includes('# Hinterland Open Tabs'));
      assert.ok(ipcSource.includes('toast.allTabsCopied'));
      assert.ok(ipcSource.includes('toast.noTabsToCopy'));
    });

    it('exposes copyAllMarkdown on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload/chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("copyAllMarkdown: () => ipcRenderer.invoke('tabs:copyAllMarkdown')"));
    });

    it('adds Copy All Open Tabs button in Tab Groups Studio (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.copyAllMarkdown()'));
      assert.ok(panelsSource.includes("t('tabGroups.copyAllLinks')"));
    });

    it('wires Copy All Open Tabs as Markdown in Main Menu and Tabstrip Menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      const count = menuSource.match(/t\('menu\.copyAllTabsMarkdown'\)/g)?.length ?? 0;
      assert.equal(count, 2);
      assert.ok(menuSource.includes('api().tabs.copyAllMarkdown()'));
    });

    it('registers tabsCopyAllMarkdown in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'tabsCopyAllMarkdown'"));
      assert.ok(cpSource.includes('api().tabs.copyAllMarkdown()'));
    });
  });

  describe('Wake All Sleeping Tabs', () => {
    it('declares wakeAll() on TabManager in src/main/tabs.js', () => {
      const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
      assert.ok(tabsSource.includes('wakeAll()'));
      assert.ok(tabsSource.includes('tab.sleeping && tab.wake()'));
    });

    it('declares tabs:wakeAll handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:wakeAll'"));
      assert.ok(ipcSource.includes('tabs.wakeAll()'));
      assert.ok(ipcSource.includes('toast.wokeAllTabs'));
      assert.ok(ipcSource.includes('toast.noSleepingTabs'));
    });

    it('exposes wakeAll on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("wakeAll: () => ipcRenderer.invoke('tabs:wakeAll')"));
    });

    it('adds Wake sleeping tabs button in Task Manager (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.wakeAll()'));
      assert.ok(panelsSource.includes("t('taskManager.wakeAll')"));
    });

    it('wires Wake All Sleeping Tabs in Tab Menus and Command Palette', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.wakeAllTabs')"));
      assert.ok(menuSource.includes('api().tabs.wakeAll()'));
      assert.ok(cpSource.includes("id: 'tabsWakeAll'"));
      assert.ok(cpSource.includes('api().tabs.wakeAll()'));
    });
  });

  describe('Cookie Inspector: Export Site Cookies as JSON', () => {
    it('declares site:exportCookies handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('site:exportCookies'"));
      assert.ok(ipcSource.includes('toast.cookiesExported'));
      assert.ok(ipcSource.includes('toast.noCookiesToExport'));
    });

    it('exposes exportCookies on site bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportCookies: (url) => ipcRenderer.invoke('site:exportCookies', url)"));
    });

    it('adds Export JSON button in Cookie Inspector toolbar (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().site.exportCookies(targetUrl)'));
      assert.ok(panelsSource.includes("t('siteInfo.exportCookies')"));
    });
  });

  describe('Downloads Manager: Clear Failed / Interrupted Downloads', () => {
    it('declares clearFailedDownloads() in src/main/downloads.js', () => {
      const dlSource = readFileSync(join(ROOT, 'src', 'main', 'downloads.js'), 'utf8');
      assert.ok(dlSource.includes('export function clearFailedDownloads()'));
      assert.ok(dlSource.includes("item.state === 'interrupted' || item.state === 'cancelled' || item.ok === false"));
    });

    it('declares downloads:clearFailed handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('downloads:clearFailed'"));
      assert.ok(ipcSource.includes('clearFailedDownloads()'));
    });

    it('exposes clearFailed on downloads bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("clearFailed: () => ipcRenderer.invoke('downloads:clearFailed')"));
    });

    it('adds Clear failed button in Downloads Manager and Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes('api().downloads.clearFailed()'));
      assert.ok(panelsSource.includes("t('downloads.clearFailed')"));
      assert.ok(panelsSource.includes("toast(t('toast.downloadsFailedCleared'), 'info')"));
      assert.ok(cpSource.includes("id: 'downloadsClearFailed'"));
    });
  });

  describe('Tab Stash: Copy Stash Links as Markdown', () => {
    it('declares stashes:copyMarkdown handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('stashes:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.stashLinksCopied'));
      assert.ok(ipcSource.includes('toast.noTabsInStashToCopy'));
    });

    it('exposes copyMarkdown on stashes bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("copyMarkdown: (stashId) => ipcRenderer.invoke('stashes:copyMarkdown', stashId)"));
    });

    it('adds Copy Links button on stash cards in Tab Stash (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().stashes.copyMarkdown(stash.id)'));
      assert.ok(panelsSource.includes("t('stash.copyLinks')"));
    });
  });

  describe('Locales Consistency for v1.34.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.copyAllTabsMarkdown',
      'menu.wakeAllTabs',
      'commandPalette.tabsCopyAllMarkdown',
      'commandPalette.tabsWakeAll',
      'commandPalette.downloadsClearFailed',
      'downloads.clearFailed',
      'siteInfo.exportCookies',
      'taskManager.wakeAll',
      'stash.copyLinks',
      'tabGroups.copyAllLinks',
      'tabGroups.copyAllLinksDesc',
      'toast.allTabsCopied',
      'toast.noTabsToCopy',
      'toast.wokeAllTabs',
      'toast.noSleepingTabs',
      'toast.cookiesExported',
      'toast.noCookiesToExport',
      'toast.downloadsFailedCleared',
      'toast.stashLinksCopied',
      'toast.noTabsInStashToCopy',
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
    it('documents v1.34.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Copy All Open Tabs'));
      assert.ok(guide.includes('Wake sleeping tabs'));
      assert.ok(guide.includes('export them as <strong>JSON</strong> from the Cookie Inspector'));
      assert.ok(guide.includes('Clear failed'));
      assert.ok(guide.includes("Copy any stash's links directly to your clipboard as Markdown"));
    });

    it('updates website/index.html to v1.34.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.34.0 · Latest Release') || indexHtml.includes('v1.35.0 · Latest Release') || indexHtml.includes('v1.36.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.34.0.exe') || indexHtml.includes('Hinterland-Setup-1.35.0.exe') || indexHtml.includes('Hinterland-Setup-1.36.0.exe'));
    });

    it('updates website/api/sync.js to v1.34.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.34.0'") || syncJs.includes("version: '1.35.0'") || syncJs.includes("version: '1.36.0'"));
    });
  });
});
