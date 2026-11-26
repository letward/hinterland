import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.32.0 Features & Polish', () => {
  describe('Tabs Sorting (By Title & By Domain)', () => {
    it('declares sortByTitle and sortByDomain in src/main/tabs.js', () => {
      const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
      assert.ok(tabsSource.includes('sortByTitle(ascending = true)'));
      assert.ok(tabsSource.includes('sortByDomain(ascending = true)'));
      assert.ok(tabsSource.includes('this.tabs.filter((t) => t.pinned)'));
    });

    it('declares tabs:sortByTitle and tabs:sortByDomain handlers in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:sortByTitle'"));
      assert.ok(ipcSource.includes("handle('tabs:sortByDomain'"));
      assert.ok(ipcSource.includes('toast.tabsSortedByTitle'));
      assert.ok(ipcSource.includes('toast.tabsSortedByDomain'));
    });

    it('exposes sortByTitle and sortByDomain on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("sortByTitle: (ascending = true) => ipcRenderer.invoke('tabs:sortByTitle', ascending)"));
      assert.ok(preloadSource.includes("sortByDomain: (ascending = true) => ipcRenderer.invoke('tabs:sortByDomain', ascending)"));
    });

    it('adds Sort Tabs by Title and Sort Tabs by Domain in Tab Groups Studio (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.sortByTitle(true)'));
      assert.ok(panelsSource.includes('api().tabs.sortByDomain(true)'));
      assert.ok(panelsSource.includes("t('tabGroups.sortByTitle')"));
      assert.ok(panelsSource.includes("t('tabGroups.sortByDomain')"));
    });

    it('wires Sort Tabs by Title and Domain in Tabstrip context menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.sortByTitle')"));
      assert.ok(menuSource.includes("t('menu.sortByDomain')"));
      assert.ok(menuSource.includes('api().tabs.sortByTitle(true)'));
      assert.ok(menuSource.includes('api().tabs.sortByDomain(true)'));
    });

    it('registers tabsSortByTitle and tabsSortByDomain in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'tabsSortByTitle'"));
      assert.ok(cpSource.includes("id: 'tabsSortByDomain'"));
      assert.ok(cpSource.includes('api().tabs.sortByTitle(true)'));
      assert.ok(cpSource.includes('api().tabs.sortByDomain(true)'));
    });
  });

  describe('Browsing History Markdown & CSV Exports', () => {
    it('declares history:exportMarkdown and history:exportCsv in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('history:exportMarkdown'"));
      assert.ok(ipcSource.includes("handle('history:exportCsv'"));
      assert.ok(ipcSource.includes('# Hinterland Browsing History Archive'));
      assert.ok(ipcSource.includes('"Title","URL","Last Visited","Visit Count"'));
      assert.ok(ipcSource.includes('toast.historyExportedMarkdown'));
      assert.ok(ipcSource.includes('toast.historyExportedCsv'));
    });

    it('exposes exportMarkdown and exportCsv on history bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportMarkdown: () => ipcRenderer.invoke('history:exportMarkdown')"));
      assert.ok(preloadSource.includes("exportCsv: () => ipcRenderer.invoke('history:exportCsv')"));
    });

    it('adds Export Markdown and Export CSV buttons in History panel (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().history.exportMarkdown()'));
      assert.ok(panelsSource.includes('api().history.exportCsv()'));
      assert.ok(panelsSource.includes("t('history.exportMarkdown')"));
      assert.ok(panelsSource.includes("t('history.exportCsv')"));
    });

    it('registers historyExportMarkdown and historyExportCsv in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'historyExportMarkdown'"));
      assert.ok(cpSource.includes("id: 'historyExportCsv'"));
      assert.ok(cpSource.includes('api().history.exportMarkdown()'));
      assert.ok(cpSource.includes('api().history.exportCsv()'));
    });
  });

  describe('Reading List: Mark All as Read', () => {
    it('declares readingList:markAllRead handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('readingList:markAllRead'"));
      assert.ok(ipcSource.includes('toast.allReadingListMarkedRead'));
    });

    it('exposes markAllRead on readingList bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("markAllRead: () => ipcRenderer.invoke('readingList:markAllRead')"));
    });

    it('adds Mark All as Read button in Reading List panel (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().readingList.markAllRead()'));
      assert.ok(panelsSource.includes("t('readingList.markAllRead')"));
    });

    it('registers readingListMarkAllRead in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'readingListMarkAllRead'"));
      assert.ok(cpSource.includes('api().readingList.markAllRead()'));
    });
  });

  describe('Quick Notes: Duplicate Note', () => {
    it('declares notes:duplicate handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('notes:duplicate'"));
      assert.ok(ipcSource.includes('(Copy)'));
      assert.ok(ipcSource.includes('toast.noteDuplicated'));
    });

    it('exposes duplicate on notes bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("duplicate: (id) => ipcRenderer.invoke('notes:duplicate', id)"));
    });

    it('adds Duplicate Note button in Quick Notes editor toolbar (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().notes.duplicate(activeNote.id)'));
      assert.ok(panelsSource.includes("t('notes.duplicateNote')"));
    });
  });

  describe('Locales Consistency for v1.32.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.sortByTitle',
      'menu.sortByDomain',
      'history.exportMarkdown',
      'history.exportCsv',
      'readingList.markAllRead',
      'notes.duplicateNote',
      'tabGroups.sortByTitle',
      'tabGroups.sortByTitleDesc',
      'tabGroups.sortByDomain',
      'tabGroups.sortByDomainDesc',
      'toast.tabsSortedByTitle',
      'toast.tabsSortedByDomain',
      'toast.historyExportedMarkdown',
      'toast.historyExportedCsv',
      'toast.allReadingListMarkedRead',
      'toast.noteDuplicated',
      'commandPalette.tabsSortByTitle',
      'commandPalette.tabsSortByDomain',
      'commandPalette.historyExportMarkdown',
      'commandPalette.historyExportCsv',
      'commandPalette.readingListMarkAllRead',
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
    it('documents Tab Sorting, History Exports, Reading List Mark All Read, and Note Duplication in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Tab Groups Studio &amp; Tab Sorting'));
      assert.ok(guide.includes('Sort Tabs by Title'));
      assert.ok(guide.includes('Sort Tabs by Domain'));
      assert.ok(guide.includes('Timeline Filters &amp; Exports'));
      assert.ok(guide.includes('Mark All as Read'));
      assert.ok(guide.includes('Duplicate Note'));
    });

    it('updates website/index.html to v1.32.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.32.0 · Latest Release') || indexHtml.includes('v1.33.0 · Latest Release') || indexHtml.includes('v1.34.0 · Latest Release') || indexHtml.includes('v1.35.0 · Latest Release') || indexHtml.includes('v1.36.0 · Latest Release') || indexHtml.includes('v1.37.0 · Latest Release') || indexHtml.includes('v1.38.0 · Latest Release') || indexHtml.includes('v1.39.0 · Latest Release') || indexHtml.includes('v1.40.0 · Latest Release') || indexHtml.includes('v1.41.0 · Latest Release') || indexHtml.includes('v1.42.0 · Latest Release') || indexHtml.includes('v1.43.0 · Latest Release') || indexHtml.includes('v1.44.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.32.0.exe') || indexHtml.includes('Hinterland-Setup-1.33.0.exe') || indexHtml.includes('Hinterland-Setup-1.34.0.exe') || indexHtml.includes('Hinterland-Setup-1.35.0.exe') || indexHtml.includes('Hinterland-Setup-1.36.0.exe') || indexHtml.includes('Hinterland-Setup-1.37.0.exe') || indexHtml.includes('Hinterland-Setup-1.38.0.exe') || indexHtml.includes('Hinterland-Setup-1.39.0.exe') || indexHtml.includes('Hinterland-Setup-1.40.0.exe') || indexHtml.includes('Hinterland-Setup-1.41.0.exe') || indexHtml.includes('Hinterland-Setup-1.42.0.exe') || indexHtml.includes('Hinterland-Setup-1.43.0.exe') || indexHtml.includes('Hinterland-Setup-1.44.0.exe'));
    });
  });
});
