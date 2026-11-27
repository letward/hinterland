const { contextBridge, ipcRenderer } = require('electron');

/**
 * Sandboxed bridge for Neocrom Horizon extension popups and extension views.
 *
 * CRITICAL SECURITY GUARANTEE:
 * Extension pages MUST NEVER receive the privileged `window.horizon` API.
 * This isolated bridge exposes only safe, scoped capabilities (e.g. closing the popup)
 * and prevents untrusted extensions from accessing browser internal settings, history,
 * bookmarks, or system controls.
 */
contextBridge.exposeInMainWorld('horizonExtension', {
  isExtensionPopup: true,
  closePopup: () => ipcRenderer.invoke('extension:closePopup'),
  getManifest: () => ipcRenderer.invoke('extension:getSelfManifest'),
});
