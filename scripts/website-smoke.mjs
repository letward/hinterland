#!/usr/bin/env node
const base = process.env.SITE_URL || 'https://ocrom.net';
let failed = 0;

async function check(name, fn) {
  try { await fn(); console.log('PASS:', name); }
  catch (e) { failed++; console.error('FAIL:', name, '-', e.message); }
}

for (const [path, view] of [['/horizon', 'listing/ocrom-horizon'], ['/horizon/store', 'horizon/store'], ['/id', 'ocrom-id']]) {
  await check(path, async () => {
    const response = await fetch(base + path, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status !== 302 || location !== '/#' + view) {
      throw new Error(`Expected redirect to /#${view}, got ${response.status} ${location ?? ''}`);
    }
  });
}

await check('Horizon Store lists community content', async () => {
  const response = await fetch(base + '/api/horizon/store');
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.themes) || !Array.isArray(data.extensions)) throw new Error('Store unavailable');
});

await check('Horizon Sync requires an Ocrom ID device', async () => {
  const response = await fetch(base + '/api/horizon/sync');
  if (response.status !== 401) throw new Error('Unexpected response ' + response.status);
});

if (failed > 0) { console.error(`\n${failed} smoke test(s) failed.`); process.exit(1); }
console.log('\nAll website smoke tests passed.');
