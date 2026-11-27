import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Neocrom Horizon v1.41.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Management & Tab Groups Studio: Close Duplicates & Wake Sleeping', () => {
    it('declares closeDuplicates and wakeAll on tabs and ipc', () => {
      assert.ok(tabsSource.includes('async closeDuplicates()'));
      assert.ok(tabsSource.includes('wakeAll()'));
      assert.ok(ipcSource.includes("handle('tabs:closeDuplicates'"));
      assert.ok(ipcSource.includes("handle('tabs:wakeAll'"));
      assert.ok(preloadSource.includes("closeDuplicates: () => ipcRenderer.invoke('tabs:closeDuplicates')"));
      assert.ok(preloadSource.includes("wakeAll: () => ipcRenderer.invoke('tabs:wakeAll')"));
    });

    it('wires Close Duplicates and Wake Sleeping in Tab Groups Studio, tabstrip menu, and Command Palette', () => {
      assert.ok(panelsSource.includes('api().tabs.closeDuplicates()'));
      assert.ok(panelsSource.includes('api().tabs.wakeAll()'));
      assert.ok(panelsSource.includes("t('tabGroups.closeDuplicates')"));
      assert.ok(panelsSource.includes("t('tabGroups.wakeAll')"));
      assert.ok(menuSource.includes('api().tabs.closeDuplicates()'));
      assert.ok(menuSource.includes('api().tabs.wakeAll()'));
      assert.ok(cpSource.includes("id: 'tabsCloseDuplicates'"));
    });
  });

  describe('History Manager: Open Matching in Background Tabs', () => {
    it('declares history:openUrls handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('history:openUrls'"));
      assert.ok(ipcSource.includes('toast.noHistoryToOpen'));
      assert.ok(ipcSource.includes('toast.historyOpened'));
      assert.ok(preloadSource.includes("openUrls: (urls) => ipcRenderer.invoke('history:openUrls', urls)"));
    });

    it('wires Open Matching in History panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().history.openUrls(urls)'));
      assert.ok(panelsSource.includes("t('history.openMatching')"));
      assert.ok(cpSource.includes("id: 'historyOpenMatching'"));
      assert.ok(cpSource.includes('api().history.openUrls()'));
    });
  });

  describe('Bookmarks Manager: Copy as JSON', () => {
    it('declares bookmarks:copyJson handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('bookmarks:copyJson'"));
      assert.ok(ipcSource.includes('toast.bookmarkJsonCopied'));
      assert.ok(preloadSource.includes("copyJson: (items) => ipcRenderer.invoke('bookmarks:copyJson', items)"));
    });

    it('wires Copy JSON in Bookmarks panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().bookmarks.copyJson(items)'));
      assert.ok(panelsSource.includes("t('bookmarks.copyJson')"));
      assert.ok(cpSource.includes("id: 'bookmarksCopyJson'"));
      assert.ok(cpSource.includes('api().bookmarks.copyJson()'));
    });
  });

  describe('Reading List: Copy as JSON & Sorting (A-Z and Domain)', () => {
    it('declares readingList:copyJson and readingList:sort handlers in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('readingList:copyJson'"));
      assert.ok(ipcSource.includes("handle('readingList:sort'"));
      assert.ok(ipcSource.includes('toast.readingListCopiedJson'));
      assert.ok(ipcSource.includes('toast.readingListSortedAlpha'));
      assert.ok(ipcSource.includes('toast.readingListSortedByDomain'));
      assert.ok(preloadSource.includes("copyJson: (mode) => ipcRenderer.invoke('readingList:copyJson', mode)"));
      assert.ok(preloadSource.includes("sort: (mode) => ipcRenderer.invoke('readingList:sort', mode)"));
    });

    it('wires Copy JSON, Sort A-Z, and Sort by Domain in Reading List and Command Palette', () => {
      assert.ok(panelsSource.includes('api().readingList.copyJson(mode)'));
      assert.ok(panelsSource.includes("api().readingList.sort('alpha')"));
      assert.ok(panelsSource.includes("api().readingList.sort('domain')"));
      assert.ok(panelsSource.includes("t('readingList.copyJson')"));
      assert.ok(panelsSource.includes("t('readingList.sortAlpha')"));
      assert.ok(panelsSource.includes("t('readingList.sortByDomain')"));
      assert.ok(cpSource.includes("id: 'readingListCopyJson'"));
      assert.ok(cpSource.includes("id: 'readingListSortAlpha'"));
      assert.ok(cpSource.includes("id: 'readingListSortByDomain'"));
    });
  });

  describe('Downloads Manager: Copy as JSON', () => {
    it('declares downloads:copyJson handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('downloads:copyJson'"));
      assert.ok(ipcSource.includes('toast.downloadsJsonCopied'));
      assert.ok(preloadSource.includes("copyJson: () => ipcRenderer.invoke('downloads:copyJson')"));
    });

    it('wires Copy JSON in Downloads panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().downloads.copyJson()'));
      assert.ok(panelsSource.includes("t('downloads.copyJson')"));
      assert.ok(cpSource.includes("id: 'downloadsCopyJson'"));
    });
  });

  describe('Extensions Manager: Copy Extensions as JSON', () => {
    it('declares extensions:copyJson handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('extensions:copyJson'"));
      assert.ok(ipcSource.includes('toast.extensionsJsonCopied'));
      assert.ok(preloadSource.includes("copyJson: () => ipcRenderer.invoke('extensions:copyJson')"));
    });

    it('wires Copy JSON in Extensions panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().extensions.copyJson()'));
      assert.ok(panelsSource.includes("t('extensions.copyJson')"));
      assert.ok(cpSource.includes("id: 'extensionsCopyJson'"));
    });
  });

  describe('Locales Consistency for v1.41.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'tabGroups.closeDuplicates',
      'tabGroups.closeDuplicatesDesc',
      'tabGroups.wakeAll',
      'tabGroups.wakeAllDesc',
      'commandPalette.tabsCloseDuplicates',
      'history.openMatching',
      'commandPalette.historyOpenMatching',
      'bookmarks.copyJson',
      'commandPalette.bookmarksCopyJson',
      'readingList.copyJson',
      'readingList.sortAlpha',
      'readingList.sortByDomain',
      'commandPalette.readingListCopyJson',
      'commandPalette.readingListSortAlpha',
      'commandPalette.readingListSortByDomain',
      'downloads.copyJson',
      'commandPalette.downloadsCopyJson',
      'extensions.copyJson',
      'commandPalette.extensionsCopyJson',
      'toast.noHistoryToOpen',
      'toast.historyOpened',
      'toast.bookmarkJsonCopied',
      'toast.readingListCopiedJson',
      'toast.readingListSortedAlpha',
      'toast.readingListSortedByDomain',
      'toast.downloadsJsonCopied',
      'toast.extensionsJsonCopied',
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
    it('documents v1.41.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Close Duplicates'));
      assert.ok(guide.includes('Wake Sleeping'));
      assert.ok(guide.includes('Copy JSON'));
      assert.ok(guide.includes('Open Matching'));
      assert.ok(guide.includes('Sort A-Z'));
      assert.ok(guide.includes('Sort by Domain'));
    });

    it('updates website/index.html to latest release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(/v1\.\d+\.\d+ · /.test(indexHtml));
      assert.ok(indexHtml.includes('Neocrom-Horizon-Setup-1.47.0.exe'));
    });

    it('updates website/api/sync.js to v1.41.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      const release = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
      assert.ok(syncJs.includes("version: '" + release + "'"));
    });
  });
});
