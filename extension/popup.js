const urlInput = document.querySelector('#url');
const state = document.querySelector('#state');
const message = document.querySelector('#message');
const report = document.querySelector('#report');
const form = document.querySelector('#scan');
const goBtn = document.querySelector('#go');
const foot = document.querySelector('#foot');
const full = document.querySelector('#full');
const dash = document.querySelector('#dash');
const picker = document.querySelector('#picker');
const pickList = document.querySelector('#pick-list');
const pickerHint = document.querySelector('#picker-hint');
const pickerTitle = document.querySelector('#picker-title');
const changePick = document.querySelector('#change-pick');

const API_BASE = 'https://pr-diff-sentinel.vercel.app';
const GITHUB_RE = /^https:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+(\/.*)?$/;
const SHOWN = 5;

const api = globalThis.chrome;
let lastListing = null;
let lastPage = null;
let mode = 'direct'; // direct | pick

function openDashboard() {
  const href = api?.runtime?.getURL ? api.runtime.getURL('dashboard.html') : 'dashboard.html';
  if (api?.tabs?.create) {
    api.tabs.create({ url: href });
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}

async function tabUrl() {
  try {
    if (!api?.tabs?.query) return '';
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url || '';
    if (!/github\.com\/[^/]+\/[^/]+/.test(url)) return '';
    return url.split('#')[0].split('?')[0];
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

function classifyGitHubUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!GITHUB_RE.test(trimmed)) return { kind: 'none' };
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'none' };
  }
  const parts = url.pathname.split('/').filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  if (parts.length < 2) return { kind: 'none' };
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const third = parts[2] || '';
  const fourth = parts[3] || '';

  if ((third === 'pull' || third === 'pulls') && /^\d{1,10}$/.test(fourth)) {
    return {
      kind: 'pr',
      scanUrl: `https://github.com/${owner}/${repo}/pull/${fourth}`,
      repoUrl,
      label: `${owner}/${repo}#${fourth}`,
    };
  }

  if ((third === 'commit' || third === 'commits') && /^[0-9a-f]{7,40}$/i.test(fourth)) {
    return {
      kind: 'commit',
      scanUrl: `https://github.com/${owner}/${repo}/commit/${fourth}`,
      repoUrl,
      label: `${owner}/${repo}@${fourth.slice(0, 7)}`,
    };
  }

  if ((third === 'blob' || third === 'tree') && /^[0-9a-f]{7,40}$/i.test(fourth)) {
    return {
      kind: 'commit',
      scanUrl: `https://github.com/${owner}/${repo}/commit/${fourth}`,
      repoUrl,
      label: `${owner}/${repo}@${fourth.slice(0, 7)}`,
      fromFile: true,
    };
  }

  return {
    kind: 'repo',
    scanUrl: repoUrl,
    repoUrl,
    label: `${owner}/${repo}`,
    context: third || 'home',
  };
}

function setMode(next) {
  mode = next;
  // Only one primary action: Scan for pasted PR/commit links.
  // In pick mode the list rows are the action — hide the top Scan button.
  goBtn.hidden = next === 'pick';
  form.classList.toggle('pick-mode', next === 'pick');
}

function setBusy(on, label) {
  goBtn.disabled = on;
  pickList.querySelectorAll('button.pick-row').forEach((btn) => {
    btn.disabled = on;
  });
  changePick.disabled = on;
  if (on) {
    state.textContent = label === 'Listing…' ? 'Listing' : 'Scanning';
    state.className = 'scanning';
    if (!goBtn.hidden) goBtn.textContent = label || 'Scanning…';
  } else if (!goBtn.hidden) {
    goBtn.textContent = 'Scan';
  }
}

function hidePicker() {
  picker.hidden = true;
  pickList.replaceChildren();
  changePick.hidden = true;
}

function showPickerList() {
  if (!lastListing || !lastPage) return;
  picker.hidden = false;
  changePick.hidden = true;
  pickerTitle.textContent = 'Pick a PR or commit';
  pickList.hidden = false;
  pickerHint.hidden = false;
  renderPicker(lastListing, lastPage);
  setMode('pick');
}

function collapsePickerAfterScan() {
  // Keep a tiny “Change” control; hide the long list so results stay on top.
  if (!lastListing) {
    hidePicker();
    return;
  }
  picker.hidden = false;
  pickList.hidden = true;
  pickerHint.hidden = true;
  pickerTitle.textContent = 'Scanned';
  changePick.hidden = false;
}

