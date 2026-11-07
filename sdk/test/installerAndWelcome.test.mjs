import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hand-Tailored 1-Click Installer & Welcome Onboarding', () => {
  describe('Installer Configuration in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

    it('configures zero-prompt 1-click NSIS installation', () => {
      assert.ok(pkg.build, 'build section must exist');
      assert.ok(pkg.build.nsis, 'build.nsis section must exist');
      assert.strictEqual(pkg.build.nsis.oneClick, true, 'must be 1-click installer');
      assert.strictEqual(pkg.build.nsis.perMachine, false, 'must install to user profile (no admin rights needed)');
      assert.strictEqual(pkg.build.nsis.allowElevation, false, 'must not prompt for UAC elevation');
      assert.strictEqual(pkg.build.nsis.allowToChangeInstallationDirectory, false);
      assert.strictEqual(pkg.build.nsis.createDesktopShortcut, 'always');
      assert.strictEqual(pkg.build.nsis.createStartMenuShortcut, true);
      assert.strictEqual(pkg.build.nsis.runAfterFinish, true, 'must launch Hinterland right after install');
      assert.strictEqual(pkg.build.nsis.include, 'build/installer.nsh');
    });

    it('declares protocol schemes and file associations for web browsing', () => {
      const protocols = pkg.build.protocols || [];
      const schemes = protocols.flatMap(p => p.schemes || []);
      assert.ok(schemes.includes('http'), 'must register http scheme');
      assert.ok(schemes.includes('https'), 'must register https scheme');
      assert.ok(schemes.includes('hinterland'), 'must register hinterland scheme');

      const fileAssoc = pkg.build.fileAssociations || [];
      const exts = fileAssoc.flatMap(f => f.ext || []);
      assert.ok(exts.includes('html'), 'must register html file association');
      assert.ok(exts.includes('htm'), 'must register htm file association');
    });
  });

  describe('Tailored NSIS Integration Script (build/installer.nsh)', () => {
    const nshPath = join(ROOT, 'build', 'installer.nsh');

    it('installer.nsh script exists', () => {
      assert.ok(existsSync(nshPath), 'build/installer.nsh must exist');
    });

    it('contains customInstall macro registering Hinterland as a full Windows internet browser', () => {
      const script = readFileSync(nshPath, 'utf8');
      assert.ok(script.includes('!macro customInstall'));
      assert.ok(script.includes('Software\\Clients\\StartMenuInternet\\Hinterland'));
      assert.ok(script.includes('Capabilities'));
      assert.ok(script.includes('URLAssociations'));
      assert.ok(script.includes('FileAssociations'));
      assert.ok(script.includes('Software\\RegisteredApplications'));
    });

    it('contains customUnInstall macro cleaning up Windows registry associations', () => {
      const script = readFileSync(nshPath, 'utf8');
      assert.ok(script.includes('!macro customUnInstall'));
      assert.ok(script.includes('DeleteRegKey HKCU "Software\\Clients\\StartMenuInternet\\Hinterland"'));
      assert.ok(script.includes('DeleteRegValue HKCU "Software\\RegisteredApplications" "Hinterland"'));
    });
  });

  describe('Default Browser IPC & Preload APIs', () => {
    const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
    const chromePreload = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
    const pagePreload = readFileSync(join(ROOT, 'src', 'preload', 'page.cjs'), 'utf8');

    it('wires app:isDefaultBrowser and app:setDefaultBrowser in ipc.js', () => {
      assert.ok(ipcSource.includes("handle('app:isDefaultBrowser'"));
      assert.ok(ipcSource.includes("handle('app:setDefaultBrowser'"));
      assert.ok(ipcSource.includes("app.isDefaultProtocolClient('http')"));
      assert.ok(ipcSource.includes("app.setAsDefaultProtocolClient('http')"));
      assert.ok(ipcSource.includes("app.setAsDefaultProtocolClient('https')"));
    });

    it('exposes default browser methods on chrome.cjs bridge', () => {
      assert.ok(chromePreload.includes("isDefaultBrowser: () => ipcRenderer.invoke('app:isDefaultBrowser')"));
      assert.ok(chromePreload.includes("setDefaultBrowser: () => ipcRenderer.invoke('app:setDefaultBrowser')"));
    });

    it('exposes default browser methods on page.cjs hinterlandPage bridge', () => {
      assert.ok(pagePreload.includes("isDefaultBrowser: () => ipcRenderer.invoke('app:isDefaultBrowser')"));
      assert.ok(pagePreload.includes("setDefaultBrowser: () => ipcRenderer.invoke('app:setDefaultBrowser')"));
    });
  });

  describe('Welcome Card Onboarding on New Tab Page', () => {
    const newtabHtml = readFileSync(join(ROOT, 'src', 'ui', 'newtab.html'), 'utf8');
    const newtabJs = readFileSync(join(ROOT, 'src', 'ui', 'js', 'newtab.js'), 'utf8');
    const newtabCss = readFileSync(join(ROOT, 'src', 'ui', 'css', 'newtab.css'), 'utf8');

    it('declares welcomeCard DOM elements in newtab.html', () => {
      assert.ok(newtabHtml.includes('id="welcomeCard"'));
      assert.ok(newtabHtml.includes('welcomeBadge'));
      assert.ok(newtabHtml.includes('id="welcomeSetDefault"'));
      assert.ok(newtabHtml.includes('id="welcomeOpenGuide"'));
      assert.ok(newtabHtml.includes('id="welcomeDismiss"'));
    });

    it('implements paintWelcomeCard() in newtab.js with first-run detection', () => {
      assert.ok(newtabJs.includes('function paintWelcomeCard()'));
      assert.ok(newtabJs.includes('general.hasRunBefore'));
      assert.ok(newtabJs.includes('welcomeSetDefault'));
      assert.ok(newtabJs.includes('welcomeOpenGuide'));
      assert.ok(newtabJs.includes('welcomeDismiss'));
    });

    it('styles welcomeCard with smooth animations and responsive grid', () => {
      assert.ok(newtabCss.includes('.welcomeCard'));
      assert.ok(newtabCss.includes('.welcomeBadge'));
      assert.ok(newtabCss.includes('.welcomePillars'));
      assert.ok(newtabCss.includes('.welcomePillar'));
      assert.ok(newtabCss.includes('.welcomeActions'));
    });
  });

  describe('Settings Panel Enhancements', () => {
    const settingsJs = readFileSync(join(ROOT, 'src', 'ui', 'js', 'settingspanel.js'), 'utf8');

    it('includes default browser check & set button in settingspanel.js', () => {
      assert.ok(settingsJs.includes('api().app.setDefaultBrowser()'));
      assert.ok(settingsJs.includes('settings.general.setDefaultBrowser'));
    });
  });

  describe('Locales Consistency for Onboarding & Default Browser', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    const requiredKeys = [
      'welcome.title',
      'welcome.subtitle',
      'welcome.featPrivacyTitle',
      'welcome.featPrivacyDesc',
      'welcome.featSpeedTitle',
      'welcome.featSpeedDesc',
      'welcome.featCustomTitle',
      'welcome.featCustomDesc',
      'welcome.btnDefault',
      'welcome.btnGuide',
      'welcome.btnDismiss',
      'welcome.isDefault',
      'toast.defaultBrowserSet',
      'settings.general.setDefaultBrowser',
      'settings.general.setDefaultBrowserDesc',
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

  describe('Documentation & Website Installer Integration', () => {
    const siteIndex = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
    const userGuide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');

    it('highlights 1-click tailored setup banner in website/index.html', () => {
      assert.ok(siteIndex.includes('install-banner'));
      assert.ok(siteIndex.includes('1-Click Download'));
      assert.ok(siteIndex.includes('Instant Setup'));
      assert.ok(siteIndex.includes('Ready to Browse'));
    });

    it('documents zero-prompt install & default browser setup in user-guide.html', () => {
      assert.ok(userGuide.includes('Streamlined 1-click installation'));
      assert.ok(userGuide.includes('First run &amp; Default Browser') || userGuide.includes('First run & Default Browser'));
      assert.ok(userGuide.includes('Hinterland-Setup.exe'));
    });
  });
});
