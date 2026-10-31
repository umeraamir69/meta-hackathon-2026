# Vercel deployment log — PR Diff Sentinel site

Everything tried, every result, and the current theory. Updated as the
story changes; the closed/wrong theories are kept (struck through in
prose, not deleted) so nobody re-tries them.

## Status (2026-10-31)

**Not live.** All `web`-project deployments fail at output collection
with `ENOENT: lstat '/vercel/path0/web/.next/export-detail.json'`,
after a fully green `next build` (route table prints, 6/6 static
pages). A plain `create-next-app`-equivalent on Next 15.5.28 deploys
**Ready** on the same account — so the cause is in our repo, not the
platform. (An earlier "Vercel platform bug" theory is withdrawn below.)

## Timeline

1. **CLI deploy from `web/`** — build green locally and remotely,
   then `ENOENT ... /vercel/path0/path0/.next/routes-manifest.json`
   (doubled path). Repeated 5×, same result.
2. **CLI deploy from repo root** — remote builder found no framework
   (`no package.json` at root): empty 404 deployment. Root cause of
   *that* attempt: project Root Directory was `.`/unset.
3. **Dashboard: Root Directory → `web`, GitHub connected.**
   Git-triggered builds now detect Next 15.5.28 and compile clean —
   then fail on `export-detail.json` (correct path this time:
   `/vercel/path0/web/.next/`).
4. **Removed `outputFileTracingRoot`** (pointed at repo root; nothing
   outside `web/` is imported) — no change, still fails.
5. **`output: 'standalone'` experiment** — same failure; reverted
   (commit `b816bb5`). The collector lookup is unconditional.
6. **Control experiment (decisive):** minimal Next 15.5.28 app
   (`plain-test` project) → **● Ready**, full pipeline
   (`Traced → Created all serverless functions → Collected static
   files → Build Completed`). Same account, same builder version.

## The withdrawn theory

Claim was: *Vercel demands `export-detail.json`, which Next 15's
`next build` deletes (`unlink(...EXPORT_DETAIL)` every build; only
`next/dist/export` writes it, i.e. static-export mode only) — so no
server-mode app could ever deploy.*

Hole (raised by external review, confirmed by experiment 6): if the
collector needed that file on every build, **all** Next.js Vercel
deploys would fail. They don't. The plain control passes, so the
lookup must be conditional on something our app does — or our build
output differs in a way that sends the collector down the wrong path.

## Evidence in hand

Our failing build (e.g. `pr-diff-sentinel-2zfaaj9d5`, 2026-10-31):

```text
✓ Compiled successfully in 6.8s
✓ Generating static pages (6/6)
Traced Next.js server files in: 60.109ms
Error: [ENOENT] ENOENT: no such file or directory,
  lstat '/vercel/path0/web/.next/export-detail.json'
```

Control build (`plain-test-59yg6txww`, same day, same versions):

```text
Traced Next.js server files in: 52.476ms
Created all serverless functions in: 116.215ms
Collected static files (public/, static/, .next/static): 2.165ms
Build Completed in /vercel/output [21s]
status ● Ready
```

Divergence point: immediately after tracing. Ours stats a legacy
manifest; the control proceeds to function creation. Something in our
app/output selects the legacy path.

## Suspects (what differs from the control)

- `app/api/scan/route.js`: `export const maxDuration = 60` (+
  `runtime = 'nodejs'`) and a top-level `import { extract } from
  'tar'` chain (`remote-scan.js` imports `tar`, `zlib`, fs). Only
  executed at request time (tmpdir extraction, never `.next`) — but
  it IS in the traced module graph. A build-time side effect here
  (or the tracing of native/binary deps) is suspect #1.
- 4 routes incl. a dynamic API route vs the control's single static
  page. Bisect candidate: deploy with `/api/scan` stubbed out.
- `next.config.mjs` is now bare (`devIndicators: false` only).
- `web/vercel.json` (`{"framework":"nextjs"}`) was removed and
  restored during testing with no effect.

Ruled out: Root Directory (now `web`, paths resolve correctly),
`outputFileTracingRoot` (removed, no change), `output: 'standalone'`
(no change, reverted), CLI-upload path doubling (git builds fail
identically), project state (fresh projects fail identically).

## Next steps

1. Reproduce the collector step locally (`vercel build` with a
   writable HOME — the sandbox blocks the default cache dir) for a
   fast bisect loop without pushing.
2. Bisect: stub `/api/scan` (drop the `tar` chain) → deploy; then
   `maxDuration`; then routes one by one.
3. If a trigger is found, fix forward (lazy-load `tar`, move the
   heavy route, etc.).
4. If no trigger is found after bisection, file a Vercel support
   ticket with: failing vs control deployment URLs, Next 15.5.28,
   "diverges right after tracing" — the control experiment makes
   the ticket actionable.

## Project notes

- Failing projects: `web`, `pr-diff-sentinel`, `meta-hackathon-2026`
  (empty 404 from a root deploy). Working control: `plain-test`.
- Production aliases currently point at dead/empty deployments:
  `pr-diff-sentinel.vercel.app` → 404 `DEPLOYMENT_NOT_FOUND`;
  `meta-hackathon-2026.vercel.app` → 404. Re-point after a green
  build (`vercel alias set <deployment> <domain>`).
- `SUBMISSION.md` still lists `https://pr-diff-sentinel.vercel.app`;
  verify 200 before the deadline.
