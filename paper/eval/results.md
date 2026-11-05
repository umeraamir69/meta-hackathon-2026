# Mini-eval results (combined)

Generated from `results/rq1.md`, `rq2.md`, `rq3.md`. Re-run scripts to refresh.

## Summary

| RQ | Question | Result |
|----|----------|--------|
| **RQ1** | History Fail vs tree-only Pass | **15/15 (100%)** |
| **RQ2** | Muse Spark vs fixture GT labels | **41/41 (100%)** |
| **RQ3** | Muse changes Pass/Fail? | **0 flips / 16 cases (PASS)** |

Details: [`results/rq1.md`](./results/rq1.md) · [`results/rq2.md`](./results/rq2.md) · [`results/rq3.md`](./results/rq3.md)

## How to reproduce

See [`DOCUMENTATION.md`](./DOCUMENTATION.md).

```bash
cd paper/eval
node scripts/build-history-fixtures.mjs
node scripts/run-rq1.mjs
node scripts/run-rq3.mjs   # needs project/.env MODEL_API_KEY
node scripts/run-rq2.mjs   # needs project/.env MODEL_API_KEY
```

## Caveats (write these in the paper)

1. **N is small** (15 leak fixtures + 1 control; 41 findings).
2. **RQ2 ground truth** is author-verified from fixture construction (docs-example vs live-shaped), not a large multi-annotator study.
3. **Gitleaks with git history** also Fails on many cases — RQ1 targets **tree/diff-only** miss, not “only Sentinel sees history.”
4. Secrets are **synthetic**; no live credentials in the dataset or paper tables.
