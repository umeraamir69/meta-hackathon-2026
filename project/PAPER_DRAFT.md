# Draft: Advisory AI-Authorship Detection for Pull Requests

Working paper draft — claims below map to evidence already in this repo
unless marked TODO. Target: EMSE special issue on Agentic Software
Engineering; fallback: MSR 2027 mining challenge / arXiv preprint.

## Title (working)

*Abstain When Unsure: Advisory Detection of Agent-Authored Pull Requests
with Attribution Signals and LLM Adjudication*

## Abstract (draft)

Autonomous coding agents now author a large share of pull requests, but
reviewers cannot tell which PRs deserve agent-aware scrutiny — and
stylistic "AI or human?" classifiers risk false accusations. We present
an advisory-only detector that (1) matches only self-declared
attribution signals (agent accounts, branches, trailers, banners,
artifact paths), never writing style, and (2) asks an LLM judge to
confirm or abstain (`likely_agent` / `likely_human` / `mixed` /
`unclear`) using only the cited evidence. Nothing blocks a merge by
default. On 200 agent PRs from AIDev plus 200 recent human PRs, the
system reaches 97.0% agent recall with zero false verdicts on 165
verified-clean human PRs and a 2% abstention rate. Auditing every
alarm, we find ~12% of nominally human PRs in top repositories openly
declare AI authorship — label noise that flatters naive precision
numbers and that our detector catches rather than misses.

## 1. Introduction

- Agents (Copilot, Codex, Claude Code, Cursor, Devin) submit PRs at
  scale; reviewers want a "was this agent-assisted?" flag the way
  they want a CI status.
- Stylistic detectors are unreliable and harmful when wrong
  (false-accusation cost). Our position: detection must be
  **attribution-based, advisory-only, and allowed to abstain**.
- Contributions (see §7 for the claim→evidence map):
  1. A two-layer detector design with an explicit abstention path.
  2. A 400-PR evaluation with full per-row audit (not just scores).
  3. Empirical label-noise findings for AIDev-style mining
     (both directions).
  4. A failure taxonomy for agent-PR signals in the wild.

## 2. Related work (TODO: flesh out with citations)

- AIDev dataset (Li et al., MSR 2026 mining challenge) — our agent
  sample source; MSR challenge papers building agent classifiers.
- Stylistic AI-text detection reliability critiques (IEEE S&P 2026
  reporting; UMD "Almost AI, Almost Human" line) — motivates our
  no-style-guessing rule. TODO: cite primary sources.
- AI code review assistants and benchmarks (TODO: survey).
- Bot/PR automation detection literature (TODO: survey).
- Gap we fill: nobody evaluates the abstention path, and nobody
  reports audited precision against label noise.

## 3. Method

### 3.1 Layer 1 — deterministic attribution signals

Only self-declared evidence fires: agent-named bot authors
(`copilot[bot]`, `claude[bot]`, …, CI/dependency bots excluded),
assistant names in authors, agent branch prefixes (`copilot/`,
`cursor/`, `aider-…`, …), `Co-Authored-By`/`Assisted-by`/`Generated-by`
trailers and "generated with" banners in PR/commit messages, and
agent artifact paths (`AGENTS.md`, `.cursor/`, `.codex/`, …).
Trailers match in message mode only (docs *about* AI must not fire);
unchecked PR-template boilerplate (`- [ ] … AI-generated …`) is
excluded while checked affirmations still fire.

### 3.2 Layer 2 — evidence-grounded LLM adjudication

When Layer 1 fires, an LLM judge (Muse Spark in our implementation;
model-agnostic by design) receives only the cited signals and
returns a verdict with reasons: `likely_agent`, `likely_human`,
`mixed`, or `unclear`. No key or no signals → Layer 1 stands alone.
At most 2 model calls per scan; silent PRs cost zero tokens.

### 3.3 Policy: advisory by default

Findings are advisory metadata on the PR (comment/HTML/SARIF);
blocking ("strict") is strictly opt-in per rule. The deterministic
gate never guesses authorship from style.

## 4. Evaluation design

- Agent arm: 200 PRs stratified-sampled from AIDev (`hao-li/AIDev`,
  `pull_request` config, seed 20261028; Claude Code 116, Copilot 56,
  Codex 19, Devin 9; 169 repos).
- Human arm: 200 recent merged PRs from ~40 high-volume repos via
  the GitHub API, bots and agent-looking branches/trailers excluded.
- Harness scans each PR (~11 GitHub calls + ≤2 model calls),
  records signals, verdict, and tokens; rate-limit guarded, paced
  1s apart with Retry-After-aware retries.
- Analysis: naive tally first, then **manual audit of every alarm
  and miss against the live PR** — the step that changes the story.
- Reproducibility: PR list (`eval/prs-full.json`), harness
  (`eval/ai-signals.mjs`), dated result files, costs in tokens.

