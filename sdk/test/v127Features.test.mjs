import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.27.0 Features & Polish', () => {
  describe('Preload Bridge API Completeness (chrome.cjs)', () => {
    const chromeCjsPath = join(ROOT, 'src', 'preload', 'chrome.cjs');
    const source = readFileSync(chromeCjsPath, 'utf8');

    it('declares allEngines, addEngine, removeEngine, setDefault, and resetEngines on search bridge', () => {
      assert.ok(source.includes("allEngines: () => ipcRenderer.invoke('search:allEngines')"));
      assert.ok(source.includes("addEngine: (engine) => ipcRenderer.invoke('search:addEngine', engine)"));
      assert.ok(source.includes("removeEngine: (id) => ipcRenderer.invoke('search:removeEngine', id)"));
      assert.ok(source.includes("setDefault: (id) => ipcRenderer.invoke('search:setDefault', id)"));
      assert.ok(source.includes("resetEngines: () => ipcRenderer.invoke('search:resetEngines')"));
    });

    it('declares resetAllPermissions, clearOriginPermissions, allShieldExceptions, removeShieldException, and resetAllShieldExceptions on site bridge', () => {
      assert.ok(source.includes("resetAllPermissions: () => ipcRenderer.invoke('site:resetAllPermissions')"));
      assert.ok(source.includes("clearOriginPermissions: (origin) => ipcRenderer.invoke('site:clearOriginPermissions', origin)"));
      assert.ok(source.includes("allShieldExceptions: () => ipcRenderer.invoke('site:allShieldExceptions')"));
      assert.ok(source.includes("removeShieldException: (domain) => ipcRenderer.invoke('site:removeShieldException', domain)"));
      assert.ok(source.includes("resetAllShieldExceptions: () => ipcRenderer.invoke('site:resetAllShieldExceptions')"));
    });
  });

  describe('Main IPC Handlers Wiring (src/main/ipc.js)', () => {
    const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');

    it('registers search management IPC handlers', () => {
      assert.ok(ipcSource.includes("handle('search:allEngines'"));
      assert.ok(ipcSource.includes("handle('search:addEngine'"));
      assert.ok(ipcSource.includes("handle('search:removeEngine'"));
      assert.ok(ipcSource.includes("handle('search:setDefault'"));
      assert.ok(ipcSource.includes("handle('search:resetEngines'"));
    });

    it('registers site permissions and shield exception IPC handlers', () => {
      assert.ok(ipcSource.includes("handle('site:resetAllPermissions'"));
      assert.ok(ipcSource.includes("handle('site:clearOriginPermissions'"));
      assert.ok(ipcSource.includes("handle('site:allShieldExceptions'"));
      assert.ok(ipcSource.includes("handle('site:removeShieldException'"));
      assert.ok(ipcSource.includes("handle('site:resetAllShieldExceptions'"));
    });
  });

  describe('Find in Page Power Search UI & Logic', () => {
    const htmlSource = readFileSync(join(ROOT, 'src', 'ui', 'index.html'), 'utf8');
    const cssSource = readFileSync(join(ROOT, 'src', 'ui', 'css', 'chrome.css'), 'utf8');
    const findSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'find.js'), 'utf8');

    it('declares Match Case and Whole Word toggle buttons in index.html', () => {
      assert.ok(htmlSource.includes('id="findMatchCase"'));
      assert.ok(htmlSource.includes('id="findWholeWord"'));
      assert.ok(htmlSource.includes('class="findToggle"'));
    });

    it('styles findToggle and findToggle.active in chrome.css', () => {
      assert.ok(cssSource.includes('.findToggle'));
      assert.ok(cssSource.includes('.findToggle.active'));
    });

    it('implements toggleMatchCase and toggleWholeWord with keyboard shortcuts in find.js', () => {
      assert.ok(findSource.includes('export function toggleMatchCase'));
      assert.ok(findSource.includes('export function toggleWholeWord'));
      assert.ok(findSource.includes('export function getFindOptions'));
      assert.ok(findSource.includes("event.altKey && (event.key === 'c' || event.key === 'C')"));
      assert.ok(findSource.includes("event.altKey && (event.key === 'w' || event.key === 'W')"));
    });
  });

  describe('Site Permissions & Shields Dashboard Panel', () => {
    const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
    const appSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'app.js'), 'utf8');
    const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
    const paletteSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');
    const settingsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'settingspanel.js'), 'utf8');

    it('exports openSitePermissions in panels.js with tabbed subnavigation and reset controls', () => {
      assert.ok(panelsSource.includes('export function openSitePermissions()'));
      assert.ok(panelsSource.includes('sitePermissions.tabPermissions'));
      assert.ok(panelsSource.includes('sitePermissions.tabShields'));
      assert.ok(panelsSource.includes('api().site.resetAllPermissions()'));
      assert.ok(panelsSource.includes('api().site.resetAllShieldExceptions()'));
      assert.ok(panelsSource.includes('api().site.clearOriginPermissions'));
      assert.ok(panelsSource.includes('api().site.removeShieldException'));
    });

    it('registers sitePermissions in PANELS router in app.js', () => {
      assert.ok(appSource.includes('sitePermissions: openSitePermissions'));
    });

    it('registers sitePermissions in Main Menu and Settings Privacy section', () => {
      assert.ok(menuSource.includes("panel: 'sitePermissions'"));
      assert.ok(settingsSource.includes("panel: 'sitePermissions'"));
    });

    it('registers sitePermissions and searchSetDefault commands in Command Palette', () => {
      assert.ok(paletteSource.includes("id: 'sitePermissions'"));
      assert.ok(paletteSource.includes("id: 'searchSetDefault'"));
    });
  });

  describe('Search Engine Management Logic', () => {
    function simulateAddEngine(currentList, { name, url, shortcut }) {
      const cleanName = (name || '').trim();
      let cleanUrl = (url || '').trim();
      if (!cleanName || !cleanUrl) return { ok: false, error: 'name_and_url_required' };
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return { ok: false, error: 'invalid_protocol' };
      }
      if (!cleanUrl.includes('{q}')) {
        cleanUrl = cleanUrl.includes('?') ? `${cleanUrl}&q={q}` : `${cleanUrl}?q={q}`;
      }
      const cleanShortcut = (shortcut || '').trim();
      const id = `eng_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const newEngine = {
        id,
        name: cleanName,
        url: cleanUrl,
        shortcut: cleanShortcut ? (cleanShortcut.startsWith('@') ? cleanShortcut : `@${cleanShortcut}`) : '',
        enabled: true,
      };
      return { ok: true, engine: newEngine, list: [...currentList, newEngine] };
    }

    it('validates protocol and automatically formats {q} placeholder when missing', () => {
      const initial = [{ id: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={q}' }];
      const invalid = simulateAddEngine(initial, { name: 'Bad', url: 'ftp://bad.com' });
      assert.strictEqual(invalid.ok, false);

      const added = simulateAddEngine(initial, { name: 'Ecosia', url: 'https://www.ecosia.org/search?q={q}', shortcut: 'e' });
      assert.strictEqual(added.ok, true);
      assert.strictEqual(added.engine.shortcut, '@e');
      assert.strictEqual(added.list.length, 2);

      const autoPlaceholder = simulateAddEngine(initial, { name: 'Brave', url: 'https://search.brave.com/search' });
      assert.strictEqual(autoPlaceholder.ok, true);
      assert.ok(autoPlaceholder.engine.url.includes('{q}'));
    });
  });

  describe('Locales Consistency for v1.27.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    const requiredKeys = [
      'find.matchCase',
      'find.wholeWord',
      'sitePermissions.title',
      'sitePermissions.description',
      'sitePermissions.tabPermissions',
      'sitePermissions.tabShields',
      'sitePermissions.searchPlaceholder',
      'sitePermissions.noPermissions',
      'sitePermissions.noShields',
      'sitePermissions.resetAllPerms',
      'sitePermissions.resetAllShields',
      'sitePermissions.revokeOrigin',
      'sitePermissions.enableShield',
      'sitePermissions.shieldPaused',
      'toast.allPermissionsReset',
      'toast.originPermissionsCleared',
      'toast.shieldExceptionRemoved',
      'toast.allShieldsReset',
      'toast.searchEngineAdded',
      'toast.searchEngineDefaultSet',
      'toast.searchEnginesReset',
      'toast.tabsMuted',
      'toast.tabsUnmuted',
      'commandPalette.sitePermissions',
      'commandPalette.searchSetDefault',
      'commandPalette.searchSetDefaultPrompt',
      'menu.sitePermissions',
      'settings.privacy.managePermissions',
    ];

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }

    for (const key of requiredKeys) {
      it(`defines key "${key}" in en.json and de.json`, () => {
        const enVal = getByPath(en, key);
        const deVal = getByPath(de, key);
        assert.ok(typeof enVal === 'string' && enVal.length > 0, `en.json missing "${key}"`);
        assert.ok(typeof deVal === 'string' && deVal.length > 0, `de.json missing "${key}"`);
      });
    }
  });

  describe('Official Documentation & User Guide Completeness', () => {
    const userGuide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
    const websiteIndex = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');

    it('documents Find in Page Power Search with Match Case and Whole Word shortcuts in user-guide.html', () => {
      assert.ok(userGuide.includes('Find in Page Power Search'));
      assert.ok(userGuide.includes('Match Case'));
      assert.ok(userGuide.includes('Match Whole Word'));
    });

    it('documents Site Permissions & Shields Dashboard in user-guide.html', () => {
      assert.ok(userGuide.includes('Site Permissions &amp; Shields Dashboard'));
    });

    it('documents Tab Sound & Audio Management in user-guide.html', () => {
      assert.ok(userGuide.includes('Tab Sound &amp; Audio Management'));
    });

    it('updates website/index.html to v1.27.0 release', () => {
      assert.ok(websiteIndex.includes('v1.27.0') || websiteIndex.includes('v1.28.0'));
      assert.ok(websiteIndex.includes('Hinterland-Setup-1.27.0.exe') || websiteIndex.includes('Hinterland-Setup-1.28.0.exe'));
    });
  });
});
