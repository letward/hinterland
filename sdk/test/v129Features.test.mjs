import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.29.0 Features & Polish', () => {
  describe('Tab Groups Studio & Management', () => {
    it('exports openTabGroups in src/ui/js/panels.js', async () => {
      const panelsPath = join(ROOT, 'src', 'ui', 'js', 'panels.js');
      const panelsSource = readFileSync(panelsPath, 'utf8');
      assert.ok(panelsSource.includes('export function openTabGroups()'));
      assert.ok(panelsSource.includes('tabGroupsPage()'));
      assert.ok(panelsSource.includes('api().tabs.groupCreate'));
      assert.ok(panelsSource.includes('api().tabs.groupStash'));
      assert.ok(panelsSource.includes('api().tabs.groupCloseTabs'));
      assert.ok(panelsSource.includes('api().tabs.groupDelete'));
    });

    it('declares tabs:groupStash and tabs:groupCloseTabs in src/main/ipc.js', () => {
      const ipcPath = join(ROOT, 'src', 'main', 'ipc.js');
      const ipcSource = readFileSync(ipcPath, 'utf8');
      assert.ok(ipcSource.includes("handle('tabs:groupStash'"));
      assert.ok(ipcSource.includes("handle('tabs:groupCloseTabs'"));
    });

    it('exposes groupStash and groupCloseTabs in src/preload/chrome.cjs', () => {
      const preloadPath = join(ROOT, 'src', 'preload', 'chrome.cjs');
      const preloadSource = readFileSync(preloadPath, 'utf8');
      assert.ok(preloadSource.includes('groupStash: (groupId) =>'));
      assert.ok(preloadSource.includes('groupCloseTabs: (groupId) =>'));
    });

    it('wires tabGroups into commandPalette, menu, and app.js', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'tabGroups'"));
      assert.ok(cpSource.includes('openTabGroups()'));

      const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
      assert.ok(menuSource.includes("t('menu.tabGroups')"));
      assert.ok(menuSource.includes("t('menu.manageGroups')"));

      const appSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'app.js'), 'utf8');
      assert.ok(appSource.includes('tabGroups: openTabGroups'));
      assert.ok(appSource.includes("hinterland:opentabgroups"));
    });

    it('defines tab groups studio styling in src/ui/css/panels.css', () => {
      const panelsCss = readFileSync(join(ROOT, 'src', 'ui', 'css', 'panels.css'), 'utf8');
      assert.ok(panelsCss.includes('.tabGroupsPage'));
      assert.ok(panelsCss.includes('.tabGroupCard'));
      assert.ok(panelsCss.includes('.groupColorIndicator'));
      assert.ok(panelsCss.includes('.tabGroupTitle'));
    });
  });

  describe('Custom Search Engines Portability (JSON Export & Import)', () => {
    it('declares search:exportJson and search:importJson in src/main/ipc.js', () => {
      const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
      assert.ok(ipcSource.includes("handle('search:exportJson'"));
      assert.ok(ipcSource.includes("handle('search:importJson'"));
    });

    it('exposes exportJson and importJson on search bridge in src/preload/chrome.cjs', () => {
      const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
      assert.ok(preloadSource.includes("exportJson: () => ipcRenderer.invoke('search:exportJson')"));
      assert.ok(preloadSource.includes("importJson: () => ipcRenderer.invoke('search:importJson')"));
    });

    it('registers searchExportJson and searchImportJson in Command Palette', () => {
      const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
      assert.ok(cpSource.includes("id: 'searchExportJson'"));
      assert.ok(cpSource.includes("id: 'searchImportJson'"));
      assert.ok(cpSource.includes('api().search.exportJson()'));
      assert.ok(cpSource.includes('api().search.importJson()'));
    });

    it('includes search engines in SYNCABLE_SETTINGS in src/main/sync.js', async () => {
      const syncModule = await import('../../src/main/sync.js');
      assert.ok(syncModule.SYNCABLE_SETTINGS.includes('search.engines'));
      assert.ok(syncModule.SYNCABLE_SETTINGS.includes('search.defaultEngine'));
    });
  });

  describe('Cloud Sync Engine: Reading List & Quick Notes Synchronization', () => {
    it('declares account.syncReadingList and account.syncNotes in schema.js with default true', async () => {
      const schemaModule = await import('../../src/main/schema.js');
      const defaults = schemaModule.buildDefaults();
      assert.ok(defaults);
      assert.equal(defaults.account?.syncReadingList, true);
      assert.equal(defaults.account?.syncNotes, true);
    });

    it('exports normalizeReadingListUrl and mergeReadingList in sync.js', async () => {
      const syncModule = await import('../../src/main/sync.js');
      assert.equal(typeof syncModule.normalizeReadingListUrl, 'function');
      assert.equal(typeof syncModule.mergeReadingList, 'function');

      const norm = syncModule.normalizeReadingListUrl('https://example.com/article/?ref=feed/');
      assert.equal(norm, 'https://example.com/article/?ref=feed');

      const local = [
        { id: '1', url: 'https://example.com/a', title: 'Article A', read: false, addedAt: 1000 },
      ];
      const remote = [
        { id: '2', url: 'https://example.com/a/', title: 'Article A Read', read: true, addedAt: 1000 },
        { id: '3', url: 'https://example.com/b', title: 'Article B', read: false, addedAt: 2000 },
      ];

      const merged = syncModule.mergeReadingList(local, remote);
      assert.equal(merged.length, 2);
      const itemA = merged.find((item) => item.url.startsWith('https://example.com/a'));
      assert.ok(itemA);
      assert.equal(itemA.read, true); // read status preserved
      assert.equal(merged[0].url, 'https://example.com/b'); // sorted by addedAt descending
    });

    it('exports mergeNotes in sync.js and handles conflict resolution', async () => {
      const syncModule = await import('../../src/main/sync.js');
      assert.equal(typeof syncModule.mergeNotes, 'function');

      const local = [
        { id: 'n1', title: 'Note 1', content: 'Local edit', pinned: false, updatedAt: 1000 },
        { id: 'n2', title: 'Local Only', content: 'Draft', pinned: true, updatedAt: 500 },
      ];
      const remote = [
        { id: 'n1', title: 'Note 1', content: 'Remote newer edit', pinned: false, updatedAt: 2000 },
        { id: 'n3', title: 'Remote Note', content: 'Content', pinned: false, updatedAt: 1500 },
      ];

      const merged = syncModule.mergeNotes(local, remote);
      assert.equal(merged.length, 3);
      const note1 = merged.find((n) => n.id === 'n1');
      assert.equal(note1.content, 'Remote newer edit');
      // Pinned note comes first
      assert.equal(merged[0].id, 'n2');
      assert.equal(merged[0].pinned, true);
    });

    it('handles readingList and notes payloads in Vercel Serverless Sync API (website/api/sync.js)', async () => {
      const syncApi = (await import('../../website/api/sync.js')).default;
      assert.equal(typeof syncApi.mergeReadingList, 'function');
      assert.equal(typeof syncApi.mergeNotes, 'function');

      // Test GET status check returns 1.29.0
      let statusCode = null;
      let jsonPayload = null;
      const fakeRes = {
        setHeader: () => {},
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { jsonPayload = data; return data; },
          };
        },
      };
      await syncApi({ method: 'GET', headers: {} }, fakeRes);
      assert.equal(statusCode, 200);
      assert.equal(jsonPayload?.version, '1.29.0');
    });

    it('reports readingListCount and notesCount in getSyncStats()', async () => {
      const syncModule = await import('../../src/main/sync.js');
      const stats = syncModule.syncService.getSyncStats();
      assert.ok('readingListCount' in stats);
      assert.ok('notesCount' in stats);
      assert.equal(typeof stats.readingListCount, 'number');
      assert.equal(typeof stats.notesCount, 'number');
    });

    it('reports syncReadingList and syncNotes in getStatus()', async () => {
      const syncModule = await import('../../src/main/sync.js');
      const status = syncModule.syncService.getStatus();
      assert.ok('syncReadingList' in status);
      assert.ok('syncNotes' in status);
    });
  });

  describe('Locales Consistency for v1.29.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    const requiredKeys = [
      'tabGroups.title',
      'tabGroups.description',
      'tabGroups.newGroupPlaceholder',
      'tabGroups.create',
      'tabGroups.defaultName',
      'tabGroups.noMatch',
      'tabGroups.empty',
      'tabGroups.renameHint',
      'tabGroups.tab',
      'tabGroups.tabs',
      'tabGroups.stashGroup',
      'tabGroups.stash',
      'tabGroups.closeTabs',
      'tabGroups.close',
      'tabGroups.deleteGroup',
      'tabGroups.ungroupTab',
      'tabGroups.ungroup',
      'commandPalette.tabGroups',
      'commandPalette.searchExportJson',
      'commandPalette.searchImportJson',
      'menu.tabGroups',
      'menu.manageGroups',
      'account.syncReadingList',
      'account.syncReadingListDesc',
      'account.syncNotes',
      'account.syncNotesDesc',
      'account.readingListSynced',
      'account.notesSynced',
      'settings.account.syncReadingList',
      'settings.account.syncReadingListDesc',
      'settings.account.syncNotes',
      'settings.account.syncNotesDesc',
      'toast.noTabsInGroupToStash',
      'toast.groupStashed',
      'toast.groupCreated',
      'toast.groupTabsClosed',
      'toast.groupDeleted',
      'toast.searchEnginesExported',
      'toast.searchEnginesImported',
      'toast.searchEnginesImportInvalid',
    ];

    function deepGet(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    for (const key of requiredKeys) {
      it(`defines key path "${key}" in both en.json and de.json`, () => {
        const valEn = deepGet(en, key);
        const valDe = deepGet(de, key);
        assert.ok(valEn, `Missing "${key}" in en.json`);
        assert.ok(valDe, `Missing "${key}" in de.json`);
      });
    }
  });

  describe('Official Documentation & Release Automation Completeness', () => {
    it('documents Tab Groups Studio in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Tab Groups Studio'));
      assert.ok(guide.includes('Search quickly &amp; Custom Engines'));
    });

    it('updates website/index.html to v1.29.0 release badge and download link', () => {
      const html = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(html.includes('v1.29.0 · Latest Release'));
      assert.ok(html.includes('Hinterland-Setup-1.29.0.exe'));
    });

    it('configures releaseType: release in package.json publish config', () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
      assert.equal(pkg.build?.publish?.releaseType, 'release');
    });

    it('ensures release workflow automatically publishes releases via gh release edit', () => {
      const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
      assert.ok(workflow.includes('Publish GitHub Release'));
      assert.ok(workflow.includes('gh release edit "$TAG" --draft=false'));
    });
  });
});
