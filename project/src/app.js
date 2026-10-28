#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReport } from './cli.js';
import { loadEnvFile } from './env.js';
import { writeDemoRepo } from './demo-repo.js';
import { parseGitHubUrl, withGitHubCheckout } from './github-target.js';
import { renderReport } from './report-html.js';

loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const port = Number(process.env.SENTINEL_PORT || 4317);
const state = { report: null, url: '', error: '', source: '', busy: false };

function send(response, status, html, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'",
    ...headers,
  });
  response.end(html);
}

function page() {
  return renderReport(state.report, { url: state.url, error: state.error, source: state.source });
}

function redirect(response) {
  send(response, 303, '', { Location: '/' });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8192) {
        request.destroy();
        reject(new Error('That request was too large.'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function scanGitHub(target) {
  state.busy = true;
  state.error = '';
  state.url = `https://github.com/${target.owner}/${target.repo}${target.pull ? `/pull/${target.pull}` : ''}`;
  try {
    await withGitHubCheckout(target, async ({ dir, base, head }) => {
      const env = { ...process.env, SENTINEL_BASE: base, SENTINEL_HEAD: head };
      state.report = await collectReport(dir, env);
      const diffNote = target.pull && !base ? ' Pull request diff was unavailable, so this is the head checkout and its history.' : '';
      state.source = `${target.label}${diffNote}`;
    });
  } catch (error) {
    state.report = null;
    state.source = '';
    state.error = error.message || 'The scan failed.';
  } finally {
    state.busy = false;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
    if (request.method === 'GET' && url.pathname === '/') {
      send(response, 200, page());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/demo') {
      if (state.busy) {
        state.error = 'A scan is already running.';
        redirect(response);
        return;
      }
      state.busy = true;
      state.error = '';
      state.url = '';
      const dir = writeDemoRepo(mkdtempSync(join(tmpdir(), 'sentinel-demo-')));
      try {
        state.report = await collectReport(dir);
        state.source = 'built-in demo';
      } catch {
        state.report = null;
        state.source = '';
        state.error = 'The built-in demo could not be scanned.';
      } finally {
        state.busy = false;
        rmSync(dir, { recursive: true, force: true });
      }
      redirect(response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/scan') {
      if (state.busy) {
        state.error = 'A scan is already running.';
        redirect(response);
        return;
      }
      const submitted = new URLSearchParams(await readBody(request)).get('url') || '';
      state.url = submitted.trim();
      const target = parseGitHubUrl(submitted);
      if (!target) {
        state.report = null;
        state.source = '';
        state.error = 'Use a public https://github.com/owner/repo link, or a pull request link.';
        redirect(response);
        return;
      }
      await scanGitHub(target);
      redirect(response);
      return;
    }
    send(response, 404, 'Not found\n');
  } catch (error) {
    state.busy = false;
    state.error = error.message || 'The scan failed.';
    send(response, 500, page());
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`PR Diff Sentinel  http://127.0.0.1:${port}\n`);
});
