#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReport } from './cli.js';
import { writeDemoRepo } from './demo-repo.js';
import { renderReport } from './report-html.js';

const root = process.argv[2] || writeDemoRepo(mkdtempSync(join(tmpdir(), 'sentinel-demo-')));
const port = Number(process.env.SENTINEL_PORT || 4317);

const server = createServer(async (_request, response) => {
  try {
    const report = await collectReport(root);
    const html = renderReport(report);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    });
    response.end(html);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('PR Diff Sentinel could not scan this path.\n');
    process.stderr.write(`${error.message || 'scan failed'}\n`);
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`PR Diff Sentinel  http://127.0.0.1:${port}\n`);
  process.stdout.write(`Scanning ${root}\n`);
});
