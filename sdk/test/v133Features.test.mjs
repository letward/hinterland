import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.33.0 Features & Polish', () => {
  describe('Bookmarks Markdown Export & Domain Sorting', () => {
    it('declares bookmarks:exportMarkdown handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('bookmarks:exportMarkdown'"));
      assert.ok(ipcSource.includes('# Hinterland Bookmarks Archive'));
      assert.ok(ipcSource.includes('toast.bookmarksExportedMarkdown'));
    });

    it('exposes exportMarkdown on bookmarks bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportMarkdown: (items) => ipcRenderer.invoke('bookmarks:exportMarkdown', items)"));
    });

    it('adds Export Markdown and Sort by Domain buttons in Bookmarks panel (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().bookmarks.exportMarkdown(items)'));
      assert.ok(panelsSource.includes("t('bookmarks.exportMarkdown')"));
      assert.ok(panelsSource.includes("t('bookmarks.sortByDomain')"));
      assert.ok(panelsSource.includes("toast(t('toast.bookmarksSortedByDomain'), 'success')"));
    });

    it('registers bookmarksExportMarkdown in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'bookmarksExportMarkdown'"));
      assert.ok(cpSource.includes('api().bookmarks.exportMarkdown()'));
    });
  });

  describe('Tab Groups Studio: Ungroup All & Copy Group Links as Markdown', () => {
    it('declares ungroupAll in src/main/tabs.js', () => {
      const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
      assert.ok(tabsSource.includes('ungroupAll()'));
      assert.ok(tabsSource.includes('tab.groupId = null'));
    });

    it('declares tabs:ungroupAll and tabs:groupCopyMarkdown handlers in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:ungroupAll'"));
      assert.ok(ipcSource.includes("handle('tabs:groupCopyMarkdown'"));
      assert.ok(ipcSource.includes('toast.allTabsUngrouped'));
      assert.ok(ipcSource.includes('toast.groupLinksCopied'));
    });

    it('exposes ungroupAll and groupCopyMarkdown on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("ungroupAll: () => ipcRenderer.invoke('tabs:ungroupAll')"));
      assert.ok(preloadSource.includes("groupCopyMarkdown: (groupId) => ipcRenderer.invoke('tabs:groupCopyMarkdown', groupId)"));
    });

    it('adds Ungroup All and Copy Links actions in Tab Groups Studio (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.ungroupAll()'));
      assert.ok(panelsSource.includes("t('tabGroups.ungroupAll')"));
      assert.ok(panelsSource.includes('api().tabs.groupCopyMarkdown(group.id)'));
      assert.ok(panelsSource.includes("t('tabGroups.copyLinks')"));
    });

    it('wires Ungroup All Tabs in Main Menu and Tabstrip menu without duplicate Close Left/Right entries (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.ungroupAllTabs')"));
      assert.ok(menuSource.includes('api().tabs.ungroupAll()'));
      const closeLeftCount = menuSource.match(/t\('menu\.closeLeft'\)/g)?.length ?? 0;
      const closeRightCount = menuSource.match(/t\('menu\.closeRight'\)/g)?.length ?? 0;
      assert.equal(closeLeftCount, 1, 'openTabMenu should not duplicate closeLeft');
      assert.equal(closeRightCount, 1, 'openTabMenu should not duplicate closeRight');
    });

    it('registers tabsUngroupAll in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'tabsUngroupAll'"));
      assert.ok(cpSource.includes('api().tabs.ungroupAll()'));
    });
  });

  describe('Quick Notes: Live Word, Character & Reading Time Counter', () => {
    it('renders live word/char/reading-time status bar in Quick Notes editor (src/ui/js/panels.js & src/ui/css/panels.css)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      const cssSource = readFileSync(join(ROOT, 'src', 'ui', 'css', 'panels.css'), 'utf8');
      assert.ok(panelsSource.includes('notesStatusBar'));
      assert.ok(panelsSource.includes("t('notes.wordCount'"));
      assert.ok(panelsSource.includes("t('notes.charCount'"));
      assert.ok(panelsSource.includes("t('notes.readingTime'"));
      assert.ok(cssSource.includes('.notesStatusBar'));
    });
  });

  describe('Downloads History Markdown Export', () => {
    it('declares downloads:exportMarkdown handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('downloads:exportMarkdown'"));
      assert.ok(ipcSource.includes('# Hinterland Downloads Log'));
      assert.ok(ipcSource.includes('toast.downloadsExportedMarkdown'));
    });

    it('exposes exportMarkdown on downloads bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportMarkdown: () => ipcRenderer.invoke('downloads:exportMarkdown')"));
    });

    it('adds Export Markdown button in Downloads panel (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().downloads.exportMarkdown()'));
      assert.ok(panelsSource.includes("t('downloads.exportMarkdown')"));
    });

    it('registers downloadsExportMarkdown in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'downloadsExportMarkdown'"));
      assert.ok(cpSource.includes('api().downloads.exportMarkdown()'));
    });
  });

  describe('Locales Consistency for v1.33.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.ungroupAllTabs',
      'commandPalette.tabsUngroupAll',
      'commandPalette.bookmarksExportMarkdown',
      'commandPalette.downloadsExportMarkdown',
      'bookmarks.exportMarkdown',
      'bookmarks.sortByDomain',
      'downloads.exportMarkdown',
      'notes.wordCount',
      'notes.charCount',
      'notes.readingTime',
      'tabGroups.ungroupAll',
      'tabGroups.ungroupAllDesc',
      'tabGroups.copyLinks',
      'tabGroups.copyLinksDesc',
      'toast.allTabsUngrouped',
      'toast.noGroupedTabs',
      'toast.groupLinksCopied',
      'toast.noTabsInGroupToCopy',
      'toast.downloadsExportedMarkdown',
      'toast.bookmarksExportedMarkdown',
      'toast.bookmarksSortedByDomain',
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
    it('documents v1.33.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Copy Links'));
      assert.ok(guide.includes('Ungroup All'));
      assert.ok(guide.includes('Sort by domain'));
      assert.ok(guide.includes('word count, character count, and estimated reading time'));
      assert.ok(guide.includes('download history log as formatted <strong>Markdown</strong>'));
    });

    it('updates website/index.html to v1.33.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.33.0 · Latest Release') || indexHtml.includes('v1.34.0 · Latest Release') || indexHtml.includes('v1.35.0 · Latest Release') || indexHtml.includes('v1.36.0 · Latest Release') || indexHtml.includes('v1.37.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.33.0.exe') || indexHtml.includes('Hinterland-Setup-1.34.0.exe') || indexHtml.includes('Hinterland-Setup-1.35.0.exe') || indexHtml.includes('Hinterland-Setup-1.36.0.exe') || indexHtml.includes('Hinterland-Setup-1.37.0.exe'));
    });
  });
});
