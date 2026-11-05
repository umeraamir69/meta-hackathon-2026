# Mini-eval protocol — PR Diff Sentinel

**Status:** RQ1–RQ3 core complete (2026-11-05). See [`DOCUMENTATION.md`](./DOCUMENTATION.md) + [`results.md`](./results.md).  
**Ethics:** All secrets are **synthetic / documentation-shaped**. Never commit live credentials. Paper tables use rule id + path + SHA-256 fingerprint only.  
**API key:** Loaded from `project/.env` (`MODEL_API_KEY`). Scripts never print the value.

## Research questions

| ID | Question | Pass criterion for paper |
|----|----------|--------------------------|
| **RQ1** | On history-leak fixtures (secret deleted from HEAD, still in git), does **Sentinel with history Fail** while a **working-tree / diff-only** baseline **Passes**? | ≥90% of H1 cases show this pattern |
| **RQ2** | After Fail, how often does Muse Spark match a human label? | Report accuracy + confusion; no cherry-picking |
| **RQ3** | Does Muse ever change Pass/Fail? | **0** flips across all Fail runs (property + tests) |

## Baselines (honest)

| Tool | Command intent | Role |
|------|----------------|------|
| Sentinel history | `node src/cli.js <repo>` with `SENTINEL_MUSE=false` | Gate under test |
| Sentinel tree-only | same + `SENTINEL_HISTORY=false` | Shows history is the lever |
| Gitleaks tree-only | `gitleaks detect --no-git -s <repo>` | Diff/HEAD-style baseline |
| Gitleaks git | `gitleaks detect -s <repo>` | Honesty check — Gitleaks *can* scan history |

We do **not** claim Sentinel is the only history scanner. RQ1 targets the **delete-then-merge** failure mode of **tree/diff-only** checks.

## H1 fixture rules

Each case:

1. Commit a synthetic secret (fake PAT / AWS example / DB URL).
2. Delete or scrub it from the working tree; commit again.
3. HEAD must not contain the secret value (or only a known docs example if case allows).
4. `git log -p` still contains the secret.
5. Expected: Sentinel history **Fail**; tree-only baselines **Pass** (unless case intentionally leaves a tree secret).

Catalog: [`history-cases.json`](./history-cases.json)  
Builder: [`scripts/build-history-fixtures.mjs`](./scripts/build-history-fixtures.mjs)

## L1 labeling (RQ2) — later weeks

- Unit of labeling: one **finding** (rule, path, fingerprint), not one repo.
- Labels: `likely_live` · `likely_example` · `likely_fixture` · `unclear`
- One primary annotator (author); 20% double-check after freeze.
- Spark run with `MODEL_API_KEY`; cache JSON under `paper/eval/cache/` (gitignored if it ever holds raw snippets — prefer fingerprints only).

## RQ3

- Assert in eval runner: report `ok` before Muse equals `ok` after Muse for every case.
- Mirror existing unit tests that Muse cannot clear Fail.

## Repro

```bash
# from repo root
brew install gitleaks   # once
# project/.env must contain MODEL_API_KEY for RQ2/RQ3

cd paper/eval
node scripts/build-history-fixtures.mjs
node scripts/run-rq1.mjs
node scripts/run-rq3.mjs
node scripts/run-rq2.mjs
```

| Script | Output |
|--------|--------|
| `run-rq1.mjs` | `results/rq1.md`, `rq1.json` |
| `run-rq3.mjs` | `results/rq3.md`, `rq3.json` |
| `run-rq2.mjs` | `results/rq2.md`, `rq2.json`, `labels.csv` |

## Install notes

- **Node:** ≥20  
- **Gitleaks:** Homebrew `gitleaks` (tested 8.30.x) or GitHub releases  
- **Sentinel:** `project/` — no npm deps for core CLI  
- **Muse (RQ2/RQ3):** `MODEL_API_KEY` in `project/.env` (never commit)
