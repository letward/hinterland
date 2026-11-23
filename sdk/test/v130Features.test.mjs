import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.30.0 Features & Polish', () => {
  describe('Reading List Markdown & Offline HTML Export', () => {
    it('declares readingList:exportMarkdown and readingList:exportHtml in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('readingList:exportMarkdown'"));
      assert.ok(ipcSource.includes("handle('readingList:exportHtml'"));
      assert.ok(ipcSource.includes('hinterland-reading-list-'));
      assert.ok(ipcSource.includes('<!DOCTYPE html>'));
    });

    it('exposes exportMarkdown and exportHtml on readingList bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportMarkdown: () => ipcRenderer.invoke('readingList:exportMarkdown')"));
      assert.ok(preloadSource.includes("exportHtml: () => ipcRenderer.invoke('readingList:exportHtml')"));
    });

    it('adds export markdown and html buttons in Reading List UI in src/ui/js/panels.js', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().readingList.exportMarkdown()'));
      assert.ok(panelsSource.includes('api().readingList.exportHtml()'));
    });

    it('registers readingListExportMarkdown and readingListExportHtml in Command Palette', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'readingListExportMarkdown'"));
      assert.ok(cpSource.includes("id: 'readingListExportHtml'"));
      assert.ok(cpSource.includes('api().readingList.exportMarkdown()'));
      assert.ok(cpSource.includes('api().readingList.exportHtml()'));
    });
  });

  describe('Tab Stashes Markdown Export', () => {
    it('declares stashes:exportMarkdown in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('stashes:exportMarkdown'"));
      assert.ok(ipcSource.includes('hinterland-stashes-'));
      assert.ok(ipcSource.includes('# Hinterland Tab Stashes'));
    });

    it('exposes exportMarkdown on stashes bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportMarkdown: (stashId) => ipcRenderer.invoke('stashes:exportMarkdown', stashId)"));
    });

    it('adds export markdown buttons in Tab Stash UI in src/ui/js/panels.js', () => {
      const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
      assert.ok(panelsSource.includes('api().stashes.exportMarkdown()'));
      assert.ok(panelsSource.includes('api().stashes.exportMarkdown(stash.id)'));
    });

    it('registers stashExportMarkdown in Command Palette', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'stashExportMarkdown'"));
      assert.ok(cpSource.includes('api().stashes.exportMarkdown()'));
    });
  });

  describe('Memory Saver Site Exemptions (Never-Sleep Whitelist)', () => {
    it('declares advanced.memorySaverExemptions in schema.js with default []', async () => {
      const schemaModule = await import('../../src/main/schema.js');
      const defaults = schemaModule.buildDefaults();
      assert.ok(defaults.advanced);
      assert.deepEqual(defaults.advanced.memorySaverExemptions, []);
    });

    it('includes advanced.memorySaverExemptions in SYNCABLE_SETTINGS in sync.js', async () => {
      const syncModule = await import('../../src/main/sync.js');
      assert.ok(syncModule.SYNCABLE_SETTINGS.includes('advanced.memorySaverExemptions'));
    });

    it('declares exemption methods and logic in Tabs manager (src/main/tabs.js)', async () => {
      const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
      assert.ok(tabsSource.includes('isDomainExempt(rawUrl)'));
      assert.ok(tabsSource.includes('getExemptDomains()'));
      assert.ok(tabsSource.includes('exemptDomain(domain)'));
      assert.ok(tabsSource.includes('unexemptDomain(domain)'));
      assert.ok(tabsSource.includes('if (this.isDomainExempt(tab.url)) continue;'));
      assert.ok(tabsSource.includes('exemptionsCount: exemptions.length'));
    });

    it('declares tabs:exemptDomain, tabs:unexemptDomain, and tabs:getExemptDomains in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:exemptDomain'"));
      assert.ok(ipcSource.includes("handle('tabs:unexemptDomain'"));
      assert.ok(ipcSource.includes("handle('tabs:getExemptDomains'"));
    });

    it('exposes exemption methods on tabs bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exemptDomain: (domain) => ipcRenderer.invoke('tabs:exemptDomain', domain)"));
      assert.ok(preloadSource.includes("unexemptDomain: (domain) => ipcRenderer.invoke('tabs:unexemptDomain', domain)"));
      assert.ok(preloadSource.includes("getExemptDomains: () => ipcRenderer.invoke('tabs:getExemptDomains')"));
    });

    it('wires memory saver site exemption in tab context menu (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes('isDomainExempted(rawUrl)'));
      assert.ok(menuSource.includes("t('menu.memorySaverExempt')"));
      assert.ok(menuSource.includes("t('menu.memorySaverUnexempt')"));
      assert.ok(menuSource.includes('api().tabs.exemptDomain(host)'));
      assert.ok(menuSource.includes('api().tabs.unexemptDomain(host)'));
    });

    it('registers memorySaverExemptSite in Command Palette (src/ui/js/commandPalette.js)', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'memorySaverExemptSite'"));
      assert.ok(cpSource.includes('api().tabs.getExemptDomains()'));
    });
  });

  describe('Global Media Hub & Controls Overhaul', () => {
    it('implements media header bar with Mute All and Unmute All in openMediaControls (src/ui/js/menu.js)', () => {
      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes('mediaHeaderBar'));
      assert.ok(menuSource.includes('media.playingCount'));
      assert.ok(menuSource.includes('menu.muteAllTabs'));
      assert.ok(menuSource.includes('menu.unmuteAllTabs'));
      assert.ok(menuSource.includes('api().tabs.muteAll(true)'));
      assert.ok(menuSource.includes('api().tabs.muteAll(false)'));
      assert.ok(menuSource.includes('mediaWaveIndicator'));
    });

    it('defines media header bar and live indicator styling in src/ui/css/panels.css', () => {
      const panelsCss = readFileSync(join(ROOT, 'src', 'ui', 'css', 'panels.css'), 'utf8');
      assert.ok(panelsCss.includes('.mediaHeaderBar'));
      assert.ok(panelsCss.includes('.mediaHeaderButtons'));
      assert.ok(panelsCss.includes('.mediaWaveIndicator'));
      assert.ok(panelsCss.includes('@keyframes pulseLive'));
    });
  });

  describe('Locales Consistency for v1.30.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'readingList.exportMarkdown',
      'readingList.exportHtml',
      'stash.exportMarkdown',
      'commandPalette.readingListExportMarkdown',
      'commandPalette.readingListExportHtml',
      'commandPalette.stashExportMarkdown',
      'commandPalette.memorySaverExemptSite',
      'menu.memorySaverExempt',
      'menu.memorySaverUnexempt',
      'media.playingCount',
      'media.live',
      'toast.memorySaverExempted',
      'toast.memorySaverUnexempted',
      'toast.cannotExemptSpecialPage',
      'settings.advanced.memorySaverExemptions',
      'settings.advanced.memorySaverExemptionsDesc',
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
    it('documents Memory Saver Exemptions, Global Media Hub, and Markdown Exports in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Never sleep this site'));
      assert.ok(guide.includes('Global Media Hub'));
      assert.ok(guide.includes('Mute All Tabs'));
      assert.ok(guide.includes('Offline HTML Digest'));
      assert.ok(guide.includes('Tab Stash &amp; Markdown Export'));
    });

    it('updates website/index.html to v1.30.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.30.0 · Latest Release') || indexHtml.includes('v1.31.0 · Latest Release') || indexHtml.includes('v1.32.0 · Latest Release') || indexHtml.includes('v1.33.0 · Latest Release') || indexHtml.includes('v1.34.0 · Latest Release') || indexHtml.includes('v1.35.0 · Latest Release') || indexHtml.includes('v1.36.0 · Latest Release') || indexHtml.includes('v1.37.0 · Latest Release') || indexHtml.includes('v1.38.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.30.0.exe') || indexHtml.includes('Hinterland-Setup-1.31.0.exe') || indexHtml.includes('Hinterland-Setup-1.32.0.exe') || indexHtml.includes('Hinterland-Setup-1.33.0.exe') || indexHtml.includes('Hinterland-Setup-1.34.0.exe') || indexHtml.includes('Hinterland-Setup-1.35.0.exe') || indexHtml.includes('Hinterland-Setup-1.36.0.exe') || indexHtml.includes('Hinterland-Setup-1.37.0.exe') || indexHtml.includes('Hinterland-Setup-1.38.0.exe'));
    });
  });
});
