/** Build a GitHub URL that lands on the exact file / commit for a finding. */

function encodePath(path) {
  return String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function parseReportRepo(report) {
  const source = String(report?.source || '');
  const pull = source.match(/^([^/]+\/[^/#]+)#(\d+)$/);
  if (pull) return { repo: pull[1], owner: pull[1].split('/')[0], name: pull[1].split('/')[1], pull: pull[2], commit: null };
  const commit = source.match(/^([^/]+\/[^/#]+)@([0-9a-f]{7,40})$/i);
  if (commit) return { repo: commit[1], owner: commit[1].split('/')[0], name: commit[1].split('/')[1], pull: null, commit: commit[2] };
  if (/^[^/]+\/[^/]+$/.test(source)) {
    const [owner, name] = source.split('/');
    return { repo: source, owner, name, pull: null, commit: null };
  }
  if (report?.owner && report?.repo) {
    return {
      repo: `${report.owner}/${report.repo}`,
      owner: report.owner,
      name: report.repo,
      pull: report.pull || null,
      commit: report.head || null,
    };
  }
  return null;
}

export function githubFindingUrl(report, finding) {
  const parsed = parseReportRepo(report);
  if (!parsed?.owner || !parsed?.name) return null;
  const { owner, name, pull } = parsed;
  const path = finding?.path || '';
  const line = finding?.line ? Number(finding.line) : null;
  const sha = finding?.commit || parsed.commit || report?.head || null;

  if (!path || path === 'commit-message' || path === 'commit' || path === 'pull-request') {
    if (sha) return `https://github.com/${owner}/${name}/commit/${sha}`;
    if (pull) return `https://github.com/${owner}/${name}/pull/${pull}`;
    return `https://github.com/${owner}/${name}`;
  }

  if (sha) {
    const base = `https://github.com/${owner}/${name}/blob/${sha}/${encodePath(path)}`;
    return line ? `${base}#L${line}` : base;
  }

  if (pull) {
    // PR files tab — best fallback when we lack a head SHA.
    return `https://github.com/${owner}/${name}/pull/${pull}/files`;
  }

  const base = `https://github.com/${owner}/${name}/blob/HEAD/${encodePath(path)}`;
  return line ? `${base}#L${line}` : base;
}
