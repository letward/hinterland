import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { HistoryStore } from '../../src/main/history.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.36.0 Features & Polish', () => {
  describe('History Manager: Most Visited, Visit Badges & Delete by Domain', () => {
    it('removes all entries matching a domain and subdomains in HistoryStore.removeByDomain()', () => {
      const dir = mkdtempSync(join(tmpdir(), 'hinterland-history-'));
      try {
        const store = new HistoryStore(join(dir, 'history.json'));
        store.entries = [
          { url: 'https://www.example.com/one', title: 'One', time: 100, visits: 3 },
          { url: 'https://docs.example.com/two', title: 'Two', time: 200, visits: 2 },
          { url: 'https://other.org/page', title: 'Other', time: 300, visits: 1 },
        ];
        const removed = store.removeByDomain('example.com');
        assert.equal(removed, 2);
        assert.equal(store.getAll().length, 1);
        assert.equal(store.getAll()[0].url, 'https://other.org/page');
        assert.equal(store.removeByDomain('missing.org'), 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('declares history:removeByDomain handler in src/main/ipc.js and preload bridge', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(ipcSource.includes("handle('history:removeByDomain'"));
      assert.ok(ipcSource.includes('history.removeByDomain('));
      assert.ok(ipcSource.includes('toast.historyDomainCleared'));
      assert.ok(preloadSource.includes("removeByDomain: (domain) => ipcRenderer.invoke('history:removeByDomain', domain)"));
    });

    it('wires Most Visited filter, visit count badge, and remove-by-domain button in History panel & Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes("id: 'mostVisited'"));
      assert.ok(panelsSource.includes("t('history.removeByDomain', { domain: host })"));
      assert.ok(panelsSource.includes('api().history.removeByDomain(host)'));
      assert.ok(cpSource.includes("id: 'historyClearCurrentDomain'"));
      assert.ok(cpSource.includes('api().history.removeByDomain(host)'));
    });
  });

  describe('Close Ungrouped Tabs & Tab Group URLs Copy & Inline Recolor', () => {
    it('declares closeUngrouped() on TabManager in src/main/tabs.js', () => {
      const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
      assert.ok(tabsSource.includes('async closeUngrouped()'));
      assert.ok(tabsSource.includes('!tab.pinned && !tab.groupId'));
    });

    it('declares tabs:closeUngrouped and tabs:groupCopyUrls handlers in src/main/ipc.js and preload', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:closeUngrouped'"));
      assert.ok(ipcSource.includes('tabs.closeUngrouped()'));
      assert.ok(ipcSource.includes('toast.closedUngrouped'));
      assert.ok(ipcSource.includes("handle('tabs:groupCopyUrls'"));
      assert.ok(ipcSource.includes('toast.groupUrlsCopied'));
      assert.ok(preloadSource.includes("closeUngrouped: () => ipcRenderer.invoke('tabs:closeUngrouped')"));
      assert.ok(preloadSource.includes("groupCopyUrls: (groupId) => ipcRenderer.invoke('tabs:groupCopyUrls', groupId)"));
    });

    it('wires Close Ungrouped, Copy Group URLs, and inline color cycling in Tab Groups Studio, Menus, and Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.closeUngrouped()'));
      assert.ok(panelsSource.includes('api().tabs.groupCopyUrls(group.id)'));
      assert.ok(panelsSource.includes("t('tabGroups.recolorHint')"));
      assert.ok(panelsSource.includes('api().tabs.groupRecolor(group.id, nextColor)'));
      assert.equal(menuSource.match(/t\('menu\.closeUngroupedTabs'\)/g)?.length ?? 0, 2);
      assert.ok(cpSource.includes("id: 'tabsCloseUngrouped'"));
    });
  });

  describe('Reading List: Copy as Markdown', () => {
    it('declares readingList:copyMarkdown handler sharing formatReadingListMarkdown in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(ipcSource.includes('formatReadingListMarkdown'));
      assert.ok(ipcSource.includes("handle('readingList:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.readingListCopied'));
      assert.ok(preloadSource.includes("copyMarkdown: (mode) => ipcRenderer.invoke('readingList:copyMarkdown', mode)"));
    });

    it('adds Copy as Markdown button in Reading List panel and Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes('api().readingList.copyMarkdown(mode)'));
      assert.ok(panelsSource.includes("t('readingList.copyMarkdown')"));
      assert.ok(cpSource.includes("id: 'readingListCopyMarkdown'"));
    });
  });

  describe('Bookmarks Manager: Copy All URLs, Row Copy Link & Count Badge', () => {
    it('declares bookmarks:copyUrls handler in src/main/ipc.js and preload', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(ipcSource.includes("handle('bookmarks:copyUrls'"));
      assert.ok(ipcSource.includes('toast.bookmarkUrlsCopied'));
      assert.ok(preloadSource.includes("copyUrls: (items) => ipcRenderer.invoke('bookmarks:copyUrls', items)"));
    });

    it('wires Copy URLs button, per-row Copy Link, and live count badge in Bookmarks Manager and Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes('api().bookmarks.copyUrls(items)'));
      assert.ok(panelsSource.includes("t('bookmarks.copyUrls')"));
      assert.ok(panelsSource.includes("t('bookmarks.countBadge'"));
      assert.ok(cpSource.includes("id: 'bookmarksCopyUrls'"));
    });
  });

  describe('Downloads Manager: Copy All URLs & Summary Counter', () => {
    it('declares downloads:copyUrls handler in src/main/ipc.js and preload', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(ipcSource.includes("handle('downloads:copyUrls'"));
      assert.ok(ipcSource.includes('toast.downloadUrlsCopied'));
      assert.ok(preloadSource.includes("copyUrls: () => ipcRenderer.invoke('downloads:copyUrls')"));
    });

    it('wires Copy URLs button and summary badge in Downloads Manager and Command Palette', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(panelsSource.includes('api().downloads.copyUrls()'));
      assert.ok(panelsSource.includes("t('downloads.copyUrls')"));
      assert.ok(panelsSource.includes("t('downloads.summaryCount'"));
      assert.ok(cpSource.includes("id: 'downloadsCopyUrls'"));
    });
  });

  describe('Locales Consistency for v1.36.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.closeUngroupedTabs',
      'commandPalette.tabsCloseUngrouped',
      'commandPalette.readingListCopyMarkdown',
      'commandPalette.historyClearCurrentDomain',
      'commandPalette.bookmarksCopyUrls',
      'commandPalette.downloadsCopyUrls',
      'bookmarks.copyUrls',
      'bookmarks.countBadge',
      'history.filterMostVisited',
      'history.visitCountTitle',
      'history.removeByDomain',
      'downloads.copyUrls',
      'downloads.summaryCount',
      'readingList.copyMarkdown',
      'tabGroups.closeUngrouped',
      'tabGroups.closeUngroupedDesc',
      'tabGroups.copyUrls',
      'tabGroups.copyUrlsDesc',
      'tabGroups.recolorHint',
      'toast.groupUrlsCopied',
      'toast.closedUngrouped',
      'toast.noUngroupedTabs',
      'toast.historyDomainCleared',
      'toast.historyNoDomainEntries',
      'toast.downloadUrlsCopied',
      'toast.noDownloadsToCopy',
      'toast.bookmarkUrlsCopied',
      'toast.readingListCopied',
      'toast.readingListEmptyToCopy',
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
    it('documents v1.36.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Most visited'));
      assert.ok(guide.includes('Close Ungrouped'));
      assert.ok(guide.includes('Copy URLs'));
      assert.ok(guide.includes('Copy as Markdown'));
    });

    it('updates website/index.html to v1.36.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.36.0 · Latest Release') || indexHtml.includes('v1.37.0 · Latest Release') || indexHtml.includes('v1.38.0 · Latest Release') || indexHtml.includes('v1.39.0 · Latest Release') || indexHtml.includes('v1.40.0 · Latest Release') || indexHtml.includes('v1.41.0 · Latest Release') || indexHtml.includes('v1.42.0 · Latest Release') || indexHtml.includes('v1.43.0 · Latest Release') || indexHtml.includes('v1.44.0 · Latest Release') || indexHtml.includes('v1.45.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.36.0.exe') || indexHtml.includes('Hinterland-Setup-1.37.0.exe') || indexHtml.includes('Hinterland-Setup-1.38.0.exe') || indexHtml.includes('Hinterland-Setup-1.39.0.exe') || indexHtml.includes('Hinterland-Setup-1.40.0.exe') || indexHtml.includes('Hinterland-Setup-1.41.0.exe') || indexHtml.includes('Hinterland-Setup-1.42.0.exe') || indexHtml.includes('Hinterland-Setup-1.43.0.exe') || indexHtml.includes('Hinterland-Setup-1.44.0.exe') || indexHtml.includes('Hinterland-Setup-1.45.0.exe'));
    });

    it('updates website/api/sync.js to v1.36.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.36.0'") || syncJs.includes("version: '1.37.0'") || syncJs.includes("version: '1.38.0'") || syncJs.includes("version: '1.39.0'") || syncJs.includes("version: '1.40.0'") || syncJs.includes("version: '1.41.0'") || syncJs.includes("version: '1.42.0'") || syncJs.includes("version: '1.43.0'") || syncJs.includes("version: '1.44.0'") || syncJs.includes("version: '1.45.0'"));
    });
  });
});