function renderPicker(listing, page) {
  pickList.replaceChildren();
  pickList.hidden = false;
  picker.hidden = false;
  const pulls = listing.pulls || [];
  const commits = listing.commits || [];
  const ctx = page?.context || 'home';

  if (ctx === 'blob' || ctx === 'tree') {
    pickerHint.textContent = 'File page — tap a PR or commit below to scan.';
  } else if (ctx === 'pulls') {
    pickerHint.textContent = 'Tap a pull request (or commit) to scan.';
  } else {
    pickerHint.textContent = 'Repo home — tap one row to scan. No second button.';
  }
  pickerHint.hidden = false;

  if (!pulls.length && !commits.length) {
    pickList.append(el('p', 'empty-pick', 'No public PRs or recent commits found.'));
    return;
  }

  function addGroup(title, items, kind) {
    if (!items.length) return;
    pickList.append(el('p', 'group-label', title));
    for (const item of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'pick-row';
      const body = el('span', 'pick-body');
      if (kind === 'pull') {
        body.append(el('strong', '', `#${item.number} ${item.title || '(no title)'}`));
        body.append(el('span', 'pick-meta', `${item.state || 'open'} · ${item.author || 'unknown'}`));
      } else {
        body.append(el('strong', '', item.subject || '(no message)'));
        body.append(el('span', 'pick-meta', `${String(item.sha || '').slice(0, 7)} · ${item.author || 'unknown'}${item.date ? ` · ${item.date}` : ''}`));
      }
      row.append(body, el('span', 'pick-go', 'Scan'));
      row.addEventListener('click', () => {
        urlInput.value = item.url;
        runScan(item.url, { fromPicker: true });
      });
      pickList.append(row);
    }
  }

  addGroup('Pull requests', pulls, 'pull');
  addGroup('Recent commits', commits, 'commit');
}

function badgesFor(finding) {
  const badges = [];
  if (finding.removed) badges.push({ text: 'removed', hot: false });
  if (finding.encoding) badges.push({ text: `encoded ${finding.encoding}`, hot: false });
  if (finding.presentInTree === false) badges.push({ text: 'deleted from current files', hot: true });
  return badges;
}

function encodePath(path) {
  return String(path || '').split('/').map((part) => encodeURIComponent(part)).join('/');
}

function githubFindingUrl(body, finding) {
  const owner = body.owner;
  const repo = body.repo;
  if (!owner || !repo) return null;
  const path = finding?.path || '';
  const line = finding?.line ? Number(finding.line) : null;
  const sha = finding?.commit || body.head || null;
  if (!path || path === 'commit-message' || path === 'commit' || path === 'pull-request') {
    if (sha) return `https://github.com/${owner}/${repo}/commit/${sha}`;
    if (body.pull) return `https://github.com/${owner}/${repo}/pull/${body.pull}`;
    return `https://github.com/${owner}/${repo}`;
  }
  if (sha) {
    const base = `https://github.com/${owner}/${repo}/blob/${sha}/${encodePath(path)}`;
    return line ? `${base}#L${line}` : base;
  }
  if (body.pull) return `https://github.com/${owner}/${repo}/pull/${body.pull}/files`;
  return null;
}

function render(body, url) {
  state.textContent = body.ok ? 'Pass' : 'Fail';
  state.className = body.ok ? 'pass' : 'fail';
  report.hidden = false;
  foot.hidden = false;
  report.replaceChildren();
  const findings = (body.findings || []).filter((finding) => !finding.advisory);
  const count = body.count ?? findings.length;
  const advisory = body.advisory ?? (body.findings || []).filter((finding) => finding.advisory).length;
  const score = body.score || {};
  report.append(el('p', 'scope', `${body.source || ''} — ${body.scope || ''}`));
  report.append(el(
    'p',
    'count',
    `Risk ${score.value ?? 0} · ${score.grade || '—'} · ${count} blocking${advisory ? ` · ${advisory} AI` : ''}`,
  ));
  if (score.headline) report.append(el('p', 'why', score.headline));
  if (advisory > 0) report.append(aiPanel(body, advisory));

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
    const fileUrl = githubFindingUrl(body, finding);
    if (fileUrl) {
      const link = el('a', 'file-link', 'Open file on GitHub');
      link.href = fileUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      row.append(link);
    }
    report.append(row);
  }
  if (findings.length > SHOWN) {
    report.append(el('p', 'more', `Showing ${SHOWN} of ${findings.length}. Open full report for PDF, fixes, and Muse chat.`));
  }
  if (body.muse?.summary) {
    const box = el('div', 'muse');
    box.append(el('span', 'muse-label', `Muse · ${body.muse.provider || 'local'}${body.muse.model ? ` · ${body.muse.model}` : ''}`));
    box.append(el('p', '', body.muse.summary));
    report.append(box);
  }
  full.href = `${API_BASE}/report?url=${encodeURIComponent(url)}`;
  if (globalThis.SentinelHistory?.saveScan) {
    SentinelHistory.saveScan({
      ts: Date.now(),
      url,
      source: body.source || url,
      verdict: body.ok ? 'pass' : 'fail',
      score: score.value ?? (body.ok ? 0 : 70),
      grade: score.grade || null,
      count,
      advisory,
      headline: score.headline || body.muse?.summary || '',
      museProvider: body.muse?.provider || null,
    }).catch(() => {});
  }
  // Scroll results into view at the top of main.
  report.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function aiPanel(body, advisory) {
  const assessment = body.muse?.assessment || null;
  const verdict = assessment?.verdict;
  const box = el('div', 'ai');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ai-toggle';
  const label = `${advisory} AI signal${advisory === 1 ? '' : 's'}${verdict ? ` · ${String(verdict).replaceAll('_', ' ')}` : ''}`;
  toggle.append(el('span', '', label));
  toggle.append(el('span', 'ai-caret', '▸'));
  const open = el('div', 'ai-body');
  open.hidden = true;
  toggle.addEventListener('click', () => {
    open.hidden = !open.hidden;
    toggle.className = `ai-toggle${open.hidden ? '' : ' open'}`;
  });
  box.append(toggle);
  if (assessment) {
    open.append(el('p', 'ai-verdict', `Muse verdict: ${String(assessment.verdict || 'unclear').replaceAll('_', ' ')} (${assessment.confidence || 'low'} confidence)`));
    for (const item of assessment.evidence || []) {
      if (!item || (!item.signal && !item.why)) continue;
      const row = el('p', 'ai-evidence');
      row.append(el('b', '', item.signal || 'signal'));
      if (item.why) row.append(el('span', '', ` — ${item.why}`));
      open.append(row);
    }
    for (const focus of assessment.review_focus || []) {
      open.append(el('p', 'ai-focus', `Check: ${focus}`));
    }
    for (const note of assessment.notes || []) {
      if (note) open.append(el('p', 'ai-note', String(note)));
    }
  }
  for (const finding of (body.findings || []).filter((finding) => finding.advisory)) {
    const row = el('div', 'ai-finding');
    row.append(el('b', '', finding.rule));
    row.append(el('span', 'where', `${finding.source} ${finding.path || ''}${finding.line ? `:${finding.line}` : ''}`.trim()));
    if (finding.masked) row.append(el('code', 'masked', finding.masked));
    open.append(row);
  }
  box.append(open);
  return box;
}

