(function (root) {
  'use strict';

  const TWO_DAYS = 2 * 24 * 60 * 60;
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60;
  const RESET_AT_TOLERANCE_MS = 5 * 60 * 1000;
  const USED_PERCENT_TOLERANCE = 0.5;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function normalizeTimestamp(value, nowMs = Date.now()) {
    if (value == null) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) value = numeric;
      else {
        const parsed = Date.parse(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (value > 10_000_000_000) return value;
    if (value > 1_000_000_000) return value * 1000;
    if (value >= 0 && value < 31_536_000) return nowMs + value * 1000;
    return null;
  }

  function windowKind(durationSeconds, hint) {
    if (durationSeconds != null) {
      if (durationSeconds >= FOURTEEN_DAYS) return 'monthly';
      if (durationSeconds >= TWO_DAYS) return 'weekly';
      return 'short';
    }
    if (hint === 'weekly') return 'weekly';
    if (hint === 'five_hour') return 'short';
    return 'unknown';
  }

  function formatWindowLabel(durationSeconds, kind, locale = 'de') {
    if (kind === 'weekly') return locale.startsWith('de') ? 'Wochenlimit' : 'Weekly limit';
    if (kind === 'monthly') return locale.startsWith('de') ? 'Monatslimit' : 'Monthly limit';
    if (durationSeconds != null) {
      const hours = durationSeconds / 3600;
      if (Math.abs(hours - 5) < 0.2) return '5h';
      if (hours < 24 && hours >= 1) return `${Math.round(hours)}h`;
    }
    return locale.startsWith('de') ? 'Kurzlimit' : 'Short limit';
  }

  function normalizeWindow(raw, hint, nowMs = Date.now()) {
    if (!raw || typeof raw !== 'object') return null;

    const durationSeconds = toNumber(raw.limit_window_seconds ?? raw.window_seconds ?? raw.limitWindowSeconds);

    let usedPercent = toNumber(raw.used_percent ?? raw.usedPercent);
    if (usedPercent == null) {
      const left = toNumber(raw.percent_left ?? raw.remaining_percent ?? raw.remainingPercent);
      if (left != null) usedPercent = 100 - left;
    }
    if (usedPercent == null) return null;

    const resetAfter = toNumber(raw.reset_after_seconds ?? raw.resetAfterSeconds);
    let resetAt = normalizeTimestamp(raw.reset_at ?? raw.resetAt ?? raw.reset_time_ms ?? raw.resetTimeMs, nowMs);
    if (resetAt == null && resetAfter != null) resetAt = nowMs + resetAfter * 1000;

    const kind = windowKind(durationSeconds, hint);
    const used = clamp(usedPercent, 0, 100);
    const remaining = clamp(100 - used, 0, 100);

    return {
      kind,
      usedPercent: used,
      remainingPercent: remaining,
      resetAt,
      durationSeconds,
      limitReached: Boolean(raw.limit_reached ?? raw.limitReached ?? remaining <= 0),
    };
  }

  function collectWindows(payload, nowMs = Date.now()) {
    const rate = payload?.rate_limit ?? payload?.rate_limits ?? {};
    const candidates = [
      ['five_hour', rate.five_hour],
      ['primary', rate.primary_window ?? rate.primary],
      ['weekly', rate.weekly],
      ['secondary', rate.secondary_window ?? rate.secondary],
    ];

    const seen = new Set();
    const normalized = [];
    for (const [hint, raw] of candidates) {
      if (!raw || typeof raw !== 'object') continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      const item = normalizeWindow(raw, hint, nowMs);
      if (item) normalized.push(item);
    }
    return normalized;
  }

  function chooseByKind(windows, kind) {
    const matches = windows.filter((window) => window.kind === kind);
    if (!matches.length) return null;
    matches.sort((a, b) => {
      const ad = a.durationSeconds ?? Number.MAX_SAFE_INTEGER;
      const bd = b.durationSeconds ?? Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
    return matches[0];
  }

  function parseUsage(payload, nowMs = Date.now()) {
    const windows = collectWindows(payload, nowMs);
    let short = chooseByKind(windows, 'short');
    let weekly = chooseByKind(windows, 'weekly');
    const monthly = chooseByKind(windows, 'monthly');

    if (!short && !weekly) {
      const primary = normalizeWindow(payload?.rate_limit?.primary_window, 'primary', nowMs);
      const secondary = normalizeWindow(payload?.rate_limit?.secondary_window, 'secondary', nowMs);
      if (primary && !secondary) {
        if ((primary.durationSeconds ?? 0) >= TWO_DAYS) weekly = primary;
        else short = primary;
      } else {
        short = primary;
        weekly = secondary;
      }
    }

    const resetBlock = payload?.rate_limit_reset_credits ?? payload?.rateLimitResetCredits ?? {};
    const availableResets = toNumber(resetBlock.available_count ?? resetBlock.availableCount);
    const applicableResets = toNumber(resetBlock.applicable_available_count ?? resetBlock.applicableAvailableCount);

    const credits = payload?.credits && typeof payload.credits === 'object' ? payload.credits : null;
    const creditBalance = credits ? toNumber(credits.balance) : null;

    return {
      planType: String(payload?.plan_type ?? payload?.planType ?? '').trim() || null,
      allowed: payload?.rate_limit?.allowed ?? payload?.rate_limits?.allowed ?? null,
      limitReached: Boolean(payload?.rate_limit?.limit_reached ?? payload?.rate_limits?.limit_reached ?? false),
      short,
      weekly,
      monthly,
      availableResets: availableResets == null ? null : Math.max(0, Math.floor(availableResets)),
      applicableResets: applicableResets == null ? null : Math.max(0, Math.floor(applicableResets)),
      credits: {
        hasCredits: Boolean(credits?.has_credits ?? credits?.hasCredits ?? (creditBalance != null && creditBalance > 0)),
        unlimited: Boolean(credits?.unlimited),
        balance: creditBalance,
      },
      fetchedAt: nowMs,
    };
  }

  function remainingForBadge(usage) {
    const target = usage?.short ?? usage?.weekly ?? usage?.monthly;
    return target ? Math.round(target.remainingPercent) : null;
  }

  function cycleChanged(base, current) {
    if (!base || !current) return true;

    // ChatGPT can report reset_after_seconds with small rounding drift between
    // refreshes. Only a larger jump means a new quota window.
    if (base.resetAt && current.resetAt) {
      const resetShift = Math.abs(base.resetAt - current.resetAt);
      if (resetShift > RESET_AT_TOLERANCE_MS) return true;
    }

    // A meaningful drop in used percentage is also a strong reset signal,
    // including cases where resetAt is temporarily missing. Ignore tiny jitter.
    if (current.usedPercent + USED_PERCENT_TOLERANCE < base.usedPercent) return true;

    return false;
  }

  function sameUsageCycle(base, current) {
    return !cycleChanged(base, current);
  }

  function computeSessionConsumption(baseline, usage) {
    function deltaFor(key) {
      const current = usage?.[key];
      const base = baseline?.[key];
      if (!current || !base) return null;
      if (!sameUsageCycle(base, current)) return 0;
      return clamp(current.usedPercent - base.usedPercent, 0, 100);
    }
    return {
      short: deltaFor('short'),
      weekly: deltaFor('weekly'),
      monthly: deltaFor('monthly'),
    };
  }

  function baselineEntry(window) {
    if (!window) return null;
    return { usedPercent: window.usedPercent, resetAt: window.resetAt, durationSeconds: window.durationSeconds ?? null };
  }

  function makeBaseline(usage) {
    return {
      short: baselineEntry(usage?.short),
      weekly: baselineEntry(usage?.weekly),
      monthly: baselineEntry(usage?.monthly),
    };
  }

  function reconcileBaseline(baseline, usage) {
    const next = { ...(baseline ?? {}) };
    for (const key of ['short', 'weekly', 'monthly']) {
      const current = usage?.[key];
      if (!current) continue;
      const base = next[key];
      if (!base || !sameUsageCycle(base, current)) next[key] = baselineEntry(current);
    }
    return next;
  }

  function shouldResetBaseline(baseline, usage) {
    if (!baseline) return true;
    for (const key of ['short', 'weekly', 'monthly']) {
      const base = baseline[key];
      const current = usage?.[key];
      if (!base || !current) continue;
      if (!sameUsageCycle(base, current)) return true;
    }
    return false;
  }

  function formatCountdown(resetAt, nowMs = Date.now(), locale = 'de') {
    if (!resetAt) return locale.startsWith('de') ? 'unbekannt' : 'unknown';
    let seconds = Math.max(0, Math.ceil((resetAt - nowMs) / 1000));
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);

    if (days > 0) return locale.startsWith('de') ? `${days} T ${hours} Std.` : `${days}d ${hours}h`;
    if (hours > 0) return locale.startsWith('de') ? `${hours} Std. ${minutes} Min.` : `${hours}h ${minutes}m`;
    return locale.startsWith('de') ? `${minutes} Min.` : `${minutes}m`;
  }

  function formatClock(resetAt, locale = 'de-CH') {
    if (!resetAt) return '—';
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(resetAt));
    } catch {
      return new Date(resetAt).toLocaleString();
    }
  }

  function formatPercent(value) {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${Math.round(value)} %`;
  }

  const api = {
    clamp,
    toNumber,
    normalizeTimestamp,
    normalizeWindow,
    parseUsage,
    remainingForBadge,
    computeSessionConsumption,
    cycleChanged,
    makeBaseline,
    reconcileBaseline,
    shouldResetBaseline,
    formatWindowLabel,
    formatCountdown,
    formatClock,
    formatPercent,
  };

  root.WorkMeterCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
