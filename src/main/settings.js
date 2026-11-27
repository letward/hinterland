import electron from 'electron';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { SCHEMA, buildDefaults } from './schema.js';

const app = typeof electron === 'object' && electron !== null ? electron.app : null;
const getUserDataPath = () => (typeof app?.getPath === 'function' ? app.getPath('userData') : join(tmpdir(), 'neocrom-horizon-data'));

const FILE_NAME = 'settings.json';
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const LEGACY_EXTENSION_MAP = {
  hinterlandfocus: 'horizonfocus',
  hinterlandpanel: 'horizonpanel',
  hinterlandpass: 'horizonpass',
  hinterlandshield: 'horizonshield',
  hinterlandnotes: 'horizonnotes',
  hinterlandtranslate: 'horizontranslate',
};
const previousPalette = {
  accent: '#4f7cff', accentContrast: '#ffffff',
  darkBackground: '#12141a', darkSurface: '#1a1d26', darkText: '#e6e9f2',
  lightBackground: '#f2f3f7', lightSurface: '#ffffff', lightText: '#161923',
};
const monochromePalette = {
  accent: '#bdbdbd', accentContrast: '#ffffff',
  darkBackground: '#090909', darkSurface: '#141414', darkText: '#f8f8f8',
  lightBackground: '#f4f4f4', lightSurface: '#ffffff', lightText: '#111111',
};

function deepGet(object, path) {
  if (!object || typeof path !== 'string') return undefined;
  const keys = path.split('.');
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) return undefined;
  }
  return keys.reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function deepSet(object, path, value) {
  if (!object || typeof path !== 'string') return;
  const keys = path.split('.');
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) return;
  }
  let node = object;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
}

function deepClone(value) {
  return structuredClone(value);
}

function coerce(definition, raw) {
  if (raw === undefined || raw === null) return deepClone(definition.default);
  try {
    switch (definition.type) {
      case 'bool':
        return Boolean(raw);
      case 'number': {
        let number = Number(raw);
        if (!Number.isFinite(number)) return deepClone(definition.default);
        if (typeof definition.min === 'number') number = Math.max(definition.min, number);
        if (typeof definition.max === 'number') number = Math.min(definition.max, number);
        return number;
      }
      case 'select':
        return definition.options.some((option) => option.value === raw)
          ? raw
          : deepClone(definition.default);
      case 'multiselect': {
        if (!Array.isArray(raw)) return deepClone(definition.default);
        const allowed = definition.options?.length ? definition.options.map((option) => option.value) : null;
        const values = allowed ? raw.filter((value) => allowed.includes(value)) : [...new Set(raw.map(String))];
        return values;
      }
      case 'list':
        return Array.isArray(raw) ? raw.map((entry) => deepClone(entry)) : [];
      case 'keyvalue': {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
        return raw;
      }
      default:
        return typeof raw === typeof definition.default ? raw : deepClone(definition.default);
    }
  } catch {
    return deepClone(definition.default);
  }
}

export class Settings extends EventEmitter {
  constructor(customPath) {
    super();
    this.setMaxListeners(50);
    this.schema = SCHEMA;
    this.data = buildDefaults();
    this.filePath = customPath || join(getUserDataPath(), FILE_NAME);
    this.timer = null;
  }

  load() {
    if (!existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
      if (parsed && typeof parsed === 'object' && deepGet(parsed, 'general.hasRunBefore') === undefined) {
        deepSet(parsed, 'general.hasRunBefore', true);
      }
      for (const palette of [previousPalette, monochromePalette]) {
        if (Object.entries(palette).every(([key, color]) => parsed.appearance?.[key] === color)) {
          for (const key of Object.keys(palette)) delete parsed.appearance[key];
          break;
        }
      }
      if (typeof parsed.general?.homepage === 'string' && parsed.general.homepage.startsWith('hinterland://')) {
        parsed.general.homepage = `horizon://${parsed.general.homepage.slice('hinterland://'.length)}`;
      }
      if (parsed.account?.provider === 'hinterland') {
        parsed.account.provider = 'horizon';
      }
      if (/^https:\/\/hinterland-browser\.vercel\.app\/api\/sync\/?$/.test(parsed.account?.serverUrl)) {
        delete parsed.account.serverUrl;
      }
      if (Array.isArray(parsed.extensions?.enabled)) {
        parsed.extensions.enabled = [...new Set(parsed.extensions.enabled.map((id) => LEGACY_EXTENSION_MAP[id] || id))];
      }
      if (parsed.store?.activeThemeId === 'midnight') {
        parsed.store.activeThemeId = 'neocrom';
      }
      for (const definition of this.schema) {
        const value = coerce(definition, deepGet(parsed, definition.key));
        if (value !== undefined) deepSet(this.data, definition.key, value);
      }
    } catch (error) {
      console.warn('[Neocrom Horizon] Settings file could not be read, using defaults.', error.message);
    }
  }