async function fetchScan(url) {
  const response = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The scan failed.');
  return body;
}

async function listRepo(url) {
  const response = await fetch(`${API_BASE}/api/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not list that repository.');
  return body;
}

async function runScan(targetUrl, { fromPicker = false } = {}) {
  setBusy(true);
  report.hidden = true;
  foot.hidden = true;
  if (!fromPicker) hidePicker();
  else {
    // Keep picker shell but collapse list while scanning so status is visible on top.
    pickList.hidden = true;
    pickerHint.hidden = true;
  }
  show('Fetching + Muse triage (often 15–30s)…');
  try {
    const body = await fetchScan(targetUrl);
    const score = body.score?.value;
    show(body.ok
      ? `Passed${score != null ? ` · risk ${score}` : ''}.`
      : `Failed${score != null ? ` · risk ${score}` : ''}. Open full report for fixes.`);
    render(body, targetUrl);
    if (fromPicker || lastListing) collapsePickerAfterScan();
    else setMode('direct');
  } catch (error) {
    state.textContent = 'Error';
    state.className = 'fail';
    const hint = /failed to fetch|networkerror|load failed/i.test(error.message || '')
      ? 'Could not reach the Sentinel backend. Try again in a moment.'
      : (error.message || 'The scan failed.');
    show(hint, 'error');
    if (fromPicker && lastListing) showPickerList();
  } finally {
    setBusy(false);
  }
}

async function runList(page) {
  setBusy(true, 'Listing…');
  report.hidden = true;
  foot.hidden = true;
  hidePicker();
  setMode('pick');
  state.textContent = 'Pick';
  state.className = '';
  show(`Loading PRs and commits for ${page.label}…`);
  try {
    const listing = await listRepo(page.repoUrl);
    lastListing = listing;
    lastPage = page;
    show('Tap one row to scan.');
    renderPicker(listing, page);
  } catch (error) {
    setMode('direct');
    state.textContent = 'Error';
    state.className = 'fail';
    show(error.message || 'Could not list that repository.', 'error');
  } finally {
    setBusy(false);
  }
}

async function handleTarget(raw) {
  const page = classifyGitHubUrl(raw);
  if (page.kind === 'none') {
    state.textContent = 'Error';
    state.className = 'fail';
    show('Use a public GitHub PR, commit, or repo link.', 'error');
    return;
  }
  urlInput.value = page.kind === 'repo' ? page.repoUrl : page.scanUrl;
  if (page.kind === 'pr' || page.kind === 'commit') {
    setMode('direct');
    if (page.fromFile) show('File page pinned to a commit — scanning…');
    await runScan(page.scanUrl);
    return;
  }
  await runList(page);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await handleTarget(urlInput.value.trim());
});

changePick?.addEventListener('click', () => {
  report.hidden = true;
  foot.hidden = true;
  show('Tap one row to scan.');
  state.textContent = 'Pick';
  state.className = '';
  showPickerList();
});

dash?.addEventListener('click', openDashboard);

tabUrl().then(async (value) => {
  if (!value) {
    setMode('direct');
    show('Open a GitHub PR, commit, or repo — or paste a link.');
    return;
  }
  const page = classifyGitHubUrl(value);
  if (page.kind === 'none') {
    setMode('direct');
    show('Open a GitHub PR, commit, or repo — or paste a link.');
    return;
  }
  urlInput.value = page.kind === 'repo' ? page.repoUrl : page.scanUrl;
  if (page.kind === 'pr' || page.kind === 'commit') {
    setMode('direct');
    await runScan(page.scanUrl);
    return;
  }
  await runList(page);
});
