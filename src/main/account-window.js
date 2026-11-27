import { BrowserWindow } from 'electron';
import { neocromOrigin } from '../../sdk/src/neocrom-id.js';
import { defaultSession } from './sessions.js';
import { appIconPath } from './resources.js';

let accountWindow;
let approving = false;

export async function openOcromAccount(parent, code) {
  const connecting = code !== undefined;
  if (connecting && (typeof code !== 'string' || !/^[A-F0-9]{10}$/.test(code))) {
    return { ok: false };
  }
  const target = new URL(connecting ? '/#ocrom-id?code=' + code : '/#account', neocromOrigin);
  if (!accountWindow || accountWindow.isDestroyed()) {
    const window = new BrowserWindow({
      parent,
      modal: true,
      width: 790,
      height: 710,
      backgroundColor: '#17131f',
      title: 'Ocrom ID · ocrom.net',
      autoHideMenuBar: true,
      icon: appIconPath() || undefined,
      webPreferences: {
        session: defaultSession(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
      },
    });
    accountWindow = window;
    window.on('page-title-updated', event => event.preventDefault());
    window.on('closed', () => { if (accountWindow === window) accountWindow = undefined; });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const sameOrigin = event => {
      if (URL.parse(event.url)?.origin !== neocromOrigin) event.preventDefault();
    };
    window.webContents.on('will-navigate', sameOrigin);
    window.webContents.on('will-redirect', sameOrigin);
  }
  approving = connecting;
  const window = accountWindow;
  window.focus();
  try {
    await window.loadURL(target.href);
    return { ok: true };
  } catch {
    if (!window.isDestroyed()) window.close();
    return { ok: false };
  }
}

export function closeOcromApproval() {
  if (approving && accountWindow && !accountWindow.isDestroyed()) accountWindow.close();
}
