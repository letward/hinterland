import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.43.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Management & Tab Groups: Reload Others, Sort Groups A-Z & Bookmark Group', () => {
    it('declares reloadOthers on TabManager and wires IPC/preload bindings', () => {
      assert.ok(tabsSource.includes('reloadOthers(id)'));
      assert.ok(ipcSource.includes('const normalizeComparableUrl ='));
      assert.ok(ipcSource.includes("handle('tabs:reloadOthers'"));
      assert.ok(ipcSource.includes("handle('tabs:groupSortAlpha'"));
      assert.ok(ipcSource.includes("handle('tabs:groupBookmark'"));
      assert.ok(preloadSource.includes("reloadOthers: (id) => ipcRenderer.invoke('tabs:reloadOthers', id)"));
      assert.ok(preloadSource.includes("groupSortAlpha: () => ipcRenderer.invoke('tabs:groupSortAlpha')"));
      assert.ok(preloadSource.includes("groupBookmark: (groupId) => ipcRenderer.invoke('tabs:groupBookmark', groupId)"));
    });

    it('wires Reload Others, Sort Groups A-Z, and Bookmark Group across UI, menus, and Command Palette', () => {
      assert.ok(menuSource.includes('api().tabs.reloadOthers('));
      assert.ok(panelsSource.includes('api().tabs.groupSortAlpha()'));
      assert.ok(panelsSource.includes('api().tabs.groupBookmark(group.id)'));
      assert.ok(cpSource.includes("id: 'tabsReloadOthers'"));
      assert.ok(cpSource.includes("id: 'tabsGroupSortAlpha'"));
    });
  });

  describe('Reading List: Add from Clipboard & Deduplicate', () => {
    it('declares readingList:addFromClipboard and readingList:deduplicate in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('readingList:addFromClipboard'"));
      assert.ok(ipcSource.includes("handle('readingList:deduplicate'"));
      assert.ok(preloadSource.includes("addFromClipboard: () => ipcRenderer.invoke('readingList:addFromClipboard')"));
      assert.ok(preloadSource.includes("deduplicate: () => ipcRenderer.invoke('readingList:deduplicate')"));
    });

    it('wires Reading List clipboard import and deduplication in panels and Command Palette', () => {
      assert.ok(panelsSource.includes('api().readingList.addFromClipboard()'));
      assert.ok(panelsSource.includes('api().readingList.deduplicate()'));
      assert.ok(cpSource.includes("id: 'readingListAddFromClipboard'"));
      assert.ok(cpSource.includes("id: 'readingListDeduplicate'"));
    });
  });

  describe('Tab Stash: Save as Note, Prune Empty & Sort Toggle', () => {
    it('declares stashes:toNote and stashes:pruneEmpty in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('stashes:toNote'"));
      assert.ok(ipcSource.includes("handle('stashes:pruneEmpty'"));
      assert.ok(preloadSource.includes("toNote: (stashId) => ipcRenderer.invoke('stashes:toNote', stashId)"));
      assert.ok(preloadSource.includes("pruneEmpty: () => ipcRenderer.invoke('stashes:pruneEmpty')"));
    });

    it('wires Tab Stash Save as Note, Prune Empty, and Sort A-Z/Recent toggle in panels and Command Palette', () => {
      assert.ok(panelsSource.includes('api().stashes.toNote(stash.id)'));
      assert.ok(panelsSource.includes('api().stashes.pruneEmpty()'));
      assert.ok(panelsSource.includes("t('stash.sortAlpha')"));
      assert.ok(panelsSource.includes("t('stash.sortRecent')"));
      assert.ok(cpSource.includes("id: 'stashesPruneEmpty'"));
    });
  });

  describe('Quick Notes & Downloads: Copy Note Links & Export Downloads JSON', () => {
    it('extracts extractUrlsFromNotes and declares notes:copyLinks and downloads:exportJson in ipc.js and preload', () => {
      assert.ok(ipcSource.includes('const extractUrlsFromNotes ='));
      assert.ok(ipcSource.includes("handle('notes:copyLinks'"));
      assert.ok(ipcSource.includes("handle('downloads:exportJson'"));
      assert.ok(preloadSource.includes("copyLinks: (id) => ipcRenderer.invoke('notes:copyLinks', id)"));
      assert.ok(preloadSource.includes("exportJson: () => ipcRenderer.invoke('downloads:exportJson')"));
    });

    it('wires Quick Notes Copy Links and Downloads Export JSON in panels and Command Palette', () => {
      assert.ok(panelsSource.includes('api().notes.copyLinks(activeNote.id)'));
      assert.ok(panelsSource.includes('api().downloads.exportJson()'));
      assert.ok(cpSource.includes("id: 'notesCopyLinks'"));
      assert.ok(cpSource.includes("id: 'downloadsExportJson'"));
    });
  });

  describe('Locales Consistency for v1.43.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.reloadOthers',
      'commandPalette.tabsReloadOthers',
      'commandPalette.tabsGroupSortAlpha',
      'commandPalette.readingListAddFromClipboard',
      'commandPalette.readingListDeduplicate',
      'commandPalette.downloadsExportJson',
      'commandPalette.notesCopyLinks',
      'commandPalette.stashesPruneEmpty',
      'downloads.exportJson',
      'readingList.addFromClipboard',
      'readingList.deduplicate',
      'notes.copyLinks',
      'stash.pruneEmpty',
      'stash.sortAlpha',
      'stash.sortRecent',
      'stash.toNote',
      'tabGroups.sortGroups',
      'tabGroups.sortGroupsDesc',
      'tabGroups.bookmarkGroup',
      'tabGroups.bookmarkGroupDesc',
      'toast.reloadedOtherTabs',
      'toast.noOtherTabsToReload',
      'toast.groupsSortedAlpha',
      'toast.noTabsInGroupToBookmark',
      'toast.groupBookmarked',
      'toast.readingListAddedFromClipboard',
      'toast.readingListDeduplicated',
      'toast.readingListNoDuplicates',
      'toast.downloadsExportedJson',
      'toast.noteLinksCopied',
      'toast.stashSavedAsNote',
      'toast.stashesPruned',
      'toast.noEmptyStashes',
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
    it('documents v1.43.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Bookmark Group'));
      assert.ok(guide.includes('Sort Groups A-Z'));
      assert.ok(guide.includes('Reload other tabs'));
      assert.ok(guide.includes('Prune Empty'));
      assert.ok(guide.includes('Save as Note'));
      assert.ok(guide.includes('Add from Clipboard'));
      assert.ok(guide.includes('Deduplicate'));
      assert.ok(guide.includes('Copy all links'));
      assert.ok(guide.includes('Export JSON'));
    });

    it('updates website/index.html to v1.43.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.43.0 · Latest Release') || indexHtml.includes('v1.44.0 · Latest Release') || indexHtml.includes('v1.45.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.43.0.exe') || indexHtml.includes('Hinterland-Setup-1.44.0.exe') || indexHtml.includes('Hinterland-Setup-1.45.0.exe'));
    });

    it('updates website/api/sync.js to v1.43.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      const release = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
      assert.ok(syncJs.includes("version: '" + release + "'"));
    });
  });
});
