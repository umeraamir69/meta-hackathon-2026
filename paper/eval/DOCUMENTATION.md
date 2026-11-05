# Evaluation documentation — PR Diff Sentinel paper track

This folder is the **reproducible mini-eval** for the arXiv preprint and FSE 2027 Tool Demo.

| Doc | What |
|-----|------|
| [`protocol.md`](./protocol.md) | RQs, baselines, ethics |
| [`DOCUMENTATION.md`](./DOCUMENTATION.md) | This file — how to run, what was produced |
| [`../PLAN.md`](../PLAN.md) | Deadlines (arXiv 12 Jan 2027 · FSE 26 Jan 2027) |
| [`results.md`](./results.md) / [`results/`](./results/) | Generated tables |

---

## Prerequisites

```bash
# Node 20+
node -v

# Gitleaks (RQ1 baseline)
brew install gitleaks
gitleaks version

# Meta Model API key (RQ2 + RQ3) — never commit
# File: project/.env
# MODEL_API_KEY=...
```

Scripts load `project/.env` via `scripts/load-env.mjs`. They log **key length only**, never the secret.

---

## One-shot regenerate

```bash
cd paper/eval
node scripts/build-history-fixtures.mjs   # → fixtures/ (gitignored)
node scripts/run-rq1.mjs                  # → results/rq1.md + rq1.json
node scripts/run-rq3.mjs                  # needs MODEL_API_KEY → results/rq3.*
node scripts/run-rq2.mjs                  # needs MODEL_API_KEY → results/rq2.* + labels.csv
```

Approximate time: RQ1 ~5s · RQ2/RQ3 several minutes (API latency).

---

## Research questions (operationalized)

### RQ1 — History gate vs tree-only

**Claim:** After a secret is deleted from HEAD but left in git history, **Sentinel with history Fails** while **tree-only** checks Pass.

**Baselines**

| Tool | Meaning |
|------|---------|
| Sentinel history | Default CLI (`SENTINEL_HISTORY` on, Muse off) |
| Sentinel tree | `SENTINEL_HISTORY=false` |
| Gitleaks tree | `gitleaks detect --no-git` |
| Gitleaks git | `gitleaks detect` (honesty: can scan history) |

**Success pattern (leak cases):** Sentinel history Fail ∧ Sentinel tree Pass ∧ Gitleaks tree Pass.

**Status:** See `results/rq1.md` (first run: **15/15**).

### RQ3 — Muse cannot clear Fail

**Claim:** Enabling Muse (Spark + Wonder) never changes `report.ok`.

**Method:** `collectReport` twice per fixture — `SENTINEL_MUSE=false` vs `true`. Count flips.

**Status:** See `results/rq3.md` after `run-rq3.mjs`.

### RQ2 — Spark label quality

**Claim:** Report agreement between Muse Spark and human/fixture ground truth on findings.

**Ground truth policy** (author-verified from fixture construction):

| Cases | Label |
|-------|--------|
| h01, h15 (AWS docs example material) | `likely_example` |
| Other H1 leak cases | `likely_live` |
| h16 control | no findings |

**Method:** Rules scan → `classifyFindings` (Spark only) → compare to GT. Output `labels.csv` (fingerprint + masked only).

**Status:** See `results/rq2.md` after `run-rq2.mjs`.

---

## Fixtures (H1)

- Source of truth: [`scripts/secrets.mjs`](./scripts/secrets.mjs)
- Catalog ids: [`history-cases.json`](./history-cases.json)
- Built under `fixtures/<id>/` (gitignored disposable git repos)
- All secrets are **synthetic / documentation-shaped**

---

## Artifacts safe to commit

| Path | Safe? |
|------|-------|
| `results/rq1.md`, `rq1.json` | Yes |
| `results/rq3.md`, `rq3.json` | Yes (no raw secrets; no API key) |
| `results/rq2.md`, `rq2.json`, `labels.csv` | Yes (masked + fingerprints) |
| `fixtures/` | **No** — gitignored (may contain synthetic secrets in git objects) |
| `cache/` | **No** — gitignored |
| `project/.env` | **No** |

---

## Paper mapping

| Section | Use |
|---------|-----|
| Eval RQ1 table | `results/rq1.md` |
| Eval RQ3 | `results/rq3.md` — “0 flips” |
| Eval RQ2 | `results/rq2.md` + confusion counts |
| Threats to validity | Small N; GT from construction; Gitleaks-git also Fails often |
| Tool availability | Live site + public GitHub (see root README) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | RQ1 harness + 15/15 smoke |
| 2026-11-05 | RQ2/RQ3 runners + env loader + this documentation |
