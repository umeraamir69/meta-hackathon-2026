# Dual-track plan: arXiv + FSE 2027 Tool Demo

**Owner:** Muhammad Umer Aamir (solo)  
**Tool:** PR Diff Sentinel — https://pr-diff-sentinel.vercel.app · https://github.com/umeraamir69/meta-hackathon-2026  
**Tracks:** (1) arXiv preprint · (2) FSE 2027 Tool Demonstrations  

| Milestone | Target date | Status |
|-----------|-------------|--------|
| Mini-eval RQ1 smoke (15 fixtures) | **4 Nov 2026** | **Done — 15/15** |
| Mini-eval v1 done (RQ2+RQ3) | **Fri 18 Dec 2026** | In progress |
| Paper draft v1 (4 pages) | **Fri 2 Jan 2027** |
| Screencast ≤3 min | **Fri 9 Jan 2027** |
| **arXiv submit** | **Mon 12 Jan 2027** |
| Polish from arXiv feedback / self-review | **12–24 Jan 2027** |
| **FSE Tool Demo submit** | **Tue 26 Jan 2027 AoE** |
| FSE notification | **17 Mar 2027** |
| Camera-ready | **2 Apr 2027** |
| Present at FSE | **12–16 Jul 2027** |

Do **not** submit to another peer-reviewed venue between arXiv and FSE (FSE requires unpublished for the demo paper). arXiv preprint is allowed; cite it in the FSE submission.

---

## 1. What we claim (one sentence)

A **deterministic, history-aware merge gate** for secrets that survive a delete, with **Muse Spark/Wonder used only for triage** after Fail — models cannot clear the gate.

Not claiming: SOTA detector vs Gitleaks on all secret types; not an LLM code reviewer.

---

## 2. FSE 2027 Tool Demo requirements (must hit)

Source: https://conf.researchr.org/track/fse-2027/fse-2027-demonstrations  

| Requirement | Our plan |
|-------------|---------|
| **≤4 pages** text/figures/tables + **1 page** refs | ACM format; strict cut |
| **Screencast** link at submit | Loom/YouTube unlisted ≤3 min |
| **Walkthrough appendix** (not published, not counted) | `paper/draft/demo-walkthrough.md` → PDF appendix |
| Tool **public** + usage instructions | Live site + README + CLI |
| Ideally **open source** | Already public GitHub |
| Encourage Docker/VM | Optional stretch: `Dockerfile` for CLI scan |
| Single-blind (names visible) | Put author name on paper |
| Submit | https://fse2027-demo.hotcrp.com by **26 Jan 2027 AoE** |
| Present if accepted | One author must register + present |

**Review criteria:** technical soundness, originality, relevance, presentation, **usability**.

---

## 3. Mini-eval design (blocks both arXiv and FSE)

Without numbers, both submissions are weak. Scope is **small but honest**.

### 3.1 Research questions

- **RQ1 (gate):** On PRs where a secret was removed from HEAD but remains in history, does Sentinel **Fail** while a **diff-only** baseline **Passes**?
- **RQ2 (labels):** After Fail, how often does Muse Spark agree with a human label (`likely_live` / `likely_example` / `likely_fixture` / `unclear`)?
- **RQ3 (safety):** In N Fail cases, does Muse ever change Pass/Fail? (Expected: **never** — property check + tests.)

### 3.2 Datasets (keep tiny)

| Set | Size | Purpose |
|-----|------|---------|
| **H1 History-leak** | 15–25 synthetic or curated fixtures | Deleted-in-tree, still in git (extend `fixtures/leaky-repo` + `demo/leaky-push-demo`) |
| **H2 Public Fail PRs** | 10–15 public PRs | In-the-wild Fail demos (start from Testing showcase + manual triage) |
| **L1 Label sample** | 80–120 **findings** (not repos) | Human-labeled for Spark accuracy |
| **B1 Diff-only baseline** | Same as H1 | Run Gitleaks and/or TruffleHog on **PR diff / HEAD only** vs Sentinel history scan |

**Do not** publish raw live secrets. Mask in paper; store labels as rule id + path + hash fingerprint only.

### 3.3 Baselines

| Tool | How we use it |
|------|----------------|
| **Gitleaks** | Scan checkout at HEAD / diff if available |
| **TruffleHog** (optional if time) | Same |
| **Sentinel rules-only** | No Muse |
| **Sentinel + Spark** | Labels after Fail |
| **Sentinel + Spark + Wonder** | Triage text quality (qualitative, 10 cases) |

Metrics: Fail/Pass agreement on H1; precision/recall or accuracy on L1 labels; time per scan (median).

### 3.4 Deliverables in repo

```
paper/eval/
  protocol.md          # how labels were done
  history-cases.json   # case ids + expected Fail
  labels.csv           # finding_id, human_label, spark_label
  results.md           # tables for the paper
  scripts/             # runners wrapping gitleaks + sentinel CLI
```

**Done when (18 Dec):** `results.md` has RQ1 table + RQ2 confusion-style counts + RQ3 “0 Pass flips.”

---

## 4. Paper outline (4 pages)

**Working title:** *Rules Block, Models Explain: PR Diff Sentinel — A History-Aware Merge Gate for Secrets*

