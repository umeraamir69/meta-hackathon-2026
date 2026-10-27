import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl } from '../src/github-target.js';
import { renderReport } from '../src/report-html.js';

test('accepts a repository link and a pull request link', () => {
  const repo = parseGitHubUrl('https://github.com/umeraamir69/meta-hackathon-2026');
  assert.equal(repo.owner, 'umeraamir69');
  assert.equal(repo.repo, 'meta-hackathon-2026');
  assert.equal(repo.pull, null);
  assert.equal(repo.cloneUrl, 'https://github.com/umeraamir69/meta-hackathon-2026.git');

  const pull = parseGitHubUrl('github.com/octocat/Hello-World/pull/12/files');
  assert.equal(pull.pull, '12');
  assert.equal(pull.label, 'octocat/Hello-World#12');

  const tree = parseGitHubUrl('https://www.github.com/octocat/Hello-World.git');
  assert.equal(tree.repo, 'Hello-World');
  assert.equal(tree.pull, null);
});

test('rejects hosts and links that are not a public GitHub repo', () => {
  assert.equal(parseGitHubUrl('https://gitlab.com/owner/repo'), null);
  assert.equal(parseGitHubUrl('http://github.com/owner/repo'), null);
  assert.equal(parseGitHubUrl('https://user:token@github.com/owner/repo'), null);
  assert.equal(parseGitHubUrl('https://github.com/owner'), null);
  assert.equal(parseGitHubUrl('https://github.com/owner/repo/issues/1'), null);
  assert.equal(parseGitHubUrl(''), null);
});

test('the empty page is a scan form and escapes errors', () => {
  const html = renderReport(null, { url: 'https://github.com/owner/repo', error: '<bad>' });
  assert.match(html, /action="\/scan"/);
  assert.match(html, /name="url"/);
  assert.match(html, /value="https:\/\/github.com\/owner\/repo"/);
  assert.match(html, /&lt;bad&gt;/);
  assert.equal(html.includes('<bad>'), false);
  assert.equal(html.includes('>Fail<'), false);
});
