import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { HistoryStore } from '../../src/main/history.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Neocrom Horizon v1.44.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const historySource = readFileSync(join(ROOT, 'src', 'main', 'history.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Groups Studio: Focus Group, Sleep Group & Copy Group JSON', () => {
    it('declares focusGroup and sleepGroup on TabManager and wires IPC/preload bindings', () => {
      assert.ok(tabsSource.includes('focusGroup(groupId)'));
      assert.ok(tabsSource.includes('sleepGroup(groupId)'));
      assert.ok(ipcSource.includes("handle('tabs:groupFocus'"));
      assert.ok(ipcSource.includes("handle('tabs:groupSleep'"));
      assert.ok(ipcSource.includes("handle('tabs:groupCopyJson'"));
      assert.ok(preloadSource.includes("groupFocus: (groupId) => ipcRenderer.invoke('tabs:groupFocus', groupId)"));
      assert.ok(preloadSource.includes("groupSleep: (groupId) => ipcRenderer.invoke('tabs:groupSleep', groupId)"));
      assert.ok(preloadSource.includes("groupCopyJson: (groupId) => ipcRenderer.invoke('tabs:groupCopyJson', groupId)"));
    });

    it('wires Focus, Sleep Group, and Copy JSON in Tab Groups Studio', () => {
      assert.ok(panelsSource.includes('api().tabs.groupFocus(group.id)'));
      assert.ok(panelsSource.includes('api().tabs.groupSleep(group.id)'));
      assert.ok(panelsSource.includes('api().tabs.groupCopyJson(group.id)'));
    });
  });

  describe('Quick Notes: Save All Open Tabs as Note & Prune Empty Notes', () => {
    it('extracts shared formatOpenTabsMarkdown and declares notes:createFromAllTabs & notes:pruneEmpty', () => {
      assert.ok(ipcSource.includes('const formatOpenTabsMarkdown ='));
      assert.ok(ipcSource.includes("handle('notes:createFromAllTabs'"));
      assert.ok(ipcSource.includes("handle('notes:pruneEmpty'"));
      assert.ok(preloadSource.includes("createFromAllTabs: () => ipcRenderer.invoke('notes:createFromAllTabs')"));
      assert.ok(preloadSource.includes("pruneEmpty: () => ipcRenderer.invoke('notes:pruneEmpty')"));
    });

    it('wires Save Open Tabs and Prune Empty across Quick Notes, Tab Groups Studio, and Command Palette', () => {
      assert.ok(panelsSource.includes('api().notes.createFromAllTabs()'));
      assert.ok(panelsSource.includes('api().notes.pruneEmpty()'));
      assert.ok(cpSource.includes("id: 'notesCreateFromAllTabs'"));
      assert.ok(cpSource.includes("id: 'notesPruneEmpty'"));
    });
  });

  describe('Tab Stash: Copy All Stashes as Markdown', () => {
    it('extracts shared formatStashesMarkdown helper and supports copying all stashes in stashes:copyMarkdown', () => {
      assert.ok(ipcSource.includes('const formatStashesMarkdown ='));
      assert.ok(ipcSource.includes("handle('stashes:copyMarkdown', (stashId = null)"));
      assert.ok(panelsSource.includes('api().stashes.copyMarkdown()'));
      assert.ok(cpSource.includes("id: 'stashesCopyAllMarkdown'"));
    });
  });

  describe('History & Recently Closed: Remove Matching History & Copy Recently Closed JSON', () => {
    it('implements HistoryStore.removeUrls and removes matching URLs cleanly', () => {
      assert.ok(historySource.includes('removeUrls(urls = [])'));
      const dir = mkdtempSync(join(tmpdir(), 'horizon-hist-'));
      try {
        const store = new HistoryStore(join(dir, 'history.json'));
        store.entries = [
          { url: 'https://example.com/a', title: 'A', time: 1000, visits: 1 },
          { url: 'https://example.org/b', title: 'B', time: 2000, visits: 1 },
          { url: 'https://example.net/c', title: 'C', time: 3000, visits: 1 },
        ];
        const removed = store.removeUrls(['https://example.com/a', 'https://example.net/c']);
        assert.equal(removed, 2);
        assert.equal(store.entries.length, 1);
        assert.equal(store.entries[0].url, 'https://example.org/b');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('wires history:removeUrls and tabs:copyRecentlyClosedJson across IPC, preload, panels, and Command Palette', () => {
      assert.ok(ipcSource.includes("handle('history:removeUrls'"));
      assert.ok(ipcSource.includes("handle('tabs:copyRecentlyClosedJson'"));
      assert.ok(preloadSource.includes("removeUrls: (urls) => ipcRenderer.invoke('history:removeUrls', urls)"));
      assert.ok(preloadSource.includes("copyRecentlyClosedJson: (entries) => ipcRenderer.invoke('tabs:copyRecentlyClosedJson', entries)"));
      assert.ok(panelsSource.includes('api().history.removeUrls(urls)'));
      assert.ok(panelsSource.includes('api().tabs.copyRecentlyClosedJson(lastFilteredEntries)'));
      assert.ok(cpSource.includes("id: 'tabsCopyRecentlyClosedJson'"));
    });
  });

  describe('Reading List: Open Matching Articles in Background Tabs', () => {
    it('declares readingList:openUrls and wires panel button and Command Palette action', () => {
      assert.ok(ipcSource.includes("handle('readingList:openUrls'"));
      assert.ok(preloadSource.includes("openUrls: (urls) => ipcRenderer.invoke('readingList:openUrls', urls)"));
      assert.ok(panelsSource.includes('api().readingList.openUrls(lastFilteredUrls)'));
      assert.ok(cpSource.includes("id: 'readingListOpenMatching'"));
    });
  });

  describe('Locales Consistency for v1.44.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'commandPalette.stashesCopyAllMarkdown',
      'commandPalette.readingListOpenMatching',
      'commandPalette.tabsCopyRecentlyClosedJson',
      'commandPalette.notesCreateFromAllTabs',
      'commandPalette.notesPruneEmpty',
      'history.removeMatching',
      'readingList.openMatching',
      'notes.saveAllTabs',
      'notes.pruneEmpty',
      'stash.copyAllMarkdown',
      'tabGroups.saveTabsAsNote',
      'tabGroups.saveTabsAsNoteDesc',
      'tabGroups.focusGroup',
      'tabGroups.focusGroupDesc',
      'tabGroups.copyJson',
      'tabGroups.copyJsonDesc',
      'tabGroups.sleepGroup',
      'tabGroups.sleepGroupDesc',
      'toast.recentlyClosedJsonCopied',
      'toast.noTabsInGroupToFocus',
      'toast.groupSleptTabs',
      'toast.noTabsInGroupToSleep',
      'toast.groupJsonCopied',
      'toast.historyRemovedMatching',
      'toast.historyNoMatchingToRemove',
      'toast.readingListEmptyToOpen',
      'toast.readingListOpenedMatching',
      'toast.noteCreatedFromAllTabs',
      'toast.notesPruned',
      'toast.noEmptyNotes',
      'toast.stashAllMarkdownCopied',
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
    it('documents v1.44.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Focus'));
      assert.ok(guide.includes('Sleep Group'));
      assert.ok(guide.includes('Save Tabs as Note'));
      assert.ok(guide.includes('Remove Matching'));
      assert.ok(guide.includes('Copy All (MD)'));
      assert.ok(guide.includes('Save Open Tabs'));
      assert.ok(guide.includes('Prune Empty'));
      assert.ok(guide.includes('Open Matching'));
    });

    it('updates website/index.html to latest release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(/v1\.\d+\.\d+ · /.test(indexHtml));
      assert.ok(indexHtml.includes('Neocrom-Horizon-Setup-1.47.0.exe'));
    });

    it('updates website/api/sync.js to v1.44.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      const release = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
      assert.ok(syncJs.includes("version: '" + release + "'"));
    });
  });
});
