import { el, clear, prettyUrl, hostOf } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { openPopup, closePopup, isOpen } from './popup.js';
import { activeTab, allTabs } from './tabs.js';
import { openMediaControls } from './menu.js';
import { toast } from './toast.js';
import { openQrCode, openCookieInspector, openSitePermissions, openTabGroups } from './panels.js';

const api = () => window.horizon;

export function openCommandPalette() {
  if (isOpen('palette')) {
    closePopup();
    return;
  }

  openPopup({
    key: 'palette',
    align: 'center',
    render: (card) => {
      const searchBox = el('div', { class: 'paletteSearch' }, [
        el('span', { html: icon('search') }),
      ]);

      const input = el('input', {
        class: 'paletteInput',
        type: 'text',
        placeholder: t('commandPalette.placeholder'),
        spellcheck: 'false',
        autocomplete: 'off',
      });
      searchBox.append(input);

      const listContainer = el('div', { class: 'paletteList' });

      card.append(searchBox, listContainer);

      let selectedIndex = 0;
      let visibleItems = [];

      const buildCommands = () => {
        const current = activeTab();
        return [
          {
            id: 'newTab',
            title: t('menu.newTab'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+T',
            icon: 'plus',
            run: () => api().tabs.create({ url: 'horizon://newtab/' }),
          },
          {
            id: 'privateTab',
            title: t('menu.privateTab'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+N',
            icon: 'shield',
            run: () => api().tabs.create({ url: 'horizon://newtab/', privateMode: true }),
          },
          {
            id: 'reopenTab',
            title: t('menu.reopenClosed'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+T',
            icon: 'clock',
            run: () => api().tabs.reopen(),
          },
          {
            id: 'closeTab',
            title: t('menu.close'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+W',
            icon: 'close',
            run: () => { if (current) api().tabs.close(current.id); },
          },
          {
            id: 'closeOthers',
            title: t('menu.closeOthers'),
            category: t('commandPalette.categoryCommand'),
            icon: 'minus',
            run: () => { if (current) api().tabs.closeOthers(current.id); },
          },
          {
            id: 'closeLeft',
            title: t('menu.closeLeft'),
            category: t('commandPalette.categoryCommand'),
            icon: 'minus',
            run: () => { if (current) api().tabs.closeLeft(current.id); },
          },
          {
            id: 'closeRight',
            title: t('menu.closeRight'),
            category: t('commandPalette.categoryCommand'),
            icon: 'minus',
            run: () => { if (current) api().tabs.closeRight(current.id); },
          },
          {
            id: 'closeAll',
            title: t('menu.closeAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'close',
            run: () => api().tabs.closeAll(),
          },
          {
            id: 'copyUrl',
            title: t('menu.copyLink'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+C',
            icon: 'link',
            run: () => { if (current) api().tab.copyUrl(current.id); },
          },
          {
            id: 'copyCleanUrl',
            title: t('menu.copyCleanLink'),
            category: t('commandPalette.categoryCommand'),
            icon: 'shield',
            run: () => { if (current) api().tab.copyCleanUrl(current.id); },
          },
          {
            id: 'duplicateTab',
            title: t('menu.duplicate'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+D',
            icon: 'copy',
            run: () => { if (current) api().tabs.duplicate(current.id); },
          },
          {
            id: 'pinTab',
            title: current?.pinned ? t('menu.unpin') : t('menu.pin'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Alt+P',
            icon: 'pin',
            run: () => { if (current) api().tabs.pin(current.id, !current.pinned); },
          },
          {
            id: 'openInPrivate',
            title: t('commandPalette.openInPrivate'),
            category: t('commandPalette.categoryCommand'),
            icon: 'shield',
            run: () => { if (current && current.url) api().tabs.create({ url: current.url, privateMode: true }); },
          },
          {
            id: 'stashCurrentTab',
            title: t('commandPalette.stashCurrentTab'),
            category: t('commandPalette.categoryCommand'),
            icon: 'archive',
            run: () => { if (current) api().stashes.stashTab(current.id); },
          },
          {
            id: 'sleepTab',
            title: current?.sleeping ? t('menu.wakeTab') : t('menu.sleepTab'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Alt+S',
            icon: 'moon',
            run: () => { if (current) (current.sleeping ? api().tab.wake(current.id) : api().tab.sleep(current.id)); },
          },
          {
            id: 'sleepOthers',
            title: t('menu.sleepOtherTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'moon',
            run: () => { if (current) api().tabs.sleepOthers(current.id); },
          },
          {
            id: 'sleepAllInactive',
            title: t('menu.sleepAllInactive'),
            category: t('commandPalette.categoryCommand'),
            icon: 'moon',
            run: async () => {
              const count = await api().tabs.sleepOthers();
              if (count > 0) toast(t('toast.sleptOthers', { count }), 'info');
            },
          },
          {
            id: 'tabsWakeAll',
            title: t('commandPalette.tabsWakeAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'sun',
            run: () => api().tabs.wakeAll(),
          },
          {
            id: 'tabsCopyAllMarkdown',
            title: t('commandPalette.tabsCopyAllMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().tabs.copyAllMarkdown(),
          },
          {
            id: 'tabsCopyAllUrls',
            title: t('commandPalette.tabsCopyAllUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().tabs.copyAllUrls(),
          },
          {
            id: 'tabsCopyAllJson',
            title: t('commandPalette.tabsCopyAllJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().tabs.copyAllJson(),
          },
          {
            id: 'tabsFocusAudible',
            title: t('commandPalette.tabsFocusAudible'),
            category: t('commandPalette.categoryCommand'),
            icon: 'volume',
            run: () => api().tabs.focusAudible(),
          },
          {
            id: 'tabsGroupOpenFromClipboard',
            title: t('commandPalette.tabsGroupOpenFromClipboard'),
            category: t('commandPalette.categoryCommand'),
            icon: 'tabs',
            run: () => api().tabs.groupOpenFromClipboard(),
          },
          {
            id: 'tabsOpenClipboardUrls',
            title: t('commandPalette.tabsOpenClipboardUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'external',
            run: () => api().tabs.openClipboardUrls(),
          },
          {
            id: 'tabsCloseByDomain',
            title: t('commandPalette.tabsCloseByDomain'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => { if (current) api().tabs.closeByDomain(current.id); },
          },
          {
            id: 'tabsCloseUngrouped',
            title: t('commandPalette.tabsCloseUngrouped'),
            category: t('commandPalette.categoryCommand'),
            icon: 'minus',
            run: () => api().tabs.closeUngrouped(),
          },
          {
            id: 'tabsGroupPruneEmpty',
            title: t('commandPalette.tabsGroupPruneEmpty'),
            category: t('commandPalette.categoryCommand'),
            icon: 'trash',
            run: () => api().tabs.groupPruneEmpty(),
          },
          {
            id: 'tabsGroupsCollapseAll',
            title: t('commandPalette.tabsGroupsCollapseAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'collapse',
            run: () => api().tabs.groupSetAllCollapsed(true),
          },
          {
            id: 'tabsGroupsExpandAll',
            title: t('commandPalette.tabsGroupsExpandAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'expand',
            run: () => api().tabs.groupSetAllCollapsed(false),
          },
          {
            id: 'tabsUnpinAll',
            title: t('commandPalette.tabsUnpinAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'pin',
            run: () => api().tabs.unpinAll(),
          },
          {
            id: 'tabsCopyDomainUrls',
            title: t('commandPalette.tabsCopyDomainUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => { if (current) api().tabs.copyDomainUrls(current.id); },
          },
          {
            id: 'tabsCopyPinnedUrls',
            title: t('commandPalette.tabsCopyPinnedUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'pin',
            run: () => api().tabs.copyPinnedUrls(),
          },
          {
            id: 'tabsCloseSleeping',
            title: t('commandPalette.tabsCloseSleeping'),
            category: t('commandPalette.categoryCommand'),
            icon: 'moon',
            run: () => api().tabs.closeSleeping(),
          },
          {
            id: 'tabsCloseDuplicates',
            title: t('commandPalette.tabsCloseDuplicates'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().tabs.closeDuplicates(),
          },
          {
            id: 'memorySaverExemptSite',
            title: t('commandPalette.memorySaverExemptSite'),
            category: t('commandPalette.categoryCommand'),
            icon: 'shield',
            run: async () => {
              if (!current || !current.url || current.url.startsWith('horizon://')) {
                toast(t('toast.cannotExemptSpecialPage'), 'warning');
                return;
              }
              const host = hostOf(current.url);
              if (!host) return;
              const exemptions = await api().tabs.getExemptDomains();
              const isExempt = exemptions.some((d) => d.toLowerCase() === host.toLowerCase());
              if (isExempt) {
                await api().tabs.unexemptDomain(host);
                toast(t('toast.memorySaverUnexempted', { domain: host }), 'info');
              } else {
                await api().tabs.exemptDomain(host);
                toast(t('toast.memorySaverExempted', { domain: host }), 'success');
              }
            },
          },
          {
            id: 'muteTab',
            title: current?.muted ? t('menu.unmute') : t('menu.mute'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+M',
            icon: 'volume',
            run: () => { if (current) api().tab.mute(current.id, !current.muted); },
          },
          {
            id: 'muteOthers',
            title: t('menu.muteOthers'),
            category: t('commandPalette.categoryCommand'),
            icon: 'volumeOff',
            run: () => { if (current) api().tabs.muteOthers(current.id); },
          },
          {
            id: 'unmuteAll',
            title: t('commandPalette.unmuteAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'volume',
            run: () => api().tabs.muteAll(false),
          },
          {
            id: 'toggleShield',
            title: t('commandPalette.toggleShield'),
            category: t('commandPalette.categoryCommand'),
            icon: 'shield',
            run: async () => {
              if (current && current.url && !current.url.startsWith('horizon://')) {
                const host = new URL(current.url).hostname;
                const res = await api().site.toggleShield(host);
                toast(res.enabled ? t('toast.shieldEnabled') : t('toast.shieldDisabled'), 'info');
                api().tab.reload(current.id);
              }
            },
          },
          {
            id: 'inspectCookies',
            title: t('commandPalette.inspectCookies'),
            category: t('commandPalette.categoryCommand'),
            icon: 'cookie',
            run: () => {
              if (current && current.url && !current.url.startsWith('horizon://')) {
                openCookieInspector(current.url);
              }
            },
          },
          {
            id: 'sitePermissions',
            title: t('commandPalette.sitePermissions'),
            category: t('commandPalette.categoryCommand'),
            icon: 'shield',
            run: () => openSitePermissions(),
          },
          {
            id: 'siteCopySummary',
            title: t('commandPalette.siteCopySummary'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().site.copySummary(),
          },
          {
            id: 'searchSetDefault',
            title: t('commandPalette.searchSetDefault'),
            category: t('commandPalette.categoryCommand'),
            icon: 'search',
            run: async () => {
              const data = await api().search.allEngines();
              const list = data?.engines || [];
              const names = list.map((e) => `${e.name} (${e.id})`).join('\n');
              const choice = prompt(`${t('commandPalette.searchSetDefaultPrompt')}\n\n${names}`, data?.defaultEngine || 'duckduckgo');
              if (choice) {
                const target = list.find((e) => e.id === choice.trim() || e.name.toLowerCase() === choice.trim().toLowerCase());
                if (target) await api().search.setDefault(target.id);
              }
            },
          },
          {
            id: 'searchExportJson',
            title: t('commandPalette.searchExportJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().search.exportJson(),
          },
          {
            id: 'searchImportJson',
            title: t('commandPalette.searchImportJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'upload',
            run: () => api().search.importJson(),
          },
          {
            id: 'searchCopyMarkdown',
            title: t('commandPalette.searchCopyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().search.copyMarkdown(),
          },
          {
            id: 'reload',
            title: t('action.reload'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+R',
            icon: 'reload',
            run: () => { if (current) api().tab.reload(current.id); },
          },
          {
            id: 'reloadAll',
            title: t('menu.reloadAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'reload',
            run: () => api().tabs.reloadAll(),
          },
          {
            id: 'tabsReloadOthers',
            title: t('commandPalette.tabsReloadOthers'),
            category: t('commandPalette.categoryCommand'),
            icon: 'reload',
            run: () => { if (current) api().tabs.reloadOthers(current.id); },
          },
          {
            id: 'tabsGroupSortAlpha',
            title: t('commandPalette.tabsGroupSortAlpha'),
            category: t('commandPalette.categoryCommand'),
            icon: 'list',
            run: () => api().tabs.groupSortAlpha(),
          },
          {
            id: 'readerMode',
            title: t('menu.reader'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Alt+R',
            icon: 'reader',
            run: () => { if (current) api().tab.readerMode(current.id); },
          },
          {
            id: 'qrCode',
            title: t('menu.qrCode'),
            subtitle: t('menu.qrCodeDesc'),
            category: t('commandPalette.categoryCommand'),
            icon: 'qr',
            run: () => { if (current) openQrCode(current.url, current.title); },
          },
          {
            id: 'hardReload',
            title: t('shortcuts.action.hardReload'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+R',
            icon: 'reload',
            run: () => { if (current) api().tab.reload(current.id, true); },
          },
          {
            id: 'find',
            title: t('menu.find'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+F',
            icon: 'find',
            run: () => window.dispatchEvent(new CustomEvent('horizon:find')),
          },
          {
            id: 'bookmark',
            title: t('menu.addBookmark'),
            category: t('commandPalette.categoryCommand'),
            icon: 'bookmark',
            run: () => window.dispatchEvent(new CustomEvent('horizon:bookmark')),
          },
          {
            id: 'siteInfo',
            title: t('omni.viewSiteInfo'),
            category: t('commandPalette.categoryCommand'),
            icon: 'shield',
            run: () => window.dispatchEvent(new CustomEvent('horizon:siteinfo')),
          },
          {
            id: 'copyLink',
            title: t('menu.copyLink'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => { if (current) api().tab.copyUrl(current.id); },
          },
          {
            id: 'copyMarkdown',
            title: t('menu.copyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+C',
            icon: 'copy',
            run: () => { if (current) api().tab.copyMarkdown(current.id); },
          },
          {
            id: 'print',
            title: t('menu.print'),
            category: t('commandPalette.categoryCommand'),
            icon: 'print',
            run: () => { if (current) api().tab.print(current.id); },
          },
          {
            id: 'savePdf',
            title: t('menu.saveAsPdf'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+E',
            icon: 'print',
            run: () => { if (current) api().tab.savePdf(current.id); },
          },
          {
            id: 'translate',
            title: t('menu.translatePage'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => { if (current) api().tab.translate(current.id); },
          },
          {
            id: 'exportBookmarks',
            title: t('bookmarks.exportHtml'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().bookmarks.exportHtml(),
          },
          {
            id: 'importBookmarks',
            title: t('bookmarks.importHtml'),
            category: t('commandPalette.categoryCommand'),
            icon: 'upload',
            run: () => api().bookmarks.importHtml(),
          },
          {
            id: 'openStore',
            title: t('commandPalette.openStore'),
            category: t('commandPalette.categoryCommand'),
            icon: 'store',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'store' } })),
          },
          {
            id: 'openNotes',
            title: t('commandPalette.openNotes'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+Y',
            icon: 'notes',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'notes' } })),
          },
          {
            id: 'passwords',
            title: t('commandPalette.passwords'),
            category: t('commandPalette.categoryNavigation'),
            shortcut: 'Ctrl+Alt+P',
            icon: 'key',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'passwords' } })),
          },
          {
            id: 'account',
            title: t('commandPalette.account'),
            category: t('commandPalette.categoryNavigation'),
            shortcut: 'Ctrl+Shift+A',
            icon: 'user',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'account' } })),
          },
          {
            id: 'syncNow',
            title: t('commandPalette.syncNow'),
            category: t('commandPalette.categoryCommand'),
            icon: 'cloud',
            run: async () => {
              const res = await api().account.syncNow();
              if (res?.ok) toast(t('toast.syncSuccess'), 'success');
              else toast(t('toast.syncFailed'), 'error');
            },
          },
          {
            id: 'clearData',
            title: t('commandPalette.clearData'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+Del',
            icon: 'trash',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'clearData' } })),
          },
          {
            id: 'togglePiP',
            title: t('commandPalette.togglePiP'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+X',
            icon: 'pip',
            run: async () => {
              if (!current) return;
              const res = await api().tab.togglePiP(current.id);
              if (res?.success) toast(res.active ? t('toast.pipEntered') : t('toast.pipExited'), 'info');
              else toast(t('toast.noVideoFound'), 'warning');
            },
          },
          {
            id: 'mediaControls',
            title: t('commandPalette.mediaControls'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Alt+M',
            icon: 'volume',
            run: () => openMediaControls(),
          },
          {
            id: 'bookmarkAllTabs',
            title: t('menu.bookmarkAllTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'bookmark',
            run: async () => {
              const tabsList = allTabs().filter((item) => item.url && item.url.startsWith('http'));
              if (!tabsList.length) {
                toast(t('toast.noTabsToBookmark'), 'warning');
                return;
              }
              const dateStr = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
              const folder = `${t('bookmarks.savedSession')} - ${dateStr}`;
              const existing = [...((await api().settings.get('data.bookmarks')) || [])];
              for (const tab of tabsList) {
                existing.push({
                  url: tab.url,
                  title: tab.title || tab.url,
                  addedAt: Date.now(),
                  folder,
                });
              }
              await api().settings.set('data.bookmarks', existing);
              toast(t('toast.allTabsBookmarked'), 'success');
            },
          },
          {
            id: 'openTabStash',
            title: t('commandPalette.openTabStash'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+U',
            icon: 'archive',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openstash')),
          },
          {
            id: 'tabGroups',
            title: t('commandPalette.tabGroups'),
            category: t('commandPalette.categoryCommand'),
            icon: 'tabs',
            run: () => openTabGroups(),
          },
          {
            id: 'groupByDomain',
            title: t('commandPalette.groupByDomain'),
            category: t('commandPalette.categoryCommand'),
            icon: 'layers',
            run: () => api().tabs.groupByDomain(),
          },
          {
            id: 'tabsSortByTitle',
            title: t('commandPalette.tabsSortByTitle'),
            category: t('commandPalette.categoryCommand'),
            icon: 'list',
            run: () => api().tabs.sortByTitle(true),
          },
          {
            id: 'tabsSortByDomain',
            title: t('commandPalette.tabsSortByDomain'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => api().tabs.sortByDomain(true),
          },
          {
            id: 'tabsUngroupAll',
            title: t('commandPalette.tabsUngroupAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'close',
            run: () => api().tabs.ungroupAll(),
          },
          {
            id: 'stashAllTabs',
            title: t('commandPalette.stashAllTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'archive',
            run: async () => {
              const res = await api().stashes.stashCurrent({ keepActive: false });
              if (res?.ok) toast(t('toast.tabsStashed', { count: res.count }), 'success');
              else if (res?.error === 'no_tabs') toast(t('toast.noTabsToStash'), 'warning');
            },
          },
          {
            id: 'stashOtherTabs',
            title: t('commandPalette.stashOtherTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'archive',
            run: async () => {
              const res = await api().stashes.stashCurrent({ keepActive: true });
              if (res?.ok) toast(t('toast.tabsStashed', { count: res.count }), 'success');
              else if (res?.error === 'no_tabs') toast(t('toast.noTabsToStash'), 'warning');
            },
          },
          {
            id: 'stashExportMarkdown',
            title: t('commandPalette.stashExportMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().stashes.exportMarkdown(),
          },
          {
            id: 'stashesCopyAllUrls',
            title: t('commandPalette.stashesCopyAllUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().stashes.copyAllUrls(),
          },
          {
            id: 'stashesCopyJson',
            title: t('commandPalette.stashesCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().stashes.copyJson(),
          },
          {
            id: 'stashesCreateFromClipboard',
            title: t('commandPalette.stashesCreateFromClipboard'),
            category: t('commandPalette.categoryCommand'),
            icon: 'plus',
            run: () => api().stashes.createFromClipboard(),
          },
          {
            id: 'stashesDeduplicate',
            title: t('commandPalette.stashesDeduplicate'),
            category: t('commandPalette.categoryCommand'),
            icon: 'check',
            run: () => api().stashes.deduplicate(),
          },
          {
            id: 'stashesPruneEmpty',
            title: t('commandPalette.stashesPruneEmpty'),
            category: t('commandPalette.categoryCommand'),
            icon: 'trash',
            run: () => api().stashes.pruneEmpty(),
          },
          {
            id: 'stashesCopyAllMarkdown',
            title: t('commandPalette.stashesCopyAllMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().stashes.copyMarkdown(),
          },
          {
            id: 'storeThemes',
            title: t('commandPalette.browseThemes'),
            category: t('commandPalette.categoryCommand'),
            icon: 'palette',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openstore', { detail: { tab: 'themes' } })),
          },
          {
            id: 'storeExtensions',
            title: t('commandPalette.browseExtensions'),
            category: t('commandPalette.categoryCommand'),
            icon: 'puzzle',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openstore', { detail: { tab: 'extensions' } })),
          },
          {
            id: 'storeCreator',
            title: t('commandPalette.themeCreator'),
            category: t('commandPalette.categoryCommand'),
            icon: 'brush',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openstore', { detail: { tab: 'studio' } })),
          },
          {
            id: 'viewSource',
            title: t('menu.viewSource'),
            category: t('commandPalette.categoryCommand'),
            icon: 'code',
            run: () => { if (current) api().tab.navigate(current.id, `view-source:${current.url}`); },
          },
          {
            id: 'openExternal',
            title: t('menu.openExternal'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => { if (current) api().tab.openExternal(current.id); },
          },
          {
            id: 'zoomIn',
            title: t('menu.zoomIn'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+=',
            icon: 'zoomIn',
            run: () => { if (current) api().tab.zoom(current.id, (current.zoom || 1) * 1.1); },
          },
          {
            id: 'zoomOut',
            title: t('menu.zoomOut'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+-',
            icon: 'zoomOut',
            run: () => { if (current) api().tab.zoom(current.id, (current.zoom || 1) / 1.1); },
          },
          {
            id: 'resetZoom',
            title: t('menu.resetZoom'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+0',
            icon: 'zoomReset',
            run: () => { if (current) api().tab.zoom(current.id, 1); },
          },
          {
            id: 'history',
            title: t('menu.history'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+H',
            icon: 'clock',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'history' } })),
          },
          {
            id: 'bookmarks',
            title: t('menu.bookmarks'),
            category: t('commandPalette.categoryCommand'),
            icon: 'bookmark',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'bookmarks' } })),
          },
          {
            id: 'toggleBookmarksBar',
            title: t('menu.showBookmarksBar'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+B',
            icon: 'archive',
            run: () => window.dispatchEvent(new CustomEvent('horizon:togglebookmarksbar')),
          },
          {
            id: 'downloads',
            title: t('menu.downloads'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+J',
            icon: 'download',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'downloads' } })),
          },
          {
            id: 'extensions',
            title: t('menu.extensions'),
            category: t('commandPalette.categoryCommand'),
            icon: 'puzzle',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'extensions' } })),
          },
          {
            id: 'extensionsCopyList',
            title: t('commandPalette.extensionsCopyList'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().extensions.copyList(),
          },
          {
            id: 'extensionsCopyJson',
            title: t('commandPalette.extensionsCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().extensions.copyJson(),
          },
          {
            id: 'shortcuts',
            title: t('menu.shortcuts'),
            category: t('commandPalette.categoryCommand'),
            icon: 'keyboard',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'shortcuts' } })),
          },
          {
            id: 'taskManager',
            title: t('commandPalette.taskManager'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Shift+Esc',
            icon: 'cpu',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'taskManager' } })),
          },
          {
            id: 'copyTaskReport',
            title: t('commandPalette.copyTaskReport'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().app.copyMetricsSummary(),
          },
          {
            id: 'capturePageClipboard',
            title: t('commandPalette.capturePageClipboard'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+Shift+S',
            icon: 'camera',
            run: () => { if (current) api().tab.capture(current.id, { saveAs: false }); },
          },
          {
            id: 'capturePageFile',
            title: t('commandPalette.capturePageFile'),
            category: t('commandPalette.categoryCommand'),
            icon: 'camera',
            run: () => { if (current) api().tab.capture(current.id, { saveAs: true }); },
          },
          {
            id: 'openReadingList',
            title: t('commandPalette.openReadingList'),
            category: t('commandPalette.categoryCommand'),
            icon: 'bookmark',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'readingList' } })),
          },
          {
            id: 'addToReadingList',
            title: t('commandPalette.addToReadingList'),
            category: t('commandPalette.categoryCommand'),
            icon: 'bookmark',
            run: () => { if (current) api().readingList.add({ url: current.url, title: current.title, favicon: current.favicon }); },
          },
          {
            id: 'readingListExport',
            title: t('commandPalette.readingListExport'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().readingList.exportJson(),
          },
          {
            id: 'readingListExportMarkdown',
            title: t('commandPalette.readingListExportMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().readingList.exportMarkdown(),
          },
          {
            id: 'readingListCopyMarkdown',
            title: t('commandPalette.readingListCopyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().readingList.copyMarkdown('all'),
          },
          {
            id: 'readingListCopyUrls',
            title: t('commandPalette.readingListCopyUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().readingList.copyUrls('all'),
          },
          {
            id: 'readingListCopyJson',
            title: t('commandPalette.readingListCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().readingList.copyJson('all'),
          },
          {
            id: 'readingListSortAlpha',
            title: t('commandPalette.readingListSortAlpha'),
            category: t('commandPalette.categoryCommand'),
            icon: 'list',
            run: () => api().readingList.sort('alpha'),
          },
          {
            id: 'readingListSortByDomain',
            title: t('commandPalette.readingListSortByDomain'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => api().readingList.sort('domain'),
          },
          {
            id: 'readingListExportHtml',
            title: t('commandPalette.readingListExportHtml'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => api().readingList.exportHtml(),
          },
          {
            id: 'readingListImport',
            title: t('commandPalette.readingListImport'),
            category: t('commandPalette.categoryCommand'),
            icon: 'folder',
            run: () => api().readingList.importJson(),
          },
          {
            id: 'readingListMarkAllRead',
            title: t('commandPalette.readingListMarkAllRead'),
            category: t('commandPalette.categoryCommand'),
            icon: 'check',
            run: () => api().readingList.markAllRead(),
          },
          {
            id: 'readingListAddAllTabs',
            title: t('commandPalette.readingListAddAllTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'tabs',
            run: () => api().readingList.addAllTabs(),
          },
          {
            id: 'readingListAddFromClipboard',
            title: t('commandPalette.readingListAddFromClipboard'),
            category: t('commandPalette.categoryCommand'),
            icon: 'plus',
            run: () => api().readingList.addFromClipboard(),
          },
          {
            id: 'readingListDeduplicate',
            title: t('commandPalette.readingListDeduplicate'),
            category: t('commandPalette.categoryCommand'),
            icon: 'check',
            run: () => api().readingList.deduplicate(),
          },
          {
            id: 'readingListOpenMatching',
            title: t('commandPalette.readingListOpenMatching'),
            category: t('commandPalette.categoryCommand'),
            icon: 'external',
            run: () => api().readingList.openUrls(),
          },
          {
            id: 'historyExport',
            title: t('commandPalette.historyExport'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().history.exportJson(),
          },
          {
            id: 'historyExportMarkdown',
            title: t('commandPalette.historyExportMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().history.exportMarkdown(),
          },
          {
            id: 'historyCopyMarkdown',
            title: t('commandPalette.historyCopyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().history.copyMarkdown(),
          },
          {
            id: 'historyExportCsv',
            title: t('commandPalette.historyExportCsv'),
            category: t('commandPalette.categoryCommand'),
            icon: 'list',
            run: () => api().history.exportCsv(),
          },
          {
            id: 'historyImport',
            title: t('commandPalette.historyImport'),
            category: t('commandPalette.categoryCommand'),
            icon: 'folder',
            run: () => api().history.importJson(),
          },
          {
            id: 'historyClearCurrentDomain',
            title: t('commandPalette.historyClearCurrentDomain'),
            category: t('commandPalette.categoryCommand'),
            icon: 'filter',
            run: () => {
              const host = hostOf(current?.url || '');
              if (host) api().history.removeByDomain(host);
              else toast(t('toast.cannotExemptSpecialPage'), 'warning');
            },
          },
          {
            id: 'historyCopyUrls',
            title: t('commandPalette.historyCopyUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().history.copyUrls(),
          },
          {
            id: 'historyOpenMatching',
            title: t('commandPalette.historyOpenMatching'),
            category: t('commandPalette.categoryCommand'),
            icon: 'external',
            run: () => api().history.openUrls(),
          },
          {
            id: 'historyCopyJson',
            title: t('commandPalette.historyCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().history.copyJson(),
          },
          {
            id: 'bookmarksExportJson',
            title: t('commandPalette.bookmarksExportJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().bookmarks.exportJson(),
          },
          {
            id: 'bookmarksImportJson',
            title: t('commandPalette.bookmarksImportJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'folder',
            run: () => api().bookmarks.importJson(),
          },
          {
            id: 'bookmarksDeduplicate',
            title: t('commandPalette.bookmarksDeduplicate'),
            category: t('commandPalette.categoryCommand'),
            icon: 'check',
            run: () => api().bookmarks.deduplicate(),
          },
          {
            id: 'bookmarksExportMarkdown',
            title: t('commandPalette.bookmarksExportMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().bookmarks.exportMarkdown(),
          },
          {
            id: 'bookmarksCopyMarkdown',
            title: t('commandPalette.bookmarksCopyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().bookmarks.copyMarkdown(),
          },
          {
            id: 'bookmarksCopyUrls',
            title: t('commandPalette.bookmarksCopyUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().bookmarks.copyUrls(),
          },
          {
            id: 'bookmarksCopyJson',
            title: t('commandPalette.bookmarksCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().bookmarks.copyJson(),
          },
          {
            id: 'bookmarksOpenMatching',
            title: t('commandPalette.bookmarksOpenMatching'),
            category: t('commandPalette.categoryCommand'),
            icon: 'external',
            run: () => api().bookmarks.openUrls(),
          },
          {
            id: 'bookmarksBookmarkAllTabs',
            title: t('commandPalette.bookmarksBookmarkAllTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'bookmark',
            run: () => api().bookmarks.bookmarkAllTabs(),
          },
          {
            id: 'bookmarksAddFromClipboard',
            title: t('commandPalette.bookmarksAddFromClipboard'),
            category: t('commandPalette.categoryCommand'),
            icon: 'plus',
            run: () => api().bookmarks.addFromClipboard(),
          },
          {
            id: 'bookmarksToNote',
            title: t('commandPalette.bookmarksToNote'),
            category: t('commandPalette.categoryCommand'),
            icon: 'notes',
            run: () => api().bookmarks.toNote(),
          },
          {
            id: 'downloadsClearCompleted',
            title: t('commandPalette.downloadsClearCompleted'),
            category: t('commandPalette.categoryCommand'),
            icon: 'check',
            run: () => api().downloads.clearCompleted(),
          },
          {
            id: 'downloadsClearFailed',
            title: t('commandPalette.downloadsClearFailed'),
            category: t('commandPalette.categoryCommand'),
            icon: 'close',
            run: async () => {
              await api().downloads.clearFailed();
              toast(t('toast.downloadsFailedCleared'), 'info');
            },
          },
          {
            id: 'downloadsExportMarkdown',
            title: t('commandPalette.downloadsExportMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().downloads.exportMarkdown(),
          },
          {
            id: 'downloadsCopyMarkdown',
            title: t('commandPalette.downloadsCopyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().downloads.copyMarkdown(),
          },
          {
            id: 'downloadsCopyUrls',
            title: t('commandPalette.downloadsCopyUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().downloads.copyUrls(),
          },
          {
            id: 'downloadsCopyJson',
            title: t('commandPalette.downloadsCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().downloads.copyJson(),
          },
          {
            id: 'downloadsExportJson',
            title: t('commandPalette.downloadsExportJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().downloads.exportJson(),
          },
          {
            id: 'downloadsRetryFailed',
            title: t('commandPalette.downloadsRetryFailed'),
            category: t('commandPalette.categoryCommand'),
            icon: 'reload',
            run: () => api().downloads.retryFailed(),
          },
          {
            id: 'clearRecentlyClosed',
            title: t('commandPalette.clearRecentlyClosed'),
            category: t('commandPalette.categoryCommand'),
            icon: 'clock',
            run: () => api().tabs.clearRecentlyClosed(),
          },
          {
            id: 'tabsCopyRecentlyClosedUrls',
            title: t('commandPalette.tabsCopyRecentlyClosedUrls'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().tabs.copyRecentlyClosedUrls(),
          },
          {
            id: 'tabsCopyRecentlyClosedMarkdown',
            title: t('commandPalette.tabsCopyRecentlyClosedMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().tabs.copyRecentlyClosedMarkdown(),
          },
          {
            id: 'tabsCopyRecentlyClosedJson',
            title: t('commandPalette.tabsCopyRecentlyClosedJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().tabs.copyRecentlyClosedJson(),
          },
          {
            id: 'tabsStashRecentlyClosed',
            title: t('commandPalette.tabsStashRecentlyClosed'),
            category: t('commandPalette.categoryCommand'),
            icon: 'archive',
            run: () => api().tabs.stashRecentlyClosed(),
          },
          {
            id: 'notesExportAll',
            title: t('commandPalette.notesExportAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().notes.exportAll(),
          },
          {
            id: 'notesExportMarkdown',
            title: t('commandPalette.notesExportMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().notes.exportMarkdown(),
          },
          {
            id: 'notesCopyMarkdown',
            title: t('commandPalette.notesCopyMarkdown'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().notes.copyMarkdown(),
          },
          {
            id: 'notesExportHtml',
            title: t('commandPalette.notesExportHtml'),
            category: t('commandPalette.categoryCommand'),
            icon: 'globe',
            run: () => api().notes.exportHtml(),
          },
          {
            id: 'notesImportAll',
            title: t('commandPalette.notesImportAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'folder',
            run: () => api().notes.importAll(),
          },
          {
            id: 'noteCurrentTab',
            title: t('commandPalette.noteCurrentTab'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().notes.createFromTab(),
          },
          {
            id: 'notesOpenLinks',
            title: t('commandPalette.notesOpenLinks'),
            category: t('commandPalette.categoryCommand'),
            icon: 'external',
            run: () => api().notes.openLinks(),
          },
          {
            id: 'notesCopyLinks',
            title: t('commandPalette.notesCopyLinks'),
            category: t('commandPalette.categoryCommand'),
            icon: 'link',
            run: () => api().notes.copyLinks(),
          },
          {
            id: 'notesCreateFromClipboard',
            title: t('commandPalette.notesCreateFromClipboard'),
            category: t('commandPalette.categoryCommand'),
            icon: 'plus',
            run: () => api().notes.createFromClipboard(),
          },
          {
            id: 'notesCopyJson',
            title: t('commandPalette.notesCopyJson'),
            category: t('commandPalette.categoryCommand'),
            icon: 'download',
            run: () => api().notes.copyJson(),
          },
          {
            id: 'notesCreateFromAllTabs',
            title: t('commandPalette.notesCreateFromAllTabs'),
            category: t('commandPalette.categoryCommand'),
            icon: 'tabs',
            run: () => api().notes.createFromAllTabs(),
          },
          {
            id: 'notesPruneEmpty',
            title: t('commandPalette.notesPruneEmpty'),
            category: t('commandPalette.categoryCommand'),
            icon: 'trash',
            run: () => api().notes.pruneEmpty(),
          },
          {
            id: 'notesToStash',
            title: t('commandPalette.notesToStash'),
            category: t('commandPalette.categoryCommand'),
            icon: 'archive',
            run: () => api().notes.toStash(),
          },
          {
            id: 'closeDuplicates',
            title: t('commandPalette.closeDuplicates'),
            category: t('commandPalette.categoryCommand'),
            icon: 'minus',
            run: () => api().tabs.closeDuplicates(),
          },
          {
            id: 'muteAll',
            title: t('commandPalette.muteAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'volumeOff',
            run: async () => {
              const count = await api().tabs.muteAll(true);
              toast(t('toast.tabsMuted', { count }), 'info');
            },
          },
          {
            id: 'unmuteAll',
            title: t('commandPalette.unmuteAll'),
            category: t('commandPalette.categoryCommand'),
            icon: 'volume',
            run: async () => {
              const count = await api().tabs.muteAll(false);
              toast(t('toast.tabsUnmuted', { count }), 'info');
            },
          },
          {
            id: 'settings',
            title: t('menu.settings'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'Ctrl+,',
            icon: 'gear',
            run: () => window.dispatchEvent(new CustomEvent('horizon:opensettings', {})),
          },
          {
            id: 'about',
            title: t('menu.about'),
            category: t('commandPalette.categoryCommand'),
            icon: 'info',
            run: () => window.dispatchEvent(new CustomEvent('horizon:openpanel', { detail: { panel: 'about' } })),
          },
          {
            id: 'copyDiagnostics',
            title: t('commandPalette.copyDiagnostics'),
            category: t('commandPalette.categoryCommand'),
            icon: 'copy',
            run: () => api().app.copyDiagnostics(),
          },
          {
            id: 'fullscreen',
            title: t('shortcuts.action.fullscreen'),
            category: t('commandPalette.categoryCommand'),
            shortcut: 'F11',
            icon: 'monitor',
            run: () => api().window.fullscreen(),
          },
          {
            id: 'updates',
            title: t('menu.checkForUpdates'),
            category: t('commandPalette.categoryCommand'),
            icon: 'refresh',
            run: () => api().app.checkForUpdates(),
          },
        ];
      };

      const buildTabs = () => {
        const current = activeTab();
        const tabs = allTabs() ?? [];
        return tabs.map((tab) => ({
          id: `tab:${tab.id}`,
          title: tab.title || prettyUrl(tab.url) || t('confirm.untitled'),
          subtitle: tab.url,
          category: t('commandPalette.categoryTab'),
          aside: tab.id === current?.id ? t('commandPalette.activeTab') : '',
          icon: 'globe',
          favicon: tab.favicon,
          run: () => api().tabs.activate(tab.id),
        }));
      };

      const executeItem = (item) => {
        closePopup();
        try {
          item?.run?.();
        } catch (error) {
          console.warn('[Neocrom Horizon] Command failed.', error);
        }
      };

      let closedItems = [];
      api().tabs.recentlyClosed().then((closed) => {
        if (!Array.isArray(closed) || !closed.length) return;
        closedItems = closed.map((entry, index) => ({
          id: `closed:${index}`,
          title: entry.title || prettyUrl(entry.url) || t('confirm.untitled'),
          subtitle: entry.url,
          category: t('commandPalette.categoryRecentlyClosed'),
          icon: 'clock',
          favicon: entry.favicon,
          run: () => api().tabs.restoreClosed(index),
        }));
        renderList();
      }).catch(() => {});

      const renderList = () => {
        clear(listContainer);
        const query = input.value.trim().toLowerCase();

        const commands = buildCommands();
        const tabs = buildTabs();
        const all = [...tabs, ...closedItems, ...commands];

        if (!query) {
          visibleItems = all;
        } else {
          visibleItems = all.filter((item) => {
            const matchTitle = item.title?.toLowerCase().includes(query);
            const matchSubtitle = item.subtitle?.toLowerCase().includes(query);
            const matchCategory = item.category?.toLowerCase().includes(query);
            const matchShortcut = item.shortcut?.toLowerCase().includes(query);
            return matchTitle || matchSubtitle || matchCategory || matchShortcut;
          });
        }

        if (!visibleItems.length) {
          listContainer.append(el('div', { class: 'empty', style: { padding: '24px 12px' }, text: t('commandPalette.noResults') }));
          return;
        }

        if (selectedIndex >= visibleItems.length) selectedIndex = 0;
        if (selectedIndex < 0) selectedIndex = visibleItems.length - 1;

        visibleItems.forEach((item, index) => {
          const isSelected = index === selectedIndex;
          const button = el('button', {
            class: `row${isSelected ? ' rowSelected' : ''}`,
            type: 'button',
            'data-index': String(index),
          });

          let iconSlot;
          if (item.favicon) {
            const img = el('img', { src: item.favicon, alt: '', style: 'width:16px;height:16px;border-radius:2px;' });
            img.addEventListener('error', () => {
              img.replaceWith(el('span', { class: 'rowIcon', html: icon(item.icon || 'globe') }));
            });
            iconSlot = el('span', { class: 'rowIcon' }, [img]);
          } else {
            iconSlot = el('span', { class: 'rowIcon', html: icon(item.icon || 'globe') });
          }

          button.append(
            iconSlot,
            el('span', { class: 'rowBody' }, [
              el('span', { class: 'rowTitle', text: item.title }),
              item.subtitle ? el('span', { class: 'rowSub', text: item.subtitle }) : null,
            ]),
          );

          if (item.aside) {
            button.append(el('span', { class: 'rowAside', text: item.aside }));
          }

          if (item.shortcut) {
            button.append(el('span', { class: 'paletteBadge', text: item.shortcut }));
          } else if (item.category) {
            button.append(el('span', { class: 'paletteBadge', text: item.category }));
          }

          button.addEventListener('click', () => executeItem(item));
          button.addEventListener('mouseenter', () => {
            selectedIndex = index;
            for (const child of listContainer.querySelectorAll('.row')) {
              child.classList.toggle('rowSelected', child.dataset.index === String(index));
            }
          });

          listContainer.append(button);
        });

        const activeRow = listContainer.querySelector('.rowSelected');
        activeRow?.scrollIntoView({ block: 'nearest' });
      };

      input.addEventListener('input', () => {
        selectedIndex = 0;
        renderList();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (visibleItems.length > 0) {
            selectedIndex = (selectedIndex + 1) % visibleItems.length;
            renderList();
          }
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (visibleItems.length > 0) {
            selectedIndex = (selectedIndex - 1 + visibleItems.length) % visibleItems.length;
            renderList();
          }
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (visibleItems[selectedIndex]) {
            executeItem(visibleItems[selectedIndex]);
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closePopup();
        }
      });

      renderList();

      setTimeout(() => {
        input.focus();
        input.select();
      }, 20);
    },
  });
}
