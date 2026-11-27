import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Neocrom Horizon v1.35.0 Features & Polish', () => {
  describe('Tab Groups Studio Fix & tabs:list Bridge', () => {
    it('declares tabs:list handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:list', () => tabs.snapshot().tabs)"));
    });

    it('exposes list on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("list: () => ipcRenderer.invoke('tabs:list')"));
    });
  });

  describe('Close Tabs from Same Domain', () => {
    it('declares closeByDomain(id) on TabManager in src/main/tabs.js', () => {
      const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
      assert.ok(tabsSource.includes('async closeByDomain(id)'));
      assert.ok(tabsSource.includes('!tab.pinned && normalizeHost(tab.url) === domain') || tabsSource.includes('!tab.pinned && this.normalizeHost(tab.url) === domain'));
    });

    it('declares tabs:closeByDomain handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:closeByDomain'"));
      assert.ok(ipcSource.includes('tabs.closeByDomain('));
      assert.ok(ipcSource.includes('toast.closedSameDomain'));
      assert.ok(ipcSource.includes('toast.noSameDomainTabs'));
    });

    it('exposes closeByDomain on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("closeByDomain: (id) => ipcRenderer.invoke('tabs:closeByDomain', id)"));
    });

    it('wires Close Tabs from Same Domain in Tab Menus and Command Palette', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.closeByDomain')"));
      assert.ok(menuSource.includes('api().tabs.closeByDomain('));
      assert.ok(cpSource.includes("id: 'tabsCloseByDomain'"));
      assert.ok(cpSource.includes('api().tabs.closeByDomain(current.id)'));
    });
  });

  describe('Copy All Open Tabs as Plain URLs & Open URLs from Clipboard', () => {
    it('declares tabs:copyAllUrls and tabs:openClipboardUrls handlers in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:copyAllUrls'"));
      assert.ok(ipcSource.includes('toast.allUrlsCopied'));
      assert.ok(ipcSource.includes("handle('tabs:openClipboardUrls'"));
      assert.ok(ipcSource.includes('toast.openedClipboardUrls'));
      assert.ok(ipcSource.includes('toast.noUrlsInClipboard'));
    });

    it('exposes copyAllUrls and openClipboardUrls on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("copyAllUrls: () => ipcRenderer.invoke('tabs:copyAllUrls')"));
      assert.ok(preloadSource.includes("openClipboardUrls: () => ipcRenderer.invoke('tabs:openClipboardUrls')"));
    });

    it('adds Copy All URLs and Open URLs from Clipboard buttons in Tab Groups Studio (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.copyAllUrls()'));
      assert.ok(panelsSource.includes("t('tabGroups.copyAllUrls')"));
      assert.ok(panelsSource.includes('api().tabs.openClipboardUrls()'));
      assert.ok(panelsSource.includes("t('tabGroups.openClipboardUrls')"));
    });

    it('wires Copy All Open Tabs as URLs and Open URLs from Clipboard in Menus and Command Palette', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.equal(menuSource.match(/t\('menu\.copyAllTabsUrls'\)/g)?.length ?? 0, 2);
      assert.equal(menuSource.match(/t\('menu\.openClipboardUrls'\)/g)?.length ?? 0, 2);
      assert.ok(cpSource.includes("id: 'tabsCopyAllUrls'"));
      assert.ok(cpSource.includes("id: 'tabsOpenClipboardUrls'"));
    });
  });

  describe('Bookmarks Manager: Copy as Markdown', () => {
    it('declares bookmarks:copyMarkdown handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('bookmarks:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.bookmarksCopied'));
      assert.ok(ipcSource.includes('toast.noBookmarksToCopy'));
    });

    it('exposes copyMarkdown on bookmarks bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("copyMarkdown: (items) => ipcRenderer.invoke('bookmarks:copyMarkdown', items)"));
    });

    it('adds Copy as Markdown button in Bookmarks Manager and Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes('api().bookmarks.copyMarkdown(items)'));
      assert.ok(panelsSource.includes("t('bookmarks.copyMarkdown')"));
      assert.ok(cpSource.includes("id: 'bookmarksCopyMarkdown'"));
    });
  });

  describe('Recently Closed Tabs: Search Filter & Copy Link', () => {
    it('adds search box and copy link action in recentlyClosedPage() (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes("t('history.recentlyClosedNoMatch')"));
      assert.ok(panelsSource.includes('api().tab.copyText(entry.url)'));
      assert.ok(panelsSource.includes('api().tabs.restoreClosed(originalIndex)'));
    });
  });

  describe('About Panel: Action Row Persistence & Copy Diagnostics', () => {
    it('declares app:copyDiagnostics handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('app:copyDiagnostics'"));
      assert.ok(ipcSource.includes('toast.diagnosticsCopied'));
    });

    it('exposes copyDiagnostics on app bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("copyDiagnostics: () => ipcRenderer.invoke('app:copyDiagnostics')"));
    });

    it('preserves actionRow in aboutPage() replaceChildren and wires Copy Diagnostics', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes("t('about.copyDiagnostics')"));
      assert.ok(panelsSource.includes('api().app.copyDiagnostics()'));
      assert.match(panelsSource, /card,\s+actions,/);
      assert.ok(cpSource.includes("id: 'copyDiagnostics'"));
    });
  });

  describe('Locales Consistency for v1.35.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.copyAllTabsUrls',
      'menu.openClipboardUrls',
      'menu.closeByDomain',
      'commandPalette.tabsCopyAllUrls',
      'commandPalette.tabsOpenClipboardUrls',
      'commandPalette.tabsCloseByDomain',
      'commandPalette.bookmarksCopyMarkdown',
      'commandPalette.copyDiagnostics',
      'bookmarks.copyMarkdown',
      'history.recentlyClosedNoMatch',
      'about.copyDiagnostics',
      'tabGroups.copyAllUrls',
      'tabGroups.copyAllUrlsDesc',
      'tabGroups.openClipboardUrls',
      'tabGroups.openClipboardUrlsDesc',
      'toast.allUrlsCopied',
      'toast.openedClipboardUrls',
      'toast.noUrlsInClipboard',
      'toast.closedSameDomain',
      'toast.noSameDomainTabs',
      'toast.bookmarksCopied',
      'toast.noBookmarksToCopy',
      'toast.diagnosticsCopied',
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
    it('documents v1.35.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Copy All URLs'));
      assert.ok(guide.includes('Open URLs from Clipboard'));
      assert.ok(guide.includes('Close Tabs from Same Domain'));
      assert.ok(guide.includes('Copy as Markdown'));
      assert.ok(guide.includes('Copy Diagnostics'));
    });

    it('updates website/index.html to latest release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(/v1\.\d+\.\d+ · /.test(indexHtml));
      assert.ok(indexHtml.includes('Neocrom-Horizon-Setup-1.47.0.exe'));
    });

    it('updates website/api/sync.js to v1.35.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      const release = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
      assert.ok(syncJs.includes("version: '" + release + "'"));
    });
  });
});
