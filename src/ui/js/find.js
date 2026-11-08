import { debounce } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { currentTab } from './state.js';

const api = () => window.hinterland;

let bar = null;
let input = null;
let counter = null;
let matchCaseBtn = null;
let wholeWordBtn = null;
let previous = '';
let options = { caseSensitive: false, wholeWord: false, regex: false };

export function getFindOptions() {
  return { ...options };
}

function updateToggleUi() {
  if (matchCaseBtn) {
    matchCaseBtn.classList.toggle('active', options.caseSensitive);
    matchCaseBtn.setAttribute('aria-pressed', String(options.caseSensitive));
    matchCaseBtn.title = t('find.matchCase');
    matchCaseBtn.setAttribute('aria-label', t('find.matchCase'));
  }
  if (wholeWordBtn) {
    wholeWordBtn.classList.toggle('active', options.wholeWord);
    wholeWordBtn.setAttribute('aria-pressed', String(options.wholeWord));
    wholeWordBtn.title = t('find.wholeWord');
    wholeWordBtn.setAttribute('aria-label', t('find.wholeWord'));
  }
}

export function toggleMatchCase() {
  options.caseSensitive = !options.caseSensitive;
  updateToggleUi();
  run();
}

export function toggleWholeWord() {
  options.wholeWord = !options.wholeWord;
  updateToggleUi();
  run();
}

const run = debounce(() => {
  const tab = currentTab();
  if (!tab) return;
  const value = input.value;
  if (!value) {
    api().tab.findStop(tab.id);
    counter.textContent = `0/0`;
    return;
  }
  api().tab.find(tab.id, value, { forward: true, ...options });
}, 140);

export function bindFind(nodes) {
  bar = nodes.bar;
  input = nodes.input;
  counter = nodes.count;
  matchCaseBtn = nodes.matchCase ?? null;
  wholeWordBtn = nodes.wholeWord ?? null;

  if (matchCaseBtn) {
    matchCaseBtn.addEventListener('click', () => toggleMatchCase());
  }

  if (wholeWordBtn) {
    wholeWordBtn.addEventListener('click', () => toggleWholeWord());
  }

  updateToggleUi();

  input.addEventListener('input', run);
  input.addEventListener('keydown', (event) => {
    if (event.altKey && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      toggleMatchCase();
      return;
    }
    if (event.altKey && (event.key === 'w' || event.key === 'W')) {
      event.preventDefault();
      toggleWholeWord();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const tab = currentTab();
      if (!tab) return;
      if (event.shiftKey) api().tab.find(tab.id, input.value, { forward: false, ...options });
      else api().tab.findNext(tab.id);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFind();
    }
  });

  nodes.next.addEventListener('click', () => {
    const tab = currentTab();
    if (tab) api().tab.findNext(tab.id);
  });

  nodes.prev.addEventListener('click', async () => {
    const tab = currentTab();
    if (!tab) return;
    options.forward = false;
    await api().tab.find(tab.id, input.value || previous, { ...options });
    options.forward = true;
    api().tab.findNext(tab.id);
  });

  nodes.close.addEventListener('click', () => closeFind());
  input.placeholder = t('find.placeholder');
}

export function openFind() {
  if (!bar) return;
  bar.hidden = false;
  previous = '';
  input.value = '';
  counter.textContent = '0/0';
  input.focus();
}

export function closeFind() {
  if (!bar) return;
  const tab = currentTab();
  if (tab) api().tab.findStop(tab.id, true);
  bar.hidden = true;
  input.value = '';
  counter.textContent = '0/0';
}

export function isFindOpen() {
  return Boolean(bar && !bar.hidden);
}

export function applyFindResult(payload) {
  if (!bar || bar.hidden) return;
  const result = payload?.result;
  if (!result) return;
  const matches = Number(result.matches) || 0;
  const active = Number(result.activeMatchOrdinal) || 0;
  counter.textContent = matches ? `${active}/${matches}` : '0/0';
  if (input.value) previous = input.value;
}