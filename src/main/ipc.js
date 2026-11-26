import { ipcMain, dialog, shell, app, clipboard, BrowserWindow, nativeImage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NEW_TAB_URL, DEFAULT_SHORTCUTS } from './constants.js';
import { settings } from './settings.js';
import { exportSchema } from './schema.js';
import { translations, availableLanguages, resolveLanguage, translate } from './i18n.js';
import { passwords } from './passwords.js';
import { syncService } from './sync.js';
import { normalizeDomain } from '../extensions/hinterlandPass/crypto.js';
import { tabs } from './tabs.js';
import { surface } from './windows.js';
import { extensions } from './extensions.js';
import { hinterStore } from './store.js';
import { history } from './history.js';
import { resolveTarget, suggestionList, activeEngines } from './navigation.js';
import { isInternalUrl } from './protocol.js';
import { openExternal, blockedSummary, handOffToSystem, stripTracking, toggleSiteShield, getSiteShield, getBlockedForDomain } from './security.js';
import updater from 'electron-updater';
const { autoUpdater } = updater;
import { applySettings, clearBrowsingData, downloadDirectory, clearSiteData, getSiteCookies, deleteSiteCookie, clearSiteCookies, getSiteStorageStats } from './sessions.js';
import { getDownloadHistory, clearDownloadHistory, clearCompletedDownloads, clearFailedDownloads, removeDownloadHistoryItem, openDownloadedFile } from './downloads.js';
import { applyContentSettings } from './content.js';

const registered = new Set();

function handle(channel, handler) {
  if (registered.has(channel)) return;
  registered.add(channel);
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.warn(`[Hinterland] ${channel} failed.`, error?.message ?? error);
      return { ok: false, error: error?.message ?? 'unknown' };
    }
  });
}

function activeTab(id) {
  const tab = id ? tabs.byId(id) : tabs.active;
  if (!tab || !tab.contents || tab.contents.isDestroyed()) return null;
  return tab;
}

function language() {
  return resolveLanguage(settings.value('general.language'));
}

