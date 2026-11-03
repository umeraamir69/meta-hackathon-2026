const API_BASE = 'https://pr-diff-sentinel.vercel.app';
const views = {
  overview: document.querySelector('#overview'),
  history: document.querySelector('#history'),
  settings: document.querySelector('#settings'),
};

function showView(name) {
  for (const [key, node] of Object.entries(views)) {
    if (node) node.hidden = key !== name;
  }
  for (const button of document.querySelectorAll('aside nav button')) {
    button.classList.toggle('on', button.dataset.view === name);
  }
}

function when(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function render(data) {
  const scans = data.scans || [];
  const summary = SentinelHistory.summarize(scans);
  document.querySelector('#fail-rate').textContent = `${summary.failRate}%`;
  document.querySelector('#checked').textContent = String(summary.checked);
  document.querySelector('#fails').textContent = String(summary.fails);
  document.querySelector('#avg-score').textContent = String(summary.avgScore);
  document.querySelector('#ai-note').textContent = summary.checked
    ? `${summary.withAi} of ${summary.checked} scan${summary.checked === 1 ? '' : 's'} had AI advisory signals. ${summary.passes} passed the secret gate.`
    : 'No scans yet. Open a GitHub PR and click the Sentinel icon.';

  const list = document.querySelector('#list');
  list.replaceChildren();
  if (!scans.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No history yet.';
    list.append(empty);
    return;
  }
  for (const row of scans) {
    const item = document.createElement('li');
    const top = document.createElement('div');
    top.className = 'row-top';
    const title = document.createElement('strong');
    title.textContent = row.source || row.url || 'Scan';
    const pill = document.createElement('span');
    pill.className = `pill ${row.verdict === 'pass' ? 'pass' : 'fail'}`;
    pill.textContent = `${row.verdict === 'pass' ? 'Pass' : 'Fail'} · ${row.score ?? 0}${row.grade ? ` ${row.grade}` : ''}`;
    top.append(title, pill);
    const meta = document.createElement('p');
    meta.textContent = `${when(row.ts)}${row.advisory ? ` · ${row.advisory} AI advisory` : ''}${row.count != null ? ` · ${row.count} blocking` : ''}`;
    if (row.headline) {
      const blurb = document.createElement('p');
      blurb.className = 'headline';
      blurb.textContent = String(row.headline).slice(0, 180);
      item.append(top, meta, blurb);
    } else {
      item.append(top, meta);
    }
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    if (row.url) {
      const report = document.createElement('a');
      report.href = `${API_BASE}/report?url=${encodeURIComponent(row.url)}`;
      report.target = '_blank';
      report.rel = 'noreferrer';
      report.textContent = 'Merge gate report';
      const github = document.createElement('a');
      github.href = row.url;
      github.target = '_blank';
      github.rel = 'noreferrer';
      github.textContent = 'GitHub';
      actions.append(report, github);
    }
    item.append(actions);
    list.append(item);
  }
}

async function refresh() {
  const data = await SentinelHistory.load();
  render(data);
}

for (const button of document.querySelectorAll('aside nav button')) {
  button.addEventListener('click', () => showView(button.dataset.view));
}

document.querySelector('#clear').addEventListener('click', async () => {
  await SentinelHistory.clearScans();
  await refresh();
  showView('overview');
});

refresh();