  saveNow() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      writeFileSync(temporary, JSON.stringify(this.data, null, 2), 'utf8');
      renameSync(temporary, this.filePath);
    } catch (error) {
      console.warn('[Neocrom Horizon] Settings could not be written.', error.message);
    }
  }

  scheduleSave() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 250);
  }

  all() {
    return deepClone(this.data);
  }

  get(key) {
    const value = deepGet(this.data, key);
    return value === undefined ? deepGet(this.data, key) : value;
  }

  has(key) {
    return deepGet(this.data, key) !== undefined;
  }

  /** Resolves a setting and always falls back to the schema default. */
  value(key) {
    const found = SCHEMA.find((definition) => definition.key === key);
    const stored = deepGet(this.data, key);
    return stored === undefined ? deepClone(found?.default) : deepClone(stored);
  }

  set(key, value, { silent = false } = {}) {
    if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) return false;
    const definition = SCHEMA.find((entry) => entry.key === key);
    if (!definition) return false;
    const next = coerce(definition, value);
    const previous = deepGet(this.data, key);
    deepSet(this.data, key, next);
    this.scheduleSave();
    if (!silent && JSON.stringify(previous) !== JSON.stringify(next)) {
      this.emit('change', { key, value: deepClone(next), previous });
      this.emit(`change:${key}`, deepClone(next), deepClone(previous));
    }
    return true;
  }

  merge(patch, { silent = false } = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return [];
    const changed = [];
    for (const [key, value] of Object.entries(patch)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const definition = SCHEMA.find((entry) => entry.key === key);
      if (!definition) continue;
      const next = coerce(definition, value);
      const previous = deepGet(this.data, key);
      if (JSON.stringify(previous) === JSON.stringify(next)) continue;
      deepSet(this.data, key, next);
      changed.push({ key, value: deepClone(next), previous: deepClone(previous) });
    }
    if (!changed.length) return [];
    this.scheduleSave();
    if (!silent) {
      for (const entry of changed) {
        this.emit('change', entry);
        this.emit(`change:${entry.key}`, entry.value, entry.previous);
      }
    }
    return changed;
  }

  reset(key) {
    const definition = SCHEMA.find((entry) => entry.key === key);
    if (!definition) return;
    this.set(key, deepClone(definition.default));
  }

  resetAll() {
    const before = this.all();
    this.data = buildDefaults();
    this.scheduleSave();
    this.emit('change', { key: '*', value: null, previous: before });
    this.emit('reset');
  }

  export() {
    return JSON.stringify(
      {
        format: 'neocrom-horizon.settings',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: this.all(),
      },
      null,
      2,
    );
  }

  import(text, { replace = false } = {}) {
    let parsed;
    try {
      parsed = typeof text === 'string' ? JSON.parse(text) : text;
    } catch {
      throw new Error('invalidJson');
    }
    const payload = parsed?.settings ?? parsed;
    if (!payload || typeof payload !== 'object') throw new Error('invalidPayload');
    const next = {};
    for (const definition of SCHEMA) {
      const value = deepGet(payload, definition.key);
      if (value !== undefined) deepSet(next, definition.key, coerce(definition, value));
    }
    if (replace) this.data = { ...buildDefaults(), ...next };
    else this.merge(next);
    if (replace) this.saveNow();
    return Object.keys(next).length;
  }
}

export const settings = new Settings();