export function installIpc() {
  /* ------------------------------------------------------------ bootstrap */
  handle('app:bootstrap', () => ({
    app: { name: app.getName(), version: app.getVersion(), platform: process.platform, locale: language() },
    languages: availableLanguages(),
    strings: translations(language()),
    settings: settings.all(),
    schema: exportSchema(),
    defaults: DEFAULT_SHORTCUTS,
    tabs: tabs.snapshot(),
    window: surface.state(),
    extensions: extensions.list(),
    startUrl: startupUrl(),
  }));

  handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    locale: language(),
    userData: app.getPath('userData'),
    downloads: downloadDirectory(),
    blocked: blockedSummary(),
    electron: process.versions.electron,
    node: process.versions.node,
    v8: process.versions.v8,
  }));

  const normalizeComparableUrl = (raw) => String(raw || '').trim().replace(/\/+$/, '').toLowerCase();

  const copyUniqueUrls = (source, emptyToast, successToast, extraData = {}) => {
    const uniqueUrls = [];
    const seen = new Set();
    for (const raw of source || []) {
      const url = typeof raw === 'string' ? raw.trim() : '';
      if (!url || seen.has(url)) continue;
      seen.add(url);
      uniqueUrls.push(url);
    }
    if (!uniqueUrls.length) {
      surface.send('toast', { message: emptyToast, kind: 'warning', data: extraData });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(uniqueUrls.join('\n'));
    surface.send('toast', { message: successToast, kind: 'success', data: { count: uniqueUrls.length, ...extraData } });
    return { ok: true, count: uniqueUrls.length };
  };

  const validateHttpUrls = (candidates, limit = 30) => {
    const seen = new Set();
    const urls = [];
    for (const candidate of candidates || []) {
      const cleaned = String(candidate || '').trim().replace(/[.,;:!?]+$/, '');
      if (!cleaned) continue;
      try {
        const parsed = new URL(cleaned);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        const normalized = parsed.href;
        if (!seen.has(normalized)) {
          seen.add(normalized);
          urls.push(normalized);
        }
      } catch {}
      if (urls.length >= limit) break;
    }
    return urls;
  };

  const extractValidatedUrlsFromClipboard = (limit = 30) => {
    const raw = clipboard.readText() || '';
    const matches = raw.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
    return validateHttpUrls(matches, limit);
  };

  const openValidatedUrlsInTabs = (candidates, { limit = 30, emptyToast, successToast } = {}) => {
    const urls = validateHttpUrls(candidates, limit);
    if (!urls.length) {
      if (emptyToast) surface.send('toast', { message: emptyToast, kind: 'warning' });
      return { ok: false, count: 0, urls: [] };
    }
    for (const url of urls) {
      tabs.create({ url, background: true });
    }
    if (successToast) surface.send('toast', { message: successToast, kind: 'success', data: { count: urls.length } });
    return { ok: true, count: urls.length, urls };
  };

  handle('app:copyDiagnostics', () => {
    const blockedCount = blockedSummary().reduce((sum, entry) => sum + (Number(entry.count) || 0), 0);
    const lines = [
      `# ${app.getName()} Diagnostics`,
      '',
      `- **Version**: ${app.getVersion()}`,
      `- **Platform**: ${process.platform} (${process.arch})`,
      `- **Locale**: ${language()}`,
      `- **Electron**: ${process.versions.electron}`,
      `- **Chromium**: ${process.versions.chrome || 'unknown'}`,
      `- **Node**: ${process.versions.node}`,
      `- **Open Tabs**: ${tabs.list.length} (${tabs.list.filter((t) => t.sleeping).length} sleeping)`,
      `- **Blocked Requests (Session)**: ${blockedCount}`,
    ];
    const diagnostics = lines.join('\n');
    clipboard.writeText(diagnostics);
    surface.send('toast', { message: 'toast.diagnosticsCopied', kind: 'success' });
    return { ok: true, diagnostics };
  });

  handle('shortcuts:copyMarkdown', (markdown) => {
    const text = typeof markdown === 'string' ? markdown.trim() : '';
    if (!text) {
      surface.send('toast', { message: 'toast.noShortcutsToCopy', kind: 'warning' });
      return { ok: false };
    }
    clipboard.writeText(text);
    surface.send('toast', { message: 'toast.shortcutsCopied', kind: 'success' });
    return { ok: true };
  });

  handle('app:openFolder', (target) => {
    const folder = target === 'userData' ? app.getPath('userData') : downloadDirectory();
    shell.openPath(folder).catch(() => {});
    return true;
  });

  handle('app:revealFile', (path) => {
    if (typeof path !== 'string' || !path.trim()) return false;
    shell.showItemInFolder(path);
    return true;
  });

  handle('app:getClipboardText', () => clipboard.readText());

  handle('app:copyImage', (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return false;
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (!img.isEmpty()) {
        clipboard.writeImage(img);
        return true;
      }
    } catch (e) {
      console.warn('[Hinterland] Error copying image to clipboard:', e?.message ?? e);
    }
    return false;
  });

  /* -------------------------------------------------------- task manager & metrics */
  const collectAppMetrics = () => {
    const metrics = app.getAppMetrics();
    const tabList = tabs.list;
    const tabByPid = new Map();

    for (const tab of tabList) {
      if (!tab.contents || tab.contents.isDestroyed()) continue;
      try {
        const pid = (typeof tab.contents.getOSProcessId === 'function' ? tab.contents.getOSProcessId() : null) || tab.contents.getProcessId();
        if (!tabByPid.has(pid)) tabByPid.set(pid, []);
        tabByPid.get(pid).push(tab.snapshot());
      } catch {
        // ignore
      }
    }

    let totalMemoryKB = 0;
    const processes = metrics.map((item) => {
      const memoryKB = item.memory ? (item.memory.workingSetSize || item.memory.privateBytes || 0) : 0;
      totalMemoryKB += memoryKB;
      const cpuPercent = item.cpu ? Math.round(item.cpu.percentCPUUsage * 10) / 10 : 0;
      const associatedTabs = tabByPid.get(item.pid) || [];

      return {
        pid: item.pid,
        type: item.type,
        cpu: cpuPercent,
        memoryKB,
        tabs: associatedTabs,
      };
    });

    return {
      processes,
      totalMemoryKB,
      tabCount: tabList.length,
      processCount: processes.length,
    };
  };

  handle('app:metrics', () => collectAppMetrics());

  handle('app:copyMetricsSummary', () => {
    const data = collectAppMetrics();
    const saverStats = tabs.getMemorySaverStats();
    const totalMB = (data.totalMemoryKB / 1024).toFixed(1);
    const lines = [
      `# ${app.getName()} Task Manager Report`,
      '',
      `- **Generated**: ${new Date().toISOString()}`,
      `- **Total Memory**: ${totalMB} MB`,
      `- **Processes**: ${data.processCount}`,
      `- **Open Tabs**: ${data.tabCount}`,
      `- **Memory Saver**: ${saverStats.enabled ? 'Enabled' : 'Disabled'} (${saverStats.sleepingCount} sleeping, ~${saverStats.estimatedSavedMB} MB saved)`,
      '',
      '| Type | PID | Memory (MB) | CPU (%) | Tab / Details |',
      '| --- | ---: | ---: | ---: | --- |',
    ];
    const sorted = [...data.processes].sort((a, b) => (b.memoryKB || 0) - (a.memoryKB || 0)).slice(0, 25);
    for (const proc of sorted) {
      const firstTab = proc.tabs?.[0];
      const detail = firstTab ? String(firstTab.title || firstTab.url || 'Tab').replace(/\|/g, '/') : proc.type;
      lines.push(`| ${proc.type} | ${proc.pid} | ${(proc.memoryKB / 1024).toFixed(1)} | ${proc.cpu} | ${detail} |`);
    }
    clipboard.writeText(lines.join('\n'));
    surface.send('toast', { message: 'toast.taskReportCopied', kind: 'success' });
    return { ok: true, processCount: data.processCount };
  });

  handle('app:killProcess', (pid) => {
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
    try {
      process.kill(pid);
      return true;
    } catch {
      return false;
    }
  });

  handle('app:isDefaultBrowser', () => {
    try {
      return app.isDefaultProtocolClient('http');
    } catch {
      return false;
    }
  });

  handle('app:setDefaultBrowser', () => {
    try {
      const okHttp = app.setAsDefaultProtocolClient('http');
      const okHttps = app.setAsDefaultProtocolClient('https');
      const okHinterland = app.setAsDefaultProtocolClient('hinterland');
      try {
        shell.openExternal('ms-settings:defaultapps');
      } catch {}
      surface.send('toast', { message: 'toast.defaultBrowserSet', kind: 'success' });
      return Boolean(okHttp || okHttps || okHinterland);
    } catch {
      return false;
    }
  });

  /* ------------------------------------------------------------- settings */
  handle('settings:get', (key) => (key ? settings.value(key) : settings.all()));
  handle('settings:set', (key, value) => {
    const changed = settings.set(key, value);
    return { changed, values: settings.all() };
  });
  handle('settings:merge', (patch) => {
    settings.merge(patch);
    return settings.all();
  });
  handle('settings:reset', (key) => {
    settings.reset(key);
    return settings.all();
  });
  handle('settings:resetAll', () => {
    settings.resetAll();
    return settings.all();
  });
  handle('settings:export', () => settings.export());

  handle('settings:import', (text) => {
    try {
      const count = settings.import(text, { replace: true });
      applySettings();
      applyContentSettings(tabs.list);
      return { ok: true, count, values: settings.all() };
    } catch {
      return { ok: false, error: 'invalidJson' };
    }
  });

  handle('settings:saveFile', async (name, content) => {
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: name || 'hinterland.settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, content, 'utf8');
    return { ok: true, path: result.filePath };
  });

  handle('settings:loadFile', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled) return { ok: false };
    const text = await readFile(result.filePaths[0], 'utf8');
    try {
      const count = settings.import(text, { replace: true });
      applySettings();
      applyContentSettings(tabs.list);
      return { ok: true, count, values: settings.all() };
    } catch {
      return { ok: false, error: 'invalidJson' };
    }
  });

  handle('settings:pickDirectory', async (key) => {
    const result = await dialog.showOpenDialog(chromeWindow(), { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return settings.value(key);
    settings.set(key, result.filePaths[0]);
    applySettings();
    return result.filePaths[0];
  });

  handle('settings:pickFile', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), { properties: ['openFile'] });
    return result.canceled ? '' : result.filePaths[0];
  });

  /* ------------------------------------------------------------- chrome ui */
  handle('chrome:height', (height) => {
    surface.setChromeHeight(height);
    return true;
  });

  handle('chrome:popup', (bottom) => {
    surface.setPopupBottom(bottom);
    return true;
  });

  handle('chrome:fullscreen', (enabled) => {
    surface.setFullChrome(enabled);
    return true;
  });

  handle('window:minimize', () => surface.minimize());
  handle('window:maximize', () => {
    surface.toggleMaximize();
    return surface.state();
  });
  handle('window:fullscreen', () => {
    surface.toggleFullScreen();
    return surface.state();
  });
  handle('window:close', () => {
    surface.close();
    return true;
  });
  handle('window:state', () => surface.state());

  /* ----------------------------------------------------------------- tabs */
  handle('tabs:create', ({ url, background, privateMode, openerId } = {}) => {
    const target = resolveTarget(url || NEW_TAB_URL);
    const tab = tabs.create({
      url: target.url ?? NEW_TAB_URL,
      background: Boolean(background),
      privateMode: Boolean(privateMode),
      openerId: openerId ?? null,
    });
    return tab.snapshot();
  });

  handle('tabs:activate', (id) => tabs.activate(id));
  handle('tabs:close', (id) => tabs.close(id));
  handle('tabs:move', (id, index) => tabs.move(id, index));
  handle('tabs:pin', (id, pinned) => tabs.setPinned(id, pinned));
  handle('tabs:duplicate', (id) => {
    const copy = tabs.duplicate(id);
    return copy?.snapshot() ?? null;
  });
  handle('tabs:cycle', (delta) => tabs.cycle(delta));
  handle('tabs:reopen', (index) => tabs.reopenClosed(index));
  handle('tabs:recentlyClosed', () => tabs.recentlyClosed());
  handle('tabs:copyRecentlyClosedUrls', (urls = null) => {
    const source = Array.isArray(urls) ? urls : (tabs.recentlyClosed() || []).map((entry) => entry?.url);
    return copyUniqueUrls(source, 'toast.noRecentlyClosedToCopy', 'toast.recentlyClosedUrlsCopied');
  });
  handle('tabs:copyRecentlyClosedMarkdown', (entries = null) => {
    const source = (Array.isArray(entries) ? entries : (tabs.recentlyClosed() || [])).filter((entry) => entry?.url);
    if (!source.length) {
      surface.send('toast', { message: 'toast.noRecentlyClosedToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const lines = ['# Recently Closed Tabs', ''];
    for (const entry of source) {
      const title = String(entry.title || entry.url || 'Untitled').replace(/[\[\]]/g, '');
      lines.push(`- [${title}](${entry.url})`);
    }
    clipboard.writeText(lines.join('\n'));
    surface.send('toast', { message: 'toast.recentlyClosedMarkdownCopied', kind: 'success', data: { count: source.length } });
    return { ok: true, count: source.length };
  });
  handle('tabs:copyRecentlyClosedJson', (entries = null) => {
    const source = (Array.isArray(entries) ? entries : (tabs.recentlyClosed() || [])).filter((entry) => entry?.url);
    if (!source.length) {
      surface.send('toast', { message: 'toast.noRecentlyClosedToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(source, null, 2));
    surface.send('toast', { message: 'toast.recentlyClosedJsonCopied', kind: 'success', data: { count: source.length } });
    return { ok: true, count: source.length };
  });
  handle('tabs:stashRecentlyClosed', (entries = null) => {
    const source = (Array.isArray(entries) ? entries : (tabs.recentlyClosed() || [])).filter(
      (entry) => entry?.url && (entry.url.startsWith('http://') || entry.url.startsWith('https://')),
    );
    if (!source.length) {
      surface.send('toast', { message: 'toast.noRecentlyClosedToStash', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const dateStr = new Date().toLocaleDateString('en-CA');
    const newStash = {
      id: `stash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: `Recently Closed (${dateStr})`,
      createdAt: Date.now(),
      tabs: source.map((entry) => ({
        url: entry.url,
        title: entry.title || entry.url,
        favicon: entry.favicon || '',
      })),
    };
    const stashes = [...(settings.value('data.tabStashes') || [])];
    stashes.unshift(newStash);
    settings.set('data.tabStashes', stashes);
    surface.send('toast', { message: 'toast.recentlyClosedStashed', kind: 'success', data: { count: source.length } });
    return { ok: true, stash: newStash, count: source.length };
  });
  handle('tabs:restoreClosed', (index) => tabs.reopenClosed(index));
  handle('tabs:clearRecentlyClosed', () => tabs.clearRecentlyClosed());
  handle('tabs:restoreAllClosed', () => tabs.restoreAllClosed());
  handle('tabs:closeOthers', async (id) => {
    const keep = activeTab(id);
    for (const tab of [...tabs.list]) {
      if (tab.id === keep?.id || tab.pinned) continue;
      await tabs.close(tab.id, { force: true });
    }
    return tabs.snapshot();
  });
  handle('tabs:closeRight', (id) => tabs.closeRight(id));
  handle('tabs:closeLeft', (id) => tabs.closeLeft(id));
  handle('tabs:closeAll', () => tabs.closeAll());
  handle('tabs:muteOthers', (id) => {
    const keep = activeTab(id);
    for (const tab of tabs.list) {
      if (tab.id === keep?.id || !tab.contents || tab.contents.isDestroyed()) continue;
      tab.muted = true;
      tab.contents.setAudioMuted(true);
      surface.send('tab:update', { ...tab.snapshot(), id: tab.id });
    }
    return true;
  });
  handle('tabs:sleepOthers', (id) => tabs.sleepOthers(id));
  handle('tabs:memorySaverStats', () => tabs.getMemorySaverStats());
  handle('tabs:exemptDomain', (domain) => tabs.exemptDomain(domain));
  handle('tabs:unexemptDomain', (domain) => tabs.unexemptDomain(domain));
  handle('tabs:getExemptDomains', () => tabs.getExemptDomains());
  handle('tabs:sleepInactive', (delay) => tabs.sleepInactive(delay));
  handle('tabs:wakeAll', () => {
    const count = tabs.wakeAll();
    surface.send('toast', {
      message: count > 0 ? 'toast.wokeAllTabs' : 'toast.noSleepingTabs',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: true, count };
  });
  handle('tabs:focusAudible', () => {
    const res = tabs.focusAudible();
    if (!res.ok) {
      surface.send('toast', { message: 'toast.noAudibleTabs', kind: 'info' });
      return { ok: false };
    }
    surface.send('toast', {
      message: 'toast.focusedAudibleTab',
      kind: 'info',
      data: { title: res.tab?.title || res.tab?.url || 'Tab' },
    });
    return res;
  });
  handle('tabs:reloadAll', () => {
    for (const tab of tabs.list) {
      if (!tab.contents || tab.contents.isDestroyed()) continue;
      tab.contents.reload();
    }
    return true;
  });

  handle('tabs:reloadOthers', (id) => {
    const count = tabs.reloadOthers(id);
    surface.send('toast', {
      message: count > 0 ? 'toast.reloadedOtherTabs' : 'toast.noOtherTabsToReload',
      kind: count > 0 ? 'info' : 'warning',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('tabs:closeDuplicates', async () => {
    const count = await tabs.closeDuplicates();
    surface.send('toast', {
      message: count > 0 ? 'toast.duplicateTabsClosed' : 'toast.noDuplicateTabs',
      kind: count > 0 ? 'success' : 'info',
    });
    return count;
  });

  handle('tabs:muteAll', (muted = true) => {
    const count = tabs.muteAll(muted);
    surface.send('toast', {
      message: muted ? 'toast.allTabsMuted' : 'toast.allTabsUnmuted',
      kind: 'info',
    });
    return count;
  });

  handle('tabs:sortByTitle', (ascending = true) => {
    const count = tabs.sortByTitle(ascending);
    surface.send('toast', {
      message: 'toast.tabsSortedByTitle',
      kind: 'success',
    });
    return { ok: true, count };
  });

  handle('tabs:sortByDomain', (ascending = true) => {
    const count = tabs.sortByDomain(ascending);
    surface.send('toast', {
      message: 'toast.tabsSortedByDomain',
      kind: 'success',
    });
    return { ok: true, count };
  });

  /* ------------------------------------------------------------- tab groups */
  function sortedGroups() {
    const groups = [...(settings.value('tabs.groups', []))];
    return groups
      .map((group, index) => ({ ...group, order: typeof group.order === 'number' ? group.order : index }))
      .sort((a, b) => a.order - b.order);
  }

  function persistGroups(groups) {
    const normalized = groups.map((group, index) => ({
      id: group.id,
      name: String(group.name || 'New group').trim().slice(0, 40) || 'New group',
      color: /^#[0-9a-f]{6}$/i.test(group.color || '') ? group.color : '#4f7cff',
      collapsed: Boolean(group.collapsed),
      order: index,
    }));
    settings.set('tabs.groups', normalized);
    surface.send('tabs:groups', normalized);
    return normalized;
  }

  handle('tabs:groups', () => sortedGroups());

  handle('tabs:groupCreate', (group) => {
    const groups = sortedGroups();
    const id = group?.id ?? `g${Date.now().toString(36)}`;
    groups.push({
      id,
      name: group?.name || 'New group',
      color: group?.color || '#4f7cff',
      collapsed: false,
    });
    return persistGroups(groups);
  });

  handle('tabs:groupUpdate', (id, patch) => {
    const groups = sortedGroups();
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    if (patch && typeof patch === 'object') {
      if (typeof patch.name === 'string') groups[idx].name = patch.name;
      if (typeof patch.color === 'string') groups[idx].color = patch.color;
      if (typeof patch.collapsed === 'boolean') groups[idx].collapsed = patch.collapsed;
    }
    persistGroups(groups);
    return true;
  });

  handle('tabs:groupRename', (id, name) => {
    const groups = sortedGroups();
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    const trimmed = String(name ?? '').trim().slice(0, 40);
    if (!trimmed) return { ok: false, error: 'emptyName' };
    groups[idx].name = trimmed;
    persistGroups(groups);
    return { ok: true, name: trimmed };
  });

  handle('tabs:groupRecolor', (id, color) => {
    const groups = sortedGroups();
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    if (!/^#[0-9a-f]{6}$/i.test(String(color || ''))) return { ok: false, error: 'invalidColor' };
    groups[idx].color = color;
    persistGroups(groups);
    return { ok: true, color };
  });

  handle('tabs:groupReorder', (id, targetIndex) => {
    const groups = sortedGroups();
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    const [moved] = groups.splice(idx, 1);
    const clamped = Math.max(0, Math.min(Number(targetIndex) || 0, groups.length));
    groups.splice(clamped, 0, moved);
    persistGroups(groups);
    return true;
  });

  handle('tabs:groupDelete', (id) => {
    const groups = sortedGroups().filter((g) => g.id !== id);
    persistGroups(groups);
    for (const tab of tabs.list) {
      if (tab.groupId === id) {
        tab.groupId = null;
        surface.send('tab:update', tab.snapshot());
      }
    }
    tabs.scheduleSave();
    return true;
  });

  handle('tabs:setGroup', (tabId, groupId, index = null) => {
    const tab = tabs.byId(tabId);
    if (!tab) return false;
    const groups = sortedGroups();
    const match = groups.find((g) => g.id === groupId || g.name === groupId);
    tab.groupId = match ? match.id : (groupId ?? null);
    tabs.scheduleSave();
    surface.send('tab:update', tab.snapshot());
    return true;
  });

  handle('tabs:groupMoveTab', (tabId, groupId, index = null) => {
    const tab = tabs.byId(tabId);
    if (!tab) return false;
    const groups = sortedGroups();
    const match = groupId ? groups.find((g) => g.id === groupId || g.name === groupId) : null;
    tab.groupId = match ? match.id : (groupId ?? null);
    tabs.scheduleSave();
    surface.send('tab:update', tab.snapshot());
    surface.send('tabs:sync', tabs.snapshot());
    return true;
  });

  handle('tabs:groupStash', async (groupId) => {
    const groups = sortedGroups();
    const group = groups.find((g) => g.id === groupId);
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId && !isInternalUrl(t.url));
    if (!tabsInGroup.length) {
      surface.send('toast', { message: 'toast.noTabsInGroupToStash', kind: 'warning' });
      return { ok: false, error: 'no_tabs' };
    }
    const groupTitle = group?.name || 'Tab Group';
    const dateStr = new Date().toLocaleDateString();
    const newStash = {
      id: `stash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: `${groupTitle} (${dateStr})`,
      createdAt: Date.now(),
      color: group?.color || '#4f7cff',
      tabs: tabsInGroup.map((t) => ({
        url: t.url,
        title: t.title || t.url,
        favicon: t.favicon || '',
      })),
    };
    const stashes = [...(settings.value('data.tabStashes') || [])];
    stashes.unshift(newStash);
    settings.set('data.tabStashes', stashes);

    for (const t of tabsInGroup) {
      tabs.close(t.id);
    }
    surface.send('toast', { message: 'toast.groupStashed', kind: 'success' });
    return { ok: true, stash: newStash, count: tabsInGroup.length };
  });

  handle('tabs:groupCloseTabs', (groupId) => {
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId);
    if (!tabsInGroup.length) return { ok: true, count: 0 };
    for (const t of tabsInGroup) {
      tabs.close(t.id);
    }
    surface.send('toast', { message: 'toast.groupTabsClosed', kind: 'info' });
    return { ok: true, count: tabsInGroup.length };
  });

  handle('tabs:groupByDomain', async () => {
    const allTabs = tabs.list;
    const groups = sortedGroups();
    const colors = [
      '#388bfd', // sapphire
      '#2ea043', // emerald
      '#d29922', // amber
      '#f85149', // ruby
      '#a371f7', // purple
      '#39c5bb', // cyan
      '#8b949e', // slate
    ];

    const domainMap = new Map();
    for (const tab of allTabs) {
      if (!tab.url || tab.url === NEW_TAB_URL || tab.url === 'about:blank' || tab.url.startsWith('hinterland://')) continue;
      const domain = normalizeDomain(tab.url);
      if (!domain) continue;
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain).push(tab);
    }

    if (domainMap.size === 0) {
      surface.send('toast', { message: 'toast.noTabsToGroup', kind: 'info' });
      return { ok: false, count: 0, groupsCreated: 0 };
    }

    let groupsCreated = 0;
    let tabsGrouped = 0;

    for (const [domain, tabList] of domainMap.entries()) {
      const cleanName = domain.replace(/^www\./i, '');
      let group = groups.find((g) => g.name.toLowerCase() === cleanName.toLowerCase() || g.name.toLowerCase() === domain.toLowerCase());
      if (!group) {
        const color = colors[groups.length % colors.length];
        const id = `g${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        group = {
          id,
          name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
          color,
          collapsed: false,
          order: groups.length,
        };
        groups.push(group);
        groupsCreated++;
      }

      for (const tab of tabList) {
        if (tab.groupId !== group.id) {
          tab.groupId = group.id;
          tabsGrouped++;
          surface.send('tab:update', tab.snapshot());
        }
      }
    }

    if (groupsCreated > 0) {
      persistGroups(groups);
    }
    tabs.scheduleSave();
    surface.send('tabs:sync', tabs.snapshot());
    surface.send('toast', {
      message: 'toast.tabsGroupedByDomain',
      kind: 'success',
      data: { count: tabsGrouped, groups: groupsCreated },
    });

    return { ok: true, count: tabsGrouped, groupsCreated };
  });

  handle('tabs:ungroupAll', () => {
    const count = tabs.ungroupAll();
    surface.send('tabs:sync', tabs.snapshot());
    surface.send('toast', {
      message: count > 0 ? 'toast.allTabsUngrouped' : 'toast.noGroupedTabs',
      kind: count > 0 ? 'success' : 'info',
    });
    return { ok: true, count };
  });

  handle('tabs:groupCopyMarkdown', (groupId) => {
    const groups = sortedGroups();
    const group = groups.find((g) => g.id === groupId);
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId && !isInternalUrl(t.url));
    if (!tabsInGroup.length) {
      surface.send('toast', { message: 'toast.noTabsInGroupToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const groupTitle = group?.name || 'Tab Group';
    const lines = [`## ${groupTitle}`, ''];
    for (const tab of tabsInGroup) {
      const title = String(tab.title || tab.url || 'Untitled').replace(/[\[\]]/g, '');
      lines.push(`- [${title}](${tab.url})`);
    }
    clipboard.writeText(lines.join('\n'));
    surface.send('toast', { message: 'toast.groupLinksCopied', kind: 'success' });
    return { ok: true, count: tabsInGroup.length };
  });

  handle('tabs:groupCopyUrls', (groupId) => {
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId && t.url && !isInternalUrl(t.url));
    if (!tabsInGroup.length) {
      surface.send('toast', { message: 'toast.noTabsInGroupToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(tabsInGroup.map((t) => t.url).join('\n'));
    surface.send('toast', { message: 'toast.groupUrlsCopied', kind: 'success', data: { count: tabsInGroup.length } });
    return { ok: true, count: tabsInGroup.length };
  });

  handle('tabs:groupPruneEmpty', () => {
    const groups = sortedGroups();
    const activeGroupIds = new Set(tabs.list.map((t) => t.groupId).filter(Boolean));
    const kept = groups.filter((g) => activeGroupIds.has(g.id));
    const removed = groups.length - kept.length;
    if (removed > 0) {
      persistGroups(kept);
      surface.send('toast', { message: 'toast.emptyGroupsPruned', kind: 'success', data: { count: removed } });
    } else {
      surface.send('toast', { message: 'toast.noEmptyGroups', kind: 'info' });
    }
    return { ok: removed > 0, removed };
  });

  handle('tabs:groupSetAllCollapsed', (collapsed = true) => {
    const groups = sortedGroups();
    if (!groups.length) {
      surface.send('toast', { message: 'toast.noTabGroups', kind: 'info' });
      return { ok: false, count: 0 };
    }
    const target = Boolean(collapsed);
    const updated = groups.map((g) => ({ ...g, collapsed: target }));
    persistGroups(updated);
    surface.send('toast', {
      message: target ? 'toast.groupsCollapsedAll' : 'toast.groupsExpandedAll',
      kind: 'success',
      data: { count: updated.length },
    });
    return { ok: true, count: updated.length, collapsed: target };
  });

  handle('tabs:groupOpenFromClipboard', () => {
    const urls = extractValidatedUrlsFromClipboard(20);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noUrlsInClipboard', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const groups = sortedGroups();
    const dateStr = new Date().toLocaleDateString('en-CA');
    const name = `Clipboard (${dateStr})`;
    const groupId = `g${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const colors = ['#388bfd', '#2ea043', '#d29922', '#f85149', '#a371f7', '#39c5bb', '#8b949e'];
    groups.push({
      id: groupId,
      name,
      color: colors[groups.length % colors.length],
      collapsed: false,
    });
    persistGroups(groups);
    for (let i = 0; i < urls.length; i++) {
      const created = tabs.create({ url: urls[i], background: i > 0 });
      if (created) {
        created.groupId = groupId;
        surface.send('tab:update', created.snapshot());
      }
    }
    tabs.scheduleSave();
    surface.send('tabs:sync', tabs.snapshot());
    surface.send('toast', {
      message: 'toast.groupOpenedFromClipboard',
      kind: 'success',
      data: { count: urls.length, name },
    });
    return { ok: true, groupId, count: urls.length };
  });

  handle('tabs:groupSortAlpha', () => {
    const groups = sortedGroups();
    if (groups.length < 2) {
      surface.send('toast', { message: groups.length ? 'toast.groupsSortedAlpha' : 'toast.noTabGroups', kind: 'info' });
      return { ok: groups.length > 0, count: groups.length };
    }
    groups.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    persistGroups(groups);
    surface.send('toast', { message: 'toast.groupsSortedAlpha', kind: 'success', data: { count: groups.length } });
    return { ok: true, count: groups.length };
  });

  const bookmarkTabEntries = (entries, folderName, { emptyToast, alreadyToast, successToast }) => {
    const webEntries = (entries || []).filter((t) => t?.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
    if (!webEntries.length) {
      surface.send('toast', { message: emptyToast, kind: 'warning' });
      return { ok: false, added: 0 };
    }
    const existing = [...(settings.value('data.bookmarks') ?? [])];
    const seen = new Set(existing.map((item) => normalizeComparableUrl(item?.url)).filter(Boolean));
    const folder = String(folderName || 'Tab Group').trim() || 'Tab Group';
    let added = 0;
    for (const entry of webEntries) {
      const key = normalizeComparableUrl(entry.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      existing.push({
        url: entry.url,
        title: (entry.title || entry.url).trim(),
        addedAt: Date.now(),
        folder,
      });
      added += 1;
    }
    if (!added) {
      surface.send('toast', { message: alreadyToast, kind: 'info' });
      return { ok: false, added: 0, total: existing.length };
    }
    settings.set('data.bookmarks', existing);
    surface.send('toast', { message: successToast, kind: 'success', data: { count: added, name: folder } });
    return { ok: true, added, total: existing.length };
  };

  handle('tabs:groupBookmark', (groupId) => {
    const groups = sortedGroups();
    const group = groups.find((g) => g.id === groupId);
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId);
    return bookmarkTabEntries(tabsInGroup, group?.name || 'Tab Group', {
      emptyToast: 'toast.noTabsInGroupToBookmark',
      alreadyToast: 'toast.allTabsAlreadyBookmarked',
      successToast: 'toast.groupBookmarked',
    });
  });

  handle('tabs:groupFocus', (groupId) => {
    const res = tabs.focusGroup(groupId);
    if (!res.ok) {
      surface.send('toast', { message: 'toast.noTabsInGroupToFocus', kind: 'info' });
      return { ok: false };
    }
    return res;
  });

  handle('tabs:groupSleep', (groupId) => {
    const count = tabs.sleepGroup(groupId);
    surface.send('toast', {
      message: count > 0 ? 'toast.groupSleptTabs' : 'toast.noTabsInGroupToSleep',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('tabs:groupWake', (groupId) => {
    const count = tabs.wakeGroup(groupId);
    surface.send('toast', {
      message: count > 0 ? 'toast.groupWokeTabs' : 'toast.noSleepingTabsInGroup',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('tabs:groupMute', (groupId, muted = null) => {
    const res = tabs.muteGroup(groupId, muted);
    if (!res.ok) {
      surface.send('toast', { message: 'toast.noTabsInGroupToMute', kind: 'info' });
      return { ok: false, count: 0 };
    }
    surface.send('toast', {
      message: res.muted ? 'toast.groupMutedTabs' : 'toast.groupUnmutedTabs',
      kind: 'info',
      data: { count: res.count },
    });
    return res;
  });

  handle('tabs:groupDuplicate', (groupId) => {
    const groups = sortedGroups();
    const source = groups.find((g) => g.id === groupId);
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId && t.url && !isInternalUrl(t.url));
    if (!source || !tabsInGroup.length) {
      surface.send('toast', { message: 'toast.noTabsInGroupToDuplicate', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const newGroupId = `g${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const newName = `${String(source.name || 'Tab Group').trim()} (Copy)`.slice(0, 40);
    groups.push({
      id: newGroupId,
      name: newName,
      color: source.color || '#4f7cff',
      collapsed: false,
    });
    persistGroups(groups);
    for (const tab of tabsInGroup) {
      const created = tabs.create({ url: tab.url, background: true, title: tab.title });
      if (created) {
        created.groupId = newGroupId;
        surface.send('tab:update', created.snapshot());
      }
    }
    tabs.scheduleSave();
    surface.send('tabs:sync', tabs.snapshot());
    surface.send('toast', {
      message: 'toast.groupDuplicated',
      kind: 'success',
      data: { count: tabsInGroup.length, name: newName },
    });
    return { ok: true, groupId: newGroupId, count: tabsInGroup.length };
  });

  handle('tabs:groupCopyJson', (groupId) => {
    const groups = sortedGroups();
    const group = groups.find((g) => g.id === groupId);
    const tabsInGroup = tabs.list.filter((t) => t.groupId === groupId && !isInternalUrl(t.url));
    if (!tabsInGroup.length) {
      surface.send('toast', { message: 'toast.noTabsInGroupToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const payload = {
      id: group?.id || groupId,
      name: group?.name || 'Tab Group',
      color: group?.color || '#4f7cff',
      tabs: tabsInGroup.map((t) => ({
        title: t.title || t.url,
        url: t.url,
        pinned: Boolean(t.pinned),
        sleeping: Boolean(t.sleeping),
      })),
    };
    clipboard.writeText(JSON.stringify(payload, null, 2));
    surface.send('toast', { message: 'toast.groupJsonCopied', kind: 'success', data: { count: tabsInGroup.length } });
    return { ok: true, count: tabsInGroup.length };
  });

  const formatOpenTabsMarkdown = () => {
    const webTabs = tabs.list.filter((t) => t.url && !isInternalUrl(t.url));
    if (!webTabs.length) return { count: 0, markdown: '' };
    const groups = sortedGroups();
    const dateStr = new Date().toLocaleDateString('en-CA');
    const lines = [`# Hinterland Open Tabs (${dateStr})`, ''];
    const groupedIds = new Set();

    for (const group of groups) {
      const members = webTabs.filter((t) => t.groupId === group.id);
      if (!members.length) continue;
      lines.push(`## ${group.name || 'Tab Group'}`, '');
      for (const tab of members) {
        groupedIds.add(tab.id);
        const title = String(tab.title || tab.url || 'Untitled').replace(/[\[\]]/g, '');
        lines.push(`- [${title}](${tab.url})`);
      }
      lines.push('');
    }

    const ungrouped = webTabs.filter((t) => !groupedIds.has(t.id));
    if (ungrouped.length) {
      if (groupedIds.size > 0) {
        lines.push('## Ungrouped', '');
      }
      for (const tab of ungrouped) {
        const title = String(tab.title || tab.url || 'Untitled').replace(/[\[\]]/g, '');
        lines.push(`- [${title}](${tab.url})`);
      }
      lines.push('');
    }

    return { count: webTabs.length, markdown: lines.join('\n').trim() };
  };

  handle('tabs:copyAllMarkdown', () => {
    const { count, markdown } = formatOpenTabsMarkdown();
    if (!count) {
      surface.send('toast', { message: 'toast.noTabsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(markdown);
    surface.send('toast', { message: 'toast.allTabsCopied', kind: 'success', data: { count } });
    return { ok: true, count };
  });

  handle('tabs:copyAllUrls', () => {
    const webTabs = tabs.list.filter((t) => t.url && !isInternalUrl(t.url));
    if (!webTabs.length) {
      surface.send('toast', { message: 'toast.noTabsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(webTabs.map((t) => t.url).join('\n'));
    surface.send('toast', { message: 'toast.allUrlsCopied', kind: 'success', data: { count: webTabs.length } });
    return { ok: true, count: webTabs.length };
  });

  handle('tabs:copyAllJson', () => {
    const webTabs = tabs.list.filter((t) => t.url && !isInternalUrl(t.url));
    if (!webTabs.length) {
      surface.send('toast', { message: 'toast.noTabsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const payload = webTabs.map((t) => ({
      id: t.id,
      title: t.title || t.url,
      url: t.url,
      pinned: Boolean(t.pinned),
      sleeping: Boolean(t.sleeping),
      groupId: t.groupId || null,
      audible: Boolean(t.audible),
      muted: Boolean(t.muted),
    }));
    clipboard.writeText(JSON.stringify(payload, null, 2));
    surface.send('toast', { message: 'toast.allTabsJsonCopied', kind: 'success', data: { count: payload.length } });
    return { ok: true, count: payload.length };
  });

  handle('tabs:openClipboardUrls', () => {
    const urls = extractValidatedUrlsFromClipboard(30);
    return openValidatedUrlsInTabs(urls, {
      limit: 30,
      emptyToast: 'toast.noUrlsInClipboard',
      successToast: 'toast.openedClipboardUrls',
    });
  });

  handle('tabs:unpinAll', () => {
    const count = tabs.unpinAll();
    surface.send('toast', {
      message: count > 0 ? 'toast.tabsUnpinnedAll' : 'toast.noPinnedTabs',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('tabs:copyDomainUrls', (id) => {
    const target = activeTab(id);
    if (!target) {
      surface.send('toast', { message: 'toast.noDomainUrlsToCopy', kind: 'warning' });
      return { ok: false, count: 0, domain: '' };
    }
    const { domain, urls } = tabs.urlsByDomain(target.id);
    const res = copyUniqueUrls(urls, 'toast.noDomainUrlsToCopy', 'toast.domainUrlsCopied', { domain });
    return { ...res, domain };
  });

  handle('tabs:closeByDomain', async (id) => {
    const target = activeTab(id);
    if (!target) return { ok: false, count: 0, domain: '' };
    const result = await tabs.closeByDomain(target.id);
    surface.send('toast', {
      message: result.count > 0 ? 'toast.closedSameDomain' : 'toast.noSameDomainTabs',
      kind: result.count > 0 ? 'success' : 'info',
      data: { count: result.count, domain: result.domain },
    });
    return { ok: result.count > 0, count: result.count, domain: result.domain };
  });

  handle('tabs:closeUngrouped', async () => {
    const count = await tabs.closeUngrouped();
    surface.send('toast', {
      message: count > 0 ? 'toast.closedUngrouped' : 'toast.noUngroupedTabs',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('tabs:closeSleeping', async () => {
    const count = await tabs.closeSleeping();
    surface.send('toast', {
      message: count > 0 ? 'toast.closedSleepingTabs' : 'toast.noSleepingTabs',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('tabs:copyPinnedUrls', () => {
    return copyUniqueUrls(tabs.pinnedUrls(), 'toast.noPinnedTabs', 'toast.pinnedUrlsCopied');
  });

  handle('app:checkForUpdates', () => {
    try {
      if (!app.isPackaged) return { ok: false, error: 'notPackaged' };
      autoUpdater.checkForUpdates().catch((error) => {
        console.warn('[Hinterland] Update check failed.', error?.message ?? error);
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message ?? 'unknown' };
    }
  });
  handle('tabs:snapshot', () => tabs.snapshot());
  handle('tabs:list', () => tabs.snapshot().tabs);

  /* ----------------------------------------------------------- tab actions */
  handle('tab:navigate', (id, input) => {
    const tab = activeTab(id);
    if (!tab) return false;
    const target = resolveTarget(input);
    if (!target.url) {
      surface.send('toast', { message: 'toast.noSearchEngine', kind: 'warning' });
      return false;
    }
    tab.loadUrl(target.url);
    return true;
  });

  handle('tab:back', (id) => {
    const tab = activeTab(id);
    if (!tab?.canGoBack) return false;
    tab.contents.navigationHistory.goBack();
    return true;
  });

  handle('tab:forward', (id) => {
    const tab = activeTab(id);
    if (!tab?.canGoForward) return false;
    tab.contents.navigationHistory.goForward();
    return true;
  });

  handle('tab:reload', (id, hard = false) => {
    const tab = activeTab(id);
    if (!tab) return false;
    if (hard) tab.contents.reloadIgnoringCache();
    else tab.contents.reload();
    return true;
  });

  handle('tab:stop', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    tab.contents.stop();
    return true;
  });

  handle('tab:zoom', (id, factor) => {
    const tab = activeTab(id);
    if (!tab) return false;
    const steps = Math.max(-3, Math.min(5, Math.round(Math.log(Number(factor) || 1) / Math.log(1.1))));
    tab.zoom = Math.pow(1.1, steps);
    tab.contents.setZoomFactor(tab.zoom);
    if (tab.url && tab.url.startsWith('http')) {
      try {
        const host = new URL(tab.url).hostname;
        if (host) {
          const levels = { ...(settings.value('site.zoomLevels') || {}) };
          if (Math.abs(tab.zoom - 1) < 0.02) delete levels[host];
          else levels[host] = tab.zoom;
          settings.set('site.zoomLevels', levels);
        }
      } catch {
        /* ignore invalid url */
      }
    }
    surface.send('tab:update', { ...tab.snapshot(), id: tab.id });
    return tab.zoom;
  });

  handle('tab:mute', (id, muted) => {
    const tab = activeTab(id);
    if (!tab) return false;
    tab.muted = Boolean(muted);
    tab.contents.setAudioMuted(tab.muted);
    surface.send('tab:update', { ...tab.snapshot(), id: tab.id });
    return tab.muted;
  });

  handle('tab:readerMode', async (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    if (tab.readerActive) {
      tab.readerActive = false;
      try {
        await tab.contents.executeJavaScript('if (window.__hinterland_reader_exit) { window.__hinterland_reader_exit(); } else { location.reload(); }');
      } catch {
        tab.contents.reload();
      }
      surface.send('tab:update', { ...tab.snapshot(), id: tab.id });
      return false;
    }

    try {
      const prefs = {
        theme: settings.value('reader.theme') || 'sepia',
        font: settings.value('reader.fontFamily') || 'serif',
        size: Number(settings.value('reader.fontSize')) || 18,
        width: settings.value('reader.contentWidth') || 'standard',
      };
      const ok = await tab.contents.executeJavaScript(`(${inPageReaderScript.toString()})(${JSON.stringify(prefs)})`);
      if (ok) {
        tab.readerActive = true;
        surface.send('tab:update', { ...tab.snapshot(), id: tab.id });
        return true;
      }
    } catch (error) {
      console.warn('[Hinterland] Reader mode error:', error?.message ?? error);
    }
    return false;
  });

  handle('tab:focus', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    tabs.activate(tab.id);
    tab.contents.focus();
    return true;
  });

  handle('tab:copyUrl', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    clipboard.writeText(tab.url);
    return true;
  });

  handle('tab:copyCleanUrl', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    const clean = stripTracking(tab.url);
    clipboard.writeText(clean);
    surface.send('toast', { message: 'toast.copiedCleanUrl', kind: 'info' });
    return true;
  });

  handle('tab:copyMarkdown', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    const title = (tab.title || tab.url || '').trim();
    clipboard.writeText(`[${title}](${tab.url})`);
    surface.send('toast', { message: 'toast.copiedMarkdown', kind: 'info' });
    return true;
  });

  handle('tab:copyLinkMarkdown', ({ text, url }) => {
    const label = (text || url || '').trim();
    clipboard.writeText(`[${label}](${url})`);
    surface.send('toast', { message: 'toast.copiedMarkdown', kind: 'info' });
    return true;
  });

  handle('tab:copyText', (text) => {
    clipboard.writeText(String(text ?? ''));
    return true;
  });

  handle('tab:openExternal', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    return openExternal(tab.url);
  });

  handle('tab:inspect', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    tab.contents.openDevTools({ mode: 'detach' });
    return true;
  });

  handle('tab:print', (id) => {
    const tab = activeTab(id);
    if (!tab) return false;
    tab.contents.print({ silent: false, printBackground: true });
    return true;
  });

  handle('tab:savePdf', async (id) => {
    const tab = activeTab(id);
    if (!tab) return { ok: false, error: 'noTab' };
    const rawTitle = (tab.title || 'page').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'page';
    const defaultPath = join(downloadDirectory(), `${rawTitle}.pdf`);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      const data = await tab.contents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      await writeFile(result.filePath, data);
      surface.send('toast', { message: 'toast.pdfSaved', kind: 'success' });
      return { ok: true, path: result.filePath };
    } catch (error) {
      console.warn('[Hinterland] PDF generation failed:', error?.message ?? error);
      surface.send('toast', { message: 'toast.pdfFailed', kind: 'error' });
      return { ok: false, error: error?.message };
    }
  });

  handle('tab:capture', async (id, { saveAs = false } = {}) => {
    const tab = activeTab(id);
    if (!tab || !tab.contents || tab.contents.isDestroyed()) return { ok: false, error: 'noTab' };
    try {
      const image = await tab.contents.capturePage();
      if (image.isEmpty()) return { ok: false, error: 'emptyImage' };

      if (saveAs) {
        const rawTitle = (tab.title || 'screenshot').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 50) || 'screenshot';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const defaultPath = join(downloadDirectory(), `${rawTitle}_${timestamp}.png`);
        const result = await dialog.showSaveDialog(chromeWindow(), {
          title: 'Hinterland',
          defaultPath,
          filters: [{ name: 'PNG Image', extensions: ['png'] }],
        });
        if (result.canceled || !result.filePath) return { ok: false, canceled: true };
        await writeFile(result.filePath, image.toPNG());
        surface.send('toast', { message: 'toast.screenshotSaved', kind: 'success' });
        return { ok: true, path: result.filePath, saved: true };
      }

      clipboard.writeImage(image);
      surface.send('toast', { message: 'toast.screenshotCopied', kind: 'success' });
      return { ok: true, copied: true };
    } catch (error) {
      console.warn('[Hinterland] Screen capture failed:', error?.message ?? error);
      surface.send('toast', { message: 'toast.screenshotFailed', kind: 'error' });
      return { ok: false, error: error?.message };
    }
  });

  handle('tab:sleep', (id) => tabs.sleep(id));
  handle('tab:wake', (id) => tabs.wake(id));

  handle('tab:translate', (id) => {
    const tab = activeTab(id);
    if (!tab || isInternalUrl(tab.url)) return false;
    const lang = resolveLanguage(settings.value('general.language')) || 'en';
    const targetUrl = `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(tab.url)}`;
    tabs.create({ url: targetUrl, background: false });
    return true;
  });

  handle('tab:find', (id, query, { forward = true, caseSensitive = false, wholeWord = false, regex = false } = {}) => {
    const tab = activeTab(id);
    if (!tab) return null;
    if (!query) {
      tab.contents.stopFindInPage('clearSelection');
      return { activeMatchOrdinal: 0, matches: 0 };
    }
    tab.contents.findInPage(query, { forward, findNext: false, caseSensitive, wholeWord, regex });
    return { pending: true };
  });

  handle('tab:findNext', (id) => {
    const tab = activeTab(id);
    if (!tab) return null;
    tab.contents.findNext(true);
    return true;
  });

  handle('tab:findStop', (id, keepSelection = false) => {
    const tab = activeTab(id);
    if (!tab) return null;
    tab.contents.stopFindInPage(keepSelection ? 'keepSelection' : 'clearSelection');
    return true;
  });

  handle('tab:togglePiP', async (id) => {
    const tab = activeTab(id);
    if (!tab) return { success: false, reason: 'no_tab' };
    return await tab.togglePiP();
  });

  handle('tab:toggleMediaPlay', async (id) => {
    const tab = activeTab(id);
    if (!tab) return { success: false, reason: 'no_tab' };
    return await tab.toggleMediaPlay();
  });

  handle('tab:confirmClose', (id, answer) => {
  resolvePending(id, answer);
  return true;
});

  /* ------------------------------------------------------------ suggestions */
  handle('search:suggest', (query) => {
    if (!settings.value('search.suggestions')) return [];
    return suggestionList(query, 8);
  });

  handle('search:resolve', (input) => resolveTarget(input));
  handle('search:engines', () => activeEngines());

  handle('search:allEngines', () => ({
    engines: settings.value('search.engines') ?? [],
    defaultEngine: settings.value('search.defaultEngine') ?? 'duckduckgo',
  }));

  handle('search:addEngine', ({ name, url, shortcut } = {}) => {
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
    const id = `eng_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newEngine = {
      id,
      name: cleanName,
      url: cleanUrl,
      shortcut: cleanShortcut ? (cleanShortcut.startsWith('@') ? cleanShortcut : `@${cleanShortcut}`) : '',
      enabled: true,
    };
    const list = [...(settings.value('search.engines') ?? [])];
    list.push(newEngine);
    settings.set('search.engines', list);
    surface.send('toast', { message: 'toast.searchEngineAdded', kind: 'success' });
    return { ok: true, engine: newEngine };
  });

  handle('search:removeEngine', (id) => {
    const list = [...(settings.value('search.engines') ?? [])];
    if (list.length <= 1) return { ok: false, error: 'cannot_remove_last' };
    const currentDefault = settings.value('search.defaultEngine');
    const filtered = list.filter((e) => e.id !== id);
    if (filtered.length === list.length) return { ok: false, error: 'not_found' };
    settings.set('search.engines', filtered);
    if (currentDefault === id && filtered.length > 0) {
      settings.set('search.defaultEngine', filtered[0].id);
    }
    return { ok: true };
  });

  handle('search:setDefault', (id) => {
    const list = settings.value('search.engines') ?? [];
    const found = list.find((e) => e.id === id);
    if (!found) return { ok: false, error: 'not_found' };
    settings.set('search.defaultEngine', id);
    surface.send('toast', { message: 'toast.searchEngineDefaultSet', kind: 'info' });
    return { ok: true };
  });

  handle('search:resetEngines', () => {
    const defaultEngines = [
      { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={q}', shortcut: '@ddg', enabled: true },
      { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={q}', shortcut: '@g', enabled: true },
      { id: 'mojeek', name: 'Mojeek', url: 'https://www.mojeek.com/search?q={q}', shortcut: '@m', enabled: true },
      { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={q}', shortcut: '@gh', enabled: true },
      { id: 'wikipedia', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search={q}', shortcut: '@w', enabled: true },
      { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query={q}', shortcut: '@yt', enabled: true },
      { id: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q={q}', shortcut: '@npm', enabled: true },
    ];
    settings.set('search.engines', defaultEngines);
    settings.set('search.defaultEngine', 'duckduckgo');
    surface.send('toast', { message: 'toast.searchEnginesReset', kind: 'success' });
    return { ok: true };
  });

  handle('search:exportJson', async () => {
    const payload = {
      version: '1.29.0',
      exportedAt: new Date().toISOString(),
      engines: settings.value('search.engines') ?? [],
      defaultEngine: settings.value('search.defaultEngine') ?? 'duckduckgo',
    };
    const json = JSON.stringify(payload, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-search-engines-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.searchEnginesExported', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: payload.engines.length };
  });

  handle('search:importJson', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.length) return { ok: false };
    try {
      const raw = await readFile(result.filePaths[0], 'utf8');
      const parsed = JSON.parse(raw);
      const incomingList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.engines) ? parsed.engines : []);
      const valid = incomingList
        .filter((e) => e && typeof e.name === 'string' && typeof e.url === 'string' && (e.url.startsWith('http://') || e.url.startsWith('https://')))
        .map((e) => {
          let cleanUrl = e.url.trim();
          if (!cleanUrl.includes('{q}')) {
            cleanUrl = cleanUrl.includes('?') ? `${cleanUrl}&q={q}` : `${cleanUrl}?q={q}`;
          }
          const cleanShortcut = (e.shortcut || '').trim();
          return {
            id: typeof e.id === 'string' && e.id ? e.id : `eng_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            name: String(e.name || '').trim().slice(0, 100),
            url: cleanUrl,
            shortcut: cleanShortcut ? (cleanShortcut.startsWith('@') ? cleanShortcut : `@${cleanShortcut}`) : '',
            enabled: e.enabled !== false,
          };
        });

      if (!valid.length) {
        surface.send('toast', { message: 'toast.searchEnginesImportInvalid', kind: 'warning' });
        return { ok: false, error: 'noValidEngines' };
      }

      const existing = [...(settings.value('search.engines') ?? [])];
      let importedCount = 0;
      for (const engine of valid) {
        const existingIdx = existing.findIndex((ex) => ex.id === engine.id || ex.url === engine.url);
        if (existingIdx >= 0) {
          existing[existingIdx] = { ...existing[existingIdx], ...engine };
        } else {
          existing.push(engine);
          importedCount++;
        }
      }
      settings.set('search.engines', existing);
      if (typeof parsed?.defaultEngine === 'string' && existing.some((e) => e.id === parsed.defaultEngine)) {
        settings.set('search.defaultEngine', parsed.defaultEngine);
      }
      surface.send('toast', { message: 'toast.searchEnginesImported', kind: 'success' });
      return { ok: true, count: importedCount, total: existing.length };
    } catch (err) {
      console.warn('[Hinterland] Search engines import failed:', err?.message);
      return { ok: false, error: 'invalidJson' };
    }
  });

  const formatSearchEnginesMarkdown = (list, defaultId) => {
    const dateStr = new Date().toLocaleDateString('en-CA');
    const lines = [
      '# Hinterland Search Engines',
      '',
      `Exported on ${dateStr}. Total engines: ${list.length}.`,
      '',
      '| Engine | Shortcut | Status | Search URL |',
      '| --- | --- | --- | --- |',
    ];
    for (const engine of list) {
      const name = String(engine.name || engine.id || 'Engine').replace(/\|/g, '\\|');
      const isDefault = engine.id === defaultId ? ' ★' : '';
      const shortcut = engine.shortcut ? `\`${engine.shortcut}\`` : '—';
      const status = engine.enabled === false ? 'Disabled' : 'Enabled';
      const url = String(engine.url || '').replace(/\|/g, '\\|');
      lines.push(`| ${name}${isDefault} | ${shortcut} | ${status} | ${url} |`);
    }
    return lines.join('\n');
  };

  handle('search:copyMarkdown', () => {
    const engines = settings.value('search.engines') ?? [];
    if (!engines.length) {
      surface.send('toast', { message: 'toast.noSearchEnginesToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const defaultId = settings.value('search.defaultEngine') ?? 'duckduckgo';
    clipboard.writeText(formatSearchEnginesMarkdown(engines, defaultId));
    surface.send('toast', { message: 'toast.searchEnginesCopied', kind: 'success', data: { count: engines.length } });
    return { ok: true, count: engines.length };
  });

  /* ------------------------------------------------------------ extensions */
  handle('extensions:list', () => extensions.list());
  handle('extensions:copyList', () => {
    const list = extensions.list() || [];
    if (!list.length) {
      surface.send('toast', { message: 'toast.noExtensionsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const lines = ['# Hinterland Extensions', ''];
    for (const ext of list) {
      const status = ext.enabled ? 'Active' : 'Paused';
      const source = ext.bundled ? 'Included' : 'Unpacked';
      const version = ext.version ? ` v${ext.version}` : '';
      lines.push(`- **${ext.name || ext.id}**${version} (${status}, ${source}) — \`${ext.id}\``);
    }
    clipboard.writeText(lines.join('\n'));
    surface.send('toast', { message: 'toast.extensionsListCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });
  handle('extensions:copyJson', () => {
    const list = extensions.list() || [];
    if (!list.length) {
      surface.send('toast', { message: 'toast.noExtensionsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(list, null, 2));
    surface.send('toast', { message: 'toast.extensionsJsonCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });
  handle('extensions:install', async () => {
    if (!settings.value('extensions.allowUnpacked')) return { ok: false, error: 'blocked' };
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openDirectory'],
    });
    if (result.canceled) return { ok: false };
    try {
      const id = await extensions.install(result.filePaths[0]);
      return { ok: true, id, list: extensions.list() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  handle('extensions:installPath', async (path) => {
    if (!settings.value('extensions.allowUnpacked')) return { ok: false, error: 'blocked' };
    try {
      const id = await extensions.install(path);
      return { ok: true, id, list: extensions.list() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  handle('extensions:uninstall', async (id) => {
    const ok = await extensions.uninstall(id);
    return { ok, list: extensions.list() };
  });
  handle('extensions:toggle', async (id, enabled) => {
    const list = await extensions.setEnabled(id, enabled);
    return { list };
  });
  handle('extensions:reload', async (id) => {
    const ok = await extensions.reload(id);
    return { ok, list: extensions.list() };
  });
  handle('extensions:reveal', (id) => extensions.reveal(id));

  handle('extensions:info', (id) => extensions.info(id));
  handle('extensions:action', (id) => extensions.executeAction(id));

  ipcMain.handle('extension:closePopup', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
      return true;
    }
    return false;
  });

  ipcMain.handle('extension:getSelfManifest', (event) => {
    const url = event.sender.getURL();
    return extensions.manifestForUrl(url);
  });

  /* ------------------------------------------------------------- hinter store */
  handle('store:catalog', () => hinterStore.catalog());
  handle('store:installExtension', ({ id, config } = {}) => hinterStore.installExtension(id, config));
  handle('store:uninstallExtension', (id) => hinterStore.uninstallExtension(id));
  handle('store:saveExtensionConfig', ({ id, config } = {}) => hinterStore.saveExtensionConfig(id, config));
  handle('store:getExtensionConfig', (id) => hinterStore.getExtensionConfig(id));
  handle('store:applyTheme', (theme) => hinterStore.applyTheme(theme));
  handle('store:installTheme', ({ theme, apply } = {}) => hinterStore.installCommunityTheme(theme, apply));
  handle('store:uninstallTheme', (id) => hinterStore.uninstallCommunityTheme(id));
  handle('store:exportTheme', (theme) => hinterStore.exportThemeFile(theme));
  handle('store:importThemeFile', () => hinterStore.importThemeFile());

  /* --------------------------------------------------------------- history */
  handle('history:search', (query) => history.search(query, 60));
  handle('history:getAll', () => history.getAll());
  handle('history:clear', () => {
    history.clear();
    return true;
  });
  handle('history:remove', (url) => {
    history.remove(url);
    return true;
  });
  handle('history:removeByDomain', (domainOrUrl) => {
    const target = normalizeDomain(domainOrUrl) || String(domainOrUrl || '').trim().replace(/^www\./i, '').toLowerCase();
    const removed = history.removeByDomain(target);
    surface.send('toast', {
      message: removed > 0 ? 'toast.historyDomainCleared' : 'toast.historyNoDomainEntries',
      kind: removed > 0 ? 'success' : 'info',
      data: { count: removed, domain: target },
    });
    return { ok: removed > 0, removed, domain: target };
  });
  handle('history:removeUrls', (urls = []) => {
    const removed = history.removeUrls(urls);
    surface.send('toast', {
      message: removed > 0 ? 'toast.historyRemovedMatching' : 'toast.historyNoMatchingToRemove',
      kind: removed > 0 ? 'success' : 'info',
      data: { count: removed },
    });
    return { ok: removed > 0, removed };
  });
  handle('history:copyUrls', (urls = null) => {
    const source = Array.isArray(urls) ? urls : (history.getAll() || []).map((entry) => entry?.url);
    const uniqueUrls = [];
    const seen = new Set();
    for (const raw of source) {
      const url = typeof raw === 'string' ? raw.trim() : '';
      if (!url || seen.has(url)) continue;
      seen.add(url);
      uniqueUrls.push(url);
    }
    if (!uniqueUrls.length) {
      surface.send('toast', { message: 'toast.historyNoUrlsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(uniqueUrls.join('\n'));
    surface.send('toast', { message: 'toast.historyUrlsCopied', kind: 'success', data: { count: uniqueUrls.length } });
    return { ok: true, count: uniqueUrls.length };
  });
  handle('history:openUrls', (urls = null) => {
    const source = Array.isArray(urls)
      ? urls
      : (history.getAll() || []).map((entry) => entry?.url);
    return openValidatedUrlsInTabs(source, {
      limit: 15,
      emptyToast: 'toast.noHistoryToOpen',
      successToast: 'toast.historyOpened',
    });
  });
  handle('history:copyJson', (entries = null) => {
    const list = (Array.isArray(entries) ? entries : (history.getAll() || [])).filter((e) => e?.url);
    if (!list.length) {
      surface.send('toast', { message: 'toast.noHistoryToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(list, null, 2));
    surface.send('toast', { message: 'toast.historyJsonCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });
  handle('history:exportJson', async () => {
    const list = history.getAll();
    const json = JSON.stringify(list, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-history-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.historyExported', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: list.length };
  });

  const formatHistoryMarkdown = (list) => {
    const dateStr = new Date().toLocaleDateString('en-CA');
    const lines = [
      '# Hinterland Browsing History Archive',
      '',
      `Exported on ${dateStr}. Total entries: ${list.length}.`,
      '',
    ];

    const groups = new Map();
    for (const entry of list) {
      if (!entry?.url) continue;
      const visitTime = entry.lastVisited || entry.visitedAt || entry.time || entry.timestamp;
      let dayKey = 'Earlier';
      let timeKey = '';
      if (visitTime) {
        try {
          const d = new Date(visitTime);
          if (!isNaN(d.getTime())) {
            dayKey = d.toLocaleDateString('en-CA');
            timeKey = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } catch {}
      }
      if (!groups.has(dayKey)) groups.set(dayKey, []);
      groups.get(dayKey).push({ ...entry, timeKey });
    }

    for (const [day, entries] of groups.entries()) {
      lines.push(`## ${day}`);
      lines.push('');
      for (const item of entries) {
        const title = String(item.title || item.url || 'Untitled').replace(/[\[\]]/g, '');
        const timePart = item.timeKey ? ` — ${item.timeKey}` : '';
        const visits = Number(item.visits || item.count || item.visitCount || 1);
        const countPart = visits > 1 ? ` (${visits} visits)` : '';
        lines.push(`- [${title}](${item.url})${timePart}${countPart}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  handle('history:exportMarkdown', async () => {
    const list = history.getAll() || [];
    const markdown = formatHistoryMarkdown(list);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-history-${Date.now()}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, markdown, 'utf8');
    surface.send('toast', { message: 'toast.historyExportedMarkdown', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: list.length };
  });

  handle('history:copyMarkdown', (entries = null) => {
    const list = (Array.isArray(entries) ? entries : (history.getAll() || [])).filter((e) => e?.url);
    if (!list.length) {
      surface.send('toast', { message: 'toast.noHistoryToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(formatHistoryMarkdown(list));
    surface.send('toast', { message: 'toast.historyCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('history:exportCsv', async () => {
    const list = history.getAll() || [];
    const rows = ['"Title","URL","Last Visited","Visit Count"'];
    for (const item of list) {
      const title = String(item.title || '').replace(/"/g, '""');
      const url = String(item.url || '').replace(/"/g, '""');
      const visited = String(item.lastVisited || item.visitedAt || item.time || item.timestamp || '').replace(/"/g, '""');
      const count = Number(item.count || item.visitCount || 1);
      rows.push(`"${title}","${url}","${visited}","${count}"`);
    }
    const csv = rows.join('\r\n');
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-history-${Date.now()}.csv`,
      filters: [{ name: 'CSV Document', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, csv, 'utf8');
    surface.send('toast', { message: 'toast.historyExportedCsv', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: list.length };
  });
  handle('history:importJson', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { ok: false };
    const content = await readFile(result.filePaths[0], 'utf8');
    try {
      const parsed = JSON.parse(content);
      const res = history.importEntries(parsed);
      surface.send('toast', { message: 'toast.historyImported', kind: 'success' });
      return { ok: true, ...res };
    } catch {
      return { ok: false, error: 'invalidJson' };
    }
  });

  /* ----------------------------------------------------------------- data */
  handle('data:clear', async (options = {}) => {
    if (options.closedTabs) {
      try {
        tabs.clearRecentlyClosed();
      } catch {}
    }
    await clearBrowsingData(options);
    surface.send('toast', { message: 'toast.dataCleared', kind: 'success' });
    return true;
  });
  handle('site:clearData', async (url) => {
    return clearSiteData(url);
  });

  handle('site:toggleShield', (domain) => toggleSiteShield(domain));
  handle('site:getShield', (domain) => getSiteShield(domain));
  handle('site:getBlockedTrackers', (domain) => getBlockedForDomain(domain));
  handle('site:getCookies', (url) => getSiteCookies(url));
  handle('site:deleteCookie', (opts) => deleteSiteCookie(opts || {}));
  handle('site:clearCookies', (url) => clearSiteCookies(url));
  handle('site:getStorageStats', (url) => getSiteStorageStats(url));
  const buildCookiesPayload = async (rawUrl) => {
    const cookies = (await getSiteCookies(rawUrl)) || [];
    if (!cookies.length) return null;
    const host = normalizeDomain(rawUrl) || 'site';
    return {
      host,
      exportedAt: new Date().toISOString(),
      count: cookies.length,
      cookies,
    };
  };

  handle('site:exportCookies', async (rawUrl) => {
    const payload = await buildCookiesPayload(rawUrl);
    if (!payload) {
      surface.send('toast', { message: 'toast.noCookiesToExport', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-cookies-${payload.host}-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
    surface.send('toast', { message: 'toast.cookiesExported', kind: 'success', data: { count: payload.count } });
    return { ok: true, filePath: result.filePath, count: payload.count };
  });

  handle('site:copyCookiesJson', async (rawUrl) => {
    const payload = await buildCookiesPayload(rawUrl);
    if (!payload) {
      surface.send('toast', { message: 'toast.noCookiesToExport', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(payload, null, 2));
    surface.send('toast', { message: 'toast.cookiesCopiedJson', kind: 'success', data: { count: payload.count } });
    return { ok: true, count: payload.count };
  });

  handle('downloads:history', () => getDownloadHistory());
  handle('downloads:clearHistory', () => clearDownloadHistory());
  handle('downloads:clearCompleted', () => clearCompletedDownloads());
  handle('downloads:clearFailed', () => clearFailedDownloads());
  handle('downloads:removeItem', (id) => removeDownloadHistoryItem(id));
  handle('downloads:openFile', (filePath) => openDownloadedFile(filePath));

  const formatDownloadsMarkdown = (list) => {
    const dateStr = new Date().toLocaleDateString('en-CA');
    const lines = [
      '# Hinterland Downloads Log',
      '',
      `Exported on ${dateStr}. Total downloads: ${list.length}.`,
      '',
    ];
    for (const item of list) {
      const name = String(item.filename || 'Download').replace(/[\[\]]/g, '');
      const status = item.state === 'completed' || (item.ok && !item.state)
        ? 'Completed'
        : (item.state === 'interrupted' || item.state === 'cancelled' || item.ok === false)
          ? 'Interrupted'
          : (item.state || 'In progress');
      const total = Number(item.totalBytes) || Number(item.receivedBytes) || 0;
      const sizeStr = total >= 1048576
        ? `${(total / 1048576).toFixed(2)} MB`
        : total >= 1024
          ? `${(total / 1024).toFixed(1)} KB`
          : `${total} B`;
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : '';
      const metaParts = [status, sizeStr, timeStr].filter(Boolean).join(' · ');
      if (item.url) {
        lines.push(`- **[${name}](${item.url})** — ${metaParts}`);
      } else {
        lines.push(`- **${name}** — ${metaParts}`);
      }
    }
    return lines.join('\n');
  };

  handle('downloads:exportMarkdown', async () => {
    const list = getDownloadHistory() || [];
    const markdown = formatDownloadsMarkdown(list);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-downloads-${Date.now()}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, markdown, 'utf8');
    surface.send('toast', { message: 'toast.downloadsExportedMarkdown', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: list.length };
  });

  handle('downloads:copyMarkdown', () => {
    const list = getDownloadHistory() || [];
    if (!list.length) {
      surface.send('toast', { message: 'toast.noDownloadsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(formatDownloadsMarkdown(list));
    surface.send('toast', { message: 'toast.downloadsCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  const triggerDownloadUrl = (rawUrl) => {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      const tab = tabs.active;
      if (tab?.contents && !tab.contents.isDestroyed()) {
        tab.contents.downloadURL(parsed.href);
      } else {
        tabs.create({ url: parsed.href, background: true });
      }
      return parsed.href;
    } catch {
      return null;
    }
  };

  handle('downloads:retry', (rawUrl) => {
    const href = triggerDownloadUrl(rawUrl);
    if (!href) {
      surface.send('toast', { message: 'toast.downloadRetryInvalid', kind: 'warning' });
      return { ok: false };
    }
    surface.send('toast', { message: 'toast.downloadRetried', kind: 'info' });
    return { ok: true, url: href };
  });

  handle('downloads:retryFailed', () => {
    const list = getDownloadHistory() || [];
    const failed = list.filter((item) => item?.state === 'interrupted' || item?.state === 'cancelled' || item?.ok === false);
    const urls = validateHttpUrls(failed.map((item) => item.url), 15);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noFailedDownloadsToRetry', kind: 'info' });
      return { ok: false, count: 0 };
    }
    let count = 0;
    for (const url of urls) {
      if (triggerDownloadUrl(url)) count += 1;
    }
    surface.send('toast', {
      message: count > 0 ? 'toast.downloadsRetriedFailed' : 'toast.noFailedDownloadsToRetry',
      kind: count > 0 ? 'success' : 'info',
      data: { count },
    });
    return { ok: count > 0, count };
  });

  handle('downloads:copyUrls', () => {
    const list = getDownloadHistory() || [];
    const seen = new Set();
    const urls = [];
    for (const item of list) {
      const url = String(item?.url || '').trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noDownloadsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(urls.join('\n'));
    surface.send('toast', { message: 'toast.downloadUrlsCopied', kind: 'success', data: { count: urls.length } });
    return { ok: true, count: urls.length };
  });
  handle('downloads:copyJson', () => {
    const list = getDownloadHistory() || [];
    if (!list.length) {
      surface.send('toast', { message: 'toast.noDownloadsToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(list, null, 2));
    surface.send('toast', { message: 'toast.downloadsJsonCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('downloads:exportJson', async () => {
    const list = getDownloadHistory() || [];
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-downloads-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, JSON.stringify(list, null, 2), 'utf8');
    surface.send('toast', { message: 'toast.downloadsExportedJson', kind: 'success', data: { count: list.length } });
    return { ok: true, filePath: result.filePath, count: list.length };
  });

  handle('site:getPermissions', (rawUrl) => {
    try {
      const url = new URL(rawUrl);
      const origin = `${url.protocol}//${url.host}`;
      const sites = settings.value('privacy.sitePermissions') ?? {};
      return sites[origin] ?? {};
    } catch {
      return {};
    }
  });

  const ALLOWED_PERMISSIONS = new Set(['media', 'geolocation', 'notifications', 'midiSysex', 'pointerLock', 'fullscreen', 'openExternal', 'clipboard', 'camera', 'microphone']);

  handle('site:setPermission', (rawUrl, permission, value) => {
    if (!permission || typeof permission !== 'string' || !ALLOWED_PERMISSIONS.has(permission)) {
      return { ok: false, error: 'invalidPermission' };
    }
    try {
      const url = new URL(rawUrl);
      const origin = `${url.protocol}//${url.host}`;
      const sites = { ...(settings.value('privacy.sitePermissions') ?? {}) };
      if (!sites[origin]) sites[origin] = {};
      if (value === 'default' || !value) {
        delete sites[origin][permission];
        if (Object.keys(sites[origin]).length === 0) delete sites[origin];
      } else {
        sites[origin][permission] = String(value);
      }
      settings.set('privacy.sitePermissions', sites);
      return { ok: true, permissions: sites[origin] ?? {} };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  handle('site:allPermissions', () => {
    return settings.value('privacy.sitePermissions') ?? {};
  });

  handle('site:resetAllPermissions', () => {
    settings.set('privacy.sitePermissions', {});
    surface.send('toast', { message: 'toast.allPermissionsReset', kind: 'success' });
    return { ok: true };
  });

  handle('site:clearOriginPermissions', (origin) => {
    if (!origin || typeof origin !== 'string') return { ok: false };
    const sites = { ...(settings.value('privacy.sitePermissions') ?? {}) };
    delete sites[origin];
    settings.set('privacy.sitePermissions', sites);
    surface.send('toast', { message: 'toast.originPermissionsCleared', kind: 'info' });
    return { ok: true };
  });

  handle('site:allShieldExceptions', () => {
    return settings.value('privacy.allowedSites') ?? {};
  });

  handle('site:removeShieldException', (domain) => {
    if (!domain || typeof domain !== 'string') return { ok: false };
    const allowed = { ...(settings.value('privacy.allowedSites') ?? {}) };
    delete allowed[domain];
    settings.set('privacy.allowedSites', allowed);
    surface.send('toast', { message: 'toast.shieldExceptionRemoved', kind: 'info' });
    return { ok: true };
  });

  handle('site:resetAllShieldExceptions', () => {
    settings.set('privacy.allowedSites', {});
    surface.send('toast', { message: 'toast.allShieldsReset', kind: 'success' });
    return { ok: true };
  });

  handle('site:copySummary', () => {
    const permsMap = settings.value('privacy.sitePermissions') ?? {};
    const shieldMap = settings.value('privacy.allowedSites') ?? {};
    const permOrigins = Object.keys(permsMap).filter((origin) => Object.keys(permsMap[origin] || {}).length > 0);
    const shieldDomains = Object.keys(shieldMap);
    if (!permOrigins.length && !shieldDomains.length) {
      surface.send('toast', { message: 'toast.noSiteRulesToCopy', kind: 'warning' });
      return { ok: false, permissionsCount: 0, shieldsCount: 0 };
    }
    const lines = ['# Hinterland Site Permissions & Shields Summary', ''];
    lines.push(`## Site Permissions (${permOrigins.length})`);
    if (!permOrigins.length) {
      lines.push('*No custom site permissions configured.*', '');
    } else {
      for (const origin of permOrigins) {
        const grants = Object.entries(permsMap[origin] || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        lines.push(`- **${origin}** — ${grants}`);
      }
      lines.push('');
    }
    lines.push(`## Shield Exceptions (${shieldDomains.length})`);
    if (!shieldDomains.length) {
      lines.push('*All sites protected by Hinterland Shield.*');
    } else {
      for (const domain of shieldDomains) {
        lines.push(`- **${domain}** — Tracking Protection Paused`);
      }
    }
    clipboard.writeText(lines.join('\n').trim());
    surface.send('toast', {
      message: 'toast.siteSummaryCopied',
      kind: 'success',
      data: { count: permOrigins.length + shieldDomains.length },
    });
    return { ok: true, permissionsCount: permOrigins.length, shieldsCount: shieldDomains.length };
  });

  handle('bookmarks:exportHtml', async (items) => {
    const list = Array.isArray(items) ? items : (settings.value('data.bookmarks') ?? []);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: 'hinterland-bookmarks.html',
      filters: [{ name: 'HTML Bookmarks', extensions: ['html', 'htm'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    const date = Math.floor(Date.now() / 1000);
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<!-- This is an automatically generated file.',
      '     It will be read and overwritten.',
      '     DO NOT EDIT! -->',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
    ];
    for (const item of list) {
      if (!item?.url) continue;
      const title = String(item.title || item.url).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const url = String(item.url).replaceAll('"', '&quot;');
      lines.push(`    <DT><A HREF="${url}" ADD_DATE="${date}">${title}</A>`);
    }
    lines.push('</DL><p>');
    await writeFile(result.filePath, lines.join('\n'), 'utf8');
    surface.send('toast', { message: 'toast.bookmarksExported', kind: 'success' });
    return { ok: true, path: result.filePath };
  });

  const formatBookmarksMarkdown = (list) => {
    const dateStr = new Date().toLocaleDateString('en-CA');
    const lines = [
      '# Hinterland Bookmarks Archive',
      '',
      `Exported on ${dateStr}. Total bookmarks: ${list.length}.`,
      '',
    ];
    const folders = new Map();
    for (const item of list) {
      if (!item?.url) continue;
      const folder = String(item.folder || 'Bookmarks').trim() || 'Bookmarks';
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(item);
    }
    for (const [folder, entries] of folders.entries()) {
      lines.push(`## ${folder}`);
      lines.push('');
      for (const item of entries) {
        const title = String(item.title || item.url).replace(/[\[\]]/g, '');
        let domain = '';
        try {
          domain = new URL(item.url).hostname.replace(/^www\./i, '');
        } catch {}
        const domainBadge = domain ? ` (${domain})` : '';
        lines.push(`- [${title}](${item.url})${domainBadge}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  };

  handle('bookmarks:exportMarkdown', async (items) => {
    const list = Array.isArray(items) ? items : (settings.value('data.bookmarks') ?? []);
    const markdown = formatBookmarksMarkdown(list);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-bookmarks-${Date.now()}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, markdown, 'utf8');
    surface.send('toast', { message: 'toast.bookmarksExportedMarkdown', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: list.length };
  });

  handle('bookmarks:copyMarkdown', (items) => {
    const list = (Array.isArray(items) ? items : (settings.value('data.bookmarks') ?? [])).filter((item) => item?.url);
    if (!list.length) {
      surface.send('toast', { message: 'toast.noBookmarksToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(formatBookmarksMarkdown(list));
    surface.send('toast', { message: 'toast.bookmarksCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('bookmarks:copyUrls', (items) => {
    const list = (Array.isArray(items) ? items : (settings.value('data.bookmarks') ?? []))
      .map((item) => String(item?.url || '').trim())
      .filter(Boolean);
    if (!list.length) {
      surface.send('toast', { message: 'toast.noBookmarksToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(list.join('\n'));
    surface.send('toast', { message: 'toast.bookmarkUrlsCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('bookmarks:openUrls', (urls = null) => {
    const source = Array.isArray(urls)
      ? urls
      : (settings.value('data.bookmarks') ?? []).map((item) => item?.url);
    return openValidatedUrlsInTabs(source, {
      limit: 15,
      emptyToast: 'toast.noBookmarksToOpen',
      successToast: 'toast.bookmarksOpened',
    });
  });

  handle('bookmarks:removeUrls', (urls = []) => {
    const targets = new Set(
      (Array.isArray(urls) ? urls : [])
        .map((u) => normalizeComparableUrl(u))
        .filter(Boolean),
    );
    if (!targets.size) {
      surface.send('toast', { message: 'toast.bookmarksNoMatchingToRemove', kind: 'info' });
      return { ok: false, removed: 0 };
    }
    const existing = [...(settings.value('data.bookmarks') ?? [])];
    const kept = existing.filter((item) => !targets.has(normalizeComparableUrl(item?.url)));
    const removed = existing.length - kept.length;
    if (removed > 0) {
      settings.set('data.bookmarks', kept);
      surface.send('toast', { message: 'toast.bookmarksRemovedMatching', kind: 'success', data: { count: removed } });
    } else {
      surface.send('toast', { message: 'toast.bookmarksNoMatchingToRemove', kind: 'info' });
    }
    return { ok: removed > 0, removed, total: kept.length };
  });

  handle('bookmarks:toNote', (items = null) => {
    const list = (Array.isArray(items) && items.length ? items : (settings.value('data.bookmarks') ?? []))
      .filter((item) => item?.url);
    if (!list.length) {
      surface.send('toast', { message: 'toast.noBookmarksToCopy', kind: 'warning' });
      return { ok: false };
    }
    const dateStr = new Date().toLocaleDateString('en-CA');
    const title = `Bookmarks (${dateStr})`;
    const fresh = {
      id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title,
      content: formatBookmarksMarkdown(list),
      pinned: false,
      updatedAt: Date.now(),
    };
    const notes = [...(settings.value('data.notes') || [])];
    notes.unshift(fresh);
    settings.set('data.notes', notes);
    surface.send('toast', { message: 'toast.bookmarksSavedAsNote', kind: 'success', data: { count: list.length } });
    return { ok: true, note: fresh, count: list.length };
  });

  handle('bookmarks:importHtml', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'Bookmarks (HTML, JSON)', extensions: ['html', 'htm', 'json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false };
    const content = await readFile(result.filePaths[0], 'utf8');
    const existing = [...(settings.value('data.bookmarks') ?? [])];
    const existingUrls = new Set(existing.map((b) => b.url));
    const imported = [];

    if (result.filePaths[0].endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed) ? parsed : (parsed.bookmarks || []);
        for (const item of list) {
          if (item && typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://')) && !existingUrls.has(item.url)) {
            existingUrls.add(item.url);
            imported.push({ title: String(item.title || item.url).slice(0, 300), url: item.url });
          }
        }
      } catch {
        return { ok: false, error: 'invalidJson' };
      }
    } else {
      const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const url = match[1].trim();
        const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
        const title = rawTitle.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"');
        if (url && (url.startsWith('http://') || url.startsWith('https://')) && !existingUrls.has(url)) {
          existingUrls.add(url);
          imported.push({ title: title || url, url });
        }
      }
    }

    if (imported.length > 0) {
      const merged = [...existing, ...imported];
      settings.set('data.bookmarks', merged);
      surface.send('toast', { message: 'toast.bookmarksImported', kind: 'success' });
      return { ok: true, count: imported.length, bookmarks: merged };
    }
    return { ok: true, count: 0, bookmarks: existing };
  });

  handle('bookmarks:copyJson', (items = null) => {
    const list = (Array.isArray(items) ? items : (settings.value('data.bookmarks') ?? []))
      .filter((b) => b?.url);
    if (!list.length) {
      surface.send('toast', { message: 'toast.noBookmarksToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(list, null, 2));
    surface.send('toast', { message: 'toast.bookmarkJsonCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('bookmarks:exportJson', async (items) => {
    const list = Array.isArray(items) ? items : (settings.value('data.bookmarks') ?? []);
    const json = JSON.stringify(list, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-bookmarks-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.bookmarksExported', kind: 'success' });
    return { ok: true, filePath: result.filePath, count: list.length };
  });

  handle('bookmarks:importJson', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { ok: false };
    const content = await readFile(result.filePaths[0], 'utf8');
    try {
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : (parsed.bookmarks || []);
      const existing = [...(settings.value('data.bookmarks') ?? [])];
      const seen = new Set(existing.map((b) => (b.url || '').trim().replace(/\/+$/, '').toLowerCase()));
      const imported = [];

      for (const item of list) {
        if (!item || typeof item.url !== 'string') continue;
        const rawUrl = item.url.trim();
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) continue;
        const normalized = rawUrl.replace(/\/+$/, '').toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          imported.push({
            title: String(item.title || rawUrl).slice(0, 300),
            url: rawUrl,
          });
        }
      }

      if (imported.length > 0) {
        const merged = [...existing, ...imported];
        settings.set('data.bookmarks', merged);
        surface.send('toast', { message: 'toast.bookmarksImported', kind: 'success' });
        return { ok: true, count: imported.length, bookmarks: merged };
      }
      surface.send('toast', { message: 'toast.bookmarksNoNew', kind: 'info' });
      return { ok: true, count: 0, bookmarks: existing };
    } catch {
      return { ok: false, error: 'invalidJson' };
    }
  });

  handle('bookmarks:deduplicate', () => {
    const existing = [...(settings.value('data.bookmarks') ?? [])];
    const seen = new Set();
    const deduplicated = [];
    let removed = 0;

    for (const item of existing) {
      if (!item || !item.url) continue;
      const normalized = String(item.url).trim().replace(/\/+$/, '').toLowerCase();
      if (seen.has(normalized)) {
        removed++;
      } else {
        seen.add(normalized);
        deduplicated.push(item);
      }
    }

    if (removed > 0) {
      settings.set('data.bookmarks', deduplicated);
      surface.send('toast', { message: 'toast.bookmarksDeduplicated', kind: 'success' });
    } else {
      surface.send('toast', { message: 'toast.bookmarksNoDuplicates', kind: 'info' });
    }
    return { ok: true, count: deduplicated.length, removed };
  });

  const collectUnseenWebTabs = (existingItems = []) => {
    const webTabs = tabs.list.filter((t) => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
    if (!webTabs.length) {
      surface.send('toast', { message: 'toast.noTabsToBookmark', kind: 'warning' });
      return { hasWebTabs: false, newTabs: [] };
    }
    const normalizeUrl = (raw) => String(raw || '').trim().replace(/\/+$/, '').toLowerCase();
    const seen = new Set((existingItems || []).map((item) => normalizeUrl(item?.url)).filter(Boolean));
    const newTabs = [];
    for (const tab of webTabs) {
      const key = normalizeUrl(tab.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      newTabs.push(tab);
    }
    return { hasWebTabs: true, newTabs };
  };

  handle('bookmarks:bookmarkAllTabs', () => {
    const existing = [...(settings.value('data.bookmarks') ?? [])];
    const { hasWebTabs, newTabs } = collectUnseenWebTabs(existing);
    if (!hasWebTabs) return { ok: false, added: 0 };
    if (!newTabs.length) {
      surface.send('toast', { message: 'toast.allTabsAlreadyBookmarked', kind: 'info' });
      return { ok: false, added: 0, total: existing.length };
    }
    const folder = `Session ${new Date().toLocaleDateString('en-CA')}`;
    for (const tab of newTabs) {
      existing.push({
        url: tab.url,
        title: (tab.title || tab.url).trim(),
        addedAt: Date.now(),
        folder,
      });
    }
    settings.set('data.bookmarks', existing);
    surface.send('toast', { message: 'toast.bookmarkedAllTabs', kind: 'success', data: { count: newTabs.length } });
    return { ok: true, added: newTabs.length, total: existing.length };
  });

  handle('bookmarks:addFromClipboard', () => {
    const urls = extractValidatedUrlsFromClipboard(30);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noUrlsInClipboard', kind: 'warning' });
      return { ok: false, added: 0 };
    }
    const existing = [...(settings.value('data.bookmarks') ?? [])];
    const normalizeUrl = (raw) => String(raw || '').trim().replace(/\/+$/, '').toLowerCase();
    const seen = new Set(existing.map((item) => normalizeUrl(item?.url)).filter(Boolean));
    const folder = `Clipboard ${new Date().toLocaleDateString('en-CA')}`;
    let added = 0;
    for (const url of urls) {
      const key = normalizeUrl(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      existing.push({
        url,
        title: normalizeDomain(url) || url,
        addedAt: Date.now(),
        folder,
      });
      added += 1;
    }
    if (!added) {
      surface.send('toast', { message: 'toast.bookmarksNoNew', kind: 'info' });
      return { ok: false, added: 0, total: existing.length };
    }
    settings.set('data.bookmarks', existing);
    surface.send('toast', { message: 'toast.bookmarksAddedFromClipboard', kind: 'success', data: { count: added } });
    return { ok: true, added, total: existing.length };
  });

  /* ------------------------------------------------------------- reading list */
  handle('readingList:get', () => {
    return settings.value('data.readingList') || [];
  });

  handle('readingList:add', (item) => {
    const list = [...(settings.value('data.readingList') || [])];
    if (!item || typeof item.url !== 'string' || (!item.url.startsWith('http://') && !item.url.startsWith('https://'))) {
      return { ok: false, error: 'noUrl' };
    }
    const existingIdx = list.findIndex((e) => e.url === item.url);
    if (existingIdx !== -1) {
      list[existingIdx].read = false;
      list[existingIdx].addedAt = Date.now();
      if (item.title) list[existingIdx].title = item.title;
      if (item.favicon) list[existingIdx].favicon = item.favicon;
    } else {
      list.unshift({
        id: `rl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        url: item.url,
        title: item.title || item.url,
        favicon: item.favicon || '',
        addedAt: Date.now(),
        read: false,
      });
    }
    settings.set('data.readingList', list);
    surface.send('toast', { message: 'toast.addedToReadingList', kind: 'success' });
    return { ok: true, list };
  });

  handle('readingList:remove', (idOrUrl) => {
    const list = (settings.value('data.readingList') || []).filter((e) => e.id !== idOrUrl && e.url !== idOrUrl);
    settings.set('data.readingList', list);
    surface.send('toast', { message: 'toast.removedFromReadingList', kind: 'info' });
    return { ok: true, list };
  });

  handle('readingList:toggleRead', (id) => {
    const list = [...(settings.value('data.readingList') || [])];
    const item = list.find((e) => e.id === id);
    if (item) {
      item.read = !item.read;
      settings.set('data.readingList', list);
      return { ok: true, item, list };
    }
    return { ok: false };
  });

  handle('readingList:clearRead', () => {
    const list = (settings.value('data.readingList') || []).filter((e) => !e.read);
    settings.set('data.readingList', list);
    return { ok: true, list };
  });

  handle('readingList:markAllRead', () => {
    const list = [...(settings.value('data.readingList') || [])];
    let count = 0;
    for (const item of list) {
      if (!item.read) {
        item.read = true;
        count++;
      }
    }
    if (count > 0) {
      settings.set('data.readingList', list);
    }
    surface.send('toast', {
      message: 'toast.allReadingListMarkedRead',
      kind: 'success',
    });
    return { ok: true, count, list };
  });

  handle('readingList:openAllUnread', () => {
    const list = [...(settings.value('data.readingList') || [])];
    const unread = list.filter((e) => !e.read);
    for (const item of unread) {
      item.read = true;
      tabs.create({ url: item.url, background: true });
    }
    if (unread.length > 0) {
      settings.set('data.readingList', list);
    }
    return { ok: true, count: unread.length };
  });

  handle('readingList:addAllTabs', () => {
    const list = [...(settings.value('data.readingList') || [])];
    const { hasWebTabs, newTabs } = collectUnseenWebTabs(list);
    if (!hasWebTabs) return { ok: false, added: 0 };
    if (!newTabs.length) {
      surface.send('toast', { message: 'toast.readingListAllTabsPresent', kind: 'info' });
      return { ok: false, added: 0, total: list.length };
    }
    for (const tab of newTabs) {
      list.unshift({
        id: `rl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        url: tab.url,
        title: (tab.title || tab.url).trim(),
        favicon: tab.favicon || '',
        addedAt: Date.now(),
        read: false,
      });
    }
    settings.set('data.readingList', list);
    surface.send('toast', { message: 'toast.readingListAddedAll', kind: 'success', data: { count: newTabs.length } });
    return { ok: true, added: newTabs.length, total: list.length };
  });

  handle('readingList:exportJson', async () => {
    const list = settings.value('data.readingList') || [];
    const json = JSON.stringify(list, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-reading-list-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.readingListExported', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  const formatReadingListMarkdown = (list) => {
    const dateStr = new Date().toISOString().split('T')[0];
    const unread = list.filter((i) => !i.read);
    const read = list.filter((i) => i.read);

    const formatItem = (item) => {
      const title = String(item.title || item.url).replaceAll('[', '\\[').replaceAll(']', '\\]');
      const host = normalizeDomain(item.url) || item.url;
      const date = item.addedAt ? new Date(item.addedAt).toISOString().split('T')[0] : '';
      return `- [${title}](${item.url}) — *${host}*${date ? ` (Saved: ${date})` : ''}`;
    };

    const lines = [
      '# Hinterland Reading List',
      '',
      `Exported on ${dateStr}. Total articles: ${list.length} (${unread.length} unread, ${read.length} read).`,
      '',
      '## Unread Articles',
      '',
    ];
    if (unread.length === 0) {
      lines.push('*No unread articles.*', '');
    } else {
      for (const item of unread) lines.push(formatItem(item));
      lines.push('');
    }

    lines.push('## Read Articles', '');
    if (read.length === 0) {
      lines.push('*No read articles.*', '');
    } else {
      for (const item of read) lines.push(formatItem(item));
      lines.push('');
    }

    return lines.join('\n');
  };

  handle('readingList:exportMarkdown', async () => {
    const list = settings.value('data.readingList') || [];
    const md = formatReadingListMarkdown(list);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-reading-list-${Date.now()}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, md, 'utf8');
    surface.send('toast', { message: 'toast.readingListExported', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  const filterReadingListByMode = (mode = 'all') => {
    const all = settings.value('data.readingList') || [];
    if (mode === 'unread') return all.filter((i) => !i.read);
    if (mode === 'read') return all.filter((i) => i.read);
    return all;
  };

  handle('readingList:copyMarkdown', (mode = 'all') => {
    const list = filterReadingListByMode(mode);
    if (!list.length) {
      surface.send('toast', { message: 'toast.readingListEmptyToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(formatReadingListMarkdown(list));
    surface.send('toast', { message: 'toast.readingListCopied', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('readingList:copyUrls', (mode = 'all') => {
    const urls = filterReadingListByMode(mode).map((i) => i.url).filter(Boolean);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.readingListEmptyToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(urls.join('\n'));
    surface.send('toast', { message: 'toast.readingListUrlsCopied', kind: 'success', data: { count: urls.length } });
    return { ok: true, count: urls.length };
  });

  handle('readingList:copyJson', (mode = 'all') => {
    const list = filterReadingListByMode(mode);
    if (!list.length) {
      surface.send('toast', { message: 'toast.readingListEmptyToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(list, null, 2));
    surface.send('toast', { message: 'toast.readingListCopiedJson', kind: 'success', data: { count: list.length } });
    return { ok: true, count: list.length };
  });

  handle('readingList:openUrls', (urls = null) => {
    const source = Array.isArray(urls)
      ? urls
      : filterReadingListByMode('unread').map((item) => item?.url);
    return openValidatedUrlsInTabs(source, {
      limit: 15,
      emptyToast: 'toast.readingListEmptyToOpen',
      successToast: 'toast.readingListOpenedMatching',
    });
  });

  handle('readingList:sort', (mode = 'alpha') => {
    const list = [...(settings.value('data.readingList') || [])];
    if (mode === 'domain') {
      list.sort((a, b) => {
        const domA = normalizeDomain(a.url) || a.url || '';
        const domB = normalizeDomain(b.url) || b.url || '';
        const cmp = domA.localeCompare(domB);
        return cmp !== 0 ? cmp : (a.title || a.url || '').localeCompare(b.title || b.url || '');
      });
    } else {
      list.sort((a, b) => (a.title || a.url || '').localeCompare(b.title || b.url || ''));
    }
    settings.set('data.readingList', list);
    surface.send('toast', {
      message: mode === 'domain' ? 'toast.readingListSortedByDomain' : 'toast.readingListSortedAlpha',
      kind: 'success',
      data: { count: list.length },
    });
    return { ok: true, count: list.length, items: list };
  });

  handle('readingList:addFromClipboard', () => {
    const urls = extractValidatedUrlsFromClipboard(30);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noUrlsInClipboard', kind: 'warning' });
      return { ok: false, added: 0 };
    }
    const list = [...(settings.value('data.readingList') || [])];
    const seen = new Set(list.map((item) => normalizeComparableUrl(item?.url)).filter(Boolean));
    let added = 0;
    for (const url of urls) {
      const key = normalizeComparableUrl(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.unshift({
        id: `rl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        url,
        title: normalizeDomain(url) || url,
        favicon: '',
        addedAt: Date.now(),
        read: false,
      });
      added += 1;
    }
    if (!added) {
      surface.send('toast', { message: 'toast.readingListAllTabsPresent', kind: 'info' });
      return { ok: false, added: 0, total: list.length };
    }
    settings.set('data.readingList', list);
    surface.send('toast', { message: 'toast.readingListAddedFromClipboard', kind: 'success', data: { count: added } });
    return { ok: true, added, total: list.length };
  });

  handle('readingList:deduplicate', () => {
    const existing = [...(settings.value('data.readingList') || [])];
    const seen = new Set();
    const deduplicated = [];
    let removed = 0;
    for (const item of existing) {
      const key = normalizeComparableUrl(item?.url);
      if (!key || seen.has(key)) {
        if (key) removed += 1;
        continue;
      }
      seen.add(key);
      deduplicated.push(item);
    }
    if (removed > 0) {
      settings.set('data.readingList', deduplicated);
      surface.send('toast', { message: 'toast.readingListDeduplicated', kind: 'success', data: { count: removed } });
    } else {
      surface.send('toast', { message: 'toast.readingListNoDuplicates', kind: 'info' });
    }
    return { ok: true, removed, count: deduplicated.length };
  });

  handle('readingList:exportHtml', async () => {
    const list = settings.value('data.readingList') || [];
    const dateStr = new Date().toISOString().split('T')[0];
    const unread = list.filter((i) => !i.read);
    const read = list.filter((i) => i.read);

    const escapeHtml = (str) =>
      String(str || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

    const renderItemsHtml = (items) => {
      if (!items.length) return '<p style="color:var(--textDim);font-style:italic;">No articles.</p>';
      return items.map((item) => {
        const title = escapeHtml(item.title || item.url);
        const url = escapeHtml(item.url);
        const host = escapeHtml(normalizeDomain(item.url) || item.url);
        const date = item.addedAt ? new Date(item.addedAt).toISOString().split('T')[0] : '';
        const badgeClass = item.read ? 'read' : 'unread';
        const badgeText = item.read ? 'Read' : 'Unread';
        return `    <div class="card">
      <div class="title"><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></div>
      <div class="meta">
        <span class="badge ${badgeClass}">${badgeText}</span>
        <span>${host}</span>
        ${date ? `<span>Saved: ${date}</span>` : ''}
      </div>
    </div>`;
      }).join('\n');
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hinterland Reading List</title>
<style>
  :root {
    --bg: #090b0e;
    --surface: #101319;
    --surfaceAlt: #151922;
    --border: #22293a;
    --text: #e6edf3;
    --textDim: #8b949e;
    --accent: #388bfd;
    --success: #3fb950;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 32px 16px;
    display: flex;
    justify-content: center;
  }
  .container { max-width: 800px; width: 100%; }
  h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .summary { color: var(--textDim); font-size: 14px; margin-bottom: 24px; }
  h2 { font-size: 18px; margin-top: 28px; margin-bottom: 12px; color: var(--accent); }
  .card { background: var(--surface); border: 1px solid var(--border); margin-bottom: 10px; padding: 12px 16px; }
  .title { font-size: 15px; font-weight: 500; }
  .title a { color: var(--text); text-decoration: none; }
  .title a:hover { color: var(--accent); text-decoration: underline; }
  .meta { font-size: 13px; color: var(--textDim); margin-top: 6px; display: flex; gap: 12px; align-items: center; }
  .badge { display: inline-block; padding: 2px 6px; font-size: 11px; text-transform: uppercase; background: var(--surfaceAlt); border: 1px solid var(--border); }
  .badge.read { color: var(--success); }
  .badge.unread { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <h1>Hinterland Reading List</h1>
  <div class="summary">Exported on ${dateStr} • ${list.length} articles (${unread.length} unread, ${read.length} read)</div>

  <h2>Unread Articles (${unread.length})</h2>
${renderItemsHtml(unread)}

  <h2>Read Articles (${read.length})</h2>
${renderItemsHtml(read)}
</div>
</body>
</html>`;

    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-reading-list-${Date.now()}.html`,
      filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, html, 'utf8');
    surface.send('toast', { message: 'toast.readingListExported', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  handle('readingList:importJson', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    try {
      const raw = await readFile(result.filePaths[0], 'utf8');
      const imported = JSON.parse(raw);
      const list = Array.isArray(imported) ? imported : [imported];
      const valid = list
        .filter((item) => item && typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://') || item.url.startsWith('hinterland://')))
        .map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id : `rl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          url: item.url,
          title: String(item.title || item.url).slice(0, 300),
          favicon: typeof item.favicon === 'string' ? item.favicon : '',
          addedAt: Number(item.addedAt) || Date.now(),
          read: Boolean(item.read),
        }));

      if (!valid.length) {
        surface.send('toast', { message: 'readingList.importInvalid', kind: 'warning' });
        return { ok: false, error: 'noValidItems' };
      }

      const existing = [...(settings.value('data.readingList') || [])];
      let importedCount = 0;
      for (const item of valid) {
        const idx = existing.findIndex((e) => e.url === item.url);
        if (idx === -1) {
          existing.push(item);
          importedCount++;
        }
      }
      settings.set('data.readingList', existing);
      surface.send('toast', { message: 'toast.readingListImported', kind: 'success' });
      return { ok: true, count: importedCount, list: existing };
    } catch (err) {
      console.warn('[Hinterland] readingList import failed', err?.message);
      return { ok: false, error: err?.message };
    }
  });

  /* ---------------------------------------------------------------- notes */
  handle('notes:get', () => {
    return settings.value('data.notes') || [];
  });

  handle('notes:save', (note) => {
    if (!note || typeof note !== 'object') return null;
    const notes = [...(settings.value('data.notes') || [])];
    const index = notes.findIndex((n) => n.id === note.id);
    const updated = {
      id: note.id || `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: (note.title || '').trim(),
      content: note.content || '',
      pinned: Boolean(note.pinned),
      updatedAt: Date.now(),
    };
    if (index >= 0) {
      notes[index] = updated;
    } else {
      notes.unshift(updated);
    }
    settings.set('data.notes', notes);
    return updated;
  });

  handle('notes:delete', (id) => {
    const notes = (settings.value('data.notes') || []).filter((n) => n.id !== id);
    settings.set('data.notes', notes);
    return true;
  });

  handle('notes:duplicate', (id) => {
    const list = [...(settings.value('data.notes') || [])];
    const source = list.find((n) => n.id === id);
    if (!source) return { ok: false, error: 'not_found' };
    const copy = {
      ...source,
      id: 'note_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: `${source.title || 'Untitled'} (Copy)`,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    };
    list.unshift(copy);
    settings.set('data.notes', list);
    surface.send('toast', {
      message: 'toast.noteDuplicated',
      kind: 'success',
    });
    return { ok: true, note: copy, notes: list };
  });

  handle('notes:export', async (note) => {
    if (!note) return { ok: false };
    const safeTitle = (note.title || 'note').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 50) || 'note';
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `${safeTitle}.md`,
      filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, note.content || '', 'utf8');
    surface.send('toast', { message: 'toast.noteExported', kind: 'success' });
    return { ok: true, path: result.filePath };
  });

  handle('notes:exportAll', async () => {
    const notes = settings.value('data.notes') || [];
    const json = JSON.stringify(notes, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-notes-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.notesExportedAll', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  const formatNotesMarkdown = (notes = []) => {
    const dateStr = new Date().toISOString().split('T')[0];
    const pinned = notes.filter((n) => n.pinned);
    const regular = notes.filter((n) => !n.pinned);

    const lines = [
      '# Hinterland Quick Notes',
      '',
      `Exported on ${dateStr}. Total notes: ${notes.length} (${pinned.length} pinned, ${regular.length} unpinned).`,
      '',
    ];

    if (notes.length === 0) {
      lines.push('*No saved notes.*', '');
    } else {
      lines.push('## Table of Contents', '');
      for (const [idx, note] of notes.entries()) {
        const title = (note.title || 'Untitled Note').trim();
        const pinIcon = note.pinned ? '📌 ' : '';
        const anchor = `note-${idx + 1}`;
        lines.push(`- [${pinIcon}${title}](#${anchor})`);
      }
      lines.push('', '---', '');

      for (const [idx, note] of notes.entries()) {
        const title = (note.title || 'Untitled Note').trim();
        const pinBadge = note.pinned ? ' `📌 Pinned`' : '';
        const updatedDate = note.updatedAt ? new Date(note.updatedAt).toISOString().replace('T', ' ').slice(0, 16) : '';
        const anchor = `note-${idx + 1}`;

        lines.push(`<a id="${anchor}"></a>`);
        lines.push(`## ${title}${pinBadge}`);
        lines.push('');
        if (updatedDate) {
          lines.push(`*Last modified: ${updatedDate}*`, '');
        }
        lines.push(note.content || '*Empty note.*');
        lines.push('', '---', '');
      }
    }

    return lines.join('\n');
  };

  handle('notes:exportMarkdown', async () => {
    const notes = settings.value('data.notes') || [];
    const markdown = formatNotesMarkdown(notes);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-notes-${Date.now()}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, markdown, 'utf8');
    surface.send('toast', { message: 'toast.notesExportedMarkdown', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  handle('notes:copyMarkdown', (noteId = null) => {
    const notes = settings.value('data.notes') || [];
    if (noteId) {
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        surface.send('toast', { message: 'toast.noNotesToCopy', kind: 'warning' });
        return { ok: false, count: 0 };
      }
      const title = (note.title || 'Untitled Note').trim();
      const body = String(note.content || '').trim();
      const md = body ? `# ${title}\n\n${body}` : `# ${title}`;
      clipboard.writeText(md);
      surface.send('toast', { message: 'toast.noteMarkdownCopied', kind: 'success', data: { count: 1 } });
      return { ok: true, count: 1 };
    }
    if (!notes.length) {
      surface.send('toast', { message: 'toast.noNotesToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(formatNotesMarkdown(notes));
    surface.send('toast', { message: 'toast.noteMarkdownCopied', kind: 'success', data: { count: notes.length } });
    return { ok: true, count: notes.length };
  });

  handle('notes:copyJson', (noteId = null) => {
    const notes = settings.value('data.notes') || [];
    if (noteId) {
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        surface.send('toast', { message: 'toast.noNotesToCopy', kind: 'warning' });
        return { ok: false, count: 0 };
      }
      clipboard.writeText(JSON.stringify(note, null, 2));
      surface.send('toast', { message: 'toast.noteJsonCopied', kind: 'success', data: { count: 1 } });
      return { ok: true, count: 1 };
    }
    if (!notes.length) {
      surface.send('toast', { message: 'toast.noNotesToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(JSON.stringify(notes, null, 2));
    surface.send('toast', { message: 'toast.noteJsonCopied', kind: 'success', data: { count: notes.length } });
    return { ok: true, count: notes.length };
  });

  handle('notes:exportHtml', async () => {
    const notes = settings.value('data.notes') || [];
    const dateStr = new Date().toISOString().split('T')[0];
    const pinned = notes.filter((n) => n.pinned);

    const escapeHtml = (str) =>
      String(str || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

    const renderNotesHtml = (items) => {
      if (!items.length) return '<p style="color:var(--textDim);font-style:italic;">No notes found.</p>';
      return items.map((note, idx) => {
        const title = escapeHtml(note.title || 'Untitled Note');
        const content = escapeHtml(note.content || '');
        const updated = note.updatedAt ? new Date(note.updatedAt).toISOString().replace('T', ' ').slice(0, 16) : '';
        const pinnedBadge = note.pinned ? '<span class="badge pinned">📌 Pinned</span>' : '';
        return `    <article class="noteCard" data-pinned="${note.pinned ? 'true' : 'false'}" data-index="${idx}">
      <div class="noteHeader">
        <h2 class="noteTitle">${title}</h2>
        <div class="noteMeta">
          ${pinnedBadge}
          ${updated ? `<span class="time">${updated}</span>` : ''}
        </div>
      </div>
      <div class="noteBody">${content}</div>
    </article>`;
      }).join('\n');
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hinterland Quick Notes</title>
  <style>
    :root {
      --bg: #090b0e;
      --surface: #101319;
      --surfaceAlt: #151922;
      --border: #22293a;
      --text: #e6e9f2;
      --textDim: #8b949e;
      --accent: #388bfd;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 32px 16px;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 860px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .meta-lead {
      color: var(--textDim);
      font-size: 0.9rem;
      margin-top: 6px;
    }
    .toolbar {
      margin: 16px 0 24px;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .search-box {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 10px 14px;
      font-size: 0.95rem;
      outline: none;
    }
    .search-box:focus {
      border-color: var(--accent);
    }
    .noteCard {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 18px 20px;
      margin-bottom: 16px;
      transition: border-color 0.15s ease;
    }
    .noteCard:hover {
      border-color: #30363d;
    }
    .noteHeader {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .noteTitle {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text);
    }
    .noteMeta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--textDim);
      white-space: nowrap;
    }
    .badge {
      font-size: 0.72rem;
      padding: 2px 7px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge.pinned {
      background: rgba(56, 139, 253, 0.15);
      color: var(--accent);
      border: 1px solid rgba(56, 139, 253, 0.35);
    }
    .noteBody {
      font-size: 0.92rem;
      color: #c9d1d9;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
    }
    footer {
      margin-top: 40px;
      text-align: center;
      color: var(--textDim);
      font-size: 0.82rem;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <h1>Hinterland Quick Notes</h1>
      <p class="meta-lead">Exported on ${dateStr} • ${notes.length} total note(s) (${pinned.length} pinned)</p>
    </header>
    <div class="toolbar">
      <input type="text" id="searchInput" class="search-box" placeholder="Filter notes in real time..." autofocus>
    </div>
    <div id="notesContainer">
${renderNotesHtml(notes)}
    </div>
    <footer>
      Generated by Hinterland Browser — A fast, secure, and freely customizable browser.
    </footer>
  </div>
  <script>
    const input = document.getElementById('searchInput');
    const cards = document.querySelectorAll('.noteCard');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'block' : 'none';
      });
    });
  </script>
</body>
</html>`;

    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-notes-${Date.now()}.html`,
      filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, html, 'utf8');
    surface.send('toast', { message: 'toast.notesExportedHtml', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  handle('notes:importAll', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    try {
      const raw = await readFile(result.filePaths[0], 'utf8');
      const imported = JSON.parse(raw);
      const list = Array.isArray(imported) ? imported : [imported];
      const valid = list
        .filter((n) => n && typeof n === 'object' && (typeof n.title === 'string' || typeof n.content === 'string'))
        .map((n) => ({
          id: typeof n.id === 'string' && n.id ? n.id : `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          title: String(n.title || '').trim().slice(0, 200),
          content: String(n.content || ''),
          pinned: Boolean(n.pinned),
          updatedAt: Number(n.updatedAt) || Date.now(),
        }));

      if (!valid.length) {
        surface.send('toast', { message: 'notes.importInvalid', kind: 'warning' });
        return { ok: false, error: 'noValidNotes' };
      }

      const existing = [...(settings.value('data.notes') || [])];
      let importedCount = 0;
      for (const note of valid) {
        const idx = existing.findIndex((e) => e.id === note.id);
        if (idx >= 0) {
          existing[idx] = note;
        } else {
          existing.unshift(note);
          importedCount++;
        }
      }
      settings.set('data.notes', existing);
      surface.send('toast', { message: 'toast.notesImported', kind: 'success' });
      return { ok: true, count: importedCount, notes: existing };
    } catch (err) {
      console.warn('[Hinterland] notes import failed', err?.message);
      return { ok: false, error: err?.message };
    }
  });

  handle('notes:createFromTab', (tabId) => {
    const tab = activeTab(tabId);
    if (!tab || !tab.url || tab.url === 'about:blank' || tab.url.startsWith('hinterland://')) {
      surface.send('toast', { message: 'toast.noTabsToBookmark', kind: 'warning' });
      return { ok: false, error: 'invalidTab' };
    }
    const tabTitle = (tab.title || tab.url).slice(0, 150);
    const dateStr = new Date().toISOString().split('T')[0];
    const noteContent = `# [${tabTitle}](${tab.url})\n\n> Captured from Hinterland Browser on ${dateStr}\n\n- URL: ${tab.url}\n`;
    const fresh = {
      id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: tabTitle,
      content: noteContent,
      pinned: false,
      updatedAt: Date.now(),
    };
    const notes = [...(settings.value('data.notes') || [])];
    notes.unshift(fresh);
    settings.set('data.notes', notes);
    surface.send('toast', { message: 'toast.noteCreatedFromTab', kind: 'success' });
    return { ok: true, note: fresh };
  });

  const extractUrlsFromNotes = (noteId = null) => {
    const notes = settings.value('data.notes') || [];
    const targets = noteId ? notes.filter((n) => n.id === noteId) : notes;
    const candidates = [];
    for (const note of targets) {
      const matches = String(note?.content || '').match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
      candidates.push(...matches);
    }
    return candidates;
  };

  handle('notes:openLinks', (noteId = null) => {
    const candidates = extractUrlsFromNotes(noteId);
    return openValidatedUrlsInTabs(candidates, {
      limit: 20,
      emptyToast: 'toast.noLinksInNote',
      successToast: 'toast.noteLinksOpened',
    });
  });

  handle('notes:copyLinks', (noteId = null) => {
    const candidates = extractUrlsFromNotes(noteId);
    const cleaned = validateHttpUrls(candidates, 100);
    return copyUniqueUrls(cleaned, 'toast.noLinksInNote', 'toast.noteLinksCopied');
  });

  handle('notes:toStash', (noteId = null) => {
    const notes = settings.value('data.notes') || [];
    const targetNote = noteId ? notes.find((n) => n.id === noteId) : null;
    const urls = validateHttpUrls(extractUrlsFromNotes(noteId), 30);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noLinksInNote', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const dateStr = new Date().toLocaleDateString('en-CA');
    const title = String(targetNote?.title || `Notes Links (${dateStr})`).trim().slice(0, 150) || `Notes Links (${dateStr})`;
    const newStash = {
      id: `stash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      createdAt: Date.now(),
      tabs: urls.map((url) => ({
        url,
        title: normalizeDomain(url) || url,
        favicon: '',
      })),
    };
    const stashes = [...(settings.value('data.tabStashes') || [])];
    stashes.unshift(newStash);
    settings.set('data.tabStashes', stashes);
    surface.send('toast', { message: 'toast.noteSavedAsStash', kind: 'success', data: { count: urls.length, title } });
    return { ok: true, stash: newStash, count: urls.length };
  });

  handle('notes:createFromClipboard', () => {
    const text = String(clipboard.readText() || '').trim();
    if (!text) {
      surface.send('toast', { message: 'toast.clipboardEmptyForNote', kind: 'warning' });
      return { ok: false, error: 'emptyClipboard' };
    }
    const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
    const derivedTitle = firstLine.replace(/^#+\s*/, '').slice(0, 80) || `Clipboard (${new Date().toLocaleDateString('en-CA')})`;
    const fresh = {
      id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: derivedTitle,
      content: text,
      pinned: false,
      updatedAt: Date.now(),
    };
    const notes = [...(settings.value('data.notes') || [])];
    notes.unshift(fresh);
    settings.set('data.notes', notes);
    surface.send('toast', { message: 'toast.noteCreatedFromClipboard', kind: 'success' });
    return { ok: true, note: fresh };
  });

  handle('notes:createFromAllTabs', () => {
    const { count, markdown } = formatOpenTabsMarkdown();
    if (!count) {
      surface.send('toast', { message: 'toast.noTabsToCopy', kind: 'warning' });
      return { ok: false, error: 'noTabs', count: 0 };
    }
    const dateStr = new Date().toLocaleDateString('en-CA');
    const title = `Session Tabs (${dateStr})`;
    const fresh = {
      id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title,
      content: markdown,
      pinned: false,
      updatedAt: Date.now(),
    };
    const notes = [...(settings.value('data.notes') || [])];
    notes.unshift(fresh);
    settings.set('data.notes', notes);
    surface.send('toast', { message: 'toast.noteCreatedFromAllTabs', kind: 'success', data: { count } });
    return { ok: true, note: fresh, count };
  });

  handle('notes:pruneEmpty', () => {
    const existing = [...(settings.value('data.notes') || [])];
    const kept = existing.filter((note) => {
      if (note?.pinned) return true;
      return Boolean(String(note?.content || '').trim());
    });
    const removed = existing.length - kept.length;
    if (removed > 0) {
      settings.set('data.notes', kept);
      surface.send('toast', { message: 'toast.notesPruned', kind: 'success', data: { count: removed } });
    } else {
      surface.send('toast', { message: 'toast.noEmptyNotes', kind: 'info' });
    }
    return { ok: removed > 0, removed, count: kept.length };
  });

  /* ------------------------------------------------------------- tab stashes */
  handle('stashes:get', () => {
    return settings.value('data.tabStashes') || [];
  });

  handle('stashes:stashCurrent', async ({ title, keepActive = false } = {}) => {
    const currentTabs = tabs.list;
    const active = tabs.active;
    const tabsToStash = currentTabs.filter((t) => {
      if (!t.url || t.url === NEW_TAB_URL || t.url === 'about:blank') return false;
      if (keepActive && active && t.id === active.id) return false;
      return true;
    });

    if (!tabsToStash.length) {
      return { ok: false, error: 'no_tabs' };
    }

    const dateStr = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const newStash = {
      id: `stash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: (title || '').trim() || `${translate(language(), 'stash.defaultTitle')} (${dateStr})`,
      createdAt: Date.now(),
      tabs: tabsToStash.map((t) => ({
        url: t.url,
        title: t.title || t.url,
        favicon: t.favicon || '',
      })),
    };

    const stashes = [...(settings.value('data.tabStashes') || [])];
    stashes.unshift(newStash);
    settings.set('data.tabStashes', stashes);

    for (const t of tabsToStash) {
      tabs.close(t.id);
    }

    if (!tabs.list.length) {
      tabs.create({ url: NEW_TAB_URL });
    }

    surface.send('toast', {
      message: translate(language(), 'toast.tabsStashed', { count: tabsToStash.length }),
      kind: 'success',
    });

    return { ok: true, stash: newStash, count: tabsToStash.length };
  });

  handle('stashes:restore', async (stashId, { closeCurrent = false, removeStash = false } = {}) => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const stash = stashes.find((s) => s.id === stashId);
    if (!stash || !stash.tabs?.length) return { ok: false, error: 'not_found' };

    if (closeCurrent) {
      tabs.closeAll();
    }

    for (let i = 0; i < stash.tabs.length; i++) {
      const entry = stash.tabs[i];
      tabs.create({ url: entry.url, background: i > 0, title: entry.title });
    }

    if (removeStash) {
      const updated = stashes.filter((s) => s.id !== stashId);
      settings.set('data.tabStashes', updated);
    }

    surface.send('toast', {
      message: translate(language(), 'toast.stashRestored', { count: stash.tabs.length }),
      kind: 'success',
    });

    return { ok: true, count: stash.tabs.length };
  });

  handle('stashes:restoreAsGroup', (stashId) => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const stash = stashes.find((s) => s.id === stashId);
    if (!stash || !stash.tabs?.length) return { ok: false, error: 'not_found' };

    const groups = sortedGroups();
    const groupId = `g${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    groups.push({
      id: groupId,
      name: String(stash.title || 'Tab Stash').slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(stash.color || '') ? stash.color : '#388bfd',
      collapsed: false,
    });
    persistGroups(groups);

    for (let i = 0; i < stash.tabs.length; i++) {
      const entry = stash.tabs[i];
      const created = tabs.create({ url: entry.url, background: i > 0, title: entry.title });
      if (created) {
        created.groupId = groupId;
        surface.send('tab:update', created.snapshot());
      }
    }
    tabs.scheduleSave();

    surface.send('toast', {
      message: 'toast.stashRestoredAsGroup',
      kind: 'success',
      data: { count: stash.tabs.length, name: String(stash.title || 'Tab Stash').slice(0, 40) },
    });

    return { ok: true, groupId, count: stash.tabs.length };
  });

  handle('stashes:delete', (stashId) => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const updated = stashes.filter((s) => s.id !== stashId);
    settings.set('data.tabStashes', updated);
    return { ok: true };
  });

  handle('stashes:rename', (stashId, newTitle) => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const stash = stashes.find((s) => s.id === stashId);
    if (stash) {
      stash.title = newTitle.trim() || stash.title;
      settings.set('data.tabStashes', stashes);
      return { ok: true, stash };
    }
    return { ok: false };
  });

  handle('stashes:removeTab', (stashId, tabIndex) => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const stash = stashes.find((s) => s.id === stashId);
    if (stash && stash.tabs) {
      stash.tabs.splice(tabIndex, 1);
      if (stash.tabs.length === 0) {
        const idx = stashes.indexOf(stash);
        stashes.splice(idx, 1);
      }
      settings.set('data.tabStashes', stashes);
      return { ok: true, stash };
    }
    return { ok: false };
  });

  handle('stashes:exportJson', async (stashId = null) => {
    const stashes = settings.value('data.tabStashes') || [];
    const exportData = stashId ? stashes.filter((s) => s.id === stashId) : stashes;
    const json = JSON.stringify(exportData, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-stashes-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.stashExported', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  const formatStashesMarkdown = (exportData) => {
    const dateStr = new Date().toISOString().split('T')[0];
    const lines = [
      '# Hinterland Tab Stashes',
      '',
      `Exported on ${dateStr}. Total stashes: ${exportData.length}.`,
      '',
    ];

    if (exportData.length === 0) {
      lines.push('*No saved tab stashes.*', '');
    } else {
      for (const stash of exportData) {
        const title = stash.title || 'Untitled Stash';
        const date = stash.createdAt ? new Date(stash.createdAt).toISOString().split('T')[0] : '';
        const count = Array.isArray(stash.tabs) ? stash.tabs.length : 0;
        lines.push(`## ${title} (${count} tabs)${date ? ` — Saved: ${date}` : ''}`, '');
        if (Array.isArray(stash.tabs) && stash.tabs.length > 0) {
          for (const tab of stash.tabs) {
            const tabTitle = String(tab.title || tab.url || 'Tab').replaceAll('[', '\\[').replaceAll(']', '\\]');
            const host = normalizeDomain(tab.url) || tab.url;
            lines.push(`- [${tabTitle}](${tab.url}) — *${host}*`);
          }
        } else {
          lines.push('*Empty stash.*');
        }
        lines.push('');
      }
    }
    return lines.join('\n');
  };

  handle('stashes:exportMarkdown', async (stashId = null) => {
    const stashes = settings.value('data.tabStashes') || [];
    const exportData = stashId ? stashes.filter((s) => s.id === stashId) : stashes;
    const md = formatStashesMarkdown(exportData);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-stashes-${Date.now()}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, md, 'utf8');
    surface.send('toast', { message: 'toast.stashExported', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  handle('stashes:copyMarkdown', (stashId = null) => {
    const stashes = settings.value('data.tabStashes') || [];
    if (!stashId) {
      if (!stashes.length) {
        surface.send('toast', { message: 'toast.noTabsInStashToCopy', kind: 'warning' });
        return { ok: false, count: 0 };
      }
      clipboard.writeText(formatStashesMarkdown(stashes));
      surface.send('toast', { message: 'toast.stashAllMarkdownCopied', kind: 'success', data: { count: stashes.length } });
      return { ok: true, count: stashes.length };
    }
    const stash = stashes.find((s) => s.id === stashId);
    const stashTabs = Array.isArray(stash?.tabs) ? stash.tabs : [];
    if (!stash || !stashTabs.length) {
      surface.send('toast', { message: 'toast.noTabsInStashToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const title = stash.title || 'Tab Stash';
    const lines = [`## ${title}`, ''];
    for (const tab of stashTabs) {
      const tabTitle = String(tab.title || tab.url || 'Tab').replace(/[\[\]]/g, '');
      lines.push(`- [${tabTitle}](${tab.url})`);
    }
    clipboard.writeText(lines.join('\n'));
    surface.send('toast', { message: 'toast.stashLinksCopied', kind: 'success' });
    return { ok: true, count: stashTabs.length };
  });

  handle('stashes:copyUrls', (stashId) => {
    const stashes = settings.value('data.tabStashes') || [];
    const stash = stashes.find((s) => s.id === stashId);
    const urls = (Array.isArray(stash?.tabs) ? stash.tabs : []).map((t) => t?.url).filter(Boolean);
    if (!stash || !urls.length) {
      surface.send('toast', { message: 'toast.noTabsInStashToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    clipboard.writeText(urls.join('\n'));
    surface.send('toast', { message: 'toast.stashUrlsCopied', kind: 'success', data: { count: urls.length } });
    return { ok: true, count: urls.length };
  });

  handle('stashes:copyAllUrls', () => {
    const stashes = settings.value('data.tabStashes') || [];
    const urls = stashes.flatMap((stash) => (Array.isArray(stash?.tabs) ? stash.tabs : []).map((t) => t?.url));
    return copyUniqueUrls(urls, 'toast.noTabsInStashToCopy', 'toast.stashAllUrlsCopied');
  });

  handle('stashes:copyJson', (stashId = null) => {
    const stashes = settings.value('data.tabStashes') || [];
    const target = stashId ? stashes.filter((s) => s.id === stashId) : stashes;
    if (!target.length) {
      surface.send('toast', { message: 'toast.noTabsInStashToCopy', kind: 'warning' });
      return { ok: false, count: 0 };
    }
    const payload = stashId && target.length === 1 ? target[0] : target;
    clipboard.writeText(JSON.stringify(payload, null, 2));
    surface.send('toast', { message: 'toast.stashJsonCopied', kind: 'success', data: { count: target.length } });
    return { ok: true, count: target.length };
  });

  handle('stashes:createFromClipboard', () => {
    const urls = extractValidatedUrlsFromClipboard(30);
    if (!urls.length) {
      surface.send('toast', { message: 'toast.noUrlsInClipboard', kind: 'warning' });
      return { ok: false, error: 'no_urls', count: 0 };
    }
    const dateStr = new Date().toLocaleDateString('en-CA');
    const newStash = {
      id: `stash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: `Clipboard (${dateStr})`,
      createdAt: Date.now(),
      tabs: urls.map((url) => ({
        url,
        title: normalizeDomain(url) || url,
        favicon: '',
      })),
    };
    const stashes = [...(settings.value('data.tabStashes') || [])];
    stashes.unshift(newStash);
    settings.set('data.tabStashes', stashes);
    surface.send('toast', { message: 'toast.stashCreatedFromClipboard', kind: 'success', data: { count: urls.length } });
    return { ok: true, stash: newStash, count: urls.length };
  });

  handle('stashes:deduplicate', () => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    let removed = 0;
    const normalizeUrl = (raw) => String(raw || '').trim().replace(/\/+$/, '').toLowerCase();
    const updated = stashes.map((stash) => {
      const seen = new Set();
      const uniqueTabs = [];
      for (const tab of stash.tabs || []) {
        const key = normalizeUrl(tab?.url);
        if (!key || seen.has(key)) {
          if (key) removed += 1;
          continue;
        }
        seen.add(key);
        uniqueTabs.push(tab);
      }
      return { ...stash, tabs: uniqueTabs };
    });
    if (removed > 0) {
      settings.set('data.tabStashes', updated);
      surface.send('toast', { message: 'toast.stashesDeduplicated', kind: 'success', data: { count: removed } });
    } else {
      surface.send('toast', { message: 'toast.stashesNoDuplicates', kind: 'info' });
    }
    return { ok: true, removed };
  });

  handle('stashes:toNote', (stashId) => {
    const stashes = settings.value('data.tabStashes') || [];
    const stash = stashes.find((s) => s.id === stashId);
    const stashTabs = Array.isArray(stash?.tabs) ? stash.tabs : [];
    if (!stash || !stashTabs.length) {
      surface.send('toast', { message: 'toast.noTabsInStashToCopy', kind: 'warning' });
      return { ok: false, error: 'no_tabs' };
    }
    const title = String(stash.title || 'Tab Stash').trim().slice(0, 150);
    const dateStr = new Date().toISOString().split('T')[0];
    const lines = [`# ${title}`, '', `> Converted from Tab Stash on ${dateStr}`, ''];
    for (const tab of stashTabs) {
      const tabTitle = String(tab.title || tab.url || 'Tab').replace(/[\[\]]/g, '');
      lines.push(`- [${tabTitle}](${tab.url})`);
    }
    const fresh = {
      id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title,
      content: lines.join('\n'),
      pinned: false,
      updatedAt: Date.now(),
    };
    const notes = [...(settings.value('data.notes') || [])];
    notes.unshift(fresh);
    settings.set('data.notes', notes);
    surface.send('toast', { message: 'toast.stashSavedAsNote', kind: 'success', data: { title } });
    return { ok: true, note: fresh };
  });

  handle('stashes:toBookmarks', (stashId) => {
    const stashes = settings.value('data.tabStashes') || [];
    const stash = stashes.find((s) => s.id === stashId);
    return bookmarkTabEntries(stash?.tabs, stash?.title || 'Tab Stash', {
      emptyToast: 'toast.noTabsInStashToCopy',
      alreadyToast: 'toast.allTabsAlreadyBookmarked',
      successToast: 'toast.stashBookmarked',
    });
  });

  handle('stashes:pruneEmpty', () => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const kept = stashes.filter((s) => Array.isArray(s?.tabs) && s.tabs.length > 0);
    const removed = stashes.length - kept.length;
    if (removed > 0) {
      settings.set('data.tabStashes', kept);
      surface.send('toast', { message: 'toast.stashesPruned', kind: 'success', data: { count: removed } });
    } else {
      surface.send('toast', { message: 'toast.noEmptyStashes', kind: 'info' });
    }
    return { ok: removed > 0, removed, count: kept.length };
  });

  handle('stashes:addTab', (stashId, tabId = null) => {
    const tab = (tabId ? tabs.byId(tabId) : null) || tabs.active;
    if (!tab || !tab.url || tab.url === NEW_TAB_URL || tab.url === 'about:blank' || tab.url.startsWith('hinterland://')) {
      surface.send('toast', { message: 'toast.noTabsToStash', kind: 'warning' });
      return { ok: false, error: 'no_tabs' };
    }
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const stash = stashes.find((s) => s.id === stashId);
    if (!stash) return { ok: false, error: 'not_found' };
    const existingTabs = Array.isArray(stash.tabs) ? stash.tabs : (stash.tabs = []);
    if (existingTabs.some((t) => t.url === tab.url)) {
      surface.send('toast', { message: 'toast.stashTabAlreadyExists', kind: 'info' });
      return { ok: false, error: 'duplicate' };
    }
    existingTabs.push({
      url: tab.url,
      title: tab.title || tab.url,
      favicon: tab.favicon || '',
    });
    settings.set('data.tabStashes', stashes);
    surface.send('toast', { message: 'toast.stashTabAdded', kind: 'success' });
    return { ok: true, stash };
  });

  handle('stashes:importJson', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    try {
      const raw = await readFile(result.filePaths[0], 'utf8');
      const imported = JSON.parse(raw);
      const list = Array.isArray(imported) ? imported : [imported];
      const valid = list
        .filter((s) => s && typeof s === 'object' && Array.isArray(s.tabs) && s.tabs.length > 0)
        .map((s) => ({
          id: typeof s.id === 'string' && s.id ? s.id : `stash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          title: String(s.title || 'Imported Stash').slice(0, 200),
          createdAt: Number(s.createdAt) || Date.now(),
          tabs: s.tabs
            .filter((t) => t && typeof t.url === 'string' && (t.url.startsWith('http://') || t.url.startsWith('https://') || t.url.startsWith('hinterland://')))
            .map((t) => ({ url: t.url, title: String(t.title || t.url).slice(0, 300), favicon: typeof t.favicon === 'string' ? t.favicon : '' })),
        }))
        .filter((s) => s.tabs.length > 0);
      if (!valid.length) return { ok: false, error: 'invalid_format' };
      const existing = [...(settings.value('data.tabStashes') || [])];
      existing.unshift(...valid);
      settings.set('data.tabStashes', existing);
      surface.send('toast', {
        message: translate(language(), 'toast.stashImported', { count: valid.length }),
        kind: 'success',
      });
      return { ok: true, count: valid.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  handle('stashes:stashTab', async (tabId) => {
    const tab = tabs.byId(tabId) || tabs.active;
    if (!tab || !tab.url || tab.url === NEW_TAB_URL || tab.url === 'about:blank' || tab.url.startsWith('hinterland://')) {
      surface.send('toast', { message: 'toast.noTabsToStash', kind: 'warning' });
      return { ok: false, error: 'no_tabs' };
    }
    const tabTitle = (tab.title || tab.url).slice(0, 100);
    const stash = {
      id: `stash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: tabTitle,
      createdAt: Date.now(),
      tabs: [{
        url: tab.url,
        title: tab.title || tab.url,
        favicon: tab.favicon || '',
      }],
    };
    const stashes = [...(settings.value('data.tabStashes') || [])];
    stashes.unshift(stash);
    settings.set('data.tabStashes', stashes);
    tabs.close(tab.id);
    surface.send('toast', { message: 'toast.tabStashed', kind: 'success', data: { title: tabTitle } });
    return { ok: true, stash };
  });

  handle('stashes:duplicate', async (stashId) => {
    const stashes = [...(settings.value('data.tabStashes') || [])];
    const source = stashes.find((s) => s.id === stashId);
    if (!source) return { ok: false, error: 'not_found' };
    const clone = {
      id: `stash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${source.title || 'Tab Stash'} (Copy)`,
      createdAt: Date.now(),
      tabs: (source.tabs || []).map((t) => ({ ...t })),
    };
    stashes.unshift(clone);
    settings.set('data.tabStashes', stashes);
    surface.send('toast', { message: 'toast.stashDuplicated', kind: 'success' });
    return { ok: true, stash: clone };
  });

  handle('shell:open', (url) => {
    if (handOffToSystem(url)) return true;
    return openExternal(url);
  });

handle('permission:resolve', (requestId, answer) => {
    resolvePending(requestId, answer);
    return true;
  });

  const PAGE_KEYS = [
    'general.hasRunBefore',
    'start.layout',
    'start.background',
    'start.backgroundOverlay',
    'start.showClock',
    'start.showSearch',
    'start.showGreeting',
    'start.searchTarget',
    'start.links',
    'appearance.accent',
    'appearance.accentContrast',
    'appearance.darkBackground',
    'appearance.darkSurface',
    'appearance.darkText',
    'appearance.lightBackground',
    'appearance.lightSurface',
    'appearance.lightText',
    'appearance.radius',
    'appearance.fontSize',
    'appearance.customFont',
    'appearance.blur',
    'appearance.theme',
    'appearance.animations',
  ];

  handle('page:settings', (patch) => {
    if (patch && typeof patch === 'object') {
      const allowed = {};
      for (const key of PAGE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) allowed[key] = patch[key];
      }
      if (Object.keys(allowed).length) settings.merge(allowed);
    }
    return {
      ...Object.fromEntries(PAGE_KEYS.map(key => [key, settings.value(key)])),
      'general.language': settings.value('general.language'),
    };
  });

handle('dialog:confirm', async ({ title, message, detail, confirmLabel, cancelLabel }) => {
  const result = await dialog.showMessageBox(chromeWindow(), {
    type: 'question',
    buttons: [confirmLabel || 'OK', cancelLabel || 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: title || 'Hinterland',
    message: message || '',
    detail: detail || '',
  });
  return result.response === 0;
  });

  /* ------------------------------------------------------------ passwords */
  handle('passwords:getStatus', (activeUrl) => {
    return passwords.getStatus(activeUrl || tabs.active?.url || '');
  });

  handle('passwords:setup', (masterPassword) => {
    return passwords.setup(masterPassword);
  });

  handle('passwords:unlock', (masterPassword) => {
    return passwords.unlock(masterPassword);
  });

  handle('passwords:lock', () => {
    return passwords.lock();
  });

  handle('passwords:changeMasterPassword', (currentPassword, newPassword) => {
    return passwords.changeMasterPassword(currentPassword, newPassword);
  });

  handle('passwords:getLoginsForUrl', (urlOrDomain) => {
    return passwords.getLoginsForUrl(urlOrDomain || tabs.active?.url || '');
  });

  handle('passwords:getAllLogins', (searchQuery) => {
    return passwords.getAllLogins(searchQuery);
  });

  handle('passwords:saveLogin', (item) => {
    return passwords.saveLogin(item);
  });

  handle('passwords:deleteLogin', (id) => {
    return passwords.deleteLogin(id);
  });

  handle('passwords:generatePassword', (options) => {
    return passwords.generatePassword(options);
  });

  handle('passwords:neverSaveDomain', (domain) => {
    return passwords.neverSaveDomain(domain || tabs.active?.url || '');
  });

  handle('passwords:exportVault', async () => {
    const res = passwords.exportVault();
    if (!res.ok) return res;
    const json = JSON.stringify(res.data, null, 2);
    const result = await dialog.showSaveDialog(chromeWindow(), {
      title: 'Hinterland',
      defaultPath: `hinterland-passwords-${Date.now()}.json`,
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await writeFile(result.filePath, json, 'utf8');
    surface.send('toast', { message: 'toast.vaultExported', kind: 'success' });
    return { ok: true, filePath: result.filePath };
  });

  handle('passwords:importVault', async () => {
    const result = await dialog.showOpenDialog(chromeWindow(), {
      title: 'Hinterland',
      properties: ['openFile'],
      filters: [{ name: 'JSON Document', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    try {
      const raw = await readFile(result.filePaths[0], 'utf8');
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const res = await passwords.importVault(items);
      if (res.ok) {
        surface.send('toast', {
          message: translate(language(), 'toast.vaultImported', { count: res.importedCount }),
          kind: 'success',
        });
      }
      return res;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  handle('passwords:updateSettings', (patch) => {
    return passwords.updateSettings(patch);
  });

  handle('passwords:autofillActiveTab', async (payload) => {
    const tab = tabs.active;
    if (!tab) return { ok: false, error: 'No active tab' };
    const ok = await passwords.autofillTab(tab, payload || {});
    return { ok };
  });

  /* ------------------------------------------------------------- account & sync */
  handle('account:getStatus', () => {
    return syncService.getStatus();
  });

  handle('account:signUp', async (opts) => {
    try {
      return await syncService.signUp(opts || {});
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  handle('account:signIn', async (opts) => {
    try {
      return await syncService.signIn(opts || {});
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  handle('account:signOut', async () => {
    return await syncService.signOut();
  });

  handle('account:syncNow', async (opts) => {
    return await syncService.syncNow(opts || {});
  });

  handle('account:updateConfig', async (patch) => {
    return await syncService.updateConfig(patch || {});
  });

  handle('account:getDevices', () => {
    return syncService.getDevices();
  });

  handle('account:getSyncStats', () => {
    return syncService.getSyncStats();
  });

  handle('account:pairDevice', () => {
    return syncService.pairDevice();
  });

  handle('account:syncBookmarks', async () => {
    return await syncService.syncBookmarks();
  });

  /* ------------------------------ credentials submitted from web content view */
  ipcMain.on('tab:credentialsSubmitted', (_event, creds) => {
    if (!creds || typeof creds !== 'object') return;
    const { username, password, url } = creds;
    if (!password || password.length < 3) return;

    const domain = normalizeDomain(url);
    if (!domain) return;

    const conf = passwords.getSettings();
    if (conf.savePromptEnabled === false) return;
    if (conf.neverDomains && conf.neverDomains.includes(domain)) return;

    // Check if matching credential already saved
    if (passwords.isUnlocked()) {
      const matches = passwords.getLoginsForUrl(domain);
      const alreadySaved = matches.logins?.some(
        (l) => l.username === (username || '') && l.password === password,
      );
      if (alreadySaved) return;
    }

    surface.send('passwords:promptSave', {
      domain,
      url,
      username: username || '',
      password,
    });
  });
}

const pendingRequests = new Map();

function resolvePending(id, answer) {
  const resolver = pendingRequests.get(id);
  pendingRequests.delete(id);
  resolver?.(Boolean(answer));
}

export function askPermission({ permission, origin, mediaTypes }) {
  const id = `p${Date.now().toString(36)}${(askPermission.counter = (askPermission.counter ?? 0) + 1).toString(36)}`;
  surface.send('permission:request', { id, permission, origin, mediaTypes });
  return new Promise((resolve) => pendingRequests.set(id, resolve));
}

export function askCloseTab(snapshot) {
  surface.send('tab:confirmClose', { id: snapshot.id, title: snapshot.title, url: snapshot.url });
  return new Promise((resolve) => pendingRequests.set(snapshot.id, resolve));
}

function chromeWindow() {
  return surface.window ?? BrowserWindow.getFocusedWindow() ?? undefined;
}

export function startupUrl() {
  const homepage = settings.value('general.homepage');
  if (homepage && homepage.trim()) return resolveTarget(homepage).url ?? NEW_TAB_URL;
  return NEW_TAB_URL;
}

function inPageReaderScript(initialPrefs) {
  const existing = document.getElementById('hinterland-reader-view');
  if (existing) {
    existing.remove();
    document.documentElement.style.overflow = '';
    return false;
  }

  const prefs = Object.assign({
    theme: 'sepia',
    font: 'serif',
    size: 18,
    width: 'standard',
  }, initialPrefs || {});

  const THEMES = {
    light: { bg: '#ffffff', text: '#1f2937', border: '#e5e7eb', meta: '#6b7280', barBg: 'rgba(255, 255, 255, 0.96)', cardBg: '#f3f4f6', link: '#2563eb' },
    sepia: { bg: '#fbf0d9', text: '#433422', border: '#e8dac2', meta: '#8c7b66', barBg: 'rgba(251, 240, 217, 0.96)', cardBg: '#f3e5c8', link: '#b45309' },
    dark: { bg: '#1a1d24', text: '#e2e8f0', border: '#2e3440', meta: '#94a3b8', barBg: 'rgba(26, 29, 36, 0.96)', cardBg: '#252934', link: '#60a5fa' },
    pitch: { bg: '#000000', text: '#f1f5f9', border: '#1f2937', meta: '#9ca3af', barBg: 'rgba(0, 0, 0, 0.96)', cardBg: '#141414', link: '#38bdf8' },
  };

  const FONTS = {
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  };

  const WIDTHS = {
    compact: '580px',
    standard: '740px',
    wide: '960px',
  };

  const selectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.article-body',
    '.story-body',
    '#content',
    'main',
  ];

  let mainEl = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.length > 200) {
      mainEl = el;
      break;
    }
  }

  if (!mainEl) {
    const candidates = Array.from(document.querySelectorAll('div, section'));
    let maxLen = 0;
    for (const cand of candidates) {
      const ps = cand.querySelectorAll('p');
      if (ps.length >= 2) {
        let textLen = 0;
        ps.forEach((p) => { textLen += p.innerText.length; });
        if (textLen > maxLen) {
          maxLen = textLen;
          mainEl = cand;
        }
      }
    }
  }

  if (!mainEl) mainEl = document.body;

  const titleEl = document.querySelector('article h1, h1, [class*="title"], [class*="headline"]');
  const title = (titleEl?.innerText || document.title || 'Reader').trim();

  const authorEl = document.querySelector('article [rel="author"], .byline, [class*="author"], time');
  const author = (authorEl?.innerText || '').trim();

  const clone = mainEl.cloneNode(true);
  const junk = clone.querySelectorAll(
    'script, style, noscript, iframe, nav, footer, header, form, aside, button, input, textarea, select, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], ' +
    '.nav, .navigation, .footer, .header, .sidebar, .comments, .social-share, .ad, .advertisement, [class*="banner"]'
  );
  junk.forEach((n) => n.remove());

  const fullText = clone.innerText || '';
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(wordCount / 200));

  const overlay = document.createElement('div');
  overlay.id = 'hinterland-reader-view';
  overlay.setAttribute('data-hinterland-reader', 'true');

  const container = document.createElement('div');
  const bar = document.createElement('div');
  const toastBox = document.createElement('div');

  function showToast(msg) {
    toastBox.textContent = msg;
    toastBox.style.opacity = '1';
    toastBox.style.transform = 'translateY(0)';
    setTimeout(() => {
      toastBox.style.opacity = '0';
      toastBox.style.transform = 'translateY(8px)';
    }, 2200);
  }

  function applyStyles() {
    const t = THEMES[prefs.theme] || THEMES.sepia;
    const f = FONTS[prefs.font] || FONTS.serif;
    const w = WIDTHS[prefs.width] || WIDTHS.standard;

    overlay.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:${t.bg};color:${t.text};overflow-y:auto;font-family:${f};font-size:${prefs.size}px;line-height:1.75;padding:0;margin:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;transition:background 0.2s, color 0.2s;`;
    bar.style.cssText = `position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:10px 24px;background:${t.barBg};backdrop-filter:blur(12px);border-bottom:1px solid ${t.border};z-index:100;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;`;
    container.style.cssText = `max-width:${w};margin:0 auto;padding:48px 24px 96px;transition:max-width 0.2s;`;

    container.querySelectorAll('a').forEach((a) => { a.style.color = t.link; });
    const divider = container.querySelector('hr');
    if (divider) divider.style.background = t.border;
  }

  // Save prefs to Hinterland
  function notifyPrefs() {
    console.log('__HINTERLAND_READER_ACTION__:' + JSON.stringify({ action: 'savePrefs', prefs }));
  }

  // Extract clean Markdown
  function extractMarkdown() {
    let md = `# ${title}\n\n`;
    if (author) md += `*${author}* • *${readMins} min read*\n\n---\n\n`;
    const paragraphs = clone.querySelectorAll('p, h2, h3, h4, blockquote, pre, li');
    if (paragraphs.length) {
      paragraphs.forEach((p) => {
        const tag = p.tagName.toLowerCase();
        const text = p.innerText.trim();
        if (!text) return;
        if (tag === 'h2') md += `## ${text}\n\n`;
        else if (tag === 'h3') md += `### ${text}\n\n`;
        else if (tag === 'h4') md += `#### ${text}\n\n`;
        else if (tag === 'blockquote') md += `> ${text}\n\n`;
        else if (tag === 'pre') md += `\`\`\`\n${text}\n\`\`\`\n\n`;
        else if (tag === 'li') md += `- ${text}\n`;
        else md += `${text}\n\n`;
      });
    } else {
      md += fullText;
    }
    return md.trim();
  }

  // Top Bar elements
  const infoBadge = document.createElement('span');
  infoBadge.style.cssText = 'color:inherit;opacity:0.8;display:flex;align-items:center;gap:6px;font-size:13px;';
  infoBadge.textContent = `📖 ${readMins} min read • ${wordCount} words`;

  // Controls container
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';

  // 1. Theme controls
  const themeGroup = document.createElement('div');
  themeGroup.style.cssText = 'display:flex;align-items:center;gap:4px;background:rgba(125,125,125,0.12);padding:2px 4px;border-radius:20px;';
  [
    { id: 'light', label: '☀️', title: 'Light' },
    { id: 'sepia', label: '📜', title: 'Sepia' },
    { id: 'dark', label: '🌙', title: 'Dark' },
    { id: 'pitch', label: '⬛', title: 'Pitch' },
  ].forEach((thm) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = thm.label;
    btn.title = thm.title;
    btn.style.cssText = 'border:0;background:transparent;cursor:pointer;font-size:13px;padding:3px 6px;border-radius:12px;';
    btn.onclick = () => {
      prefs.theme = thm.id;
      applyStyles();
      notifyPrefs();
    };
    themeGroup.appendChild(btn);
  });

  // 2. Font family controls
  const fontGroup = document.createElement('div');
  fontGroup.style.cssText = 'display:flex;align-items:center;gap:2px;background:rgba(125,125,125,0.12);padding:2px 4px;border-radius:6px;';
  [
    { id: 'serif', label: 'Serif' },
    { id: 'sans', label: 'Sans' },
    { id: 'mono', label: 'Mono' },
  ].forEach((fnt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = fnt.label;
    btn.style.cssText = 'border:0;background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:3px 8px;border-radius:4px;';
    btn.onclick = () => {
      prefs.font = fnt.id;
      applyStyles();
      notifyPrefs();
    };
    fontGroup.appendChild(btn);
  });

  // 3. Size controls
  const sizeGroup = document.createElement('div');
  sizeGroup.style.cssText = 'display:flex;align-items:center;gap:4px;';
  const sizeDown = document.createElement('button');
  sizeDown.type = 'button';
  sizeDown.textContent = 'A-';
  sizeDown.style.cssText = 'border:1px solid rgba(125,125,125,0.3);background:transparent;color:inherit;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:4px;';
  const sizeVal = document.createElement('span');
  sizeVal.style.cssText = 'font-size:12px;opacity:0.8;min-width:32px;text-align:center;';
  sizeVal.textContent = `${prefs.size}px`;
  const sizeUp = document.createElement('button');
  sizeUp.type = 'button';
  sizeUp.textContent = 'A+';
  sizeUp.style.cssText = 'border:1px solid rgba(125,125,125,0.3);background:transparent;color:inherit;cursor:pointer;font-size:13px;padding:2px 6px;border-radius:4px;';

  sizeDown.onclick = () => {
    prefs.size = Math.max(14, prefs.size - 1);
    sizeVal.textContent = `${prefs.size}px`;
    applyStyles();
    notifyPrefs();
  };
  sizeUp.onclick = () => {
    prefs.size = Math.min(26, prefs.size + 1);
    sizeVal.textContent = `${prefs.size}px`;
    applyStyles();
    notifyPrefs();
  };
  sizeGroup.append(sizeDown, sizeVal, sizeUp);

  // 4. Width controls
  const widthGroup = document.createElement('div');
  widthGroup.style.cssText = 'display:flex;align-items:center;gap:2px;background:rgba(125,125,125,0.12);padding:2px 4px;border-radius:6px;';
  [
    { id: 'compact', label: 'Narrow' },
    { id: 'standard', label: 'Standard' },
    { id: 'wide', label: 'Wide' },
  ].forEach((w) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = w.label;
    btn.style.cssText = 'border:0;background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:3px 6px;border-radius:4px;';
    btn.onclick = () => {
      prefs.width = w.id;
      applyStyles();
      notifyPrefs();
    };
    widthGroup.appendChild(btn);
  });

  // Action buttons
  const actionsGroup = document.createElement('div');
  actionsGroup.style.cssText = 'display:flex;align-items:center;gap:6px;';

  const readListBtn = document.createElement('button');
  readListBtn.type = 'button';
  readListBtn.textContent = '🔖 Reading List';
  readListBtn.style.cssText = 'border:1px solid rgba(125,125,125,0.3);background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:3px 10px;border-radius:6px;';
  readListBtn.onclick = () => {
    console.log('__HINTERLAND_READER_ACTION__:' + JSON.stringify({
      action: 'addToReadingList',
      url: location.href,
      title,
    }));
    showToast('✓ Added to Reading List');
  };

  const copyMdBtn = document.createElement('button');
  copyMdBtn.type = 'button';
  copyMdBtn.textContent = '📋 Markdown';
  copyMdBtn.style.cssText = 'border:1px solid rgba(125,125,125,0.3);background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:3px 10px;border-radius:6px;';
  copyMdBtn.onclick = () => {
    const md = extractMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      showToast('✓ Markdown copied to clipboard');
    }).catch(() => {
      showToast('✓ Markdown generated');
    });
  };

  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.textContent = '🖨️';
  printBtn.title = 'Print article';
  printBtn.style.cssText = 'border:1px solid rgba(125,125,125,0.3);background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:3px 8px;border-radius:6px;';
  printBtn.onclick = () => window.print();

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Exit reader mode (Esc)';
  closeBtn.style.cssText = 'border:1px solid rgba(125,125,125,0.3);background:transparent;color:inherit;cursor:pointer;font-size:13px;padding:3px 10px;border-radius:6px;';

  const exit = () => {
    overlay.remove();
    document.documentElement.style.overflow = '';
    window.removeEventListener('keydown', keyHandler);
    console.log('__HINTERLAND_READER_ACTION__:' + JSON.stringify({ action: 'exit' }));
  };
  closeBtn.onclick = exit;
  window.__hinterland_reader_exit = exit;

  const keyHandler = (e) => {
    if (e.key === 'Escape') exit();
  };
  window.addEventListener('keydown', keyHandler);

  controls.append(themeGroup, fontGroup, sizeGroup, widthGroup);
  actionsGroup.append(readListBtn, copyMdBtn, printBtn, closeBtn);

  bar.append(infoBadge, controls, actionsGroup);

  // Content
  const h1 = document.createElement('h1');
  h1.textContent = title;
  h1.style.cssText = 'font-size:2em;line-height:1.25;margin:0 0 16px 0;font-weight:700;letter-spacing:-0.02em;';
  container.appendChild(h1);

  if (author) {
    const meta = document.createElement('div');
    meta.textContent = author;
    meta.style.cssText = 'font-size:0.9em;opacity:0.8;margin-bottom:20px;';
    container.appendChild(meta);
  }

  const divider = document.createElement('hr');
  divider.style.cssText = 'border:0;height:1px;margin:20px 0 28px 0;';
  container.appendChild(divider);

  const contentHolder = document.createElement('div');
  contentHolder.innerHTML = clone.innerHTML;
  contentHolder.querySelectorAll('img').forEach((img) => {
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '8px';
    img.style.margin = '20px 0';
  });
  contentHolder.querySelectorAll('p').forEach((p) => {
    p.style.marginBottom = '1.4em';
  });
  contentHolder.querySelectorAll('h2, h3, h4').forEach((h) => {
    h.style.margin = '1.8em 0 0.8em 0';
    h.style.fontWeight = '600';
  });
  container.appendChild(contentHolder);

  // Toast
  toastBox.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);background:#101828;color:#ffffff;padding:8px 18px;border-radius:24px;font-size:13px;font-family:-apple-system,sans-serif;opacity:0;transition:opacity 0.25s, transform 0.25s;pointer-events:none;z-index:200;box-shadow:0 4px 16px rgba(0,0,0,0.25);';

  overlay.appendChild(bar);
  overlay.appendChild(container);
  overlay.appendChild(toastBox);

  applyStyles();
  document.documentElement.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  return true;
}