| § | Content | ~pages |
|---|---------|--------|
| 1 Intro | Delete ≠ gone; vibe coding; gap vs diff-only | 0.5 |
| 2 Tool | Architecture: tree + PR diff + history; Action/CLI/ext/site | 1.0 |
| 3 Muse role | Spark labels, Wonder rotate/chat; cannot clear Fail; masking | 0.75 |
| 4 Eval | RQ1–RQ3 tables | 1.0 |
| 5 Related work | Gitleaks, TruffleHog, Keysentinel, AssetHarvester, IssueGuard — position ours | 0.5 |
| 6 Limitations + conclusion | Small N; not SOTA recall; ethics | 0.25 |
| Refs | 1 page | 1 |

Appendix (FSE only, unpublished): click-by-click demo walkthrough.

arXiv version can be the **same 4–5 pages** (or lightly expanded PDF); same core claims.

---

## 5. Week-by-week schedule

### Phase A — Eval (now → 18 Dec 2026)

| Week | Dates | Tasks |
|------|-------|-------|
| A1 | **5–11 Nov** | Freeze paper claim; list H1 fixtures; install Gitleaks; draft `protocol.md` |
| A2 | **12–18 Nov** | Build 15+ history-leak cases; script Sentinel vs HEAD-only baseline |
| A3 | **19–25 Nov** | Collect H2 public PRs; run scans; mask + store fingerprints |
| A4 | **26 Nov–2 Dec** | Human-label L1 findings (target 80+); run Spark offline/batch |
| A5 | **3–9 Dec** | Fill gaps; Wonder qualitative notes (10 Fails) |
| A6 | **10–18 Dec** | Lock `results.md`; freeze numbers for paper |

### Phase B — Write + media (19 Dec → 12 Jan 2027)

| Week | Dates | Tasks |
|------|-------|-------|
| B1 | **19–26 Dec** | Sections 1–3 draft in Overleaf/LaTeX ACM |
| B2 | **27 Dec–2 Jan** | Section 4 tables + figures; related work |
| B3 | **3–9 Jan** | Screencast (Fail history → Muse labels → rotate chat); walkthrough appendix |
| B4 | **10–12 Jan** | Proofread; **submit arXiv** (cs.SE + cs.CR) |

### Phase C — FSE submit (12–26 Jan 2027)

| Dates | Tasks |
|-------|-------|
| 12–18 Jan | Fix anything arXiv moderation / self-review finds |
| 19–23 Jan | Align PDF to FSE format; HotCRP account; ORCID |
| **24–26 Jan** | Final PDF + screencast URL + tool URL + appendix → **submit HotCRP** |

### Phase D — After submit

| Date | Action |
|------|--------|
| 17 Mar 2027 | If accept: calendar travel/funding; if reject: revise → ASE/ICSE next tool track or workshop |
| 2 Apr 2027 | Camera-ready |
| Jul 2027 | Present |

---

## 6. Screencast script (≤3 min)

1. **0:00** Problem: delete key → green CI → still in history  
2. **0:25** Live Fail on public sandbox PR (or local history demo)  
3. **1:00** Findings: masked; Spark live vs example  
4. **1:40** Muse chat / rotate steps — “cannot clear Fail”  
5. **2:10** Surfaces: Action / hook / extension (quick)  
6. **2:40** Close: rules block, models explain  

Reuse Loom skills from the hackathon; re-record trimmed for FSE (≤3 min, no filler).

---

## 7. arXiv checklist

- [ ] PDF compiled, author name, affiliations (WLU)  
- [ ] Categories: **cs.SE** primary, **cs.CR** secondary  
- [ ] Link to tool + GitHub in abstract/comments  
- [ ] No live secrets in PDF or annex  
- [ ] Submit **before** FSE so you can cite `arXiv:XXXX.XXXXX` in the demo paper comment field  
- [ ] After announce (~1–2 days), tweet/LinkedIn once with link  

---

## 8. FSE HotCRP checklist (26 Jan)

- [ ] 4+1 page PDF, ACM format  
- [ ] Author names visible (single-blind)  
- [ ] Screencast URL in submission  
- [ ] Tool URL + GitHub + install blurb  
- [ ] Unpublished walkthrough appendix  
- [ ] ORCID  
- [ ] Not under review elsewhere  

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Eval not done by mid-Dec | Cut H2; keep H1 synthetic + L1 ≥60 labels |
| Muse API flaky / cost | Cache Spark outputs; offline checklist for ablation |
| Page limit | Kill AI-signals story from paper (appendix or future work) |
| Solo bandwidth (school + jobs) | Hard freeze Friday evenings for eval only through Dec |
| Reject at FSE | arXiv still counts; resubmit ASE/ICSE 2028 tool track |
| Ethics / secrets in paper | Fingerprints + masks only; fixtures clearly fake |

---

## 10. Out of scope for this cycle

- Beating Gitleaks on unstructured password recall  
- Large GitHub measurement study (Keysentinel-scale)  
- MSR/ICPC November 2026 deadlines  
- Training a custom detector model  

---

## 11. Immediate next actions (this week)

1. Create Gitleaks install notes in `paper/eval/protocol.md`.  
2. List 15 history-leak scenarios to implement under `project/fixtures/`.  
3. Open Overleaf ACM sigconf template titled with the working title above.  
4. Block calendar: **18 Dec** eval lock · **12 Jan** arXiv · **26 Jan** FSE.

When Phase A starts in earnest, track progress by checking boxes in §7–§8 and updating the milestone table at the top.
