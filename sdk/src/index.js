/**
 * @fileoverview Neocrom Horizon Extension SDK
 * Official SDK for building secure, modern extensions for the Neocrom Horizon browser.
 */

export {
  PERMISSION_LEVELS,
  validateManifest,
  defineManifest,
} from './manifest.js';

export {
  escapeHtml,
  sanitizeHtml,
  safeHtml,
  rawSafeHtml,
  validateOrigin,
  maskSensitiveText,
  stripTracking,
  encryptData,
  decryptData,
  SecureStorage,
  createSecureStorage,
} from './security.js';

export {
  MessageBus,
  createMessageBus,
} from './messaging.js';

export {
  ContentHelper,
} from './content.js';

export {
  HORIZON_CSS_VARS,
  injectHorizonTheme,
  Store,
  createStore,
  UIHelper,
} from './ui.js';

export {
  HorizonExtension,
  createExtension,
} from './extension.js';
