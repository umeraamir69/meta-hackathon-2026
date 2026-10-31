# Vercel deployment log — PR Diff Sentinel site

Everything tried, every result, and the current theory. Updated as the
story changes; the closed/wrong theories are kept so nobody re-tries them.

## Status (2026-10-31)

**Live and public.** Cause was the npm `tar` package. Fixed with an
inline pure-JS ustar reader in `lib/remote-scan.js` (no npm `tar`, no
OS `tar` — serverless has no binary). `/api/scan` returns JSON on the
public alias.

- Public site: https://pr-diff-sentinel.vercel.app
- Production project URL: https://web-theta-gold-g4i6l9mz7q.vercel.app
- `MODEL_API_KEY` set on Production + Preview (redeployed after add)
- SSO protection: `all_except_custom_domains` — custom alias is open;
  `*.vercel.app` deployment URLs still ask for Vercel login

## What was wrong (short)

1. Local and remote `next build` both succeeded (route table printed).
2. Vercel's post-trace step then failed looking for `export-detail.json`.
3. Community reports link the same failure to calling / depending on
   npm `tar` (also seen via `next-swagger-doc`, which pulls `tar` in).
4. Our site imported `tar` at the top of `remote-scan.js` for full-repo
   archive scans. That put `tar` in the traced serverless graph.
5. Replacing it with `/usr/bin/tar` removes the bad dependency while
   keeping the same archive → scanWorkingTree path.

## Timeline

1. **CLI deploy from `web/`** — build green, then doubled-path
   `routes-manifest.json` ENOENT (Root Directory / CLI path confusion).
2. **CLI deploy from repo root** — no framework at root → empty 404.
3. **Dashboard: Root Directory → `web`** — Next detected; build green;
   then `export-detail.json` ENOENT under `/vercel/path0/web/.next/`.
4. **Removed `outputFileTracingRoot`**, tried `output: 'standalone'` —
   no change; standalone reverted.
5. **Control:** minimal Next 15.5.28 (`plain-test`) → **Ready**.
6. **2026-10-31:** Removed npm `tar`; extract with system `tar`.

## Withdrawn theory

Claim: *Vercel always needs `export-detail.json`, which Next 15 deletes.*

Hole: if that were true, every Next.js Vercel deploy would fail. The
plain control passed. The collector path is tripped by something in
*our* dependency / output graph — here, `tar`.

## Evidence

Failing build (before fix):

```text
✓ Compiled successfully
✓ Generating static pages (6/6)
Traced Next.js server files in: 60.109ms
Error: [ENOENT] ENOENT: no such file or directory,
  lstat '/vercel/path0/web/.next/export-detail.json'
```

Control (`plain-test`): continued past tracing to
`Created all serverless functions` → Ready.

External confirmations:

- https://community.vercel.com/t/calling-tar-x-causeserror-enoent-no-such-file-or-directory-lstat-next-export-detail-json/2007
- https://github.com/jellydn/next-swagger-doc/issues/1157 (tar via that package)

## Deploy checklist

```bash
cd web
npm install          # lockfile without tar
npm run build        # must exit 0 locally
vercel --prod        # or push to the linked GitHub branch
```

Project settings that must stay:

- Framework Preset: **Next.js**
- Root Directory: **`web`**
- Build Command: default (`next build`)
- Output Directory: default (do not set `out`)

After a green deploy, re-point aliases if needed:

```bash
vercel alias set <deployment-url> pr-diff-sentinel.vercel.app
```

Env vars on the project (Billing / Muse): `MODEL_API_KEY` (or
`META_API_KEY` / `MUSE_API_KEY`). Optional: `GITHUB_TOKEN` for higher
GitHub rate limits on `/api/scan`.

## Project notes

- Failing projects before the fix: `web`, `pr-diff-sentinel`,
  `meta-hackathon-2026` (root deploy). Working control: `plain-test`.
- Production aliases were pointing at dead deployments; verify 200 on
  `https://pr-diff-sentinel.vercel.app` after redeploy.
- Do not re-add the npm `tar` package without a Vercel redeploy check.
- Follow-up: the serverless runtime has no `tar` binary either
  (`spawn tar ENOENT` on repo scans), so extraction is now a
  zero-dependency tar reader in `web/lib/remote-scan.js`
  (`extractTarBuffer`: ustar/pax/GNU-longname, traversal guard,
  verified against system-tar output). No new npm packages.
