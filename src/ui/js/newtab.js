import { el, clear } from '../js/util.js';
import { icon } from '../js/icons.js';
import { ecosystem, horizonGuide } from './ecosystem.js';
import { applySurfaceColors } from './appearance.js';

const page = window.horizonPage;

const settings = {};
let strings = {};
let engine = null;
let experienceRequest = 0;

function t(key, values) {
  let text = strings[key];
  if (text === undefined) text = key.split('.').at(-1);
  if (!values) return text;
  return String(text).replaceAll(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

function value(path, fallback) {
  const found = settings[path];
  return found === undefined ? fallback : found;
}

function looksLikeUrl(text) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return true;
  if (/\s/.test(text)) return false;
  const host = text.split('/')[0];
  if (host.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return /^[^.]+\.[^.]{2,}$/.test(host);
}

async function loadSettings() {
  const payload = (await page?.settings?.get()) ?? {};
  Object.assign(settings, payload);
}

async function saveSettings() {
  await page?.settings?.set?.({
    'start.layout': settings['start.layout'],
    'start.background': settings['start.background'],
    'start.backgroundOverlay': settings['start.backgroundOverlay'],
    'start.showClock': settings['start.showClock'],
    'start.showSearch': settings['start.showSearch'],
    'start.showGreeting': settings['start.showGreeting'],
    'start.searchTarget': settings['start.searchTarget'],
    'start.links': settings['start.links'],
  });
  paintLinks();
}

function applyTheme() {
  const selected = value('appearance.theme', 'system');
  const dark = selected === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : selected === 'dark';
  const theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.animations = value('appearance.animations', true) ? 'on' : 'off';

  const root = document.documentElement.style;
  const accent = value('appearance.accent', '#ffd5b0');
  const onAccent = value('appearance.accentContrast', '#17131f');
  if (accent === '#ffd5b0' && onAccent === '#17131f') {
    root.removeProperty('--accent');
    root.removeProperty('--onAccent');
  } else {
    root.setProperty('--accent', accent);
    root.setProperty('--onAccent', onAccent);
  }
  applySurfaceColors(document.documentElement, theme, value);
  root.setProperty('--radius', `${Number(value('appearance.radius', 10))}px`);
  root.setProperty('--fontSize', `${Number(value('appearance.fontSize', 14))}px`);
  root.setProperty('--blur', `${Number(value('appearance.blur', 18))}px`);
  const font = String(value('appearance.customFont', '')).trim();
  if (font) root.setProperty('--font', `${font}, system-ui, sans-serif`);
  else root.removeProperty('--font');
}

function paintBackdrop() {
  const backdrop = document.getElementById('backdrop');
  const source = String(value('start.background', '') ?? '').trim();
  if (!source) {
    backdrop.classList.remove('active');
    backdrop.style.backgroundImage = '';
    return;
  }
  backdrop.style.backgroundImage = `url("${source.replaceAll('"', '')}")`;
  backdrop.style.opacity = String(Number(value('start.backgroundOverlay', 0.25)));
  backdrop.classList.add('active');
}

function paintGreeting() {
  const node = document.getElementById('greeting');
  if (!value('start.showGreeting', true)) {
    node.textContent = '';
    return;
  }
  const hour = new Date().getHours();
  const key = hour < 5 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : hour < 22 ? 'evening' : 'night';
  node.textContent = t(`greeting.${key}`);
}

function paintClock() {
  const node = document.getElementById('clock');
  if (!value('start.showClock', true)) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  const code = document.documentElement.lang;
  const tick = () => {
    const now = new Date();
    clear(node);
    node.append(
      document.createTextNode(new Intl.DateTimeFormat(code, { hour: '2-digit', minute: '2-digit' }).format(now)),
      el('span', { text: new Intl.DateTimeFormat(code, { weekday: 'long', day: 'numeric', month: 'long' }).format(now) }),
    );
  };
  tick();
  setInterval(tick, 10_000);
}

function paintSearch() {
  const box = document.getElementById('searchBox');
  const input = document.getElementById('searchInput');
  const hasEngine = Boolean(engine?.url);
  box.hidden = !value('start.showSearch', true);
  if (box.hidden) return;

  document.getElementById('searchIcon').innerHTML = icon('search');
  const submit = document.getElementById('searchGo');
  submit.innerHTML = icon('forward');
  submit.setAttribute('aria-label', t('start.searchAction'));
  input.placeholder = hasEngine ? t('start.searchPlaceholder') : t('start.noEngine');
  input.setAttribute('aria-label', input.placeholder);

  box.onsubmit = (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    if (looksLikeUrl(query)) {
      location.assign(looksLikeScheme(query) ? query : `https://${query}`);
      return;
    }
    if (!hasEngine) return;
    const target = engine.url.includes('{q}') ? engine.url.replaceAll('{q}', encodeURIComponent(query)) : `${engine.url}${encodeURIComponent(query)}`;
    location.assign(target);
  };

  if (document.getElementById('welcomeCard').hidden) input.focus({ preventScroll: true });
}

function looksLikeScheme(text) {
  return /^(https?|horizon|file|data|about|view-source):/i.test(text);
}

function linkNode(entry) {
  const node = el('a', { class: 'link', href: entry.url || '#', title: entry.url || '' });
  node.append(
    el('div', { class: 'linkIcon', text: (entry.title || entry.url || '?').slice(0, 1) }),
    el('div', { class: 'linkLabel', text: entry.title || entry.url || '' }),
  );
  node.addEventListener('click', (event) => {
    if (!entry.url) event.preventDefault();
  });
  return node;
}

function paintLinks() {
  const host = document.getElementById('links');
  const entries = Array.isArray(value('start.links', [])) ? value('start.links', []) : [];
  const layout = value('start.layout', 'grid');

  host.dataset.layout = layout === 'minimal' ? 'list' : layout;
  host.hidden = entries.length === 0;
  if (host.hidden) return;

  clear(host);
  for (const entry of entries) host.append(linkNode(entry));
}

function paintEcosystem() {
  document.getElementById('ecosystemTitle').textContent = t('ecosystem.shortcuts');
  const host = document.getElementById('ecosystemLinks');
  for (const { id, url, icon: glyph } of ecosystem) {
    const name = el('strong', { text: t(`ecosystem.${id}`) });
    const description = el('span', { text: t(`ecosystem.${id}Description`) });
    const mark = glyph.endsWith('.svg')
      ? el('img', { src: `horizon://assets/${glyph}`, alt: '', width: 22, height: 22 })
      : el('span', { html: icon(glyph), 'aria-hidden': 'true' });
    host.append(el('a', { class: 'ecosystemTile', href: url }, [
      el('span', { class: 'ecosystemIcon' }, mark),
      el('span', { class: 'ecosystemLabel' }, [name, description]),
      el('span', { class: 'ecosystemArrow', html: icon('forward'), 'aria-hidden': 'true' }),
    ]));
  }
}

async function paintOcromExperience(accountChanged = false) {
  const request = ++experienceRequest;
  const section = document.getElementById('ocromExperience');
  const host = document.getElementById('ocromExperienceLinks');
  if (accountChanged) {
    section.hidden = true;
    clear(host);
  }
  const experience = await page.ocrom.experience().catch(() => null);
  if (!experience || request !== experienceRequest) return;
  clear(host);
  const { connected, items } = experience;
  document.getElementById('ocromExperienceTitle').textContent = t(connected ? 'ecosystem.recommendations' : 'ecosystem.accountTitle');
  if (!connected) {
    section.dataset.connected = 'false';
    document.getElementById('ocromExperienceHint').textContent = t('ecosystem.accountHint');
    host.append(el('button', { class: 'button', type: 'button', text: t('ecosystem.connect'),
      onclick: () => page.ocrom.openAccount() }));
  } else {
    section.dataset.connected = 'true';
    document.getElementById('ocromExperienceHint').textContent = items.length ? t('ecosystem.recommendationHint') : '';
    for (const { id, title } of items) {
      if (!Number.isSafeInteger(id) || id < 1 || typeof title !== 'string') continue;
      host.append(el('a', { class: 'ecosystemTile', href: `https://ocrom.net/#listing/${id}`,
        onclick: () => page.ocrom.recommendationOpened(id) }, el('span', { class: 'ecosystemLabel', text: title })));
    }
    host.append(el('a', { class: 'ecosystemTile', href: 'https://ocrom.net/#privacy' },
      el('span', { class: 'ecosystemLabel', text: t('ecosystem.privacy') })));
  }
  section.hidden = false;
}

function paintFoot() {
  const foot = document.getElementById('foot');
  clear(foot);
  foot.append(el('button', { type: 'button', text: t('start.editLinks'), onclick: openEditor }));
}

function openEditor() {
  const sheet = document.getElementById('editSheet');
  const editor = document.getElementById('linkEditor');

  document.getElementById('editTitle').textContent = t('start.title');
  document.getElementById('editHint').textContent = t('start.hint');
  document.getElementById('linkAdd').textContent = t('start.addLink');
  document.getElementById('linkClose').textContent = t('start.done');

  function render() {
    clear(editor);
    const entries = [...(value('start.links', []) ?? [])];
    entries.forEach((entry, index) => {
      const title = el('input', { type: 'text', value: entry.title ?? '', placeholder: 'Titel' });
      const url = el('input', { type: 'text', value: entry.url ?? '', placeholder: 'https://' });
      const commit = () => {
        entries[index] = { title: title.value, url: url.value };
        settings['start.links'] = entries;
        saveSettings();
      };
      title.addEventListener('change', commit);
      url.addEventListener('change', commit);
      editor.append(
        el('div', { class: 'listItem' }, [
          title,
          url,
          el('button', {
            class: 'iconButton',
            type: 'button',
            html: icon('trash'),
            title: t('start.done'),
            onclick: () => {
              entries.splice(index, 1);
              settings['start.links'] = entries;
              saveSettings();
              render();
            },
          }),
        ]),
      );
    });
  }

  render();
  sheet.hidden = false;

  document.getElementById('linkAdd').onclick = () => {
    settings['start.links'] = [...(settings['start.links'] ?? []), { title: '', url: '' }];
    render();
  };
  document.getElementById('linkClose').onclick = async () => {
    await saveSettings();
    sheet.hidden = true;
  };
}

function flatten(source, prefix = '', target = {}) {
  for (const [key, value] of Object.entries(source ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, target);
    else target[path] = String(value);
  }
  return target;
}

async function loadStrings() {
  const preferred = value('general.language', 'system');
  const locale = preferred === 'system' ? navigator.language : preferred;
  const code = String(locale || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  document.documentElement.lang = code;
  try {
    const response = await fetch(`locales/${code}.json`);
    if (response.ok) return flatten(await response.json());
    const fallback = await fetch('locales/en.json');
    return fallback.ok ? flatten(await fallback.json()) : {};
  } catch {
    return {};
  }
}

function paintWelcomeCard() {
  const card = document.getElementById('welcomeCard');
  if (!card) return;
  const hasRun = Boolean(value('general.hasRunBefore', false));
  if (hasRun) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  document.getElementById('welcomeTitle').textContent = t('welcome.title');
  document.getElementById('welcomeSubtitle').textContent = t('welcome.subtitle');
  document.getElementById('pillarPrivacyTitle').textContent = t('welcome.featPrivacyTitle');
  document.getElementById('pillarPrivacyDesc').textContent = t('welcome.featPrivacyDesc');
  document.getElementById('pillarSpeedTitle').textContent = t('welcome.featSpeedTitle');
  document.getElementById('pillarSpeedDesc').textContent = t('welcome.featSpeedDesc');
  document.getElementById('pillarCustomTitle').textContent = t('welcome.featCustomTitle');
  document.getElementById('pillarCustomDesc').textContent = t('welcome.featCustomDesc');
  document.getElementById('welcomeSetDefault').textContent = t('welcome.btnDefault');
  document.getElementById('welcomeOpenGuide').textContent = t('welcome.btnGuide');
  document.getElementById('welcomeDismiss').textContent = t('welcome.btnDismiss');

  const dismiss = async () => {
    card.hidden = true;
    const focusTarget = document.getElementById('searchBox').hidden
      ? document.querySelector('#ecosystemLinks a') : document.getElementById('searchInput');
    focusTarget?.focus({ preventScroll: true });
    settings['general.hasRunBefore'] = true;
    await page?.settings?.set?.({ 'general.hasRunBefore': true });
  };

  document.getElementById('welcomeClose').onclick = dismiss;
  document.getElementById('welcomeDismiss').onclick = dismiss;
  document.getElementById('welcomeOpenGuide').onclick = () => {
    page?.open?.(horizonGuide);
  };
  document.getElementById('welcomeSetDefault').onclick = async () => {
    const button = document.getElementById('welcomeSetDefault');
    button.disabled = true;
    const isDefault = await page?.app?.setDefaultBrowser?.();
    button.textContent = t(isDefault ? 'welcome.isDefault' : 'welcome.confirmDefault');
    button.disabled = Boolean(isDefault);
  };
}

async function boot() {
  await loadSettings();
  strings = await loadStrings();
  const engines = (await page?.search?.engines?.()) ?? [];
  engine = engines[0] ?? null;

  applyTheme();
  page?.settings?.onAppearanceChanged?.(async () => {
    await loadSettings();
    applyTheme();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  paintBackdrop();
  paintWelcomeCard();
  paintGreeting();
  paintClock();
  paintSearch();
  paintLinks();
  paintEcosystem();
  paintFoot();
  if (page?.ocrom) {
    page.ocrom.onAccountChanged(() => void paintOcromExperience(true));
    window.addEventListener('focus', () => void paintOcromExperience());
    void paintOcromExperience();
  }
}

boot();
