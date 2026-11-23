import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.37.0 Features & Polish', () => {
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Stash: Copy URLs, Add Current Tab & Summary Counter', () => {
    it('declares stashes:copyUrls and stashes:addTab handlers in src/main/ipc.js and preload bridge', () => {
      assert.ok(ipcSource.includes("handle('stashes:copyUrls'"));
      assert.ok(ipcSource.includes('toast.stashUrlsCopied'));
      assert.ok(ipcSource.includes("handle('stashes:addTab'"));
      assert.ok(ipcSource.includes('toast.stashTabAdded'));
      assert.ok(ipcSource.includes('toast.stashTabAlreadyExists'));
      assert.ok(preloadSource.includes("copyUrls: (stashId) => ipcRenderer.invoke('stashes:copyUrls', stashId)"));
      assert.ok(preloadSource.includes("addTab: (stashId, tabId) => ipcRenderer.invoke('stashes:addTab', stashId, tabId)"));
    });

    it('wires Copy URLs, Add current tab, and summary badge in Tab Stash panel', () => {
      assert.ok(panelsSource.includes('api().stashes.copyUrls(stash.id)'));
      assert.ok(panelsSource.includes('api().stashes.addTab(stash.id)'));
      assert.ok(panelsSource.includes("t('stash.summaryCount'"));
      assert.ok(panelsSource.includes("t('stash.copyUrls')"));
      assert.ok(panelsSource.includes("t('stash.addCurrentTab')"));
    });
  });

  describe('Quick Notes: Copy as Markdown & Live Note Count Badge', () => {
    it('extracts shared formatNotesMarkdown and declares notes:copyMarkdown handler in src/main/ipc.js and preload', () => {
      assert.ok(ipcSource.includes('formatNotesMarkdown'));
      assert.ok(ipcSource.includes("handle('notes:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.noteMarkdownCopied'));
      assert.ok(ipcSource.includes('toast.noNotesToCopy'));
      assert.ok(preloadSource.includes("copyMarkdown: (id) => ipcRenderer.invoke('notes:copyMarkdown', id)"));
    });

    it('wires Copy as Markdown and note count badge in Quick Notes panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().notes.copyMarkdown(activeNote.id)'));
      assert.ok(panelsSource.includes("t('notes.copyMarkdown')"));
      assert.ok(panelsSource.includes("t('notes.countBadge'"));
      assert.ok(cpSource.includes("id: 'notesCopyMarkdown'"));
      assert.ok(cpSource.includes('api().notes.copyMarkdown()'));
    });
  });

  describe('Reading List: Copy URLs, Row Copy Link & Live Count Badge', () => {
    it('declares readingList:copyUrls handler sharing filterReadingListByMode in src/main/ipc.js and preload', () => {
      assert.ok(ipcSource.includes('filterReadingListByMode'));
      assert.ok(ipcSource.includes("handle('readingList:copyUrls'"));
      assert.ok(ipcSource.includes('toast.readingListUrlsCopied'));
      assert.ok(preloadSource.includes("copyUrls: (mode) => ipcRenderer.invoke('readingList:copyUrls', mode)"));
    });

    it('wires Copy URLs, per-row Copy Link, and live count badge in Reading List panel and Command Palette', () => {
      assert.ok(panelsSource.includes('api().readingList.copyUrls(mode)'));
      assert.ok(panelsSource.includes("t('readingList.copyUrls')"));
      assert.ok(panelsSource.includes("t('readingList.countBadge'"));
      assert.ok(cpSource.includes("id: 'readingListCopyUrls'"));
      assert.ok(cpSource.includes("api().readingList.copyUrls('all')"));
    });
  });

  describe('History Manager: Copy URLs & Per-Row Copy Link', () => {
    it('declares history:copyUrls handler in src/main/ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('history:copyUrls'"));
      assert.ok(ipcSource.includes('toast.historyUrlsCopied'));
      assert.ok(ipcSource.includes('toast.historyNoUrlsToCopy'));
      assert.ok(preloadSource.includes("copyUrls: (urls) => ipcRenderer.invoke('history:copyUrls', urls)"));
    });

    it('wires Copy URLs toolbar button, per-row Copy Link, and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().history.copyUrls(urls)'));
      assert.ok(panelsSource.includes("t('history.copyUrls')"));
      assert.ok(cpSource.includes("id: 'historyCopyUrls'"));
      assert.ok(cpSource.includes('api().history.copyUrls()'));
    });
  });

  describe('Tab Groups Studio: Add Active Tab & Prune Empty Groups', () => {
    it('declares tabs:groupPruneEmpty handler in src/main/ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('tabs:groupPruneEmpty'"));
      assert.ok(ipcSource.includes('toast.emptyGroupsPruned'));
      assert.ok(ipcSource.includes('toast.noEmptyGroups'));
      assert.ok(preloadSource.includes("groupPruneEmpty: () => ipcRenderer.invoke('tabs:groupPruneEmpty')"));
    });

    it('wires Prune Empty, Add Active Tab, and Command Palette action in Tab Groups Studio', () => {
      assert.ok(panelsSource.includes('api().tabs.groupPruneEmpty()'));
      assert.ok(panelsSource.includes("t('tabGroups.pruneEmpty')"));
      assert.ok(panelsSource.includes("t('tabGroups.addActiveTab')"));
      assert.ok(panelsSource.includes("t('toast.tabAddedToGroup')"));
      assert.ok(cpSource.includes("id: 'tabsGroupPruneEmpty'"));
    });
  });

  describe('Locales Consistency for v1.37.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'commandPalette.tabsGroupPruneEmpty',
      'commandPalette.readingListCopyUrls',
      'commandPalette.historyCopyUrls',
      'commandPalette.notesCopyMarkdown',
      'history.copyUrls',
      'readingList.copyUrls',
      'readingList.countBadge',
      'notes.copyMarkdown',
      'notes.countBadge',
      'stash.summaryCount',
      'stash.addCurrentTab',
      'stash.copyUrls',
      'tabGroups.pruneEmpty',
      'tabGroups.pruneEmptyDesc',
      'tabGroups.addActiveTab',
      'tabGroups.addActiveTabDesc',
      'toast.emptyGroupsPruned',
      'toast.noEmptyGroups',
      'toast.tabAddedToGroup',
      'toast.historyUrlsCopied',
      'toast.historyNoUrlsToCopy',
      'toast.readingListUrlsCopied',
      'toast.noteMarkdownCopied',
      'toast.noNotesToCopy',
      'toast.stashUrlsCopied',
      'toast.stashTabAdded',
      'toast.stashTabAlreadyExists',
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
    it('documents v1.37.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Add Active Tab'));
      assert.ok(guide.includes('Prune Empty'));
      assert.ok(guide.includes('Add current tab'));
      assert.ok(guide.includes('Copy URLs'));
      assert.ok(guide.includes('Copy as Markdown'));
    });

    it('updates website/index.html to v1.37.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.37.0 · Latest Release') || indexHtml.includes('v1.38.0 · Latest Release') || indexHtml.includes('v1.39.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.37.0.exe') || indexHtml.includes('Hinterland-Setup-1.38.0.exe') || indexHtml.includes('Hinterland-Setup-1.39.0.exe'));
    });

    it('updates website/api/sync.js to v1.37.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.37.0'") || syncJs.includes("version: '1.38.0'") || syncJs.includes("version: '1.39.0'"));
    });
  });
});
