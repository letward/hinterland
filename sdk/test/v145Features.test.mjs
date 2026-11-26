import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.45.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Groups Studio: Wake Group, Mute Group & Duplicate Group', () => {
    it('declares wakeGroup and muteGroup on TabManager and wires IPC/preload bindings', () => {
      assert.ok(tabsSource.includes('wakeGroup(groupId)'));
      assert.ok(tabsSource.includes('muteGroup(groupId, muted = null)'));
      assert.ok(ipcSource.includes("handle('tabs:groupWake'"));
      assert.ok(ipcSource.includes("handle('tabs:groupMute'"));
      assert.ok(ipcSource.includes("handle('tabs:groupDuplicate'"));
      assert.ok(preloadSource.includes("groupWake: (groupId) => ipcRenderer.invoke('tabs:groupWake', groupId)"));
      assert.ok(preloadSource.includes("groupMute: (groupId, muted) => ipcRenderer.invoke('tabs:groupMute', groupId, muted)"));
      assert.ok(preloadSource.includes("groupDuplicate: (groupId) => ipcRenderer.invoke('tabs:groupDuplicate', groupId)"));
    });

    it('wires Wake Group, Mute/Unmute Group, and Duplicate Group in Tab Groups Studio', () => {
      assert.ok(panelsSource.includes('api().tabs.groupWake(group.id)'));
      assert.ok(panelsSource.includes('api().tabs.groupMute(group.id)'));
      assert.ok(panelsSource.includes('api().tabs.groupDuplicate(group.id)'));
    });
  });

  describe('Bookmarks Manager: Remove Matching & Save as Note', () => {
    it('declares bookmarks:removeUrls and bookmarks:toNote across IPC, preload, UI, and Command Palette', () => {
      assert.ok(ipcSource.includes("handle('bookmarks:removeUrls'"));
      assert.ok(ipcSource.includes("handle('bookmarks:toNote'"));
      assert.ok(preloadSource.includes("removeUrls: (urls) => ipcRenderer.invoke('bookmarks:removeUrls', urls)"));
      assert.ok(preloadSource.includes("toNote: (items) => ipcRenderer.invoke('bookmarks:toNote', items)"));
      assert.ok(panelsSource.includes('api().bookmarks.removeUrls(lastFilteredUrls)'));
      assert.ok(panelsSource.includes('api().bookmarks.toNote(lastFilteredItems)'));
      assert.ok(cpSource.includes("id: 'bookmarksToNote'"));
    });
  });

  describe('Quick Notes & Tab Stash Symmetry: Save Note as Stash & Bookmark Stash', () => {
    it('extracts shared bookmarkTabEntries and validateHttpUrls helpers in ipc.js', () => {
      assert.ok(ipcSource.includes('const validateHttpUrls ='));
      assert.ok(ipcSource.includes('const bookmarkTabEntries ='));
    });

    it('wires notes:toStash and stashes:toBookmarks across IPC, preload, panels, and Command Palette', () => {
      assert.ok(ipcSource.includes("handle('notes:toStash'"));
      assert.ok(ipcSource.includes("handle('stashes:toBookmarks'"));
      assert.ok(preloadSource.includes("toStash: (id) => ipcRenderer.invoke('notes:toStash', id)"));
      assert.ok(preloadSource.includes("toBookmarks: (stashId) => ipcRenderer.invoke('stashes:toBookmarks', stashId)"));
      assert.ok(panelsSource.includes('api().notes.toStash(activeNote.id)'));
      assert.ok(panelsSource.includes('api().stashes.toBookmarks(stash.id)'));
      assert.ok(cpSource.includes("id: 'notesToStash'"));
    });
  });

  describe('Downloads & Recently Closed QoL: Retry Failed & Stash Recently Closed', () => {
    it('extracts shared triggerDownloadUrl and wires downloads:retryFailed and tabs:stashRecentlyClosed', () => {
      assert.ok(ipcSource.includes('const triggerDownloadUrl ='));
      assert.ok(ipcSource.includes("handle('downloads:retryFailed'"));
      assert.ok(ipcSource.includes("handle('tabs:stashRecentlyClosed'"));
      assert.ok(preloadSource.includes("retryFailed: () => ipcRenderer.invoke('downloads:retryFailed')"));
      assert.ok(preloadSource.includes("stashRecentlyClosed: (entries) => ipcRenderer.invoke('tabs:stashRecentlyClosed', entries)"));
      assert.ok(panelsSource.includes('api().downloads.retryFailed()'));
      assert.ok(panelsSource.includes('api().tabs.stashRecentlyClosed(lastFilteredEntries)'));
      assert.ok(cpSource.includes("id: 'downloadsRetryFailed'"));
      assert.ok(cpSource.includes("id: 'tabsStashRecentlyClosed'"));
    });
  });

  describe('Locales Consistency for v1.45.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'commandPalette.tabsStashRecentlyClosed',
      'commandPalette.bookmarksToNote',
      'commandPalette.notesToStash',
      'commandPalette.downloadsRetryFailed',
      'bookmarks.removeMatching',
      'bookmarks.toNote',
      'history.stashRecentlyClosed',
      'downloads.retryFailed',
      'notes.toStash',
      'stash.toBookmarks',
      'tabGroups.wakeGroup',
      'tabGroups.wakeGroupDesc',
      'tabGroups.muteGroup',
      'tabGroups.unmuteGroup',
      'tabGroups.muteGroupDesc',
      'tabGroups.duplicateGroup',
      'tabGroups.duplicateGroupDesc',
      'toast.recentlyClosedStashed',
      'toast.noRecentlyClosedToStash',
      'toast.groupWokeTabs',
      'toast.noSleepingTabsInGroup',
      'toast.groupMutedTabs',
      'toast.groupUnmutedTabs',
      'toast.noTabsInGroupToMute',
      'toast.groupDuplicated',
      'toast.noTabsInGroupToDuplicate',
      'toast.bookmarksRemovedMatching',
      'toast.bookmarksNoMatchingToRemove',
      'toast.bookmarksSavedAsNote',
      'toast.noteSavedAsStash',
      'toast.stashBookmarked',
      'toast.downloadsRetriedFailed',
      'toast.noFailedDownloadsToRetry',
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
    it('documents v1.45.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Wake Group'));
      assert.ok(guide.includes('Mute Group'));
      assert.ok(guide.includes('Duplicate'));
      assert.ok(guide.includes('Save as Stash'));
      assert.ok(guide.includes('Save to Bookmarks'));
      assert.ok(guide.includes('Save links as Tab Stash'));
      assert.ok(guide.includes('Retry failed'));
    });

    it('updates website/index.html to v1.45.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.45.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.45.0.exe'));
    });

    it('updates website/api/sync.js to v1.45.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.45.0'"));
    });
  });
});
