import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.42.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Management & Audio: Focus Audible Tab, Copy All JSON & Clipboard as Group', () => {
    it('declares focusAudible on TabManager and wires IPC/preload bindings', () => {
      assert.ok(tabsSource.includes('focusAudible()'));
      assert.ok(ipcSource.includes("handle('tabs:focusAudible'"));
      assert.ok(ipcSource.includes("handle('tabs:copyAllJson'"));
      assert.ok(ipcSource.includes("handle('tabs:groupOpenFromClipboard'"));
      assert.ok(ipcSource.includes("handle('tabs:copyRecentlyClosedMarkdown'"));
      assert.ok(preloadSource.includes("focusAudible: () => ipcRenderer.invoke('tabs:focusAudible')"));
      assert.ok(preloadSource.includes("copyAllJson: () => ipcRenderer.invoke('tabs:copyAllJson')"));
      assert.ok(preloadSource.includes("groupOpenFromClipboard: () => ipcRenderer.invoke('tabs:groupOpenFromClipboard')"));
      assert.ok(preloadSource.includes("copyRecentlyClosedMarkdown: (entries) => ipcRenderer.invoke('tabs:copyRecentlyClosedMarkdown', entries)"));
    });

    it('wires Focus Audible, Copy All JSON, Clipboard as Group, and Recently Closed Markdown in UI, menus, and Command Palette', () => {
      assert.ok(menuSource.includes('api().tabs.focusAudible()'));
      assert.ok(menuSource.includes('api().tabs.copyAllJson()'));
      assert.ok(menuSource.includes("t('media.focusPlaying')"));
      assert.ok(panelsSource.includes('api().tabs.copyAllJson()'));
      assert.ok(panelsSource.includes('api().tabs.groupOpenFromClipboard()'));
      assert.ok(panelsSource.includes('api().tabs.copyRecentlyClosedMarkdown(lastFilteredEntries)'));
      assert.ok(cpSource.includes("id: 'tabsFocusAudible'"));
      assert.ok(cpSource.includes("id: 'tabsCopyAllJson'"));
      assert.ok(cpSource.includes("id: 'tabsGroupOpenFromClipboard'"));
      assert.ok(cpSource.includes("id: 'tabsCopyRecentlyClosedMarkdown'"));
    });
  });

  describe('Tab Stash: Create from Clipboard, Copy JSON & Deduplicate', () => {
    it('declares stashes:createFromClipboard, stashes:copyJson, and stashes:deduplicate in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('stashes:createFromClipboard'"));
      assert.ok(ipcSource.includes("handle('stashes:copyJson'"));
      assert.ok(ipcSource.includes("handle('stashes:deduplicate'"));
      assert.ok(preloadSource.includes("createFromClipboard: () => ipcRenderer.invoke('stashes:createFromClipboard')"));
      assert.ok(preloadSource.includes("copyJson: (stashId) => ipcRenderer.invoke('stashes:copyJson', stashId)"));
      assert.ok(preloadSource.includes("deduplicate: () => ipcRenderer.invoke('stashes:deduplicate')"));
    });

    it('wires Tab Stash clipboard creation, JSON copy, and deduplication in panels and Command Palette', () => {
      assert.ok(panelsSource.includes('api().stashes.createFromClipboard()'));
      assert.ok(panelsSource.includes('api().stashes.copyJson()'));
      assert.ok(panelsSource.includes('api().stashes.copyJson(stash.id)'));
      assert.ok(panelsSource.includes('api().stashes.deduplicate()'));
      assert.ok(cpSource.includes("id: 'stashesCreateFromClipboard'"));
      assert.ok(cpSource.includes("id: 'stashesCopyJson'"));
      assert.ok(cpSource.includes("id: 'stashesDeduplicate'"));
    });
  });

  describe('Quick Notes: Note from Clipboard, Copy JSON & Sort Toggle', () => {
    it('declares notes:createFromClipboard and notes:copyJson in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('notes:createFromClipboard'"));
      assert.ok(ipcSource.includes("handle('notes:copyJson'"));
      assert.ok(preloadSource.includes("createFromClipboard: () => ipcRenderer.invoke('notes:createFromClipboard')"));
      assert.ok(preloadSource.includes("copyJson: (id) => ipcRenderer.invoke('notes:copyJson', id)"));
    });

    it('wires Quick Notes clipboard creation, JSON copy, and A-Z/Recent sort toggle in panels and Command Palette', () => {
      assert.ok(panelsSource.includes('api().notes.createFromClipboard()'));
      assert.ok(panelsSource.includes('api().notes.copyJson()'));
      assert.ok(panelsSource.includes('api().notes.copyJson(activeNote.id)'));
      assert.ok(panelsSource.includes("t('notes.sortAlpha')"));
      assert.ok(panelsSource.includes("t('notes.sortRecent')"));
      assert.ok(cpSource.includes("id: 'notesCreateFromClipboard'"));
      assert.ok(cpSource.includes("id: 'notesCopyJson'"));
    });
  });

  describe('History & Bookmarks: History Copy JSON & Bookmarks Add from Clipboard', () => {
    it('declares history:copyJson and bookmarks:addFromClipboard in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('history:copyJson'"));
      assert.ok(ipcSource.includes("handle('bookmarks:addFromClipboard'"));
      assert.ok(preloadSource.includes("copyJson: (entries) => ipcRenderer.invoke('history:copyJson', entries)"));
      assert.ok(preloadSource.includes("addFromClipboard: () => ipcRenderer.invoke('bookmarks:addFromClipboard')"));
    });

    it('wires History Copy JSON and Bookmarks Add from Clipboard in panels and Command Palette', () => {
      assert.ok(panelsSource.includes('api().history.copyJson(getFilteredEntries())'));
      assert.ok(panelsSource.includes('api().bookmarks.addFromClipboard()'));
      assert.ok(cpSource.includes("id: 'historyCopyJson'"));
      assert.ok(cpSource.includes("id: 'bookmarksAddFromClipboard'"));
    });
  });

  describe('Locales Consistency for v1.42.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.copyAllTabsJson',
      'menu.focusAudibleTab',
      'media.focusPlaying',
      'tabGroups.copyAllJson',
      'tabGroups.copyAllJsonDesc',
      'tabGroups.openClipboardAsGroup',
      'tabGroups.openClipboardAsGroupDesc',
      'bookmarks.addFromClipboard',
      'history.copyJson',
      'notes.copyJson',
      'notes.copyAllJson',
      'notes.fromClipboard',
      'notes.sortAlpha',
      'notes.sortRecent',
      'stash.copyJson',
      'stash.copyAllJson',
      'stash.createFromClipboard',
      'stash.deduplicate',
      'commandPalette.tabsFocusAudible',
      'commandPalette.tabsCopyAllJson',
      'commandPalette.tabsGroupOpenFromClipboard',
      'commandPalette.tabsCopyRecentlyClosedMarkdown',
      'commandPalette.historyCopyJson',
      'commandPalette.bookmarksAddFromClipboard',
      'commandPalette.notesCreateFromClipboard',
      'commandPalette.notesCopyJson',
      'commandPalette.stashesCreateFromClipboard',
      'commandPalette.stashesCopyJson',
      'commandPalette.stashesDeduplicate',
      'toast.focusedAudibleTab',
      'toast.noAudibleTabs',
      'toast.allTabsJsonCopied',
      'toast.recentlyClosedMarkdownCopied',
      'toast.groupOpenedFromClipboard',
      'toast.historyJsonCopied',
      'toast.bookmarksAddedFromClipboard',
      'toast.clipboardEmptyForNote',
      'toast.noteCreatedFromClipboard',
      'toast.noteJsonCopied',
      'toast.stashJsonCopied',
      'toast.stashCreatedFromClipboard',
      'toast.stashesDeduplicated',
      'toast.stashesNoDuplicates',
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
    it('documents v1.42.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Jump to playing'));
      assert.ok(guide.includes('Copy All (JSON)'));
      assert.ok(guide.includes('Clipboard as Group'));
      assert.ok(guide.includes('Add from Clipboard'));
      assert.ok(guide.includes('Stash from Clipboard'));
      assert.ok(guide.includes('Deduplicate'));
      assert.ok(guide.includes('Note from Clipboard'));
    });

    it('updates website/index.html to v1.42.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.42.0 · Latest Release') || indexHtml.includes('v1.43.0 · Latest Release') || indexHtml.includes('v1.44.0 · Latest Release') || indexHtml.includes('v1.45.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.42.0.exe') || indexHtml.includes('Hinterland-Setup-1.43.0.exe') || indexHtml.includes('Hinterland-Setup-1.44.0.exe') || indexHtml.includes('Hinterland-Setup-1.45.0.exe'));
    });

    it('updates website/api/sync.js to v1.42.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      const release = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
      assert.ok(syncJs.includes("version: '" + release + "'"));
    });
  });
});
