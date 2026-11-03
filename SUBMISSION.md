# Submission draft — PR Diff Sentinel

**Paste into:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details  
**Due:** Wed, Nov 4 · **9:00 PM ET** · Late submissions not considered  
**Track:** Indie developer · **Theme:** Build for Your World  
**Team:** Solo — Muhammad Umer Aamir (`umeraamir69`)

Official guide summary used for this draft: public repo required · ~3 min demo video · must use Meta models · judges score Impact / Meta AI tooling / Technical depth / Demo.

---

## Form fields (copy/paste)

### Project name
PR Diff Sentinel

### Track
Indie developer

### Theme / problem statement
Build for Your World

### One-liner
A merge gate for secrets that survive a delete — rules decide Pass/Fail; Muse Spark + Muse Wonder only explain.

### Why are Meta's models important to your solution? (form)
```
A pure rule scanner can Fail a PR, but it cannot tell a human what to do next without dumping raw findings. After vibe coding, maintainers need triage: which hits look live vs docs samples, what to revoke first, and how far the blast radius goes — without letting an LLM wave through a leak.

Meta models are that triage layer. Muse Spark labels masked findings so people prioritize real exposure. Muse Wonder turns those labels into rotate steps and live report chat. Because Muse cannot change Pass/Fail, we get Meta’s reasoning quality without putting model judgment in the merge decision path — the responsible pattern for AI in security tooling.
```

### Project description (short)

Deleting a secret from the latest file does not delete it from git. Diff-only scanners miss history; CI goes green; the merge still ships the leak. That failure mode got worse with vibe coding.

**PR Diff Sentinel** is a deterministic merge gate over the working tree, the PR diff, **and** git history. The rule engine is the only Pass/Fail. The check stays red until a person rotates the credential.

**Meta models (required):**
- **Muse Spark** (`muse-spark-1.3`) labels each masked hit: `likely_live`, `likely_example`, `likely_fixture`, `unclear`.
- **Muse Wonder** (`muse-wonder-1.0`) explains live/unclear hits: rotate runbook, blast radius, redacted fix guidance.
- Live Muse **chat** on the report streams Wonder answers about this report only.
- Muse **cannot** clear a Fail. Contributor-tier models are refused. Offline local fallback if the key is missing.

**Built during the hackathon (judge-facing):**
- Hosted Next.js scanner + Testing showcase + merge-gate report (PDF, Muse chat, finding Muse popups)
- Chrome MV3 extension (scan PR/commit; repo picker; local dashboard)
- CLI, GitHub Action, pre-commit/pre-push hooks, leaky-push demo
- AI-authorship **advisory** signals (never block the secrets gate)
- Eval notes + 94 unit tests including self-scan

**Not an AI code reviewer.** Rules block; Muse explains. Secrets are masked before any model call.

### Links

| Field | Value |
|-------|--------|
| Live product | https://pr-diff-sentinel.vercel.app |
| Public repo | https://github.com/umeraamir69/meta-hackathon-2026 |
| Demo video (≤3 min) | https://www.loom.com/share/568f5bb5a2d04286b8c8a803de925843 |
| Transcript / runbook | `VIDEO_TRANSCRIPT.md` · `DEMO_SCRIPT.md` |
| Chrome Web Store (optional) | https://chromewebstore.google.com/detail/pr-diff-sentinel/ahlihmimlioaieccfbgbpmfabfjhmfch |

### People on the project
Muhammad Umer Aamir only (solo Indie)

---

## Rubric map (what judges score)

| Category | Weight | How we hit it |
|----------|--------|----------------|
| **Impact** | 30% | Real OSS leak path (deleted-but-still-in-history). Maintainers / CI / pre-commit. |
| **Use of Meta AI tooling** | 25% | Muse Spark labels + Muse Wonder rotate + streaming Muse chat. Never decides Pass/Fail. |
| **Technical depth** | 20% | Tree + PR diff + history gate; fail-closed shallow clones; Action + CLI parity; masked prompts; 94 tests. |
| **Demo** | 25% | Working live site + Fail showcase + Muse on camera + extension + hook block. Keep ≤ **3 minutes**. |

Stage 1 pass/fail: fits **Build for Your World** + clearly uses **Meta Model API** (Spark/Wonder). Say Muse names on camera.

---

## Rules checklist (from participant guide)

- [x] Repository is **public**
- [x] Built during hackathon window (show in video: site, Muse, extension, hooks)
- [x] Uses Meta models (Spark + Wonder via Meta Model API)
- [x] **Demo video** recorded — https://www.loom.com/share/568f5bb5a2d04286b8c8a803de925843
- [x] **Submitted** on CV platform (2026-11-03) — due was Nov 4, 9:00 PM ET
- [x] Video shows hackathon build (site / Muse / extension / hooks)

---

## Proof / evidence (optional paste)

- 94/94 unit tests; `node scripts/demo-history.mjs` fails as designed on a deleted key
- Live Fail: Secrets.Sandbox#1 via https://pr-diff-sentinel.vercel.app/testing
- AI advisories Pass (never block): Anthropic skills PR #66
- Muse chat streams on `/report` (report-only scope)
- Demo: https://www.loom.com/share/568f5bb5a2d04286b8c8a803de925843

---

## After you record

1. [x] Video uploaded (Loom).
2. Paste this into the CV form **Demo video** field:  
   `https://www.loom.com/share/568f5bb5a2d04286b8c8a803de925843`
3. [x] Submitted at https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details (2026-11-03)  
4. Keep Loom + public repo reachable through judging (Nov 5–8).
