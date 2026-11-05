# Paper track — arXiv + FSE 2027 Tool Demo

See [`PLAN.md`](./PLAN.md) for the full schedule.

## Quick start (RQ1)

```bash
brew install gitleaks   # once
cd paper/eval
node scripts/build-history-fixtures.mjs
node scripts/run-rq1.mjs
# → results/rq1.md  (also copied to results.md)
```

Fixtures are rebuilt locally under `eval/fixtures/` (gitignored).

## Layout

| Path | Purpose |
|------|---------|
| `PLAN.md` | Dual-track deadlines |
| `eval/protocol.md` | RQs, baselines, ethics |
| `eval/scripts/` | Fixture builder + RQ1 runner |
| `eval/results/` | Generated tables |
| `draft/main.tex` | ACM content scaffold |
| `draft/demo-walkthrough.md` | FSE unpublished appendix |

## Next

1. RQ3 assertion in runner (Muse cannot flip Pass/Fail)  
2. RQ2: label batch + Spark cache  
3. Fill `draft/main.tex` sections from RQ1 tables  
