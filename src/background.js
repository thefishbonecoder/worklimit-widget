'use strict';

const ext = globalThis.browser ?? globalThis.chrome;
const Core = globalThis.WorkMeterCore;

const USAGE_PAGE = 'https://chatgpt.com/settings/usage?tab=overview';
const CHATGPT_HOME = 'https://chatgpt.com/';
const REFRESH_ALARM = 'workmeter-refresh';
const REFRESH_MINUTES = 5;
const TEMP_TAB_TIMEOUT_MS = 12_000;

const DEFAULT_SETTINGS = {
  warningsEnabled: true,
};

const tempTabWaiters = new Map();

async function storageGet(keys) {
  return ext.storage.local.get(keys);
}

async function storageSet(values) {
  return ext.storage.local.set(values);
}

async function storageRemove(keys) {
  return ext.storage.local.remove(keys);
}

async function ensureSettings() {
  const stored = await storageGet(['settings']);
  if (!stored.settings) await storageSet({ settings: DEFAULT_SETTINGS });
}

async function resetSessionBaseline() {
  await storageSet({
    session: {
      startedAt: Date.now(),
      baseline: null,
    },
  });
}

async function createRefreshAlarm() {
  try {
    await ext.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES });
  } catch {
    ext.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES });
  }
}

async function initialize({ resetSession = false } = {}) {
  await ensureSettings();
  await createRefreshAlarm();
  if (resetSession) await resetSessionBaseline();
  await updateBadgeFromCache();
}

ext.runtime.onInstalled.addListener(() => {
  initialize({ resetSession: true }).catch(() => {});
});

ext.runtime.onStartup.addListener(() => {
  initialize({ resetSession: true }).then(() => refreshUsage({ allowTemporaryTab: false })).catch(() => {});
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshUsage({ allowTemporaryTab: false }).catch(() => {});
});

async function ingestUsage(payload, source = 'chatgpt-session') {
  const usage = Core.parseUsage(payload);
  if (!usage.short && !usage.weekly && !usage.monthly) {
    throw new Error('ChatGPT hat keine verwertbaren Nutzungsfenster geliefert.');
  }

  const { session = { startedAt: Date.now(), baseline: null } } = await storageGet(['session']);
  const baseline = Core.reconcileBaseline(session.baseline, usage);

  usage.sessionConsumption = Core.computeSessionConsumption(baseline, usage);
  usage.source = source;

  await storageSet({
    usage,
    connected: true,
    session: {
      startedAt: session.startedAt ?? Date.now(),
      baseline,
    },
    lastError: null,
  });

  await updateBadge(usage);
  await maybeNotifyWarnings(usage);
  return usage;
}

async function getChatGptTabs() {
  try {
    const tabs = await ext.tabs.query({ url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] });
    return tabs.filter((tab) => Number.isInteger(tab.id));
  } catch {
    return [];
  }
}

async function requestFromTab(tabId) {
  try {
    const result = await ext.tabs.sendMessage(tabId, { type: 'usage:capture' });
    if (result?.ok) return result;
    return { ok: false, error: result?.error || (result?.status ? `HTTP ${result.status}` : 'Keine Nutzungsdaten erhalten.') };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function requestViaExistingTab() {
  const tabs = await getChatGptTabs();
  if (!tabs.length) return { ok: false, error: 'NO_CHATGPT_TAB' };

  tabs.sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));
  let lastError = 'ChatGPT-Sitzung konnte nicht gelesen werden.';
  for (const tab of tabs) {
    const result = await requestFromTab(tab.id);
    if (result?.ok) return result;
    lastError = result?.error || lastError;
  }
  return { ok: false, error: lastError };
}

function waitForTempTab(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      tempTabWaiters.delete(tabId);
      resolve({ ok: false, error: 'Zeitüberschreitung beim Lesen der ChatGPT-Nutzung.' });
    }, TEMP_TAB_TIMEOUT_MS);
    tempTabWaiters.set(tabId, { resolve, timer });
  });
}

async function requestViaTemporaryTab() {
  let tab;
  try {
    tab = await ext.tabs.create({ url: USAGE_PAGE, active: false });
    if (!Number.isInteger(tab?.id)) throw new Error('Temporärer Tab konnte nicht erstellt werden.');
    const result = await waitForTempTab(tab.id);
    return result;
  } finally {
    if (Number.isInteger(tab?.id)) {
      try { await ext.tabs.remove(tab.id); } catch {}
    }
  }
}

async function refreshUsage({ allowTemporaryTab = true } = {}) {
  const existing = await requestViaExistingTab();
  if (existing?.ok) return existing.usage ?? (await storageGet(['usage'])).usage;

  if (!allowTemporaryTab) {
    // Automatic refresh is best-effort. A closed ChatGPT tab is expected and
    // should not turn an otherwise valid cached reading into an error state.
    return null;
  }

  const temp = await requestViaTemporaryTab();
  if (temp?.ok) return temp.usage ?? (await storageGet(['usage'])).usage;

  const error = temp?.error || existing?.error || 'Nutzungsdaten konnten nicht geladen werden.';
  await storageSet({ lastError: error });
  throw new Error(error);
}

async function updateBadgeFromCache() {
  const { usage } = await storageGet(['usage']);
  await updateBadge(usage ?? null);
}

