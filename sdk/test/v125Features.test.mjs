import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.25.0 Features & Polish', () => {
  describe('Preload Bridge API Completeness (chrome.cjs)', () => {
    const chromeCjsPath = join(ROOT, 'src', 'preload', 'chrome.cjs');
    const source = readFileSync(chromeCjsPath, 'utf8');

    it('declares getAll, exportJson, and importJson on history bridge', () => {
      assert.ok(source.includes("getAll: () => ipcRenderer.invoke('history:getAll')"));
      assert.ok(source.includes("exportJson: () => ipcRenderer.invoke('history:exportJson')"));
      assert.ok(source.includes("importJson: () => ipcRenderer.invoke('history:importJson')"));
    });

    it('declares exportJson, importJson, and deduplicate on bookmarks bridge', () => {
      assert.ok(source.includes("exportJson: (items) => ipcRenderer.invoke('bookmarks:exportJson', items)"));
      assert.ok(source.includes("importJson: () => ipcRenderer.invoke('bookmarks:importJson')"));
      assert.ok(source.includes("deduplicate: () => ipcRenderer.invoke('bookmarks:deduplicate')"));
    });

    it('declares clearCompleted on downloads bridge', () => {
      assert.ok(source.includes("clearCompleted: () => ipcRenderer.invoke('downloads:clearCompleted')"));
    });
  });

  describe('Main IPC Handlers Wiring (src/main/ipc.js)', () => {
    const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');

    it('registers history:getAll, history:exportJson, and history:importJson handlers', () => {
      assert.ok(ipcSource.includes("handle('history:getAll'"));
      assert.ok(ipcSource.includes("handle('history:exportJson'"));
      assert.ok(ipcSource.includes("handle('history:importJson'"));
    });

    it('registers bookmarks:exportJson, bookmarks:importJson, and bookmarks:deduplicate handlers', () => {
      assert.ok(ipcSource.includes("handle('bookmarks:exportJson'"));
      assert.ok(ipcSource.includes("handle('bookmarks:importJson'"));
      assert.ok(ipcSource.includes("handle('bookmarks:deduplicate'"));
    });

    it('registers downloads:clearCompleted handler', () => {
      assert.ok(ipcSource.includes("handle('downloads:clearCompleted'"));
    });
  });

  describe('History Store & Import Merging Logic', () => {
    function simulateHistoryImport(existingEntries, rawEntries, limit = 5000) {
      const entries = [...existingEntries];
      const list = Array.isArray(rawEntries) ? rawEntries : (rawEntries?.entries || []);
      let added = 0;
      let updated = 0;

      for (const item of list) {
        if (!item || typeof item.url !== 'string') continue;
        const url = item.url.trim();
        if (url.length < 4 || url.startsWith('about:') || !(url.startsWith('http://') || url.startsWith('https://') || url.startsWith('hinterland://'))) {
          continue;
        }
        const title = String(item.title || url).slice(0, 300);
        const time = Number(item.time) || Date.now();
        const visits = Math.max(1, Math.floor(Number(item.visits) || 1));

        const existing = entries.find((e) => e.url === url);
        if (existing) {
          existing.visits = (Number(existing.visits) || 1) + visits;
          if (time > (existing.time || 0)) {
            existing.time = time;
            if (title && title !== url) existing.title = title;
          }
          updated++;
        } else {
          entries.push({ url, title, time, visits });
          added++;
        }
      }

      entries.sort((a, b) => (b.time || 0) - (a.time || 0));
      if (entries.length > limit) entries.length = limit;
      return { entries, count: entries.length, added, updated };
    }

    it('validates incoming history URLs and rejects invalid protocols or short URLs', () => {
      const raw = [
        { url: 'https://hinterland.example.org', title: 'Hinterland Browser' },
        { url: 'about:blank', title: 'Blank' },
        { url: 'javascript:void(0)', title: 'XSS' },
        { url: 'http://foo.bar', title: 'Foo Bar' },
      ];
      const result = simulateHistoryImport([], raw);
      assert.equal(result.count, 2);
      assert.equal(result.added, 2);
      assert.equal(result.entries[0].url, 'https://hinterland.example.org');
      assert.equal(result.entries[1].url, 'http://foo.bar');
    });

    it('merges duplicate URLs by accumulating visit counts and updating latest time', () => {
      const existing = [
        { url: 'https://example.com/docs', title: 'Docs Old', time: 1000, visits: 2 },
      ];
      const imported = [
        { url: 'https://example.com/docs', title: 'Docs New', time: 2000, visits: 3 },
      ];
      const result = simulateHistoryImport(existing, imported);
      assert.equal(result.count, 1);
      assert.equal(result.added, 0);
      assert.equal(result.updated, 1);
      assert.equal(result.entries[0].visits, 5);
      assert.equal(result.entries[0].time, 2000);
      assert.equal(result.entries[0].title, 'Docs New');
    });

    it('caps total imported entries at limit', () => {
      const bulk = Array.from({ length: 60 }, (_, i) => ({
        url: `https://site${i}.org`,
        title: `Site ${i}`,
        time: 1000 + i,
      }));
      const result = simulateHistoryImport([], bulk, 25);
      assert.equal(result.count, 25);
      assert.equal(result.entries[0].url, 'https://site59.org');
    });
  });

  describe('Bookmarks Deduplication & JSON Portability', () => {
    function deduplicateBookmarks(list) {
      const seen = new Set();
      const deduplicated = [];
      let removed = 0;

      for (const item of list) {
        if (!item || !item.url) continue;
        const normalized = String(item.url).trim().replace(/\/+$/, '').toLowerCase();
        if (seen.has(normalized)) {
          removed++;
        } else {
          seen.add(normalized);
          deduplicated.push(item);
        }
      }
      return { deduplicated, removed };
    }

    it('removes duplicate bookmark entries and normalizes trailing slashes', () => {
      const input = [
        { title: 'Home', url: 'https://example.com/' },
        { title: 'Blog', url: 'https://example.com/blog' },
        { title: 'Home Dup', url: 'https://example.com' },
        { title: 'Docs', url: 'https://example.com/docs/' },
        { title: 'Blog Dup', url: 'https://EXAMPLE.com/blog/' },
      ];
      const { deduplicated, removed } = deduplicateBookmarks(input);
      assert.equal(removed, 2);
      assert.equal(deduplicated.length, 3);
      assert.equal(deduplicated[0].title, 'Home');
      assert.equal(deduplicated[1].title, 'Blog');
      assert.equal(deduplicated[2].title, 'Docs');
    });
  });

  describe('Downloads Clear Completed Logic', () => {
    function clearCompleted(stored) {
      const kept = stored.filter((item) => item.state !== 'completed');
      const clearedCount = stored.length - kept.length;
      return { kept, clearedCount };
    }

    it('clears completed downloads while preserving active and interrupted ones', () => {
      const downloads = [
        { id: '1', filename: 'app.exe', state: 'completed', ok: true },
        { id: '2', filename: 'archive.zip', state: 'progressing', ok: true },
        { id: '3', filename: 'video.mp4', state: 'interrupted', ok: false },
        { id: '4', filename: 'doc.pdf', state: 'completed', ok: true },
      ];
      const { kept, clearedCount } = clearCompleted(downloads);
      assert.equal(clearedCount, 2);
      assert.equal(kept.length, 2);
      assert.equal(kept[0].id, '2');
      assert.equal(kept[1].id, '3');
    });
  });

  describe('History Timeline Filtering Logic', () => {
    function partitionHistory(entries, referenceTime = new Date('2026-11-07T18:00:00Z').getTime()) {
      const now = new Date(referenceTime);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

      const today = [];
      const yesterday = [];
      const older = [];

      for (const entry of entries) {
        const t = entry.time || 0;
        if (t >= startOfToday) today.push(entry);
        else if (t >= startOfYesterday && t < startOfToday) yesterday.push(entry);
        else older.push(entry);
      }
      return { today, yesterday, older };
    }

    it('partitions history entries into today, yesterday, and older timelines', () => {
      const ref = new Date('2026-11-07T18:00:00Z').getTime();
      const todayTime = new Date('2026-11-07T12:00:00Z').getTime();
      const yesterdayTime = new Date('2026-11-06T14:00:00Z').getTime();
      const olderTime = new Date('2026-11-01T10:00:00Z').getTime();

      const sample = [
        { url: 'https://site1.org', time: todayTime },
        { url: 'https://site2.org', time: yesterdayTime },
        { url: 'https://site3.org', time: olderTime },
      ];

      const { today, yesterday, older } = partitionHistory(sample, ref);
      assert.equal(today.length, 1);
      assert.equal(today[0].url, 'https://site1.org');
      assert.equal(yesterday.length, 1);
      assert.equal(yesterday[0].url, 'https://site2.org');
      assert.equal(older.length, 1);
      assert.equal(older[0].url, 'https://site3.org');
    });
  });

  describe('UI Panel Controls & Command Palette Integration', () => {
    const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
    const cmdSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

    it('panels.js exposes history export/import buttons and timeline filters', () => {
      assert.ok(panelsSource.includes("history.exportJson"));
      assert.ok(panelsSource.includes("history.importJson"));
      assert.ok(panelsSource.includes("history.filterAll"));
      assert.ok(panelsSource.includes("history.filterToday"));
      assert.ok(panelsSource.includes("history.entriesCount"));
    });

    it('panels.js exposes bookmarks exportJson, importJson, and deduplicate buttons', () => {
      assert.ok(panelsSource.includes("bookmarks.exportJson"));
      assert.ok(panelsSource.includes("bookmarks.importJson"));
      assert.ok(panelsSource.includes("bookmarks.deduplicate"));
    });

    it('panels.js downloads panel includes clearCompleted button', () => {
      assert.ok(panelsSource.includes("downloads.clearCompleted"));
    });

    it('commandPalette.js registers new v1.25 commands', () => {
      assert.ok(cmdSource.includes("id: 'historyExport'"));
      assert.ok(cmdSource.includes("id: 'historyImport'"));
      assert.ok(cmdSource.includes("id: 'bookmarksExportJson'"));
      assert.ok(cmdSource.includes("id: 'bookmarksImportJson'"));
      assert.ok(cmdSource.includes("id: 'bookmarksDeduplicate'"));
      assert.ok(cmdSource.includes("id: 'downloadsClearCompleted'"));
      assert.ok(cmdSource.includes("id: 'clearRecentlyClosed'"));
    });
  });

  describe('User Guide Documentation & Locales Synchronization', () => {
    const guideSource = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    it('user guide documents Bookmarks duplicate cleaning, History timeline, and Downloads', () => {
      assert.ok(guideSource.includes('Bookmarks &amp; Portability'));
      assert.ok(guideSource.includes('Browsing History &amp; Timeline Filters'));
      assert.ok(guideSource.includes('Downloads Management'));
    });

    it('synchronizes all new v1.25 keys between en.json and de.json', () => {
      const keys = [
        ['history', 'exportJson'],
        ['history', 'importJson'],
        ['history', 'filterAll'],
        ['history', 'filterToday'],
        ['history', 'filterYesterday'],
        ['history', 'filterOlder'],
        ['history', 'entriesCount'],
        ['bookmarks', 'exportJson'],
        ['bookmarks', 'importJson'],
        ['bookmarks', 'deduplicate'],
        ['downloads', 'clearCompleted'],
        ['commandPalette', 'historyExport'],
        ['commandPalette', 'historyImport'],
        ['commandPalette', 'bookmarksExportJson'],
        ['commandPalette', 'bookmarksImportJson'],
        ['commandPalette', 'bookmarksDeduplicate'],
        ['commandPalette', 'downloadsClearCompleted'],
        ['commandPalette', 'clearRecentlyClosed'],
        ['toast', 'historyExported'],
        ['toast', 'historyImported'],
        ['toast', 'bookmarksNoNew'],
        ['toast', 'bookmarksDeduplicated'],
        ['toast', 'bookmarksNoDuplicates'],
        ['toast', 'downloadsCompletedCleared'],
        ['toast', 'recentlyClosedCleared'],
      ];

      for (const [section, prop] of keys) {
        assert.ok(en[section]?.[prop], `en.json missing ${section}.${prop}`);
        assert.ok(de[section]?.[prop], `de.json missing ${section}.${prop}`);
      }
    });
  });
});
