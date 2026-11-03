globalThis.SentinelHistory = {
  summarize,
  load,
  saveScan,
  clearScans,
};

const SCAN_KEY = 'scans';
const MAX_SCANS = 80;
const PAGE_KEY = 'sentinel.history';

function summarize(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const checked = list.length;
  const fails = list.filter((row) => row.verdict === 'fail').length;
  const passes = list.filter((row) => row.verdict === 'pass').length;
  const withAi = list.filter((row) => (row.advisory || 0) > 0).length;
  const avgScore = checked
    ? Math.round(list.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / checked)
    : 0;
  const failRate = checked ? Math.round((fails / checked) * 100) : 0;
  return { checked, fails, passes, withAi, avgScore, failRate };
}

function storage() {
  return globalThis.chrome?.storage?.local || null;
}

function readPage() {
  try {
    const data = JSON.parse(localStorage.getItem(PAGE_KEY) || '{}');
    return { scans: Array.isArray(data.scans) ? data.scans : [] };
  } catch {
    return { scans: [] };
  }
}

function writePage(patch) {
  const next = { ...readPage(), ...patch };
  localStorage.setItem(PAGE_KEY, JSON.stringify(next));
  return next;
}

function load() {
  const local = storage();
  if (!local) return Promise.resolve(readPage());
  return local.get([SCAN_KEY]).then((data) => ({
    scans: Array.isArray(data[SCAN_KEY]) ? data[SCAN_KEY] : [],
  }));
}

function saveScan(entry) {
  return load().then((data) => {
    const scans = [entry, ...data.scans].slice(0, MAX_SCANS);
    const local = storage();
    if (!local) {
      writePage({ scans });
      return scans;
    }
    return local.set({ [SCAN_KEY]: scans }).then(() => scans);
  });
}

function clearScans() {
  const local = storage();
  if (!local) {
    writePage({ scans: [] });
    return Promise.resolve([]);
  }
  return local.set({ [SCAN_KEY]: [] }).then(() => []);
}
