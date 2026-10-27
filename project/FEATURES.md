# PR Diff Sentinel — feature inventory

Deterministic merge gate for secrets in the working tree, the PR diff, and git history.
Muse triages after a failure. Muse never decides pass/fail.

## The gate (no LLM)

- Working-tree scan, staged scan, three-dot PR-diff scan, full-history scan
  (added lines, removed lines, commit messages).
- Fails closed on shallow clones (`fetch-depth: 0` required) and on git errors.
- Decoded scan (base64 and friends) and composite secrets (id + secret pairs).
- Allowlist (`.sentinelignore`): `path <glob>`, `rule <id>`, `<rule> <glob>`.
- Masked output everywhere; configured secrets redacted before logging.
- Tree-presence marking: a history hit with `presentInTree=false` is the core
  incident — deleted from files, still recoverable from git.

## How Muse is used (every call)

At most **two** model calls per scan, both after the gate has already failed:

| # | Model | Trigger | Input | Output |
|---|-------|---------|-------|--------|
| 1 | Muse Spark (`muse-spark-1.3`) | Always when a key is set | Masked findings, one block per unique hit | `likely_live` / `likely_example` / `likely_fixture` / `unclear` + why, per hit |
| 2 | Muse Wonder (`muse-wonder-1.0`) | Only when a hit is `likely_live` or `unclear` | Masked focus findings + blast radius + purge guidance | Summary, ordered rotate runbook, `why_live` verdict, redacted `fix` patch, `.sentinelignore` candidates |

What each Muse output becomes:

- **Labels** → findings table in the PR comment, the report page, and the triage order.
- **Blast radius** (deterministic, fed to the prompt and shown always): every commit,
  file, and author carrying the same secret value, plus whether it is gone from
  current files. Computed from hashes, never raw values.
- **why_live** → one grounded sentence per rotate item.
- **fix** → redacted before/after patch (`before` keeps the mask, `after` reads
  from env / secret manager). Omitted for history-only hits. Rendered as a diff
  block in the PR comment and the report page.
- **Rotate runbook** → revoke → contain → prevent, with per-provider hints and a
  `git filter-repo` purge command for history hits.
- **ignore** → `.sentinelignore` candidates, only for example/fixture hits, in
  narrow `<rule> <path>` form. Live and unclear hits never get one.

## Efficiency design (why the model bill stays tiny)

1. Two calls maximum per scan, batched — never one call per finding.
2. Wonder is skipped entirely when every hit is an example or fixture.
3. Identical hits share one prompt block with every location listed
   (`occurrences=N`), so a repeated secret costs one block instead of N.
4. Findings cap (`SENTINEL_MUSE_MAX_FINDINGS`, default 25) with a disclosure
   note in the output when it bites. The local checklist always covers everything.
5. `reasoning: { effort: 'minimal' }` on both calls, with a plain retry on 400.
6. Pre-commit hook runs with Muse off by default: fast and offline.
7. Every response is validated (JSON shape, length caps) and scanned for
   credential echoes; anything suspicious falls back to local output.

## Surfaces

| Surface | Entry | Notes |
|---------|-------|-------|
| CLI | `node src/cli.js [root] [--staged] [--sarif]` | Exit 1 = gate failed. `--sarif` for code-scanning upload |
| GitHub Action | `project/action.yml` + root workflow | Fails the check, updates one PR comment, needs `fetch-depth: 0` |
| Pre-commit hook | `node scripts/install-hook.mjs /path/to/repo` | Same gate on every commit, Muse off unless `SENTINEL_MUSE=true` |
| Local report app | `node src/app.js` → http://127.0.0.1:4317 | Paste a repo/PR link or run the built-in demo |
| Next.js site | `web/` → Vercel, root `web` | `POST /api/scan` for public repos/PRs via the GitHub API |
| Chrome extension | `extension/` (unpacked MV3) | Scans the open GitHub tab through the site's `/api/scan` |

## Demos and tests

```bash
cd project
node --test test/*.test.js   # 72 tests: gate, diff, allowlist, Muse + fallback, hook, self-scan
node scripts/demo-history.mjs # history fail: removed live key + doc example, both block merge
SENTINEL_MUSE=false node src/cli.js fixtures/leaky-repo
```

The self-scan test scans this repo with its own gate: the tree must be clean
after the allowlist, so no test may contain a literal secret.

## Environment knobs

| Variable | Default | Meaning |
|----------|---------|---------|
| `MODEL_API_KEY` (or `META_API_KEY`, `MUSE_API_KEY`) | — | Meta Model API key. Without one, labels and checklists are local |
| `SENTINEL_MUSE` | `true` | `false` forces the local fallback |
| `SENTINEL_MODEL` | `muse-wonder-1.0` | Explainer model. `*-contributor` ids are refused |
| `SENTINEL_CLASSIFIER` | `muse-spark-1.3` | Labeling model. `*-contributor` ids are refused |
| `SENTINEL_MUSE_TIMEOUT_MS` | `20000` | Per-call timeout |
| `SENTINEL_MUSE_MAX_FINDINGS` | `25` | Max findings sent to Muse per call |
| `SENTINEL_HISTORY` | `true` | `false` skips the history scan |
| `SENTINEL_MAX_COMMITS` | `200` | History depth bound (max 5000) |
| `SENTINEL_STAGED` | — | `true` scans only the staged diff |
| `SENTINEL_BASE` / `SENTINEL_HEAD` | — | PR-diff scan range |

## Docs

- `README.md` — run it, hook it, Action it.
- `../SUBMISSION.md` — hackathon submission draft.
- `../DEMO_SCRIPT.md` — 3-minute demo video script.
- `PLAN.md` — build plan and remaining checklist.
