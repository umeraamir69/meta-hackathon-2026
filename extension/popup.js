const urlInput = document.querySelector('#url');
const apiInput = document.querySelector('#api');
const state = document.querySelector('#state');
const message = document.querySelector('#message');
const report = document.querySelector('#report');
const form = document.querySelector('#scan');

const browser = globalThis.chrome;

async function savedApi() {
  if (!browser?.storage?.local) return 'http://127.0.0.1:3000';
  const stored = await browser.storage.local.get({ apiBase: 'http://127.0.0.1:3000' });
  return stored.apiBase;
}

async function tabUrl() {
  if (!browser?.tabs?.query) return '';
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url || '';
  return /github\.com\/[^/]+\/[^/]+/.test(url) ? url : '';
}

function show(text, kind) {
  message.textContent = text;
  message.className = kind || '';
}

function render(body) {
  state.textContent = body.ok ? 'Pass' : 'Fail';
  state.className = body.ok ? 'pass' : 'fail';
  report.hidden = false;
  report.replaceChildren();
  const note = document.createElement('p');
  note.textContent = body.scope || '';
  report.append(note);
  for (const finding of (body.findings || []).slice(0, 6)) {
    const row = document.createElement('div');
    row.className = 'row';
    const title = document.createElement('b');
    title.textContent = `${finding.rule} · ${finding.label || 'unlabeled'}`;
    const where = document.createElement('span');
    where.textContent = `${finding.path}:${finding.line}${finding.removed ? ' removed' : ''}`;
    row.append(title, where);
    report.append(row);
  }
  if (!body.findings?.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No findings.';
    report.append(empty);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  state.textContent = 'Scanning';
  state.className = '';
  show('');
  report.hidden = true;
  const apiBase = apiInput.value.trim().replace(/\/$/, '');
  if (browser?.storage?.local) await browser.storage.local.set({ apiBase });
  try {
    const response = await fetch(`${apiBase}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value.trim() }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The scan failed.');
    show(body.source || '');
    render(body);
  } catch (error) {
    state.textContent = 'Error';
    state.className = 'fail';
    show(error.message || 'The scan failed.', 'error');
  } finally {
    button.disabled = false;
  }
});

savedApi().then((value) => { apiInput.value = value; });
tabUrl().then((value) => { if (value) urlInput.value = value; });
