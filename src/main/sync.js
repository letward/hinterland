/**
 * @fileoverview Neocrom Horizon Account & Cloud Sync Engine
 * Synchronizes selected browser data with Neocrom ID using encrypted snapshots.
 * Explicitly configured personal sync providers are supported for existing profiles.
 */

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import electron from 'electron';
import { settings } from './settings.js';
import { history } from './history.js';
import { neocromOrigin, neocromRequest } from '../../sdk/src/neocrom-id.js';

export const DEFAULT_SERVER_URL = neocromOrigin + '/api/horizon/sync';

export const SYNCABLE_SETTINGS = [
  'general.language',
  'general.startMode',
  'appearance.theme',
  'appearance.density',
  'appearance.font',
  'appearance.showBookmarksBar',
  'appearance.tabPosition',
  'privacy.blockTrackers',
  'privacy.blockFingerprinting',
  'privacy.blockMiners',
  'privacy.clearOnExit',
  'content.javascript',
  'content.images',
  'content.popups',
  'data.readingList',
  'data.notes',
  'search.engines',
  'search.defaultEngine',
  'shortcuts',
  'advanced.memorySaverExemptions',
];

/* ----------------------------------------------------------------- crypto */

export function deriveSyncKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

export function encryptSyncPayload(payload, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveSyncKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const jsonStr = JSON.stringify(payload);
  let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted,
  };
}

