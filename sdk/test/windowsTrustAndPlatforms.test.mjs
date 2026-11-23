import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Windows Trust, Microsoft Store & Multi-Platform Distribution ($0)', () => {
  describe('Microsoft Store Auto-Updater Guard (src/main/main.js)', () => {
    it('disables third-party electron-updater inside Microsoft Store packages', () => {
      const mainSource = readFileSync(join(ROOT, 'src', 'main', 'main.js'), 'utf8');
      assert.ok(mainSource.includes('if (!app.isPackaged || process.windowsStore) return;'));
    });
  });

  describe('Microsoft Store AppX Configuration & Tile Assets', () => {
    const storeConfigPath = join(ROOT, 'build', 'electron-builder.store.json');

    it('declares a dedicated Store config targeting appx without reserved http/https schemes', () => {
      assert.ok(existsSync(storeConfigPath), 'build/electron-builder.store.json must exist');
      const cfg = JSON.parse(readFileSync(storeConfigPath, 'utf8'));
      const targets = (cfg.win?.target ?? []).map((t) => (typeof t === 'string' ? t : t.target));
      assert.ok(targets.includes('appx'), 'Store config must target appx');
      const schemes = (cfg.protocols ?? []).flatMap((p) => p.schemes ?? []);
      assert.ok(schemes.includes('hinterland'), 'Store config must retain hinterland scheme');
      assert.ok(!schemes.includes('http') && !schemes.includes('https'), 'Store AppX must not claim reserved http/https protocols');
      const exts = (cfg.fileAssociations ?? []).map((f) => f.ext);
      assert.ok(exts.includes('html') && exts.includes('htm'));
      assert.equal(cfg.win?.requestedExecutionLevel, 'asInvoker');
    });

    const requiredPngs = [
      'StoreLogo.png',
      'Square44x44Logo.png',
      'SmallTile.png',
      'Square150x150Logo.png',
      'LargeTile.png',
      'Wide310x150Logo.png',
      'SplashScreen.png',
    ];

    for (const file of requiredPngs) {
      it(`includes valid PNG asset build/appx/${file}`, () => {
        const assetPath = join(ROOT, 'build', 'appx', file);
        assert.ok(existsSync(assetPath), `Missing AppX asset ${assetPath}`);
        const buf = readFileSync(assetPath);
        assert.ok(buf.length > 500, `${file} is unexpectedly small`);
        assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${file} must have valid PNG magic header`);
      });
    }
  });

  describe('Package Metadata & Cross-Platform Targets (package.json)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

    it('preserves v1.39.0 release metadata and configures Windows, Store, Linux, and macOS scripts', () => {
      assert.equal(pkg.version, '1.39.0');
      assert.equal(pkg.homepage, 'https://hinterland-browser.vercel.app');
      assert.equal(pkg.repository?.type, 'git');
      assert.ok(pkg.scripts?.['dist:win']);
      assert.ok(pkg.scripts?.['dist:store']?.includes('build/electron-builder.store.json'));
      assert.ok(pkg.scripts?.['dist:linux']);
      assert.ok(pkg.scripts?.['dist:mac']);
    });

    it('sets non-elevated execution level, copyright, Linux AppImage/deb, and macOS dmg/zip without breaking unsigned updater', () => {
      assert.ok(pkg.build?.copyright);
      assert.equal(pkg.build?.win?.requestedExecutionLevel, 'asInvoker');
      assert.equal(pkg.build?.win?.publisherName, undefined, 'Must not set publisherName while EXE is unsigned');
      assert.ok(pkg.build?.linux?.target?.includes('AppImage'));
      assert.ok(pkg.build?.linux?.target?.includes('deb'));
      assert.ok(pkg.build?.mac?.target?.includes('dmg'));
      assert.ok(pkg.build?.mac?.target?.includes('zip'));
    });
  });

  describe('Privacy Policy, Licensing & SignPath Foundation Compliance', () => {
    it('provides THIRD_PARTY_NOTICES.md covering Hinterland, Electron, Chromium, Node, and electron-updater', () => {
      const notices = readFileSync(join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
      assert.ok(notices.includes('MIT'));
      assert.ok(notices.includes('Electron'));
      assert.ok(notices.includes('Chromium'));
      assert.ok(notices.includes('BSD-3-Clause'));
      assert.ok(notices.includes('electron-updater'));
    });

    it('provides SignPath code signing policy and required attribution in README and policy doc', () => {
      const policy = readFileSync(join(ROOT, 'docs', 'security', 'code-signing-policy.md'), 'utf8');
      const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
      const attribution = 'Free code signing provided by SignPath.io, certificate by SignPath Foundation';
      assert.ok(policy.includes(attribution));
      assert.ok(readme.includes(attribution));
      assert.ok(policy.includes('https://hinterland-browser.vercel.app/docs/privacy.html'));
    });

    it('provides Store-compliant privacy policy HTML linked from website/index.html', () => {
      const privacy = readFileSync(join(ROOT, 'website', 'docs', 'privacy.html'), 'utf8');
      const siteIndex = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(privacy.includes('Privacy Policy'));
      assert.ok(privacy.includes('AES-256-GCM'));
      assert.ok(privacy.includes('Microsoft Store'));
      assert.ok(siteIndex.includes('/docs/privacy.html'));
    });

    it('documents $0 Microsoft Store, SignPath, Defender submission, WinGet, Scoop, Chocolatey, Flathub, and macOS caveats in docs/distribution.md', () => {
      const doc = readFileSync(join(ROOT, 'docs', 'distribution.md'), 'utf8');
      assert.ok(doc.includes('https://storedeveloper.microsoft.com'));
      assert.ok(doc.includes('https://signpath.org'));
      assert.ok(doc.includes('https://www.microsoft.com/en-us/wdsi/filesubmission'));
      assert.ok(doc.includes('MS_STORE_IDENTITY_NAME'));
      assert.ok(doc.includes('packaging/winget'));
      assert.ok(doc.includes('packaging/flatpak'));
    });
  });

  describe('Package Manager Manifests (WinGet, Scoop, Chocolatey, Flathub)', () => {
    const SHA256_LOWER = 'ac5886afdb447eec7e1fa19f406971f382bd35ffb195e20ae3c1bf2fb68582b6';
    const SHA256_UPPER = SHA256_LOWER.toUpperCase();

    it('provides valid WinGet v1.6.0 manifests for v1.39.0', () => {
      const versionYaml = readFileSync(join(ROOT, 'packaging', 'winget', 'Hinterland.Hinterland.yaml'), 'utf8');
      const installerYaml = readFileSync(join(ROOT, 'packaging', 'winget', 'Hinterland.Hinterland.installer.yaml'), 'utf8');
      const enYaml = readFileSync(join(ROOT, 'packaging', 'winget', 'Hinterland.Hinterland.locale.en-US.yaml'), 'utf8');
      const deYaml = readFileSync(join(ROOT, 'packaging', 'winget', 'Hinterland.Hinterland.locale.de-DE.yaml'), 'utf8');

      assert.ok(versionYaml.includes('PackageIdentifier: Hinterland.Hinterland'));
      assert.ok(versionYaml.includes('PackageVersion: 1.39.0'));
      assert.ok(installerYaml.includes('InstallerType: nullsoft'));
      assert.ok(installerYaml.includes(`InstallerSha256: ${SHA256_UPPER}`));
      assert.ok(enYaml.includes('PrivacyUrl: https://hinterland-browser.vercel.app/docs/privacy.html'));
      assert.ok(deYaml.includes('PackageLocale: de-DE'));
    });

    it('provides valid Scoop manifest JSON with matching SHA-256 and autoupdate config', () => {
      const scoop = JSON.parse(readFileSync(join(ROOT, 'packaging', 'scoop', 'hinterland.json'), 'utf8'));
      assert.equal(scoop.version, '1.39.0');
      assert.equal(scoop.license, 'MIT');
      assert.equal(scoop.architecture['64bit'].hash, SHA256_LOWER);
      assert.ok(scoop.architecture['64bit'].url.includes('Hinterland-Setup-1.39.0.exe'));
      assert.equal(scoop.autoupdate.architecture['64bit'].url.includes('$version'), true);
    });

    it('provides Chocolatey nuspec, install/uninstall scripts, and verification doc', () => {
      const nuspec = readFileSync(join(ROOT, 'packaging', 'chocolatey', 'hinterland.nuspec'), 'utf8');
      const installPs1 = readFileSync(join(ROOT, 'packaging', 'chocolatey', 'tools', 'chocolateyinstall.ps1'), 'utf8');
      const uninstallPs1 = readFileSync(join(ROOT, 'packaging', 'chocolatey', 'tools', 'chocolateyuninstall.ps1'), 'utf8');
      const verification = readFileSync(join(ROOT, 'packaging', 'chocolatey', 'tools', 'VERIFICATION.txt'), 'utf8');

      assert.ok(nuspec.includes('<version>1.39.0</version>'));
      assert.ok(installPs1.includes(SHA256_LOWER));
      assert.ok(installPs1.includes('Install-ChocolateyPackage'));
      assert.ok(uninstallPs1.includes('Uninstall-ChocolateyPackage'));
      assert.ok(verification.includes(SHA256_LOWER));
    });

    it('provides Flathub AppStream metainfo, desktop entry, and Flatpak manifest', () => {
      const metainfo = readFileSync(join(ROOT, 'packaging', 'flatpak', 'de.hinterland.Browser.metainfo.xml'), 'utf8');
      const desktop = readFileSync(join(ROOT, 'packaging', 'flatpak', 'de.hinterland.Browser.desktop'), 'utf8');
      const flatpakYml = readFileSync(join(ROOT, 'packaging', 'flatpak', 'de.hinterland.Browser.yml'), 'utf8');

      assert.ok(metainfo.includes('<project_license>MIT</project_license>'));
      assert.ok(metainfo.includes('version="1.39.0"'));
      assert.ok(desktop.includes('Categories=Network;WebBrowser;'));
      assert.ok(flatpakYml.includes('org.electronjs.Electron2.BaseApp'));
      assert.ok(flatpakYml.includes('tag: v1.39.0'));
    });
  });

  describe('Release CI Workflow (.github/workflows/release.yml)', () => {
    const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');

    it('builds Store AppX, optional SignPath signing, SHA256SUMS, SLSA provenance, Linux, macOS, and optional WinGet', () => {
      assert.ok(workflow.includes('build/electron-builder.store.json'));
      assert.ok(workflow.includes('signpath/github-action-submit-signing-request@v3'));
      assert.ok(workflow.includes('SHA256SUMS-windows.txt'));
      assert.ok(workflow.includes('actions/attest-build-provenance@v2'));
      assert.ok(workflow.includes('build-linux:'));
      assert.ok(workflow.includes('build-macos:'));
      assert.ok(workflow.includes('CSC_IDENTITY_AUTO_DISCOVERY: false'));
      assert.ok(workflow.includes('publish-winget:'));
      assert.ok(workflow.includes('vedantmgoyal9/winget-releaser@v2'));
      assert.ok(workflow.includes('gh release edit "$TAG" --draft=false'));
    });
  });
});
