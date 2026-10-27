# Meta Global AI Developer Hackathon — full status

**Last updated:** 2026-10-26 ~11:20pm ET  
**Owner:** Muhammad Umer Aamir (`umeraamir69`)  
**Event page:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon

---

## One-line status

**ACCEPTED** · Indie track · Project **PR Diff Sentinel** · Build window **Oct 26 → Nov 4, 9:00pm ET** · Day 1 scaffold done · Official Rules / Muse API key / Day 2 demo PR still open.

---

## Event facts

| Item | Value |
|------|--------|
| Host | Meta / Cerebral Valley |
| Where | Online |
| Prize pool | $1M cash |
| Cap | 20,000 accepted (rolling) |
| Track | **Indie developer** (picked) |
| Theme | **Build for Your World** |
| Applied | 2026-10-23 ~11:37 ET |
| Accepted | 2026-10-25 ~11:18pm ET (confirmed) |
| Notify-by | 2026-10-26 9:00 AM ET |
| Build | 2026-10-26 → 2026-11-04 |
| **Submit by** | **2026-11-04 9:00 PM ET** |
| Judging | Nov 4 – Nov 8 |
| Winners | Nov 9 closing ceremony |

### Eligibility (our case)

- Ontario / Canada: OK  
- Indie (solo / student): OK  
- Not Meta/CV employee: OK  

### Indie judging (what they score)

1. Creativity  
2. Technical ambition  
3. Whether it works  

---

## Project: PR Diff Sentinel

### Pitch

Deterministic secret scan on **PR diff + git history** that **blocks merge**.  
**Muse Wonder** only **explains** findings and drafts a **rotate checklist**.  
Not AI code review.

### Why this can win

- Crowded lane = LLM “reviews your PR.” We avoid that.  
- Gate is offline rule-based; Muse is triage only.  
- Real prior art: SecSentry (history secrets), Next.js hang PR receipts.  
- Theme fit: secrets in git are a problem we actually hit shipping OSS.

### Stack

| Layer | Role |
|-------|------|
| Rules + CLI scanner | Pass/fail. No LLM. |
| GitHub Action | Runs on `pull_request`; fails check on findings. |
| Muse Wonder (Meta Model API) | Explain + rotate steps after a fail. |
| Demo repo | Planted fake secret in history → red Action → Muse text. |

Local Day‑1 code lives in [`project/`](./project/) in this repo.

### Past project cited on application

Urdu text-reuse FYP (back-translation + embeddings).

---

## Checklist — done vs open

### Done

- [x] Chose idea (PR Diff Sentinel over LectureLens / ApplySafe)  
- [x] Applied Indie track (2026-10-23)  
- [x] Accepted (2026-10-25)  
- [x] Day 1 scaffold: CLI, rules, Action stub, workflow, Muse local fallback  
- [x] Fixture fails gate on planted `AKIA…` key (`project/fixtures/leaky-repo`)  
- [x] Unit test for working-tree scan  

### Open (do these next)

- [ ] Accept **Official Rules** on Cerebral Valley (required for selected participants)  
- [ ] Join kickoff / Discord; save Meta Model API / Muse credentials  
- [ ] **Day 2:** public or private demo with secret in **git history** + failing PR Action  
- [ ] **Day 3:** real Muse Wonder HTTP client (keep fail/pass deterministic)  
- [ ] Suppress list + clear CI annotations  
- [ ] 60-second README reproduce path  
- [ ] Demo video (fail → Muse explain → rotate)  
- [ ] Submission write-up + freeze before **Nov 4 9pm ET**  

---

## Day-by-day build plan

| Day | Date | Focus | Status |
|-----|------|--------|--------|
| 1 | Oct 26 | Repo, Action stub, scanner, Muse stub, fixture | **Done** |
| 2 | Oct 27 | Action on real PR; planted key in history | Todo |
| 3 | Oct 28 | Muse Wonder HTTP once API access is live | Todo |
| 4–5 | Oct 29–30 | Suppress list, CI notes, README 60s path | Todo |
| 6–8 | Oct 31–Nov 2 | Demo video, hardening, edge cases | Todo |
| 9 | Nov 3 | Buffer / judge-path polish | Todo |
| 10 | Nov 4 | Freeze afternoon; **submit by 9pm ET** | Todo |

---

## Design rules (do not break)

1. **Muse never decides pass/fail.** Only the rule engine does.  
2. No “generic AI code review” product.  
3. Demo must work **without** `META_API_KEY` (local checklist fallback).  
4. Prefer thin Action + CLI + README over a dashboard.  
5. Mask secrets in all logs and Muse prompts.

---

## How to run Day‑1 scaffold

```bash
cd project
node src/cli.js fixtures/leaky-repo
# expect exit 1 + JSON with aws_access_key

node --test test/scan.test.js
```

GitHub Action entrypoints: `project/action.yml`, `project/.github/workflows/sentinel.yml`.

---

## Partners / credits (event)

- Baseten — credits + TPM for open-weights  
- Modal — credits / Endpoints / GPUs  
- Fireworks — credits + workshop  

Use only if they help the Muse / open-weights path; core gate stays local.

---

## Links

| What | URL |
|------|-----|
| Event | https://cerebralvalley.ai/e/meta-ai-developer-hackathon |
| Waiver / overview | https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver |
| SecSentry (prior art) | https://github.com/umeraamir69/secsentry |
| This status repo | (see GitHub after push) |

---

## Submission notes (draft — fill before Nov 4)

- **Track:** Indie  
- **Theme:** Build for Your World  
- **Problem:** Secrets deleted from HEAD still live in `git log`; PR-only greps miss them.  
- **Solution:** Deterministic diff+history gate + Muse triage.  
- **Proof:** Failing Action on planted history secret; Muse explanation screenshot; optional SecSentry / Next hang links as builder receipts.  

---

## Log

| When (ET) | Note |
|-----------|------|
| 2026-10-23 11:37 | Applied Indie · PR Diff Sentinel |
| 2026-10-25 23:18 | Accepted (confirmed) |
| 2026-10-26 11:30 | Day 1 scaffold on Desktop; gate fails AKIA fixture |
| 2026-10-26 23:20 | This private status repo created |
