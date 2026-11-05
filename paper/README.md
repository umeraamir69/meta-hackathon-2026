# Paper track — arXiv + FSE 2027 Tool Demo

See [`PLAN.md`](./PLAN.md) for the full schedule.

## Quick start (all RQs)

```bash
brew install gitleaks   # once
# Ensure project/.env has MODEL_API_KEY (never commit)

cd paper/eval
node scripts/build-history-fixtures.mjs
node scripts/run-rq1.mjs
node scripts/run-rq3.mjs
node scripts/run-rq2.mjs
```

Full docs: [`eval/DOCUMENTATION.md`](./eval/DOCUMENTATION.md) · combined: [`eval/results.md`](./eval/results.md)

| RQ | Latest |
|----|--------|
| RQ1 history vs tree-only | **15/15** |
| RQ2 Spark vs GT | **41/41** |
| RQ3 Muse flips gate? | **0 flips** |

Fixtures rebuild under `eval/fixtures/` (gitignored).

## Layout

| Path | Purpose |
|------|---------|
| `PLAN.md` | Dual-track deadlines |
| `eval/DOCUMENTATION.md` | How to run + artifact rules |
| `eval/protocol.md` | RQs, baselines, ethics |
| `eval/scripts/` | Fixture builder + RQ1/2/3 runners |
| `eval/results/` | Generated tables + `labels.csv` |
| `draft/main.tex` | ACM content scaffold |
| `draft/demo-walkthrough.md` | FSE unpublished appendix |

## Next

1. Fill `draft/main.tex` Eval section from `eval/results/*.md`  
2. Optional H2: 10–15 public Fail PRs  
3. Screencast + arXiv (see PLAN)  
