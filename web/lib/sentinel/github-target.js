import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NAME = /^[A-Za-z0-9_.-]+$/;

export function parseGitHubUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed || trimmed.length > 300) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!NAME.test(owner) || !NAME.test(repo)) return null;
  let pull = null;
  let commit = null;
  if (parts[2] === 'pull' || parts[2] === 'pulls') {
    if (!/^\d{1,10}$/.test(parts[3] || '')) return null;
    pull = parts[3];
  } else if (parts[2] === 'commit' || parts[2] === 'commits') {
    if (!/^[0-9a-f]{7,40}$/i.test(parts[3] || '')) return null;
    commit = parts[3].toLowerCase();
  } else if (parts.length > 2 && parts[2] !== 'tree' && parts[2] !== 'blob') {
    return null;
  }
  return {
    owner,
    repo,
    pull,
    commit,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    label: pull ? `${owner}/${repo}#${pull}` : commit ? `${owner}/${repo}@${commit.slice(0, 7)}` : `${owner}/${repo}`,
  };
}

function git(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd,
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
    }, (error, stdout, stderr) => {
      if (error) {
        const failure = new Error(String(stderr || error.message || 'git failed').slice(0, 500));
        failure.timedOut = error.killed && error.signal === 'SIGTERM';
        reject(failure);
        return;
      }
      resolve(String(stdout).trim());
    });
  });
}

async function clone(target, dir) {
  const args = ['clone', '--no-tags', target.cloneUrl, dir];
  try {
    await git(['clone', '--filter=blob:none', '--no-tags', target.cloneUrl, dir]);
  } catch {
    await rm(dir, { recursive: true, force: true });
    await git(args);
  }
}

export async function withGitHubCheckout(target, run) {
  const parent = await mkdtemp(join(tmpdir(), 'sentinel-scan-'));
  const dir = join(parent, 'repo');
  try {
    let base = '';
    let head = '';
    try {
      await clone(target, dir);
      if (target.pull) {
        try {
          await git(['fetch', 'origin', `pull/${target.pull}/merge:refs/sentinel/merge`], dir);
          base = await git(['rev-parse', 'refs/sentinel/merge^1'], dir);
          head = await git(['rev-parse', 'refs/sentinel/merge^2'], dir);
        } catch {
          await git(['fetch', 'origin', `pull/${target.pull}/head:refs/sentinel/head`], dir);
          head = await git(['rev-parse', 'refs/sentinel/head'], dir);
        }
        await git(['checkout', '--detach', head], dir);
      } else if (target.commit) {
        try {
          await git(['fetch', 'origin', target.commit], dir);
          head = await git(['rev-parse', 'FETCH_HEAD'], dir);
        } catch {
          throw new Error('Could not fetch that commit. It has to be a public GitHub commit on the default history.');
        }
        await git(['checkout', '--detach', head], dir);
      }
    } catch (error) {
      if (error.timedOut) throw new Error('The clone took too long. Try a smaller public repository.');
      if (target.pull) throw new Error('Could not fetch that pull request. It has to be a public GitHub pull request.');
      throw new Error('Could not clone that repository. It has to be a public GitHub repository.');
    }
    return await run({ dir, base, head });
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}
