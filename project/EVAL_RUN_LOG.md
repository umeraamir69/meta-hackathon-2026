# Full eval — run log

Every request and its output for the 400-PR eval run (2026-10-28).
Secrets are never recorded here. See [AI_BUILD_LOG.md](AI_BUILD_LOG.md)
for the feature chronicle and [AI_SIGNALS.md](AI_SIGNALS.md) §10 for
analysis and go/no-go.

## 1. Dataset probing

Request:

```bash
node -e "fetch('https://datasets-server.huggingface.co/info?dataset=mabujadallah/GitHub-Agentic-PR-Dataset')…"
```

Output: dataset reachable, 1,959,649 rows — but the `rows` endpoint
returned HTTP 500 (`Scan size limit exceeded`). Unusable. Rejected.

Request: web search for AIDev download location.

Output: AIDev at `hao-li/AIDev` (HuggingFace) + Zenodo; configs
`pull_request` (361,296 rows) and `all_pull_request` (7,685,281 rows),
both with an `agent` label column.

Request:

```bash
node -e "fetch('https://datasets-server.huggingface.co/rows?dataset=hao-li/AIDev&config=pull_request…')…"
```

Output: HTTP 200, rows carry `agent` + `html_url`. Sampling route
confirmed. (The `/sql` endpoint 404'd — sampling via `rows` only.)

## 2. Sampler v1 (AIDev both classes) — failed on humans

Request: `node eval/sample-aidev.mjs --agents 200 --humans 200 --seed 20261028`

Output: agents 200/200 in 20 chunks (169 repos; Claude Code 116,
Copilot 56, Codex 19, Devin 9). Humans: `all_pull_request` chunks
failed repeatedly (HTTP 500 scan-limit, then 429s, then fetch
failures); run killed after ~120 tries with no usable human rows.
Also fixed along the way: 429 backoff, fast-fail on 500s, bounded
try counter (first version could loop forever on skips).

## 3. Split sampling — success

Request: `node eval/sample-aidev.mjs --agents 200 --humans 0 --seed 20261028`

Hiccup: `--humans 0` parsed as 200 (`Number('0') || fallback` bug).
Fixed to `Number.isFinite` check, reran.

Output:

```text
agents: 200/200 in 20 chunks, repos: 169 mix: {"OpenAI_Codex":19,"Claude_Code":116,"Devin":9,"Copilot":56}
wrote project/eval/prs-full.json (200 entries, seed 20261028)
```

Request: `node eval/sample-humans-gh.mjs --humans 200`

Output: 202 keepers from 44 repos (3 repos 404'd as listed:
`postgres/postgres`, `torvalds/linux`, `kubernetes/kubectl`;
`golang/go`, `git/git`, `vim/vim` yielded 0 under the bot/agent
filters; spares topped up). Merged file: 402 entries, trimmed to
exactly 200/class (400 total).

## 4. Keys

- `MODEL_API_KEY`: already present in `project/.env` (len 48).
- `GITHUB_TOKEN`: user-provided, stored in `project/.env`
  (gitignored, verified). Rate budget: 5000/hr (was 60 anonymous).

## 5. Eval run

Request: `node eval/ai-signals.mjs --write --file prs-full.json`

Output: in progress (this file records the tally on completion).
Early rows: agents mostly `CORRECT … likely_agent` with regular
`ABSTAIN … unclear`; a few `ERROR … fetch failed` (transient) and
one `not public` (repo went private) — retry pass planned for the
transient failures.

## 6. Pass 1 killed by GitHub 503s (root-caused)

269/400 rows completed, then the run was stopped: 89 rows errored
with `GitHub returned 503` (plus 6 `fetch failed`, 1×500,
2×not-public, 1 genuine recall miss on
`tektoncd/pipelines-as-code#2326` — no Layer-1 signals).

Root cause (ours, not GitHub's — status page: all operational):
`web/lib/remote-scan.js` fired ~11 API calls per PR back-to-back
with **zero pacing, zero Retry-After handling, zero retries** —
a textbook trigger for GitHub's secondary/abuse limits, which
answer 503/429.

Fix:

- `github()` now retries 429/500/502/503 + abuse-limit 403s (max 5
  attempts), honoring `Retry-After`, else exponential backoff
  1s→30s. Verified by throwaway probe (`/tmp/retry-probe.mjs`):
  503, 503, 200 → 3 calls, ~2s waits, scan completes.
- Harness paces PRs 1s apart (eval-only; product UX untouched).

## 7. Commits this session

- `7b65b8b` eval: AIDev + GitHub samplers and full-eval plan note
- `5e3dc15` docs: complete AI build log; eval list 400 PRs; sampler flag fix
- (this log + results commit on eval completion)
