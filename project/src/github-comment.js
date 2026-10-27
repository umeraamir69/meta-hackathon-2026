#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const marker = '<!-- pr-diff-sentinel -->';

export async function upsertPullRequestComment({ token, repo, pr, body, fetchImpl }) {
  if (!token || !repo || !pr || !body) return { posted: false };
  const fetchFn = fetchImpl || globalThis.fetch;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'pr-diff-sentinel',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const full = `${marker}\n${body}`.slice(0, 65000);
  const listUrl = `https://api.github.com/repos/${repo}/issues/${pr}/comments?per_page=100`;
  const listed = await fetchFn(listUrl, { headers });
  if (!listed.ok) return { posted: false, status: listed.status };
  const comments = await listed.json();
  const existing = Array.isArray(comments) ? comments.find((comment) => String(comment.body || '').includes(marker)) : null;
  const response = existing
    ? await fetchFn(`https://api.github.com/repos/${repo}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body: full }),
    })
    : await fetchFn(`https://api.github.com/repos/${repo}/issues/${pr}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: full }),
    });
  return { posted: response.ok, status: response.status, updated: Boolean(existing) };
}

function pullRequestNumber() {
  if (!process.env.GITHUB_EVENT_PATH) return '';
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    return String(event.pull_request?.number || event.issue?.number || '');
  } catch {
    return '';
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) return;
  let report;
  try {
    report = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    process.stderr.write('PR Diff Sentinel could not read the report for the pull request comment.\n');
    return;
  }
  const body = report.muse?.comment;
  if (!body) return;
  const result = await upsertPullRequestComment({
    token: process.env.SENTINEL_GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPOSITORY || '',
    pr: pullRequestNumber(),
    body,
  });
  if (!result.posted && process.env.SENTINEL_GITHUB_TOKEN) {
    process.stderr.write('PR Diff Sentinel could not update the pull request comment.\n');
  }
}

const entry = process.argv[1] || '';
if (entry.endsWith('github-comment.js')) {
  main().catch(() => {
    process.stderr.write('PR Diff Sentinel skipped the pull request comment.\n');
  });
}
