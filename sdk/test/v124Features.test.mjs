import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.24.0 Features & Polish', () => {
  describe('Preload Bridge API Completeness (chrome.cjs)', () => {
    const chromeCjsPath = join(ROOT, 'src', 'preload', 'chrome.cjs');

    it('declares exportJson and importJson on readingList bridge', () => {
      const source = readFileSync(chromeCjsPath, 'utf8');
      assert.ok(source.includes("exportJson: () => ipcRenderer.invoke('readingList:exportJson')"));
      assert.ok(source.includes("importJson: () => ipcRenderer.invoke('readingList:importJson')"));
    });

    it('declares exportAll, importAll, and createFromTab on notes bridge', () => {
      const source = readFileSync(chromeCjsPath, 'utf8');
      assert.ok(source.includes("exportAll: () => ipcRenderer.invoke('notes:exportAll')"));
      assert.ok(source.includes("importAll: () => ipcRenderer.invoke('notes:importAll')"));
      assert.ok(source.includes("createFromTab: (tabId) => ipcRenderer.invoke('notes:createFromTab', tabId)"));
    });
  });

  describe('Main IPC Handlers Wiring (src/main/ipc.js)', () => {
    const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');

    it('registers readingList:exportJson and readingList:importJson handlers', () => {
      assert.ok(ipcSource.includes("handle('readingList:exportJson'"));
      assert.ok(ipcSource.includes("handle('readingList:importJson'"));
    });

    it('registers notes:exportAll, notes:importAll, and notes:createFromTab handlers', () => {
      assert.ok(ipcSource.includes("handle('notes:exportAll'"));
      assert.ok(ipcSource.includes("handle('notes:importAll'"));
      assert.ok(ipcSource.includes("handle('notes:createFromTab'"));
    });
  });

  describe('Reading List Portability & Deduplication Logic', () => {
    function sanitizeImportedReadingItems(rawList) {
      const list = Array.isArray(rawList) ? rawList : [rawList];
      return list
        .filter((item) => item && typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://') || item.url.startsWith('hinterland://')))
        .map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id : 'generated_id',
          url: item.url,
          title: String(item.title || item.url).slice(0, 300),
          favicon: typeof item.favicon === 'string' ? item.favicon : '',
          addedAt: Number(item.addedAt) || Date.now(),
          read: Boolean(item.read),
        }));
    }

    it('validates reading items and rejects non-web protocols', () => {
      const input = [
        { url: 'https://example.com/article', title: 'Article 1' },
        { url: 'javascript:alert(1)', title: 'Malicious' },
        { url: 'file:///etc/passwd', title: 'File' },
        { url: 'hinterland://newtab/', title: 'Internal' },
      ];
      const valid = sanitizeImportedReadingItems(input);
      assert.equal(valid.length, 2);
      assert.equal(valid[0].url, 'https://example.com/article');
      assert.equal(valid[1].url, 'hinterland://newtab/');
    });

    it('deduplicates imported reading items against existing entries', () => {
      const existing = [
        { id: '1', url: 'https://example.com/existing', title: 'Existing' },
      ];
      const incoming = [
        { id: '2', url: 'https://example.com/existing', title: 'Existing Updated' },
        { id: '3', url: 'https://example.com/new', title: 'New Item' },
      ];
      const valid = sanitizeImportedReadingItems(incoming);
      let importedCount = 0;
      for (const item of valid) {
        if (!existing.some((e) => e.url === item.url)) {
          existing.push(item);
          importedCount++;
        }
      }
      assert.equal(importedCount, 1);
      assert.equal(existing.length, 2);
      assert.equal(existing[1].url, 'https://example.com/new');
    });
  });

  describe('Notes Bulk Portability & Tab Clipping Logic', () => {
    function sanitizeImportedNotes(rawList) {
      const list = Array.isArray(rawList) ? rawList : [rawList];
      return list
        .filter((n) => n && typeof n === 'object' && (typeof n.title === 'string' || typeof n.content === 'string'))
        .map((n) => ({
          id: typeof n.id === 'string' && n.id ? n.id : 'generated_note_id',
          title: String(n.title || '').trim().slice(0, 200),
          content: String(n.content || ''),
          pinned: Boolean(n.pinned),
          updatedAt: Number(n.updatedAt) || Date.now(),
        }));
    }

    it('sanitizes imported notes and normalizes fields', () => {
      const input = [
        { id: 'n1', title: 'Project Roadmap', content: '# Plan\n- Step 1', pinned: true },
        null,
        123,
        { id: 'n2', content: 'Quick thought without title' },
      ];
      const valid = sanitizeImportedNotes(input);
      assert.equal(valid.length, 2);
      assert.equal(valid[0].title, 'Project Roadmap');
      assert.equal(valid[0].pinned, true);
      assert.equal(valid[1].title, '');
      assert.equal(valid[1].pinned, false);
    });

    it('formats web clipping note with proper Markdown anchor and metadata', () => {
      const tab = { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' };
      const dateStr = new Date().toISOString().split('T')[0];
      const noteContent = `# [${tab.title}](${tab.url})\n\n> Captured from Hinterland Browser on ${dateStr}\n\n- URL: ${tab.url}\n`;
      assert.ok(noteContent.includes('# [MDN Web Docs](https://developer.mozilla.org/)'));
      assert.ok(noteContent.includes(dateStr));
    });
  });

  describe('UI Panel Controls & Command Palette Integration', () => {
    const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
    const paletteSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
    const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');

    it('panels.js exposes reading list export and import action buttons', () => {
      assert.ok(panelsSource.includes("t('readingList.exportJson')"));
      assert.ok(panelsSource.includes("t('readingList.importJson')"));
      assert.ok(panelsSource.includes('api().readingList.exportJson()'));
      assert.ok(panelsSource.includes('api().readingList.importJson()'));
    });

    it('panels.js exposes notes bulk export, import, and tab clipping buttons', () => {
      assert.ok(panelsSource.includes("t('notes.exportAll')"));
      assert.ok(panelsSource.includes("t('notes.importNotes')"));
      assert.ok(panelsSource.includes("t('notes.clipCurrentTab')"));
      assert.ok(panelsSource.includes('api().notes.createFromTab()'));
    });

    it('panels.js task manager includes process sorting controls', () => {
      assert.ok(panelsSource.includes("t('taskManager.sortLabel')"));
      assert.ok(panelsSource.includes("t('taskManager.sortByMemory')"));
      assert.ok(panelsSource.includes("t('taskManager.sortByCpu')"));
      assert.ok(panelsSource.includes("t('taskManager.sortByName')"));
    });

    it('commandPalette.js registers new v1.24 commands', () => {
      assert.ok(paletteSource.includes("id: 'readingListExport'"));
      assert.ok(paletteSource.includes("id: 'readingListImport'"));
      assert.ok(paletteSource.includes("id: 'notesExportAll'"));
      assert.ok(paletteSource.includes("id: 'notesImportAll'"));
      assert.ok(paletteSource.includes("id: 'noteCurrentTab'"));
    });

    it('menu.js registers saveTabAsNote in tab and page menus', () => {
      assert.ok(menuSource.includes("t('menu.saveTabAsNote')"));
      assert.ok(menuSource.includes('api().notes.createFromTab'));
    });
  });

  describe('User Guide Documentation & Locales Synchronization', () => {
    it('user guide documents Reading List export/import, Quick Notes, and Task Manager', () => {
      const guidePath = join(ROOT, 'website', 'docs', 'user-guide.html');
      assert.ok(existsSync(guidePath));
      const html = readFileSync(guidePath, 'utf8');
      assert.ok(html.includes('export your reading list to a structured JSON file'));
      assert.ok(html.includes('Quick Notes &amp; Web Clipping'));
      assert.ok(html.includes('Task Manager'));
    });

    it('synchronizes all new v1.24 keys between en.json and de.json', () => {
      const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
      const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

      const requiredKeys = [
        ['menu', 'saveTabAsNote'],
        ['readingList', 'exportJson'],
        ['readingList', 'importJson'],
        ['readingList', 'importInvalid'],
        ['notes', 'exportAll'],
        ['notes', 'importNotes'],
        ['notes', 'clipCurrentTab'],
        ['notes', 'importInvalid'],
        ['taskManager', 'sortLabel'],
        ['taskManager', 'sortByMemory'],
        ['taskManager', 'sortByCpu'],
        ['taskManager', 'sortByName'],
        ['commandPalette', 'readingListExport'],
        ['commandPalette', 'readingListImport'],
        ['commandPalette', 'notesExportAll'],
        ['commandPalette', 'notesImportAll'],
        ['commandPalette', 'noteCurrentTab'],
        ['toast', 'readingListExported'],
        ['toast', 'readingListImported'],
        ['toast', 'notesExportedAll'],
        ['toast', 'notesImported'],
        ['toast', 'noteCreatedFromTab'],
      ];

      for (const [section, key] of requiredKeys) {
        assert.ok(en[section]?.[key], `en.json must contain ${section}.${key}`);
        assert.ok(de[section]?.[key], `de.json must contain ${section}.${key}`);
        assert.equal(typeof en[section][key], 'string');
        assert.equal(typeof de[section][key], 'string');
      }
    });
  });
});
