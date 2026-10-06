'use strict';

const ext = globalThis.browser ?? globalThis.chrome;
const Core = globalThis.WorkMeterCore;
const locale = navigator.language?.toLowerCase().startsWith('de') ? 'de-CH' : 'en-US';
const lang = locale.startsWith('de') ? 'de' : 'en';

const strings = {
  de: {
    loginLead: 'WorkMeter verwendet deine bestehende ChatGPT-Anmeldung im Browser. Es ist kein zusätzlicher Login nötig.',
    loginButton: 'Nutzungsdaten lesen',
    openChatGPT: 'ChatGPT öffnen',
    loginPrivacy: 'Keine Passwörter oder Sitzungstokens werden gespeichert. WorkMeter speichert nur die Nutzungswerte lokal im Browser.',
    sessionUsage: 'Diese Sitzung',
    fullResets: 'Verfügbare Resets',
    weeklyLimit: 'Wochenlimit',
    monthlyLimit: 'Monatslimit',
    credits: 'Credits',
    lastUpdate: 'Letzte Aktualisierung',
    warnings: 'Warnungen bei 25 %, 10 % und 0 %',
    refresh: 'Aktualisieren',
    openUsage: 'Nutzung öffnen',
    autoRefresh: 'Automatisch alle 5 Min. bei offenem ChatGPT',
    clearData: 'Lokale Daten löschen',
    noData: 'Noch keine Nutzungsdaten verfügbar.',
    resetIn: 'Reset in',
    refreshError: 'Aktualisierung fehlgeschlagen',
    genericUsageError: 'Die Nutzungsdaten sind momentan nicht verfügbar. Öffne ChatGPT und versuche es erneut.',
    openTabError: 'Für die automatische Aktualisierung muss mindestens ein ChatGPT-Tab geöffnet sein.',
  },
  en: {
    loginLead: 'WorkMeter uses your existing ChatGPT browser session. No additional sign-in is required.',
    loginButton: 'Read usage data',
    openChatGPT: 'Open ChatGPT',
    loginPrivacy: 'No passwords or session tokens are stored. WorkMeter stores only usage values locally in your browser.',
    sessionUsage: 'This session',
    fullResets: 'Available resets',
    weeklyLimit: 'Weekly limit',
    monthlyLimit: 'Monthly limit',
    credits: 'Credits',
    lastUpdate: 'Last update',
    warnings: 'Warnings at 25%, 10% and 0%',
    refresh: 'Refresh',
    openUsage: 'Open usage',
    autoRefresh: 'Auto-refresh every 5 min. while ChatGPT is open',
    clearData: 'Clear local data',
    noData: 'No usage data available yet.',
    resetIn: 'Reset in',
    refreshError: 'Refresh failed',
    genericUsageError: 'Usage data is currently unavailable. Open ChatGPT and try again.',
    openTabError: 'At least one ChatGPT tab must be open for automatic refresh.',
  },
};
const t = (key) => strings[lang][key] ?? key;

const $ = (id) => document.getElementById(id);
const loginView = $('loginView');
const usageView = $('usageView');
let state = null;
let countdownTimer = null;

function applyTranslations() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

function showOnly(view) {
  [loginView, usageView].forEach((el) => el.classList.add('hidden'));
  view.classList.remove('hidden');
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('busy', busy);
}

async function send(message) {
  return ext.runtime.sendMessage(message);
}

function windowLabel(window, fallbackKind) {
  if (fallbackKind === 'weekly') {
    if (window?.kind === 'monthly') return t('monthlyLimit');
    return t('weeklyLimit');
  }
  if (!window) return '5h';
  return Core.formatWindowLabel(window.durationSeconds, window.kind, lang);
}

function friendlyError(error) {
  if (!error) return null;
  const message = String(error);
  if (message.includes('mindestens ein ChatGPT-Tab') || message.includes('NO_CHATGPT_TAB')) {
    return t('openTabError');
  }
  if (message.includes('Zeitüberschreitung') ||
      message.includes('keine verwertbaren Nutzungsfenster') ||
      message.includes('Nutzungsdaten konnten nicht') ||
      message.includes('Keine Nutzungsdaten') ||
      message.includes('HTTP')) {
    return t('genericUsageError');
  }
  return message;
}