export function decryptSyncPayload(data, passphrase) {
  if (!data?.encrypted || !data?.ciphertext) return data;
  const salt = Buffer.from(data.salt, 'base64');
  const iv = Buffer.from(data.iv, 'base64');
  const tag = Buffer.from(data.tag, 'base64');
  const key = deriveSyncKey(passphrase, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(data.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/* ---------------------------------------------------------------- helpers */

export function normalizeBookmarkUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

export function mergeBookmarks(local = [], remote = []) {
  const map = new Map();

  for (const item of (Array.isArray(local) ? local : [])) {
    if (!item || !item.url) continue;
    const key = normalizeBookmarkUrl(item.url);
    map.set(key, { ...item });
  }

  for (const item of (Array.isArray(remote) ? remote : [])) {
    if (!item || !item.url) continue;
    const key = normalizeBookmarkUrl(item.url);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
    } else {
      const merged = { ...existing };
      if (!merged.title && item.title) merged.title = item.title;
      if (item.updatedAt && (!merged.updatedAt || item.updatedAt > merged.updatedAt)) {
        merged.title = item.title || merged.title;
        merged.updatedAt = item.updatedAt;
      }
      map.set(key, merged);
    }
  }

  return Array.from(map.values());
}

export function normalizeHistoryUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

export function mergeHistory(local = [], remote = []) {
  const map = new Map();

  for (const item of (Array.isArray(local) ? local : [])) {
    if (!item || !item.url) continue;
    const key = normalizeHistoryUrl(item.url);
    map.set(key, { ...item });
  }

  for (const item of (Array.isArray(remote) ? remote : [])) {
    if (!item || !item.url) continue;
    const key = normalizeHistoryUrl(item.url);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
    } else {
      map.set(key, {
        url: existing.url,
        title: item.title || existing.title || '',
        time: Math.max(Number(item.time) || 0, Number(existing.time) || 0),
        visits: Math.max(Number(item.visits) || 1, Number(existing.visits) || 1),
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .slice(0, 1000);
}

export function normalizeReadingListUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

export function mergeReadingList(local = [], remote = []) {
  const map = new Map();

  for (const item of (Array.isArray(local) ? local : [])) {
    if (!item || !item.url) continue;
    const key = normalizeReadingListUrl(item.url);
    map.set(key, { ...item });
  }

  for (const item of (Array.isArray(remote) ? remote : [])) {
    if (!item || !item.url) continue;
    const key = normalizeReadingListUrl(item.url);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
    } else {
      const merged = { ...existing };
      if (!merged.title && item.title) merged.title = item.title;
      if (item.favicon && !merged.favicon) merged.favicon = item.favicon;
      if (item.read !== undefined && item.read) merged.read = true;
      if (item.addedAt && (!merged.addedAt || item.addedAt > merged.addedAt)) {
        merged.addedAt = item.addedAt;
      }
      map.set(key, merged);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (Number(b.addedAt) || 0) - (Number(a.addedAt) || 0));
}

export function mergeNotes(local = [], remote = []) {
  const map = new Map();

  for (const item of (Array.isArray(local) ? local : [])) {
    if (!item || !item.id) continue;
    map.set(item.id, { ...item });
  }

  for (const item of (Array.isArray(remote) ? remote : [])) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, { ...item });
    } else {
      const remoteUpdated = Number(item.updatedAt) || 0;
      const localUpdated = Number(existing.updatedAt) || 0;
      if (remoteUpdated >= localUpdated) {
        map.set(item.id, { ...existing, ...item });
      } else {
        map.set(item.id, { ...item, ...existing });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
    });
}

export function extractSyncableSettings(allSettings) {
  const result = {};
  if (!allSettings || typeof allSettings !== 'object') return result;

  const deepGet = (obj, path) => path.split('.').reduce((n, k) => (n == null ? undefined : n[k]), obj);

  for (const key of SYNCABLE_SETTINGS) {
    const val = deepGet(allSettings, key);
    if (val !== undefined) {
      result[key] = structuredClone(val);
    }
  }
  return result;
}

export function mergeSettings(localSettings, remoteSettings) {
  const patch = {};
  if (!remoteSettings || typeof remoteSettings !== 'object') return patch;
  for (const key of SYNCABLE_SETTINGS) {
    if (remoteSettings[key] !== undefined) {
      patch[key] = structuredClone(remoteSettings[key]);
    }
  }
  return patch;
}

/* ------------------------------------------------------------- SyncService */

export class SyncService extends EventEmitter {
  constructor(customFetch = null) {
    super();
    this.fetch = customFetch || globalThis.fetch;
    this.status = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error'
    this.lastError = null;
    this.lastSyncedAt = null;
    this.syncPassphrase = null;
    this.debounceTimer = null;
    this.intervalTimer = null;
    this.started = false;
    this.isSyncing = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.lastSyncedAt = settings.value('account.lastSyncTime') || null;

    // Listen to local setting & bookmark mutations
    settings.on('change', ({ key }) => {
      if (this.isSyncing) return;
      if (!this.isLoggedIn()) return;
      if (!settings.value('account.autoSync')) return;

      if (key === 'data.bookmarks' || SYNCABLE_SETTINGS.includes(key)) {
        this.scheduleDebouncedSync(1500);
      }
    });

    // Periodic sync every 15 minutes
    this.intervalTimer = setInterval(() => {
      if (this.isLoggedIn() && settings.value('account.autoSync')) {
        this.syncNow({ silent: true }).catch(() => {});
      }
    }, 15 * 60 * 1000);
    this.intervalTimer.unref?.();

    // Initial sync check on boot if logged in
    if (this.isLoggedIn() && settings.value('account.autoSync')) {
      setTimeout(() => {
        this.syncNow({ silent: true }).catch(() => {});
      }, 2500);
    }
  }

  scheduleDebouncedSync(delayMs = 1500) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncNow({ silent: true }).catch(() => {});
    }, delayMs);
  }

  getDevices() {
    const defaultName = process.platform === 'win32'
      ? 'Windows Desktop'
      : process.platform === 'darwin' ? 'macOS Desktop' : 'Linux Desktop';
    const myDevice = {
      id: settings.value('account.deviceId') || 'dev-current',
      name: settings.value('account.deviceName') || defaultName,
      platform: process.platform,
      os: process.platform,
      browserVersion: '1.29.0',
      lastActive: this.lastSyncedAt || new Date().toISOString(),
      current: true,
      isCurrent: true,
      status: 'active',
    };
    const known = settings.value('account.knownDevices') || [];
    return [myDevice, ...known.filter((d) => d.id !== myDevice.id)];
  }

  getSyncStats() {
    const bookmarks = settings.value('data.bookmarks') || [];
    const readingList = settings.value('data.readingList') || [];
    const notes = settings.value('data.notes') || [];
    const syncable = extractSyncableSettings(settings.all());
    const known = settings.value('account.knownDevices') || [];
    return {
      bookmarkCount: bookmarks.length,
      bookmarksCount: bookmarks.length,
      readingListCount: readingList.length,
      notesCount: notes.length,
      settingsCount: Object.keys(syncable).length,
      syncableSettingsCount: Object.keys(syncable).length,
      deviceCount: known.length + 1,
      e2eeActive: this.getStatus().hasPassphrase,
      lastSyncTime: settings.value('account.lastSyncTime') || this.lastSyncedAt || null,
      lastSyncedAt: settings.value('account.lastSyncTime') || this.lastSyncedAt || null,
      provider: settings.value('account.provider') || 'horizon',
      autoSync: settings.value('account.autoSync') ?? true,
      status: this.isLoggedIn() ? 'synced' : this.status,
    };
  }

  pairDevice(codeOrOpts) {
    if (typeof codeOrOpts === 'object' && codeOrOpts?.code) {
      const code = String(codeOrOpts.code).trim().toUpperCase();
      if (!/^(NH|HL)-[A-Z0-9]{4,8}$/i.test(code) && !/^(NH|HL)-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) {
        return { ok: false, error: 'invalidCode' };
      }
      const known = settings.value('account.knownDevices') || [];
      const newDevice = {
        id: 'dev-' + crypto.randomBytes(3).toString('hex'),
        name: codeOrOpts.name || 'Paired Device',
        platform: 'unknown',
        os: 'unknown',
        browserVersion: '1.48.0',
        lastActive: new Date().toISOString(),
        pairedCode: code,
        current: false,
        isCurrent: false,
        status: 'paired',
      };
      settings.set('account.knownDevices', [...known, newDevice]);
      return { ok: true, device: newDevice };
    }

    const code = 'NH-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const token = this.getSession()?.token || '';
    return {
      ok: true,
      code,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      pairingPayload: JSON.stringify({ code, token: token.slice(0, 16) + '...' }),
    };
  }

  async syncBookmarks(newBookmarks) {
    if (Array.isArray(newBookmarks)) {
      settings.set('data.bookmarks', newBookmarks);
      this.scheduleDebouncedSync(1500);
      return { ok: true, scheduled: true };
    }
    return await this.syncNow({ direction: 'both', silent: false });
  }

  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.removeAllListeners();
  }

  getSession() {
    const session = settings.value('account.session');
    if (session?.provider !== 'neocrom') {
      return session?.provider === 'supabase' || settings.value('account.serverUrl') ? session || null : null;
    }
    try {
      return { ...session, token: electron.safeStorage.decryptString(Buffer.from(session.protectedToken, 'base64')) };
    } catch {
      return null;
    }
  }

  isLoggedIn() {
    const session = this.getSession();
    return Boolean(session?.token && session?.user);
  }

  getStatus() {
    const session = this.getSession();
    const provider = session?.provider || settings.value('account.provider') || 'horizon';
    const supabaseUrl = settings.value('account.supabaseUrl') || '';
    const supabaseKey = settings.value('account.supabaseAnonKey') || '';

    return {
      isLoggedIn: this.isLoggedIn(),
      user: session?.user ? { email: session.user.email, id: session.user.id, handle: session.user.handle, displayName: session.user.name } : null,
      provider,
      serverUrl: settings.value('account.serverUrl') || DEFAULT_SERVER_URL,
      supabaseUrl,
      hasSupabaseCredentials: Boolean(supabaseUrl && supabaseKey),
      autoSync: settings.value('account.autoSync') ?? true,
      syncBookmarks: settings.value('account.syncBookmarks') ?? true,
      syncHistory: settings.value('account.syncHistory') ?? true,
      syncReadingList: settings.value('account.syncReadingList') ?? true,
      syncNotes: settings.value('account.syncNotes') ?? true,
      syncSettings: settings.value('account.syncSettings') ?? true,
      lastSyncedAt: settings.value('account.lastSyncTime') || this.lastSyncedAt || null,
      status: this.status,
      error: this.lastError,
      hasPassphrase: Boolean(session?.provider === 'neocrom' ? this.neocromPassphrase(session) : this.syncPassphrase),
    };
  }

  async refreshNeocromStatus() {
    const session = this.getSession();
    if (session?.provider !== 'neocrom') return this.getStatus();
    try {
      const profile = await neocromRequest('/api/neocrom-id/profile', { token: session.token, fetch: this.fetch });
      if (this.getSession()?.token === session.token && (profile.name !== session.user.name || profile.handle !== session.user.handle)) {
        settings.set('account.session', { ...settings.value('account.session'), user: profile });
      }
    } catch (error) {
      if (error.status === 401 && this.getSession()?.token === session.token) {
        settings.set('account.session', null);
        this.syncPassphrase = null;
      }
    }
    return this.getStatus();
  }

  broadcastStatus() {
    const payload = this.getStatus();
    this.emit('status', payload);
  }

  setSyncPassphrase(passphrase) {
    const stored = settings.value('account.session');
    if (stored?.provider === 'neocrom') {
      if (passphrase && String(passphrase).length < 12) throw new Error('syncPassphraseRequired');
      settings.set('account.session', { ...stored, protectedPassphrase: passphrase
        ? electron.safeStorage.encryptString(String(passphrase)).toString('base64') : null });
    }
    this.syncPassphrase = passphrase ? String(passphrase) : null;
    this.broadcastStatus();
  }

  async updateConfig(patch = {}) {
    if (!patch || typeof patch !== 'object') return this.getStatus();

    if (patch.autoSync !== undefined) settings.set('account.autoSync', Boolean(patch.autoSync));
    if (patch.provider !== undefined) settings.set('account.provider', String(patch.provider));
    if (patch.serverUrl !== undefined) settings.set('account.serverUrl', String(patch.serverUrl));
    if (patch.supabaseUrl !== undefined) settings.set('account.supabaseUrl', String(patch.supabaseUrl));
    if (patch.supabaseAnonKey !== undefined) settings.set('account.supabaseAnonKey', String(patch.supabaseAnonKey));
    if (patch.syncBookmarks !== undefined) settings.set('account.syncBookmarks', Boolean(patch.syncBookmarks));
    if (patch.syncHistory !== undefined) settings.set('account.syncHistory', Boolean(patch.syncHistory));
    if (patch.syncReadingList !== undefined) settings.set('account.syncReadingList', Boolean(patch.syncReadingList));
    if (patch.syncNotes !== undefined) settings.set('account.syncNotes', Boolean(patch.syncNotes));
    if (patch.syncSettings !== undefined) settings.set('account.syncSettings', Boolean(patch.syncSettings));
    if (patch.syncPassphrase !== undefined) {
      const session = this.getSession();
      if (session?.provider === 'neocrom' && patch.syncPassphrase) {
        if (typeof patch.syncPassphrase !== 'string' || patch.syncPassphrase.length < 12 || patch.syncPassphrase.length > 256) {
          throw new Error('syncPassphraseRequired');
        }
        const { snapshot } = await neocromRequest('/api/horizon/sync', { token: session.token, fetch: this.fetch });
        if (snapshot) decryptSyncPayload(snapshot, patch.syncPassphrase);
        if (this.getSession()?.token !== session.token) throw new Error('notLoggedIn');
      }
      this.setSyncPassphrase(patch.syncPassphrase);
    }

    this.broadcastStatus();
    return this.getStatus();
  }

  neocromPassphrase(session) {
    if (!session?.protectedPassphrase) return null;
    try {
      return electron.safeStorage.decryptString(Buffer.from(session.protectedPassphrase, 'base64'));
    } catch { return null; }
  }

  /* ------------------------------------------------------------- Auth flows */

  async beginNeocromConnection() {
    if (!electron.safeStorage?.isEncryptionAvailable() || electron.safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
      throw new Error('Secure credential storage is unavailable.');
    }
    const { deviceCode, userCode, expiresIn, interval } = await neocromRequest('/api/neocrom-id/device', {
      method: 'POST', body: { client: 'horizon' }, fetch: this.fetch,
    });
    this.neocromConnection = deviceCode;
    return { userCode, expiresIn, interval, verificationUrl: neocromOrigin + '/id' };
  }

  async completeNeocromConnection() {
    const deviceCode = this.neocromConnection;
    if (!deviceCode) return { expired: true };
    let result;
    try {
      result = await neocromRequest('/api/neocrom-id/token', { method: 'POST', body: { deviceCode }, fetch: this.fetch });
    } catch (error) {
      if (error.status === 410) return { expired: true };
      if (error.status === 429) return { pending: true };
      throw error;
    }
    if (deviceCode !== this.neocromConnection) return { expired: true };
    if (result.pending) return result;
    const protectedToken = electron.safeStorage.encryptString(result.accessToken).toString('base64');
    const previous = this.getSession();
    if (previous?.provider === 'neocrom') await this.disconnectNeocrom(previous.token);
    this.neocromConnection = null;
    this.syncPassphrase = null;
    settings.set('account.session', { provider: 'neocrom', protectedToken, user: result.profile });
    this.status = 'idle';
    this.lastError = null;
    this.broadcastStatus();
    return { ok: true };
  }

  disconnectNeocrom(token) {
    return neocromRequest('/api/neocrom-id/session', { method: 'DELETE', token, fetch: this.fetch }).catch(() => null);
  }

  async ocromExperience(event, listingId) {
    const session = this.getSession();
    if (session?.provider !== 'neocrom' || !session.token) return { connected: false, items: [] };
    const options = { token: session.token, fetch: this.fetch };
    try {
      const { settings: consent, items } = await neocromRequest('/api/horizon/experience', options);
      if (session.token !== this.getSession()?.token) return { connected: false, items: [] };
      const category = event === 'recommendation_open' ? items.find(item => item.id === listingId)?.category : undefined;
      if (event === 'recommendation_open' ? category && consent.personalization : consent.analytics) {
        void neocromRequest('/api/horizon/telemetry', {
          ...options, method: 'POST', body: { event, ...(category ? { category } : {}) },
        }).catch(() => {});
      }
      return { connected: true, items: consent.personalization ? items : [] };
    } catch (error) {
      return { connected: error.status !== 401, items: [] };
    }
  }

  async neocromStore(kind, item) {
    const path = '/api/horizon/store';
    if (!kind) return neocromRequest(path, { fetch: this.fetch });
    const session = this.getSession();
    if (session?.provider !== 'neocrom') return { ok: false, error: 'notLoggedIn' };
    return neocromRequest(path, { method: 'POST', token: session.token, body: { ...item, kind }, fetch: this.fetch });
  }

  async signUp({ email, password, provider, supabaseUrl, supabaseAnonKey, syncPassphrase }) {
    if (!email || !password) throw new Error('emailAndPasswordRequired');
    if (password.length < 6) throw new Error('passwordTooShort');

    const cleanEmail = String(email).trim().toLowerCase();
    const activeProvider = provider || settings.value('account.provider') || 'horizon';

    if (supabaseUrl) settings.set('account.supabaseUrl', supabaseUrl);
    if (supabaseAnonKey) settings.set('account.supabaseAnonKey', supabaseAnonKey);
    if (provider) settings.set('account.provider', provider);
    if (syncPassphrase) this.setSyncPassphrase(syncPassphrase);

    let session;
    if (activeProvider === 'supabase') {
      session = await this._supabaseSignUp(cleanEmail, password);
    } else {
      session = await this._horizonSignUp(cleanEmail, password);
    }

    settings.set('account.session', session);
    this.status = 'idle';
    this.lastError = null;
    this.broadcastStatus();

    // Perform initial sync upload immediately
    try {
      await this.syncNow();
    } catch {
      // Continue even if initial sync upload is queued
    }

    return { ok: true, user: session.user };
  }

  async signIn({ email, password, provider, supabaseUrl, supabaseAnonKey, syncPassphrase }) {
    if (!email || !password) throw new Error('emailAndPasswordRequired');

    const cleanEmail = String(email).trim().toLowerCase();
    const activeProvider = provider || settings.value('account.provider') || 'horizon';

    if (supabaseUrl) settings.set('account.supabaseUrl', supabaseUrl);
    if (supabaseAnonKey) settings.set('account.supabaseAnonKey', supabaseAnonKey);
    if (provider) settings.set('account.provider', provider);
    if (syncPassphrase) this.setSyncPassphrase(syncPassphrase);

    let session;
    if (activeProvider === 'supabase') {
      session = await this._supabaseSignIn(cleanEmail, password);
    } else {
      session = await this._horizonSignIn(cleanEmail, password);
    }

    settings.set('account.session', session);
    this.status = 'idle';
    this.lastError = null;
    this.broadcastStatus();

    // Pull and merge upon signing in
    try {
      await this.syncNow();
    } catch {
      // Non-fatal
    }

    return { ok: true, user: session.user };
  }

  async signOut() {
    const session = this.getSession();
    if (session?.provider === 'neocrom') await this.disconnectNeocrom(session.token);
    this.neocromConnection = null;
    if (session?.provider === 'supabase' && session?.token) {
      try {
        const url = (settings.value('account.supabaseUrl') || '').replace(/\/$/, '');
        const key = settings.value('account.supabaseAnonKey');
        if (url && key) {
          await this.fetch(`${url}/auth/v1/logout`, {
            method: 'POST',
            headers: { apikey: key, Authorization: `Bearer ${session.token}` },
          });
        }
      } catch {
        // Ignore logout errors
      }
    }

    settings.set('account.session', null);
    this.status = 'idle';
    this.lastError = null;
    this.syncPassphrase = null;
    this.broadcastStatus();
    return { ok: true };
  }

  /* ----------------------------------------------------------- Sync operation */

  async syncNow({ direction = 'both', silent = false } = {}) {
    if (!this.isLoggedIn()) return { ok: false, error: 'notLoggedIn' };

    const session = this.getSession();
    this.status = 'syncing';
    this.lastError = null;
    this.isSyncing = true;
    this.broadcastStatus();

    try {
      const syncBookmarksEnabled = settings.value('account.syncBookmarks') ?? true;
      const syncHistoryEnabled = settings.value('account.syncHistory') ?? true;
      const syncReadingListEnabled = settings.value('account.syncReadingList') ?? true;
      const syncNotesEnabled = settings.value('account.syncNotes') ?? true;
      const syncSettingsEnabled = settings.value('account.syncSettings') ?? true;

      const localBookmarks = syncBookmarksEnabled ? (settings.value('data.bookmarks') ?? []) : [];
      const localHistory = syncHistoryEnabled ? history.recent(500) : [];
      const localReadingList = syncReadingListEnabled ? (settings.value('data.readingList') ?? []) : [];
      const localNotes = syncNotesEnabled ? (settings.value('data.notes') ?? []) : [];
      const localSettings = syncSettingsEnabled ? extractSyncableSettings(settings.all()) : {};

      let cloudData = null;
      if (session.provider === 'neocrom') {
        const flags = {
          bookmarks: syncBookmarksEnabled, history: syncHistoryEnabled, readingList: syncReadingListEnabled,
          notes: syncNotesEnabled, settings: syncSettingsEnabled,
        };
        delete localSettings['data.readingList'];
        delete localSettings['data.notes'];
        cloudData = await this.neocromSync(session, {
          bookmarks: localBookmarks, history: localHistory, readingList: localReadingList, notes: localNotes, settings: localSettings,
        }, flags, direction);
        if (this.getSession()?.token !== session.token) return { ok: false, error: 'notLoggedIn' };
      } else if (session.provider === 'supabase') {
        cloudData = await this._supabaseSync(session, {
          bookmarks: localBookmarks,
          history: localHistory,
          readingList: localReadingList,
          notes: localNotes,
          settings: localSettings,
          direction,
        });
      } else {
        cloudData = await this._horizonSync(session, {
          bookmarks: localBookmarks,
          history: localHistory,
          readingList: localReadingList,
          notes: localNotes,
          settings: localSettings,
          direction,
        });
      }

      // Merge and apply cloud data locally if allowed
      let mergedBookmarks = localBookmarks;
      if (syncBookmarksEnabled && Array.isArray(cloudData?.bookmarks)) {
        mergedBookmarks = mergeBookmarks(localBookmarks, cloudData.bookmarks);
        settings.set('data.bookmarks', mergedBookmarks, { silent: true });
        this.emit('bookmarksUpdated', mergedBookmarks);
      }

      let mergedHistory = localHistory;
      if (syncHistoryEnabled && Array.isArray(cloudData?.history)) {
        mergedHistory = history.mergeEntries(cloudData.history);
        this.emit('historyUpdated', history.entries);
      }

      let mergedReadingList = localReadingList;
      if (syncReadingListEnabled && Array.isArray(cloudData?.readingList)) {
        mergedReadingList = mergeReadingList(localReadingList, cloudData.readingList);
        settings.set('data.readingList', mergedReadingList, { silent: true });
        this.emit('readingListUpdated', mergedReadingList);
      }

      let mergedNotes = localNotes;
      if (syncNotesEnabled && Array.isArray(cloudData?.notes)) {
        mergedNotes = mergeNotes(localNotes, cloudData.notes);
        settings.set('data.notes', mergedNotes, { silent: true });
        this.emit('notesUpdated', mergedNotes);
      }

      if (syncSettingsEnabled && cloudData?.settings && typeof cloudData.settings === 'object') {
        const patch = mergeSettings(localSettings, cloudData.settings);
        if (session.provider === 'neocrom') {
          delete patch['data.readingList'];
          delete patch['data.notes'];
          const baseline = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, settingFingerprint(value)]));
          settings.set('account.session', { ...settings.value('account.session'), settingBaseline: baseline }, { silent: true });
        }
        settings.merge(patch, { silent: true });
      }

      const now = new Date().toISOString();
      this.lastSyncedAt = now;
      settings.set('account.lastSyncTime', now);
      this.status = 'synced';
      this.lastError = null;
      this.broadcastStatus();

      if (!silent) {
        this.emit('toast', { message: 'toast.syncSuccess', kind: 'success' });
      }

      return {
        ok: true,
        syncedAt: now,
        bookmarksCount: mergedBookmarks.length,
      };
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message || 'syncFailed';
      this.broadcastStatus();

      if (!silent) {
        this.emit('toast', { message: 'toast.syncFailed', kind: 'error' });
      }
      return { ok: false, error: this.lastError };
    } finally {
      this.isSyncing = false;
    }
  }

  /* --------------------------------------------------- Supabase implementation */

  async _supabaseSignUp(email, password) {
    const url = (settings.value('account.supabaseUrl') || '').replace(/\/$/, '');
    const key = settings.value('account.supabaseAnonKey');
    if (!url || !key) throw new Error('missingSupabaseConfig');

    const res = await this.fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'signUpFailed');

    const token = data.access_token || (data.session && data.session.access_token);
    const user = data.user || (data.session && data.session.user);
    if (!token && !user) throw new Error('signUpConfirmEmailRequired');

    return {
      provider: 'supabase',
      token,
      refreshToken: data.refresh_token || (data.session && data.session.refresh_token),
      user: { id: user?.id || data.id, email: user?.email || email },
    };
  }

  async _supabaseSignIn(email, password) {
    const url = (settings.value('account.supabaseUrl') || '').replace(/\/$/, '');
    const key = settings.value('account.supabaseAnonKey');
    if (!url || !key) throw new Error('missingSupabaseConfig');

    const res = await this.fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'invalidCredentials');

    return {
      provider: 'supabase',
      token: data.access_token,
      refreshToken: data.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    };
  }

  async _supabaseSync(session, { bookmarks, history: localHistory = [], readingList: localReadingList = [], notes: localNotes = [], settings: currentSettings }) {
    const url = (settings.value('account.supabaseUrl') || '').replace(/\/$/, '');
    const key = settings.value('account.supabaseAnonKey');
    if (!url || !key) throw new Error('missingSupabaseConfig');

    // Prepare payload (encrypt if passphrase is provided)
    let payload = {
      bookmarks,
      history: localHistory,
      readingList: localReadingList,
      notes: localNotes,
      settings: currentSettings,
      updatedAt: new Date().toISOString(),
    };
    if (this.syncPassphrase) {
      payload = encryptSyncPayload(payload, this.syncPassphrase);
    }

    // Try reading existing data first from user_metadata (zero SQL setup required)
    let remoteData = null;
    const userRes = await this.fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: 'Bearer ' + session.token },
    });

    if (userRes.ok) {
      const userData = await userRes.json();
      const rawSync = userData.user_metadata?.horizon_sync || userData.user_metadata?.hinterland_sync;
      if (rawSync) {
        remoteData = rawSync.encrypted && this.syncPassphrase
          ? decryptSyncPayload(rawSync, this.syncPassphrase)
          : rawSync;
      }
    }

    // Merge remote bookmarks, history, readingList, notes and settings with local
    const mergedBookmarks = mergeBookmarks(bookmarks, remoteData?.bookmarks ?? []);
    const mergedHistory = mergeHistory(localHistory, remoteData?.history ?? []);
    const mergedReadingList = mergeReadingList(localReadingList, remoteData?.readingList ?? []);
    const mergedNotes = mergeNotes(localNotes, remoteData?.notes ?? []);
    const mergedSettings = { ...(remoteData?.settings ?? {}), ...currentSettings };

    let toSave = {
      bookmarks: mergedBookmarks,
      history: mergedHistory,
      readingList: mergedReadingList,
      notes: mergedNotes,
      settings: mergedSettings,
      updatedAt: new Date().toISOString(),
    };

    if (this.syncPassphrase) {
      toSave = encryptSyncPayload(toSave, this.syncPassphrase);
    }

    // Push merged state back to Supabase user_metadata
    await this.fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + session.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: { horizon_sync: toSave },
      }),
    });

    return {
      bookmarks: mergedBookmarks,
      history: mergedHistory,
      readingList: mergedReadingList,
      notes: mergedNotes,
      settings: mergedSettings,
      updatedAt: toSave.updatedAt,
    };
  }

  /* --------------------------------------------------- Horizon Serverless */

  async _horizonSignUp(email, password) {
    const endpoint = settings.value('account.serverUrl');
    if (!endpoint) throw new Error('neocromIdRequired');
    const res = await this.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'signUpFailed');

    return {
      provider: 'horizon',
      token: data.token,
      user: data.user,
    };
  }

  async _horizonSignIn(email, password) {
    const endpoint = settings.value('account.serverUrl');
    if (!endpoint) throw new Error('neocromIdRequired');
    const res = await this.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'invalidCredentials');

    return {
      provider: 'horizon',
      token: data.token,
      user: data.user,
    };
  }

  async _horizonSync(session, { bookmarks, history: localHistory = [], readingList: localReadingList = [], notes: localNotes = [], settings: currentSettings }) {
    const endpoint = settings.value('account.serverUrl');
    if (!endpoint) throw new Error('neocromIdRequired');

    let payloadData = {
      bookmarks,
      history: localHistory,
      readingList: localReadingList,
      notes: localNotes,
      settings: currentSettings,
      updatedAt: new Date().toISOString(),
    };
    if (this.syncPassphrase) {
      payloadData = encryptSyncPayload(payloadData, this.syncPassphrase);
    }

    const res = await this.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.token,
      },
      body: JSON.stringify({
        action: 'sync',
        token: session.token,
        data: payloadData,
        updatedAt: new Date().toISOString(),
      }),
    });

    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.error || 'syncFailed');

    let returnedData = result.data || result;
    if (returnedData.encrypted && this.syncPassphrase) {
      returnedData = decryptSyncPayload(returnedData, this.syncPassphrase);
    }

    return returnedData;
  }

  async neocromSync(session, local, flags, direction) {
    const passphrase = this.neocromPassphrase(session);
    if (!passphrase || passphrase.length < 12) throw new Error('syncPassphraseRequired');
    const path = '/api/horizon/sync';
    const options = { token: session.token, fetch: this.fetch };
    for (let attempt = 0; attempt < 3; attempt++) {
      const { revision, snapshot } = await neocromRequest(path, options);
      const remote = snapshot ? decryptSyncPayload(snapshot, passphrase) : {};
      if (direction === 'pull') return remote;
      const merged = { ...remote };
      const mergers = { bookmarks: mergeBookmarks, history: mergeHistory, readingList: mergeReadingList, notes: mergeNotes,
        settings: (current, prior) => {
          const next = { ...current, ...mergeSettings(current, prior) };
          for (const [key, value] of Object.entries(current)) {
            const baseline = session.settingBaseline?.[key];
            if (baseline && settingFingerprint(value) !== baseline) next[key] = value;
          }
          return next;
        } };
      for (const [field, merge] of Object.entries(mergers)) {
        if (flags[field]) merged[field] = merge(local[field], remote[field]);
      }
      try {
        await neocromRequest(path, { ...options, method: 'PUT', body: { revision, snapshot: encryptSyncPayload(merged, passphrase) } });
        return merged;
      } catch (error) {
        if (error.status !== 409 || attempt === 2) throw error;
      }
    }
  }
}

const settingFingerprint = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const syncService = new SyncService();
