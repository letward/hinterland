import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.31.0 Features & Polish', () => {
  describe('Auto-Group Tabs by Domain', () => {
    it('declares tabs:groupByDomain handler in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:groupByDomain'"));
      assert.ok(ipcSource.includes('normalizeDomain(tab.url)'));
      assert.ok(ipcSource.includes('toast.tabsGroupedByDomain'));
    });

    it('exposes groupByDomain on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("groupByDomain: () => ipcRenderer.invoke('tabs:groupByDomain')"));
    });

    it('adds Auto-Group by Domain button in Tab Groups Studio (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().tabs.groupByDomain()'));
      assert.ok(panelsSource.includes("t('tabGroups.groupByDomain')"));
    });

    it('wires Auto-Group by Domain in Tabstrip context menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('tabGroups.groupByDomain')"));
      assert.ok(menuSource.includes('api().tabs.groupByDomain()'));
    });

    it('registers groupByDomain in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'groupByDomain'"));
      assert.ok(cpSource.includes('api().tabs.groupByDomain()'));
    });
  });

  describe('Quick Notes Full-Vault Markdown & Offline HTML Export', () => {
    it('declares notes:exportMarkdown and notes:exportHtml in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('notes:exportMarkdown'"));
      assert.ok(ipcSource.includes("handle('notes:exportHtml'"));
      assert.ok(ipcSource.includes('# Hinterland Quick Notes'));
      assert.ok(ipcSource.includes('hinterland-notes-'));
    });

    it('exposes exportMarkdown and exportHtml on notes bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportMarkdown: () => ipcRenderer.invoke('notes:exportMarkdown')"));
      assert.ok(preloadSource.includes("exportHtml: () => ipcRenderer.invoke('notes:exportHtml')"));
    });

    it('adds export markdown and export html buttons in Quick Notes UI (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().notes.exportMarkdown()'));
      assert.ok(panelsSource.includes('api().notes.exportHtml()'));
      assert.ok(panelsSource.includes("t('notes.exportMarkdown')"));
      assert.ok(panelsSource.includes("t('notes.exportHtml')"));
    });

    it('registers notesExportMarkdown and notesExportHtml in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'notesExportMarkdown'"));
      assert.ok(cpSource.includes("id: 'notesExportHtml'"));
      assert.ok(cpSource.includes('api().notes.exportMarkdown()'));
      assert.ok(cpSource.includes('api().notes.exportHtml()'));
    });
  });

  describe('Tab Stashes: Single Tab Stash & Duplicate Stash', () => {
    it('declares stashes:stashTab and stashes:duplicate in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('stashes:stashTab'"));
      assert.ok(ipcSource.includes("handle('stashes:duplicate'"));
      assert.ok(ipcSource.includes('(Copy)'));
    });

    it('exposes stashTab and duplicate on stashes bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("stashTab: (tabId) => ipcRenderer.invoke('stashes:stashTab', tabId)"));
      assert.ok(preloadSource.includes("duplicate: (stashId) => ipcRenderer.invoke('stashes:duplicate', stashId)"));
    });

    it('wires Stash Tab in Tab context menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.stashTab')"));
      assert.ok(menuSource.includes('api().stashes.stashTab(tab.id)'));
    });

    it('adds Duplicate Stash button in Tab Stash manager (src/ui/js/panels.js)', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().stashes.duplicate(stash.id)'));
      assert.ok(panelsSource.includes("t('stash.duplicate')"));
    });

    it('registers stashCurrentTab in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'stashCurrentTab'"));
      assert.ok(cpSource.includes('api().stashes.stashTab(current.id)'));
    });
  });

  describe('Tab Audio & Private Mode Ergonomics', () => {
    it('wires Unmute All Tabs in Tabstrip context menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.unmuteAllTabs')"));
      assert.ok(menuSource.includes('api().tabs.muteAll(false)'));
    });

    it('wires Open in Private Tab in Tab context menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.openInPrivate')"));
      assert.ok(menuSource.includes('privateMode: true'));
    });

    it('registers openInPrivate in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'openInPrivate'"));
      assert.ok(cpSource.includes('privateMode: true'));
    });
  });

  describe('Locales Consistency for v1.31.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'tabGroups.groupByDomain',
      'tabGroups.groupByDomainDesc',
      'notes.exportMarkdown',
      'notes.exportHtml',
      'stash.duplicate',
      'menu.stashTab',
      'menu.unmuteAllTabs',
      'menu.openInPrivate',
      'toast.tabsGroupedByDomain',
      'toast.noTabsToGroup',
      'toast.tabStashed',
      'toast.stashDuplicated',
      'toast.notesExportedMarkdown',
      'toast.notesExportedHtml',
      'commandPalette.groupByDomain',
      'commandPalette.stashCurrentTab',
      'commandPalette.notesExportMarkdown',
      'commandPalette.notesExportHtml',
      'commandPalette.openInPrivate',
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
    it('documents Auto-Group by Domain, Quick Notes Markdown & Offline HTML, and Single-Tab Stash in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Auto-Group by Domain'));
      assert.ok(guide.includes('Offline HTML Notebook'));
      assert.ok(guide.includes('Single-Tab Stashing'));
    });

    it('updates website/index.html to v1.31.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.31.0 · Latest Release') || indexHtml.includes('v1.32.0 · Latest Release') || indexHtml.includes('v1.33.0 · Latest Release') || indexHtml.includes('v1.34.0 · Latest Release') || indexHtml.includes('v1.35.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.31.0.exe') || indexHtml.includes('Hinterland-Setup-1.32.0.exe') || indexHtml.includes('Hinterland-Setup-1.33.0.exe') || indexHtml.includes('Hinterland-Setup-1.34.0.exe') || indexHtml.includes('Hinterland-Setup-1.35.0.exe'));
    });
  });
});
