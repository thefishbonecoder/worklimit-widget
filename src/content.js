'use strict';

const ext = globalThis.browser ?? globalThis.chrome;
const USAGE_PATH = '/backend-api/wham/usage';
const VISIBILITY_REFRESH_MIN_MS = 60 * 1000;

let inFlight = false;
let lastFetchAt = 0;

function getAccessToken() {
  try {
    const el = document.getElementById('client-bootstrap');
    if (!el?.textContent) return null;
    const bootstrap = JSON.parse(el.textContent);
    return bootstrap?.session?.accessToken || null;
  } catch {
    return null;
  }
}

async function fetchUsage({ force = false } = {}) {
  const now = Date.now();
  if (inFlight) return { ok: false, error: 'busy' };
  if (!force && now - lastFetchAt < VISIBILITY_REFRESH_MIN_MS) {
    return { ok: true, skipped: true };
  }

  inFlight = true;
  lastFetchAt = now;

  try {
    const headers = {
      Accept: 'application/json',
      'oai-language': navigator.language || 'de-CH',
    };

    const accessToken = getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetch(USAGE_PATH, {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }

    const payload = await response.json();
    const result = await ext.runtime.sendMessage({
      type: 'usage:ingest',
      payload,
      source: accessToken ? 'chatgpt-session-token' : 'chatgpt-session-cookie',
    });

    return result?.ok
      ? { ok: true, usage: result.usage }
      : { ok: false, error: result?.error || 'ingest-failed' };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  } finally {
    inFlight = false;
  }
}

// Initial reading when a ChatGPT page becomes available.
setTimeout(() => fetchUsage({ force: true }).catch(() => {}), 1200);

// The background service worker performs the regular 5-minute refresh.
// Here we only refresh when the user returns to ChatGPT after a while or
// reconnects to the network. This avoids duplicate requests from multiple tabs.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchUsage().catch(() => {});
  }
});

window.addEventListener('online', () => {
  fetchUsage().catch(() => {});
});

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'usage:capture') return false;
  fetchUsage({ force: true })
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});
