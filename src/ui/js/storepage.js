import { renderHorizonStore } from './horizonStore.js';
import { setStrings } from './i18n.js';

async function init() {
  const root = document.getElementById('storeRoot');
  if (!root) return;

  // Fetch strings if horizonPage is present
  try {
    const res = await fetch('horizon://strings/de.json');
    if (res.ok) {
      const strings = await res.json();
      setStrings(strings, 'de');
    }
  } catch {}

  const view = renderHorizonStore('all');
  root.append(view);
}

init();
