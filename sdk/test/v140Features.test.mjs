import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.40.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Management: Close Sleeping Tabs & Copy Pinned URLs', () => {
    it('adds closeSleeping and pinnedUrls to TabManager in src/main/tabs.js', () => {
      assert.ok(tabsSource.includes('async closeSleeping()'));
      assert.ok(tabsSource.includes('pinnedUrls()'));
    });

    it('declares tabs:closeSleeping and tabs:copyPinnedUrls in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('tabs:closeSleeping'"));
      assert.ok(ipcSource.includes("handle('tabs:copyPinnedUrls'"));
      assert.ok(preloadSource.includes("closeSleeping: () => ipcRenderer.invoke('tabs:closeSleeping')"));
      assert.ok(preloadSource.includes("copyPinnedUrls: () => ipcRenderer.invoke('tabs:copyPinnedUrls')"));
    });

    it('wires Close Sleeping and Copy Pinned URLs across Tab Groups Studio, tabstrip menu, and Command Palette', () => {
      assert.ok(panelsSource.includes('api().tabs.closeSleeping()'));
      assert.ok(panelsSource.includes('api().tabs.copyPinnedUrls()'));
      assert.ok(menuSource.includes('api().tabs.closeSleeping()'));
      assert.ok(menuSource.includes('api().tabs.copyPinnedUrls()'));
      assert.ok(cpSource.includes("id: 'tabsCloseSleeping'"));
      assert.ok(cpSource.includes("id: 'tabsCopyPinnedUrls'"));
    });
  });

  describe('Bookmarks Manager: Bookmark All Open Tabs', () => {
    it('declares shared collectUnseenWebTabs helper and bookmarks:bookmarkAllTabs handler', () => {
      assert.ok(ipcSource.includes('const collectUnseenWebTabs ='));
      assert.ok(ipcSource.includes("handle('bookmarks:bookmarkAllTabs'"));
      assert.ok(ipcSource.includes('toast.bookmarkedAllTabs'));
      assert.ok(ipcSource.includes('toast.allTabsAlreadyBookmarked'));
      assert.ok(preloadSource.includes("bookmarkAllTabs: () => ipcRenderer.invoke('bookmarks:bookmarkAllTabs')"));
    });

    it('wires Bookmark Open Tabs in Bookmarks panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().bookmarks.bookmarkAllTabs()'));
      assert.ok(panelsSource.includes("t('bookmarks.bookmarkAllTabs')"));
      assert.ok(cpSource.includes("id: 'bookmarksBookmarkAllTabs'"));
    });
  });

  describe('Reading List: Add All Open Tabs', () => {
    it('declares readingList:addAllTabs handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('readingList:addAllTabs'"));
      assert.ok(ipcSource.includes('toast.readingListAddedAll'));
      assert.ok(ipcSource.includes('toast.readingListAllTabsPresent'));
      assert.ok(preloadSource.includes("addAllTabs: () => ipcRenderer.invoke('readingList:addAllTabs')"));
    });

    it('wires Add Open Tabs button in Reading List panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().readingList.addAllTabs()'));
      assert.ok(panelsSource.includes("t('readingList.addAllTabs')"));
      assert.ok(cpSource.includes("id: 'readingListAddAllTabs'"));
    });
  });

  describe('Quick Notes: Open All Links & Copy All Notes Markdown', () => {
    it('declares notes:openLinks handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('notes:openLinks'"));
      assert.ok(ipcSource.includes('toast.noteLinksOpened'));
      assert.ok(ipcSource.includes('toast.noLinksInNote'));
      assert.ok(preloadSource.includes("openLinks: (id) => ipcRenderer.invoke('notes:openLinks', id)"));
    });

    it('wires Open Links and Copy All Markdown in Quick Notes and Command Palette', () => {
      assert.ok(panelsSource.includes('api().notes.openLinks(activeNote.id)'));
      assert.ok(panelsSource.includes("t('notes.openLinks')"));
      assert.ok(panelsSource.includes("t('notes.copyAllMarkdown')"));
      assert.ok(cpSource.includes("id: 'notesOpenLinks'"));
    });
  });

  describe('Search Engines: Copy Engines as Markdown', () => {
    it('extracts formatSearchEnginesMarkdown and declares search:copyMarkdown in ipc.js and preload', () => {
      assert.ok(ipcSource.includes('const formatSearchEnginesMarkdown ='));
      assert.ok(ipcSource.includes("handle('search:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.searchEnginesCopied'));
      assert.ok(ipcSource.includes('toast.noSearchEnginesToCopy'));
      assert.ok(preloadSource.includes("copyMarkdown: () => ipcRenderer.invoke('search:copyMarkdown')"));
    });

    it('wires Copy Search Engines as Markdown in Command Palette', () => {
      assert.ok(cpSource.includes("id: 'searchCopyMarkdown'"));
      assert.ok(cpSource.includes('api().search.copyMarkdown()'));
    });
  });

  describe('Locales Consistency for v1.40.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.copyPinnedUrls',
      'menu.closeSleepingTabs',
      'commandPalette.tabsCopyPinnedUrls',
      'commandPalette.tabsCloseSleeping',
      'commandPalette.searchCopyMarkdown',
      'commandPalette.readingListAddAllTabs',
      'commandPalette.bookmarksBookmarkAllTabs',
      'commandPalette.notesOpenLinks',
      'bookmarks.bookmarkAllTabs',
      'readingList.addAllTabs',
      'notes.openLinks',
      'notes.copyAllMarkdown',
      'tabGroups.copyPinnedUrls',
      'tabGroups.copyPinnedUrlsDesc',
      'tabGroups.closeSleeping',
      'tabGroups.closeSleepingDesc',
      'toast.closedSleepingTabs',
      'toast.pinnedUrlsCopied',
      'toast.searchEnginesCopied',
      'toast.noSearchEnginesToCopy',
      'toast.bookmarkedAllTabs',
      'toast.allTabsAlreadyBookmarked',
      'toast.readingListAddedAll',
      'toast.readingListAllTabsPresent',
      'toast.noteLinksOpened',
      'toast.noLinksInNote',
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
    it('documents v1.40.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Copy Pinned URLs'));
      assert.ok(guide.includes('Close Sleeping'));
      assert.ok(guide.includes('Bookmark Open Tabs'));
      assert.ok(guide.includes('Add Open Tabs'));
      assert.ok(guide.includes('Copy All (MD)'));
      assert.ok(guide.includes('Open links in tabs'));
      assert.ok(guide.includes('Copy Search Engines as Markdown'));
    });

    it('updates website/index.html to v1.40.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.40.0 · Latest Release') || indexHtml.includes('v1.41.0 · Latest Release') || indexHtml.includes('v1.42.0 · Latest Release') || indexHtml.includes('v1.43.0 · Latest Release') || indexHtml.includes('v1.44.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.40.0.exe') || indexHtml.includes('Hinterland-Setup-1.41.0.exe') || indexHtml.includes('Hinterland-Setup-1.42.0.exe') || indexHtml.includes('Hinterland-Setup-1.43.0.exe') || indexHtml.includes('Hinterland-Setup-1.44.0.exe'));
    });

    it('updates website/api/sync.js to v1.40.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.40.0'") || syncJs.includes("version: '1.41.0'") || syncJs.includes("version: '1.42.0'") || syncJs.includes("version: '1.43.0'") || syncJs.includes("version: '1.44.0'"));
    });
  });
});