function setMeter(prefix, window, fallbackKind) {
  const card = $(`${prefix}Card`);
  if (!window) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  $(`${prefix}Label`).textContent = windowLabel(window, fallbackKind);
  $(`${prefix}Percent`).textContent = `${Math.round(window.remainingPercent)} %`;
  const bar = $(`${prefix}Bar`);
  bar.style.width = `${Math.max(0, Math.min(100, window.remainingPercent))}%`;
  bar.dataset.level = window.remainingPercent <= 10 ? 'critical' : window.remainingPercent <= 25 ? 'warning' : 'normal';
  $(`${prefix}Countdown`).textContent = `${t('resetIn')} ${Core.formatCountdown(window.resetAt, Date.now(), lang)}`;
  $(`${prefix}Clock`).textContent = Core.formatClock(window.resetAt, locale);
}

function formatBalance(balance) {
  if (balance == null) return '—';
  if (Number.isInteger(balance)) return String(balance);
  return Number(balance).toFixed(2);
}

function renderUsage() {
  showOnly(usageView);
  const usage = state?.usage;
  const error = state?.lastError;
  const errorBanner = $('errorBanner');

  if (error) {
    errorBanner.textContent = friendlyError(error);
    errorBanner.classList.remove('hidden');
  } else {
    errorBanner.classList.add('hidden');
  }

  if (!usage) {
    setMeter('short', null, 'short');
    setMeter('weekly', null, 'weekly');
    $('sessionUsage').textContent = '—';
    $('lastUpdated').textContent = t('noData');
  } else {
    setMeter('short', usage.short, 'short');
    setMeter('weekly', usage.weekly ?? usage.monthly, 'weekly');

    const sessionValue = usage.sessionConsumption?.short ?? usage.sessionConsumption?.weekly ?? usage.sessionConsumption?.monthly;
    $('sessionUsage').textContent = sessionValue == null ? '—' : `${Math.round(sessionValue)} %`;
    $('lastUpdated').textContent = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(usage.fetchedAt));

    const planBadge = $('planBadge');
    if (usage.planType) {
      planBadge.textContent = usage.planType.toUpperCase();
      planBadge.classList.remove('hidden');
    } else {
      planBadge.classList.add('hidden');
    }

    const resetRow = $('resetRow');
    if (usage.availableResets != null) {
      $('resetCount').textContent = String(usage.availableResets);
      resetRow.classList.remove('hidden');
    } else resetRow.classList.add('hidden');

    const creditsRow = $('creditsRow');
    const creditBalance = usage.credits?.balance;
    const creditsRelevant = Boolean(usage.credits?.unlimited || (creditBalance != null && creditBalance > 0));
    if (creditsRelevant) {
      $('creditsBalance').textContent = usage.credits?.unlimited ? '∞' : formatBalance(creditBalance);
      creditsRow.classList.remove('hidden');
    } else creditsRow.classList.add('hidden');
  }

  $('warningsToggle').checked = Boolean(state?.settings?.warningsEnabled);
  startCountdownTimer();
}

function render() {
  if (state?.usage || state?.connected) renderUsage();
  else showOnly(loginView);
}

async function loadState() {
  state = await send({ type: 'state:get' });
  render();
}

async function refreshUsage() {
  const button = $('refreshButton');
  const loginButton = $('startLoginButton');
  setBusy(button, true);
  setBusy(loginButton, true);
  const result = await send({ type: 'usage:refresh' });
  setBusy(button, false);
  setBusy(loginButton, false);
  state = await send({ type: 'state:get' });
  if (!result?.ok && result?.error) state.lastError = result.error;
  render();
}

function startCountdownTimer() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!state?.usage) return;
    if (state.usage.short) setMeter('short', state.usage.short, 'short');
    if (state.usage.weekly || state.usage.monthly) setMeter('weekly', state.usage.weekly ?? state.usage.monthly, 'weekly');
  }, 1000);
}

$('startLoginButton').addEventListener('click', refreshUsage);
$('openChatGPTButton').addEventListener('click', () => send({ type: 'page:openChatGPT' }));
$('refreshButton').addEventListener('click', refreshUsage);
$('openUsageButton').addEventListener('click', () => send({ type: 'page:openUsage' }));
$('logoutButton').addEventListener('click', async () => {
  await send({ type: 'data:clear' });
  await loadState();
});
$('warningsToggle').addEventListener('change', async (event) => {
  await send({ type: 'settings:warnings', enabled: event.target.checked });
  state = await send({ type: 'state:get' });
});

window.addEventListener('unload', () => {
  if (countdownTimer) clearInterval(countdownTimer);
});

applyTranslations();
loadState()
  .then(() => refreshUsage())
  .catch((error) => {
    showOnly(loginView);
    console.error(error);
  });
