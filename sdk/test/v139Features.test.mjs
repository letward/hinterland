import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('Hinterland v1.39.0 Features & Polish', () => {
  const tabsSource = readFileSync(join(ROOT, 'src', 'main', 'tabs.js'), 'utf8');
  const ipcSource = readFileSync(join(ROOT, 'src', 'main', 'ipc.js'), 'utf8');
  const preloadSource = readFileSync(join(ROOT, 'src', 'preload', 'chrome.cjs'), 'utf8');
  const panelsSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'panels.js'), 'utf8');
  const menuSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'menu.js'), 'utf8');
  const cpSource = readFileSync(join(ROOT, 'src', 'ui', 'js', 'commandPalette.js'), 'utf8');

  describe('Tab Groups & Tab Management: Unpin All, Copy Domain URLs & Collapse/Expand All', () => {
    it('adds normalizeHost, urlsByDomain, and unpinAll to TabManager in src/main/tabs.js', () => {
      assert.ok(tabsSource.includes('normalizeHost(rawUrl)'));
      assert.ok(tabsSource.includes('urlsByDomain(id)'));
      assert.ok(tabsSource.includes('unpinAll()'));
    });

    it('declares tabs:unpinAll, tabs:copyDomainUrls, and tabs:groupSetAllCollapsed in ipc.js and preload', () => {
      assert.ok(ipcSource.includes("handle('tabs:unpinAll'"));
      assert.ok(ipcSource.includes("handle('tabs:copyDomainUrls'"));
      assert.ok(ipcSource.includes("handle('tabs:groupSetAllCollapsed'"));
      assert.ok(preloadSource.includes("unpinAll: () => ipcRenderer.invoke('tabs:unpinAll')"));
      assert.ok(preloadSource.includes("copyDomainUrls: (id) => ipcRenderer.invoke('tabs:copyDomainUrls', id)"));
      assert.ok(preloadSource.includes("groupSetAllCollapsed: (collapsed) => ipcRenderer.invoke('tabs:groupSetAllCollapsed', collapsed)"));
    });

    it('wires Unpin All, Copy Domain URLs, and Collapse/Expand All across panels, menus, and Command Palette', () => {
      assert.ok(panelsSource.includes('api().tabs.groupSetAllCollapsed(true)'));
      assert.ok(panelsSource.includes('api().tabs.groupSetAllCollapsed(false)'));
      assert.ok(panelsSource.includes('api().tabs.unpinAll()'));
      assert.ok(panelsSource.includes('api().tabs.copyDomainUrls()'));
      assert.ok(menuSource.includes('api().tabs.copyDomainUrls(tab.id)'));
      assert.ok(menuSource.includes('api().tabs.unpinAll()'));
      assert.ok(cpSource.includes("id: 'tabsGroupsCollapseAll'"));
      assert.ok(cpSource.includes("id: 'tabsGroupsExpandAll'"));
      assert.ok(cpSource.includes("id: 'tabsUnpinAll'"));
      assert.ok(cpSource.includes("id: 'tabsCopyDomainUrls'"));
    });
  });

  describe('Task Manager: Copy Process Report as Markdown', () => {
    it('extracts collectAppMetrics and declares app:copyMetricsSummary handler in ipc.js and preload', () => {
      assert.ok(ipcSource.includes('const collectAppMetrics = () =>'));
      assert.ok(ipcSource.includes("handle('app:copyMetricsSummary'"));
      assert.ok(ipcSource.includes('toast.taskReportCopied'));
      assert.ok(preloadSource.includes("copyMetricsSummary: () => ipcRenderer.invoke('app:copyMetricsSummary')"));
    });

    it('wires Copy Report button in Task Manager and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().app.copyMetricsSummary()'));
      assert.ok(panelsSource.includes("t('taskManager.copyReport')"));
      assert.ok(cpSource.includes("id: 'copyTaskReport'"));
    });
  });

  describe('History Manager: Copy Filtered History as Markdown', () => {
    it('extracts formatHistoryMarkdown and declares history:copyMarkdown in ipc.js and preload', () => {
      assert.ok(ipcSource.includes('const formatHistoryMarkdown = (list) =>'));
      assert.ok(ipcSource.includes("handle('history:copyMarkdown'"));
      assert.ok(ipcSource.includes('toast.historyCopied'));
      assert.ok(ipcSource.includes('toast.noHistoryToCopy'));
      assert.ok(preloadSource.includes("copyMarkdown: (entries) => ipcRenderer.invoke('history:copyMarkdown', entries)"));
    });

    it('wires Copy as Markdown button in History panel and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().history.copyMarkdown(getFilteredEntries())'));
      assert.ok(panelsSource.includes("t('history.copyMarkdown')"));
      assert.ok(cpSource.includes("id: 'historyCopyMarkdown'"));
    });
  });

  describe('Bookmarks Manager: Open Matching Bookmarks in Background Tabs', () => {
    it('extracts openValidatedUrlsInTabs and declares bookmarks:openUrls in ipc.js and preload', () => {
      assert.ok(ipcSource.includes('const openValidatedUrlsInTabs ='));
      assert.ok(ipcSource.includes("handle('bookmarks:openUrls'"));
      assert.ok(ipcSource.includes('toast.bookmarksOpened'));
      assert.ok(ipcSource.includes('toast.noBookmarksToOpen'));
      assert.ok(preloadSource.includes("openUrls: (urls) => ipcRenderer.invoke('bookmarks:openUrls', urls)"));
    });

    it('wires Open Matching button in Bookmarks panel and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().bookmarks.openUrls(lastFilteredUrls)'));
      assert.ok(panelsSource.includes("t('bookmarks.openMatching')"));
      assert.ok(cpSource.includes("id: 'bookmarksOpenMatching'"));
    });
  });

  describe('Downloads Manager: Copy as Markdown & Retry / Re-download', () => {
    it('extracts formatDownloadsMarkdown and declares downloads:copyMarkdown and downloads:retry', () => {
      assert.ok(ipcSource.includes('const formatDownloadsMarkdown = (list) =>'));
      assert.ok(ipcSource.includes("handle('downloads:copyMarkdown'"));
      assert.ok(ipcSource.includes("handle('downloads:retry'"));
      assert.ok(ipcSource.includes('toast.downloadsCopied'));
      assert.ok(ipcSource.includes('toast.downloadRetried'));
      assert.ok(preloadSource.includes("copyMarkdown: () => ipcRenderer.invoke('downloads:copyMarkdown')"));
      assert.ok(preloadSource.includes("retry: (url) => ipcRenderer.invoke('downloads:retry', url)"));
    });

    it('wires Copy as Markdown, Retry button, and Command Palette action', () => {
      assert.ok(panelsSource.includes('api().downloads.copyMarkdown()'));
      assert.ok(panelsSource.includes('api().downloads.retry(entry.url)'));
      assert.ok(panelsSource.includes("t('downloads.copyMarkdown')"));
      assert.ok(panelsSource.includes("t('downloads.retryDownload')"));
      assert.ok(cpSource.includes("id: 'downloadsCopyMarkdown'"));
    });
  });

  describe('Locales Consistency for v1.39.0 Features', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'en.json'), 'utf8'));
    const de = JSON.parse(readFileSync(join(ROOT, 'src', 'ui', 'locales', 'de.json'), 'utf8'));

    function getByPath(obj, path) {
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    }

    const testKeys = [
      'menu.copyDomainUrls',
      'menu.unpinAllTabs',
      'commandPalette.tabsGroupsCollapseAll',
      'commandPalette.tabsGroupsExpandAll',
      'commandPalette.tabsUnpinAll',
      'commandPalette.tabsCopyDomainUrls',
      'commandPalette.historyCopyMarkdown',
      'commandPalette.bookmarksOpenMatching',
      'commandPalette.downloadsCopyMarkdown',
      'commandPalette.copyTaskReport',
      'bookmarks.openMatching',
      'history.copyMarkdown',
      'downloads.copyMarkdown',
      'downloads.retryDownload',
      'taskManager.copyReport',
      'tabGroups.collapseAll',
      'tabGroups.collapseAllDesc',
      'tabGroups.expandAll',
      'tabGroups.expandAllDesc',
      'tabGroups.unpinAll',
      'tabGroups.unpinAllDesc',
      'tabGroups.copyDomainUrls',
      'tabGroups.copyDomainUrlsDesc',
      'toast.taskReportCopied',
      'toast.noTabGroups',
      'toast.groupsCollapsedAll',
      'toast.groupsExpandedAll',
      'toast.tabsUnpinnedAll',
      'toast.noPinnedTabs',
      'toast.domainUrlsCopied',
      'toast.noDomainUrlsToCopy',
      'toast.historyCopied',
      'toast.noHistoryToCopy',
      'toast.downloadsCopied',
      'toast.downloadRetried',
      'toast.downloadRetryInvalid',
      'toast.bookmarksOpened',
      'toast.noBookmarksToOpen',
    ];

    for (const key of testKeys) {
      it(`defines key path "${key}" in both en.json and de.json`, () => {
        const enVal = getByPath(en, key);
        const deVal = getByPath(de, key);
        assert.ok(typeof enVal === 'string' && enVal.length > 0, `en missing ${key}`);
        assert.ok(typeof deVal === 'string' && deVal.length > 0, `de missing ${key}`);
      });
    }
  });

  describe('Official Documentation & Website Completeness', () => {
    it('documents v1.39.0 features in user-guide.html', () => {
      const guide = readFileSync(join(ROOT, 'website', 'docs', 'user-guide.html'), 'utf8');
      assert.ok(guide.includes('Collapse All'));
      assert.ok(guide.includes('Expand All'));
      assert.ok(guide.includes('Unpin All'));
      assert.ok(guide.includes('Copy Domain URLs'));
      assert.ok(guide.includes('Open Matching'));
      assert.ok(guide.includes('Download again'));
      assert.ok(guide.includes('Copy Report'));
    });

    it('updates website/index.html to v1.39.0 release badge and download link', () => {
      const indexHtml = readFileSync(join(ROOT, 'website', 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('v1.39.0 · Latest Release') || indexHtml.includes('v1.40.0 · Latest Release') || indexHtml.includes('v1.41.0 · Latest Release') || indexHtml.includes('v1.42.0 · Latest Release'));
      assert.ok(indexHtml.includes('Hinterland-Setup-1.39.0.exe') || indexHtml.includes('Hinterland-Setup-1.40.0.exe') || indexHtml.includes('Hinterland-Setup-1.41.0.exe') || indexHtml.includes('Hinterland-Setup-1.42.0.exe'));
    });

    it('updates website/api/sync.js to v1.39.0', () => {
      const syncJs = readFileSync(join(ROOT, 'website', 'api', 'sync.js'), 'utf8');
      assert.ok(syncJs.includes("version: '1.39.0'") || syncJs.includes("version: '1.40.0'") || syncJs.includes("version: '1.41.0'") || syncJs.includes("version: '1.42.0'"));
    });
  });
});