function uiLanguage() {
  try {
    const value = ext.i18n?.getUILanguage?.() || navigator.language || 'en';
    return String(value).toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

function notificationLocale() {
  return uiLanguage() === 'de' ? 'de-CH' : 'en-US';
}

async function updateBadge(usage) {
  const remaining = Core.remainingForBadge(usage);
  const text = remaining == null ? '' : String(remaining);
  try {
    await ext.action.setBadgeText({ text });
    if (remaining != null) {
      const color = remaining <= 10 ? '#b91c1c' : remaining <= 25 ? '#b45309' : '#4f46e5';
      await ext.action.setBadgeBackgroundColor({ color });
      const title = uiLanguage() === 'de'
        ? `WorkMeter: ${remaining}% verbleibend`
        : `WorkMeter: ${remaining}% remaining`;
      await ext.action.setTitle({ title });
    } else {
      await ext.action.setTitle({ title: 'WorkMeter' });
    }
  } catch {}
}

function warningThreshold(remaining) {
  if (remaining <= 0) return 0;
  if (remaining <= 10) return 10;
  if (remaining <= 25) return 25;
  return null;
}

function warningWindowSnapshot(window) {
  if (!window) return null;
  return {
    usedPercent: window.usedPercent,
    resetAt: window.resetAt,
    durationSeconds: window.durationSeconds ?? null,
  };
}

function warningCycleChanged(previous, window) {
  if (!previous || !window) return true;

  if (previous.window) {
    return Core.cycleChanged(previous.window, window);
  }

  // Backward compatibility with warning state written by WorkMeter <= 0.2.1.
  // The next successful refresh migrates it to the tolerant window snapshot.
  const legacyKey = String(window.resetAt ?? 'no-reset');
  return previous.cycleKey !== legacyKey;
}

function warningLabel(key, window, language) {
  if (key === 'short') return language === 'de' ? '5-Stunden-Limit' : '5-hour limit';
  if (window?.kind === 'monthly' || key === 'monthly') {
    return language === 'de' ? 'Monatslimit' : 'Monthly limit';
  }
  return language === 'de' ? 'Wochenlimit' : 'Weekly limit';
}

async function maybeNotifyWarnings(usage) {
  const stored = await storageGet(['settings', 'warningState']);
  const settings = { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) };
  if (!settings.warningsEnabled) return;

  const state = stored.warningState ?? {};
  const language = uiLanguage();
  const locale = notificationLocale();

  for (const key of ['short', 'weekly', 'monthly']) {
    const window = usage?.[key];
    if (!window) continue;

    const threshold = warningThreshold(window.remainingPercent);
    const previous = state[key];
    const newCycle = warningCycleChanged(previous, window);
    const cycleState = newCycle ? null : previous;

    if (threshold == null) {
      state[key] = {
        window: warningWindowSnapshot(window),
        lastThreshold: null,
      };
      continue;
    }

    const alreadyWarned = cycleState?.lastThreshold != null && cycleState.lastThreshold <= threshold;
    if (!alreadyWarned) {
      const label = warningLabel(key, window, language);
      const resetText = window.resetAt
        ? Core.formatClock(window.resetAt, locale)
        : (language === 'de' ? 'unbekannt' : 'unknown');
      const title = language === 'de'
        ? `${label}: ${Math.round(window.remainingPercent)} % übrig`
        : `${label}: ${Math.round(window.remainingPercent)}% remaining`;
      const message = language === 'de' ? `Reset: ${resetText}` : `Resets: ${resetText}`;

      try {
        await ext.notifications.create(`workmeter-${key}-${Math.round(window.resetAt ?? Date.now())}-${threshold}`, {
          type: 'basic',
          iconUrl: ext.runtime.getURL('icons/icon-128.png'),
          title,
          message,
        });
      } catch {}
    }

    state[key] = {
      window: warningWindowSnapshot(window),
      lastThreshold: alreadyWarned ? cycleState.lastThreshold : threshold,
    };
  }

  await storageSet({ warningState: state });
}

async function getState() {
  const stored = await storageGet(['connected', 'usage', 'settings', 'session', 'lastError']);
  return {
    connected: Boolean(stored.connected || stored.usage),
    usage: stored.usage ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) },
    session: stored.session ?? null,
    lastError: stored.lastError ?? null,
    usagePage: USAGE_PAGE,
  };
}

async function clearLocalData() {
  await storageRemove(['connected', 'usage', 'warningState', 'lastError']);
  await resetSessionBaseline();
  await updateBadge(null);
  return { ok: true };
}

async function setWarningsEnabled(enabled) {
  const { settings } = await storageGet(['settings']);
  const updated = { ...DEFAULT_SETTINGS, ...(settings ?? {}), warningsEnabled: Boolean(enabled) };
  await storageSet({ settings: updated });
  if (!updated.warningsEnabled) await storageRemove(['warningState']);
  return updated;
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'state:get':
      return getState();
    case 'usage:ingest': {
      const usage = await ingestUsage(message.payload, message.source);
      const tabId = sender?.tab?.id;
      if (Number.isInteger(tabId) && tempTabWaiters.has(tabId)) {
        const waiter = tempTabWaiters.get(tabId);
        clearTimeout(waiter.timer);
        tempTabWaiters.delete(tabId);
        waiter.resolve({ ok: true, usage });
      }
      return { ok: true, usage };
    }
    case 'usage:refresh':
      try {
        const usage = await refreshUsage({ allowTemporaryTab: true });
        return { ok: true, usage };
      } catch (error) {
        return { ok: false, error: error?.message ?? String(error) };
      }
    case 'settings:warnings':
      return { settings: await setWarningsEnabled(message.enabled) };
    case 'data:clear':
      return clearLocalData();
    case 'page:openUsage':
      await ext.tabs.create({ url: USAGE_PAGE });
      return { ok: true };
    case 'page:openChatGPT':
      await ext.tabs.create({ url: CHATGPT_HOME });
      return { ok: true };
    default:
      return { ok: false, error: 'Unbekannte Nachricht.' };
  }
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error?.message ?? String(error) }));
  return true;
});

initialize().catch(() => {});
