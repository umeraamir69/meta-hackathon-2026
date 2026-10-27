# Sentinel site

Next.js app for the hosted scan. Paste a public repo or pull request link; the server reads the diff and recent commits through the GitHub API. Full history stays on the local gate.

## Run

```bash
cd web
npm install
npm run dev
```

Open http://127.0.0.1:3000.

## Deploy (Vercel)

1. Import `umeraamir69/meta-hackathon-2026` in Vercel.
2. Set the Root Directory to `web`.
3. Optional env: `GITHUB_TOKEN` (raises the GitHub rate limit), `MODEL_API_KEY` (Muse labels; without it they stay local).
4. Deploy. The scan endpoint is `POST /api/scan` with `{ "url": "https://github.com/owner/repo/pull/123" }`.

The scanner core is vendored into `web/lib/sentinel/` (Vercel only uploads the
root directory, so a `../project` import cannot resolve there). After changing
anything in `project/src`, re-run the sync from `web/`:

```bash
node scripts/sync-sentinel.mjs
```

CI fails when the vendored copy drifts (`--check`). Nothing else to configure
beyond the root directory.
