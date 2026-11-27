import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Settings } from '../../src/main/settings.js';
import { ecosystem } from '../../src/ui/js/ecosystem.js';

test('the Horizon theme adopts the old default palette while preserving custom themes', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'horizon-default-theme-'));
  const file = join(folder, 'settings.json');
  const appearance = {
    accent: '#4f7cff', accentContrast: '#ffffff',
    darkBackground: '#12141a', darkSurface: '#1a1d26', darkText: '#e6e9f2',
    lightBackground: '#f2f3f7', lightSurface: '#ffffff', lightText: '#161923',
    radius: 18,
  };
  try {
    await writeFile(file, JSON.stringify({ appearance, general: { language: 'de' } }));
    const settings = new Settings(file);
    settings.load();
    assert.equal(settings.value('appearance.darkBackground'), '#090909');
    assert.equal(settings.value('appearance.accent'), '#bdbdbd');
    assert.equal(settings.value('appearance.radius'), 18);
    assert.equal(settings.value('general.language'), 'de');
    assert.equal(settings.value('general.hasRunBefore'), true);

    appearance.accent = '#7258a0';
    await writeFile(file, JSON.stringify({ appearance }));
    const customized = new Settings(file);
    customized.load();
    assert.equal(customized.value('appearance.accent'), '#7258a0');
    assert.equal(customized.value('appearance.darkBackground'), '#12141a');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('the ecosystem opens the official Neocrom routes with localized labels', async () => {
  assert.deepEqual(ecosystem.map(item => item.url), [
    'https://neocrom.pro/#store', 'https://neocrom.pro/#community',
    'https://neocrom.pro/#library', 'https://neocrom.pro/#pulse',
  ]);
  for (const language of ['de', 'en']) {
    const { ecosystem: labels } = JSON.parse(await readFile(new URL(`../../src/ui/locales/${language}.json`, import.meta.url), 'utf8'));
    for (const { id } of ecosystem) {
      assert.ok(labels[id]);
      assert.ok(labels[id + 'Description']);
    }
  }
});

test('legacy Hinterland settings migrate cleanly into Neocrom Horizon defaults', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'horizon-legacy-migration-'));
  const file = join(folder, 'settings.json');
  try {
    await writeFile(file, JSON.stringify({
      general: { homepage: 'hinterland://store' },
      account: { provider: 'hinterland', serverUrl: 'https://hinterland-browser.vercel.app/api/sync' },
      extensions: { enabled: ['hinterlandfocus', 'hinterlandpanel', 'hinterlandpass'] },
      store: { activeThemeId: 'midnight' },
    }));
    const settings = new Settings(file);
    settings.load();
    assert.equal(settings.value('general.homepage'), 'horizon://store');
    assert.equal(settings.value('account.provider'), 'horizon');
    assert.equal(settings.value('account.serverUrl'), '');
    assert.deepEqual(settings.value('extensions.enabled'), ['horizonfocus', 'horizonpanel', 'horizonpass']);
    assert.equal(settings.value('store.activeThemeId'), 'neocrom');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('design tokens stay synchronized between design/ and website/ and brand assets exist', async () => {
  const rootUrl = new URL('../../', import.meta.url);
  const designTokens = await readFile(new URL('design/tokens.css', rootUrl), 'utf8');
  const websiteTokens = await readFile(new URL('website/tokens.css', rootUrl), 'utf8');
  assert.equal(websiteTokens, designTokens);

  const requiredAssets = [
    'website/site.css',
    'website/assets/horizon-favicon.svg',
    'website/assets/horizon-wordmark-dark.svg',
    'website/assets/horizon-wordmark-light.svg',
    'website/assets/horizon-mark-light.svg',
    'website/assets/horizon-social-cover.svg',
    'website/assets/apple-touch-icon.png',
  ];
  for (const rel of requiredAssets) {
    const data = await readFile(new URL(rel, rootUrl));
    assert.ok(data.length > 0, `${rel} should exist and be non-empty`);
  }
});
