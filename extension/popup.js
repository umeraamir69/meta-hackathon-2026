const urlInput = document.querySelector('#url');
const apiInput = document.querySelector('#api');
const state = document.querySelector('#state');
const message = document.querySelector('#message');
const report = document.querySelector('#report');
const form = document.querySelector('#scan');
const foot = document.querySelector('#foot');
const full = document.querySelector('#full');

const DEFAULT_API = 'http://127.0.0.1:3000';
const GITHUB_RE = /^https:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+(\/.*)?$/;
const SHOWN = 6;

const api = globalThis.chrome;

async function savedApi() {
  if (!api?.storage?.local) return DEFAULT_API;
  const stored = await api.storage.local.get({ apiBase: DEFAULT_API });
  return stored.apiBase || DEFAULT_API;
}

async function tabUrl() {
  try {
    if (!api?.tabs?.query) return '';
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url || '';
    if (!/github\.com\/[^/]+\/[^/]+/.test(url)) return '';
    return url.split('#')[0];
  } catch {
    return '';
  }
}

function show(text, kind) {
  message.textContent = text;
  message.className = kind || '';
}

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : 'unlabeled';
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function badgesFor(finding) {
  const badges = [];
  if (finding.removed) badges.push({ text: 'removed', hot: false });
  if (finding.encoding) badges.push({ text: `encoded ${finding.encoding}`, hot: false });
  if (finding.presentInTree === false) badges.push({ text: 'deleted from current files', hot: true });
  return badges;
}

function render(body, apiBase, url) {
  state.textContent = body.ok ? 'Pass' : 'Fail';
  state.className = body.ok ? 'pass' : 'fail';
  report.hidden = false;
  foot.hidden = false;
  report.replaceChildren();
  const findings = (body.findings || []).filter((finding) => !finding.advisory);
  const count = body.count ?? findings.length;
  const advisory = body.advisory ?? (body.findings || []).filter((finding) => finding.advisory).length;
  report.append(el('p', 'scope', `${body.source || ''} — ${body.scope || ''}`));
  report.append(el('p', 'count', `${count} finding${count === 1 ? '' : 's'}${body.ok ? '' : ' blocking merge'}`));
  if (advisory > 0) {
    const verdict = body.muse?.assessment?.verdict;
    const extra = verdict ? ` · ${String(verdict).replaceAll('_', ' ')}` : '';
    report.append(el('p', 'ai', `${advisory} AI signal${advisory === 1 ? '' : 's'}${extra} (advisory, see full report)`));
  }
  if (!findings.length) {
    report.append(el('p', 'empty', 'No findings. Nothing in this scan blocks the merge.'));
  }
  for (const finding of findings.slice(0, SHOWN)) {
    const row = el('div', `row sev-${finding.severity || 'medium'}`);
    const top = el('div', 'top');
    top.append(el('b', '', finding.rule));
    top.append(el('em', `label-${finding.label || 'unclear'}`, pretty(finding.label)));
    row.append(top);
    row.append(el('span', 'where', `${finding.source} ${finding.path}:${finding.line}`));
    if (finding.masked) row.append(el('code', 'masked', finding.masked));
    const badges = badgesFor(finding);
    if (badges.length) {
      const wrap = el('div', 'badges');
      for (const badge of badges) wrap.append(el('span', badge.hot ? 'hot' : '', badge.text));
      row.append(wrap);
    }
    if (finding.why) row.append(el('p', 'why', finding.why));
    report.append(row);
  }
  if (findings.length > SHOWN) {
    report.append(el('p', 'more', `Showing ${SHOWN} of ${findings.length}.`));
  }
  if (body.muse?.summary) {
    const box = el('div', 'muse');
    box.append(el('span', 'muse-label', `Muse · ${body.muse.provider || 'local'}`));
    box.append(el('p', '', body.muse.summary));
    const steps = (body.muse.rotate || []).flatMap((item) => item.steps || []).slice(0, 4);
    if (steps.length) {
      const list = el('ul', '');
      for (const step of steps) list.append(el('li', '', step));
      box.append(list);
    }
    report.append(box);
  }
  full.href = `${apiBase}/?url=${encodeURIComponent(url)}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const url = urlInput.value.trim();
  if (!GITHUB_RE.test(url)) {
    state.textContent = 'Error';
    state.className = 'fail';
    show('Use a public https://github.com/owner/repo link, or a pull request link.', 'error');
    return;
  }
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Scanning…';
  state.textContent = 'Scanning';
  state.className = 'scanning';
  show('Reading the diff and the recent commits.');
  report.hidden = true;
  foot.hidden = true;
  const apiBase = (apiInput.value.trim() || DEFAULT_API).replace(/\/$/, '');
  if (api?.storage?.local) await api.storage.local.set({ apiBase });
  try {
    const response = await fetch(`${apiBase}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The scan failed.');
    show(body.ok ? 'Passed.' : 'Failed. A secret is still in reach.');
    render(body, apiBase, url);
  } catch (error) {
    state.textContent = 'Error';
    state.className = 'fail';
    const hint = /failed to fetch|networkerror|load failed/i.test(error.message || '')
      ? 'Could not reach the API. Check the API field, or run the site locally.'
      : (error.message || 'The scan failed.');
    show(hint, 'error');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

savedApi().then((value) => { apiInput.value = value; });
tabUrl().then((value) => { if (value) urlInput.value = value; });