## 5. Results (observed, 2026-10-29)

- Naive tally: 347 correct / 4 abstain / 12 warn / 37 error (n=400).
- Audited: agent recall **97.0%** (193/199; 4 abstentions, 2 repos
  deleted mid-eval); **0 false verdicts on 165 verified-clean human
  PRs** (163 silent, 2 `unclear`); 7 safe abstentions total.
- The 37 "errors" decompose to: 26 correct flags on AI-declared
  human-account PRs (label noise), 3 correct flags on checked
  template affirmations, 5 description-level flags (CodeRabbit
  marker gray zone), 3 transients recovered on retry.
- The 1 "recall miss" was audited human-written (AIDev label noise
  in the other direction) — true misses: zero.
- Cost: ~114k input / ~137k output tokens for 400 PRs.

## 6. Findings for the community (label noise + taxonomy)

1. **Human baselines leak.** ~12% of recent PRs from top repos carry
   explicit AI-authorship trailers under human accounts. Any study
   sampling "human" PRs by account type alone inherits this noise —
   and naive precision metrics punish detectors for catching it.
2. **AIDev labels leak both ways.** At least one agent-labeled PR is
   plainly human-written (maintainer, human branch, no signals).
   Attribution-derived labels need spot auditing before they anchor
   recall claims.
3. **Failure taxonomy** (each with repo evidence in our logs):
   template-boilerplate FPs (fixed class), description-vs-code gray
   zone, artifact-path weak signals (correctly abstained), transient
   API failures under burst scanning (fixed with backoff).
4. **Abstention works as designed.** All 7 `unclear`s were genuinely
   ambiguous rows (single weak signals); none masked a confident
   error.

## 7. Claim→evidence map (for reviewers)

| Paper claim | Evidence in repo |
|---|---|
| Attribution-only signals, no style guessing | `project/src/ai.js`, `AI_SIGNALS.md` §§2–3 |
| Abstention path exists and triggers | 7 `unclear`s in result JSONs with reasons |
| 97% recall / 0 clean-human false verdicts | `eval/results/ai-signals-2026-10-29-1538.json` + `…-1541.json`, §5 audit |
| ~12% human-baseline label noise | 27 audited rows listed in `AI_SIGNALS.md` §10 |
| Template fix verified | `test/ai.test.js` checkbox test + retry rows |
| Cost bounded | token tallies in both result files |
| Reproducible | `eval/prs-full.json`, `eval/prs-retry.json`, sampler scripts with seed |

## 8. Limitations (stated upfront)

- Single-author manual audit (rule-book: any AI trailer/banner =
  AI-declared; documented in §10; independent re-audit TODO).
- n=400, one time window (Oct 2026), GitHub only.
- No baseline comparison yet — TODO: run a stylistic/zero-shot
  judge on the same 400 and show the gap (§9, experiment E1).
- Agent arm inherits AIDev's mining biases (5 agents, no Cursor
  rows drawn); human arm is top-repo-skewed.
- Verdict nondeterminism observed across passes (some `unclear` →
  `likely_agent` on rerun) — TODO: quantify with repeat runs (§9,
  experiment E3).

## 9. Future work (concrete experiments)

- **E1 — baselines.** Zero-shot LLM judge ("AI or human?") and an
  off-the-shelf AI-text classifier on the same 400; report their
  false-verdict rate on the 165 clean humans vs ours (0).
- **E2 — scale.** 1,000+ PRs, second time window, non-top repos;
  re-measure the 12% label-noise rate across ecosystems.
- **E3 — verdict stability.** 3× repeat runs on firing rows;
  abstention-rate and flip-rate statistics.
- **E4 — reviewer study.** Do `unclear` + reasons change reviewer
  behavior vs a bare flag? Small task-based study (n≈20).
- **E5 — description-vs-code.** Separate the CodeRabbit gray zone:
  does description-level AI predict code-level AI?
- **E6 — longitudinal.** Re-run quarterly; track trailer adoption
  as agents evolve (signal half-life study).

## 10. Venue + submission checklist

- Primary: EMSE special issue on Agentic SE (wants AIDev-based
  empirical work; our §6 findings fit directly).
- Backup: MSR 2027 mining challenge; arXiv preprint anytime.
- Checklist before submit: E1 baselines done · E3 stability done ·
  related-work citations completed · second reader for audit sample ·
  author identities/affiliations decided · results JSONs archived
  (Zenodo) with DOI cited.

## 11. What to write next (draft order)

1. E1 + E3 experiments (numbers first, prose follows).
2. Related work (needs library pass, ~20 papers).
3. Method (§3 above is already 70% there).
4. Camera-ready figures: audited confusion flow, fire-taxonomy
   bar chart, cost-vs-recall curve.
