# AI-authorship detection — build log

Complete record of the agent-PR detection feature: what was built, how,
and how to run everything. Design rationale lives in
[AI_SIGNALS.md](AI_SIGNALS.md); this file is the implementation chronicle.

## 1. What it does

PR Diff Sentinel flags pull requests that look agent-authored, as
**advisory-only** findings (never blocks the gate by default):

- **Layer 1 — deterministic signals** (`src/ai.js`): self-declared
  authorship only. Agent-named bot authors (`copilot[bot]`,
  `devin-ai-integration[bot]`, …), assistant names in authors
  (`Claude`, `Codex`, `Cursor`, …), agent branch prefixes
  (`copilot/…`, `cursor/…`, `aider-…`, …), `Co-Authored-By` trailers
  and "generated with" banners in PR/commit messages, and agent
  artifact paths (`.cursor/`, `.codex/`, …). CI/dependency bots
  (`dependabot`, `github-actions`, `renovate`, …) are explicitly
  excluded.
- **Layer 2 — Muse verdicts** (`src/muse.js`, `assessAiSignals`):
  when Layer 1 fires, Muse Spark reads the cited signals and returns
  `likely_agent` / `likely_human` / `mixed` / `unclear` with reasons;
  Muse Wonder writes the review note. `unclear` abstention is a
  first-class outcome. No key → Layer 1 only.
- **Strict mode (opt-in)**: `SENTINEL_AI_STRICT=true` or a comma rule
  list (`ai_author,ai_trailer`) converts matching advisory findings to
  blocking. Single conversion point in `collectReport` (+ hosted scan).
- **Surfaces**: CLI exit counts + `advisory` line, HTML report,
  PR comment, SARIF/annotations, hosted web scan, Chrome extension
  popup (signal list + verdict line).

## 2. How it was built (phases)

### Phase 1 — Layer-1 signals + bot precision

- Built `src/ai.js` (`isAiAuthor`, `isAiPath`,
  `aiBranchDescriptor`, `scanAiContent`, `scanAiMessage`), wired into
  `src/scan.js` and the CLI.
- Bug: `isAiAuthor` fired on any `[bot]` → narrowed to agent-named
  bots + assistant names; live Dependabot PR went 2 → 0 advisory.
- Bug: `Co-Authored-By:` in *file content* false-fired on docs →
  trailers only match in message mode.
- Tests in `test/ai.test.js`.

### Phase 2 — Muse verdicts + key plumbing

- Added `assessAiSignals` using the real `muse.js` helpers
  (`postResponses`, `extractOutputText`, `usageOf`); fixed an early
  mock mismatch against custom wrappers.
- Bug: `.env` keys invisible to CLI/app/`collectReport` → target-aware
  `loadEnvFile(path, target)`, loaded before env-copy in `run()` and
  `app.js` startup. Keyed triage fell back to local before this fix.
- Live n=8 eval: 6/6 agent PRs → `likely_agent`, 2/2 human PRs
  silent (conditional GO, recorded in `AI_SIGNALS.md` §5.4 and
  `eval/results/ai-signals-2026-10-28.json`).

### Phase 3 — strict mode + demo

- Rule-scoped strict (`SENTINEL_AI_STRICT`, Action input
  `ai_strict`), demo-script encore (bot PR → advisory → strict
  block), extension popup verdict line + harness assertion.
- Full verification: 92/92 tests, self-scan clean, web build green,
  sentinel sync check, `node --check extension/popup.js`.

### Phase 4 — full 400-PR eval (this run)

- `eval/sample-aidev.mjs`: 200 agent PRs from AIDev (`hao-li/AIDev`,
  `pull_request` config, stratified offsets, seed 20261028).
  Mix: Claude Code 116, Copilot 56, Codex 19, Devin 9; 169 repos.
- `eval/sample-humans-gh.mjs`: 200 human PRs via GitHub API (recent
  merged PRs from ~40 repos, bots + agent branches/trailers
  excluded). AIDev's `all_pull_request` table was unusable over the
  rows API (repeated scan-limit 500s), hence the GitHub route.
- `eval/ai-signals.mjs --write --file prs-full.json`: the run.
  Needs `GITHUB_TOKEN` (~4,400 calls) + `MODEL_API_KEY`.

## 3. Files

| Area | Files |
|------|-------|
| Signals | `project/src/ai.js`, `project/src/scan.js` |
| Verdicts | `project/src/muse.js`, `project/src/comment.js` |
| Wiring | `project/src/cli.js`, `project/src/app.js`, `project/src/env.js`, `project/src/report-html.js`, `project/src/annotate.js`, `project/action.yml` |
| Web | `web/lib/remote-scan.js`, `web/lib/sentinel/ai.js` (vendored), `web/components/scanner.js`, `web/app/page.js`, `web/scripts/sync-sentinel.mjs` |
| Extension | `extension/popup.js`, `extension/popup.css`, `extension/popup.html` |
| Tests/eval | `project/test/ai.test.js`, `project/eval/ai-signals.mjs`, `project/eval/sample-aidev.mjs`, `project/eval/sample-humans-gh.mjs`, `project/eval/prs*.json`, `project/eval/results/` |
| Docs | `project/AI_SIGNALS.md` (design), this file (chronicle), `project/README.md`, `DEMO_SCRIPT.md` |

## 4. How to run

```bash
cd project
node --test test/*.test.js            # 92 tests
node src/cli.js .                     # self-scan (SENTINEL_MUSE=false for local-only)

# eval harness (curated 8-PR list)
node eval/ai-signals.mjs --write

# full eval (400-PR list; needs GITHUB_TOKEN + MODEL_API_KEY in .env)
node eval/sample-aidev.mjs --agents 200 --humans 0 --seed 20261028
node eval/sample-humans-gh.mjs --humans 200
node eval/ai-signals.mjs --write --file prs-full.json
```

Web: `cd web && npm run build`, `node scripts/sync-sentinel.mjs --check`.
Extension: `node --check extension/popup.js` + popup harness.

## 5. Results

- n=8 (2026-10-28): 6/6 agent `likely_agent`, 2/2 human silent —
  conditional GO (`eval/results/ai-signals-2026-10-28.json`).
- n=400 (2026-10-29): GO. Agent recall 97.0% (193/199),
  0 false verdicts on 165 clean humans, 7 safe abstentions.
  27 "human" rows were AI-declared (label noise), 1 AIDev label
  was human (correctly silent), 8 gray description-level rows.
  One genuine bug (unchecked template boilerplate) fixed and
  verified. Full audit in `AI_SIGNALS.md` §10.

## 6. Standing rules

- Advisory-only; strict is strictly opt-in.
- Deterministic gate never guesses authorship from writing style.
- Commit + push after each task.
- npm `pr-diff-sentinel` stays private; user deploys `web/` to Vercel.
