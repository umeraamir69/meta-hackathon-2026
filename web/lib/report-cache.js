const PREFIX = 'sentinel.rpt.';
const INDEX_KEY = `${PREFIX}index`;
const LATEST_KEY = `${PREFIX}latest`;
const HANDOFF_KEY = `${PREFIX}handoff`;
const MAX = 12;
const TTL_MS = 12 * 60 * 60 * 1000;

function normalize(url) {
  try {
    const value = String(url || '').trim().split('#')[0].replace(/\/+$/, '');
    if (!value) return '';
    const parsed = new URL(value);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return String(url || '').trim().replace(/\/+$/, '').split('#')[0];
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function memoryStore() {
  if (typeof window === 'undefined') return null;
  if (!window.__sentinelReports) window.__sentinelReports = Object.create(null);
  return window.__sentinelReports;
}

function readIndex() {
  if (typeof window === 'undefined') return [];
  const parsed = safeParse(window.localStorage.getItem(INDEX_KEY) || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

function writeIndex(ids) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids.slice(0, MAX)));
}

function removeId(id) {
  try {
    window.localStorage.removeItem(`${PREFIX}${id}`);
  } catch {
    /* ignore */
  }
  const mem = memoryStore();
  if (mem && id) delete mem[id];
}

function prune(ids) {
  const now = Date.now();
  const kept = [];
  for (const id of ids) {
    const entry = safeParse(window.localStorage.getItem(`${PREFIX}${id}`) || 'null');
    if (!entry?.report || now - (entry.savedAt || 0) >= TTL_MS) {
      removeId(id);
      continue;
    }
    kept.push(id);
  }
  return kept.slice(0, MAX);
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function remember(id, url, report) {
  const entry = {
    savedAt: Date.now(),
    url: normalize(url) || String(url || ''),
    report,
  };
  const mem = memoryStore();
  if (mem) mem[id] = entry;
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ id, ...entry }));
  } catch {
    /* ignore */
  }
  return entry;
}

function persistLocal(id, entry) {
  const payload = JSON.stringify(entry);
  window.localStorage.setItem(`${PREFIX}${id}`, payload);
  if (entry.url) window.localStorage.setItem(`${PREFIX}url:${entry.url}`, id);
  window.localStorage.setItem(LATEST_KEY, id);
  const ids = [id, ...readIndex().filter((item) => item !== id)];
  writeIndex(prune(ids));
}

/** Save report and return a short id for /report?rid=… */
export function stashReport(url, report) {
  if (typeof window === 'undefined' || !report) return null;
  const id = makeId();
  const entry = remember(id, url, report);
  try {
    persistLocal(id, entry);
    return id;
  } catch {
    try {
      for (const old of readIndex()) removeId(old);
      writeIndex([]);
      persistLocal(id, entry);
      return id;
    } catch {
      // Memory + session handoff still hold the report for this navigation.
      return id;
    }
  }
}

/** @deprecated alias — still used after scans */
export function cacheReport(url, report) {
  return stashReport(url, report);
}

function fromMemory(id) {
  const mem = memoryStore();
  const entry = mem?.[id];
  if (!entry?.report) return null;
  if (Date.now() - (entry.savedAt || 0) >= TTL_MS) {
    delete mem[id];
    return null;
  }
  return entry;
}

function fromSessionHandoff(id) {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    const entry = safeParse(raw);
    if (!entry?.report) return null;
    if (id && entry.id && entry.id !== id) return null;
    if (Date.now() - (entry.savedAt || 0) >= TTL_MS) {
      window.sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    return { savedAt: entry.savedAt, url: entry.url, report: entry.report };
  } catch {
    return null;
  }
}

function fromOpener(id) {
  try {
    const openerMem = window.opener?.__sentinelReports;
    const entry = openerMem?.[id];
    if (!entry?.report) return null;
    remember(id, entry.url, entry.report);
    try {
      persistLocal(id, {
        savedAt: entry.savedAt || Date.now(),
        url: entry.url,
        report: entry.report,
      });
    } catch {
      /* memory is enough for this tab */
    }
    return entry;
  } catch {
    return null;
  }
}

export function readById(id) {
  if (typeof window === 'undefined' || !id) return null;

  const mem = fromMemory(id);
  if (mem) return mem;

  const handoff = fromSessionHandoff(id);
  if (handoff) {
    remember(id, handoff.url, handoff.report);
    return handoff;
  }

  const opener = fromOpener(id);
  if (opener) return opener;

  const entry = safeParse(window.localStorage.getItem(`${PREFIX}${id}`) || 'null');
  if (!entry?.report) return null;
  if (Date.now() - (entry.savedAt || 0) >= TTL_MS) {
    removeId(id);
    return null;
  }
  remember(id, entry.url, entry.report);
  return entry;
}

export function readCachedReport(url) {
  if (typeof window === 'undefined') return null;
  const key = normalize(url);
  if (!key) return null;
  const id = window.localStorage.getItem(`${PREFIX}url:${key}`);
  if (id) {
    const entry = readById(id);
    if (entry?.report) return entry.report;
  }
  for (const item of readIndex()) {
    const entry = readById(item);
    if (entry?.report && normalize(entry.url) === key) return entry.report;
  }
  const handoff = fromSessionHandoff('');
  if (handoff?.report && normalize(handoff.url) === key) return handoff.report;
  return null;
}

export function cachedAt(url) {
  if (typeof window === 'undefined') return null;
  const key = normalize(url);
  const id = window.localStorage.getItem(`${PREFIX}url:${key}`) || window.localStorage.getItem(LATEST_KEY);
  if (!id) return null;
  const entry = readById(id);
  return entry?.savedAt || null;
}

export function reportPath(url, report) {
  const rid = stashReport(url, report);
  const params = new URLSearchParams();
  if (rid) params.set('rid', rid);
  if (url) params.set('url', url);
  return `/report?${params.toString()}`;
}
