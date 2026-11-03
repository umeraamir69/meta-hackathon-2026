# Meta Global AI Developer Hackathon — full status

**Last updated:** 2026-11-02 (ET)
**Owner:** Muhammad Umer Aamir (`umeraamir69`)
**Event page:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon
**Live site:** https://pr-diff-sentinel.vercel.app
**Status report:** [STATUS_REPORT.md](./STATUS_REPORT.md)
**Notes:** Obsidian vault `/Users/umeraamir/Documents/Obsidian Vault/Meta Hackathon 2026`

---

## One-line status

**ACCEPTED** · Indie · **PR Diff Sentinel** · 94/94 tests · site live · Actions secret set · Demo video + Cerebral Valley submit **deferred to tomorrow** · Still need: public repo · Deadline **Nov 4 9pm ET**.

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
| Build | 2026-10-26 → 2026-11-04 |
| **Submit by** | **2026-11-04 9:00 PM ET** |
| Judging | Nov 4 – Nov 8 |
| Winners | Nov 9 closing ceremony |
| Kickoff | 2026-10-26 12:00 PM ET (livestream already happened) |

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

Deterministic secret scan on the working tree, the PR diff, and git history. The process blocks merge. **Muse Spark** labels each masked hit. **Muse Wonder** explains only live and unclear hits. Neither model can pass the gate. Not AI code review.

### Why this can win

- The crowded lane is “an LLM reviews your PR.” This does not do that.
- The gate is offline and rule-based. Muse is triage after a failure.
- Prior art: SecSentry (history secrets) and real secrets that survive a delete commit.
- Theme fit: secrets in git are a problem we hit shipping OSS.

### Stack

| Layer | Role |
|-------|------|
| Rules + CLI | Pass/fail. No LLM. |
| GitHub Action | `pull_request`, fails the check, updates one comment. `fetch-depth: 0`. |
| Muse Spark (`muse-spark-1.3`) | Label each hit. Cannot clear the gate. |
| Muse Wonder (`muse-wonder-1.0`) | Explain live and unclear hits. |
| Local fallback | Same labels and checklist with no key, or when a call fails. |
| Report app | `node src/app.js` — local page for the demo. |

Code lives in [`project/`](./project/).

### Past project cited on the application

Urdu text-reuse FYP (back-translation + embeddings).

---

## Checklist

### Done

- [x] Chose PR Diff Sentinel
- [x] Applied and accepted, Indie track
- [x] Working tree, git history (added and removed lines, commit messages), three-dot PR diff
- [x] Allowlist (`.sentinelignore`), masked output, configured-key redaction
- [x] Composite Action and root CI workflow
- [x] Muse Wonder HTTP client. A verification call returned **HTTP 200** for `muse-wonder-1.0`. The gate does not use that response to pass or fail.
- [x] Offline demo and unit tests (23 passing)
- [x] Key file present locally at `project/.env` (gitignored). Names only: `MODEL_API_KEY`, `META_API_KEY`, `MUSE_API_KEY`.
- [x] Submitted the **$150 credits form** and confirmed the grant on [Billing](https://ai.developer.meta.com/billing) (card on file, spend-limit notification at $150).
- [x] Accepted **Official Rules** on Cerebral Valley.
- [x] Joined Discord.
- [x] Next.js site (`web/`) with `/api/scan` and Chrome MV3 extension (`extension/`).
- [x] Pre-commit hook installer with tests, plus how-to docs for Vercel deploy, extension install, and protecting another repo.
- [x] Muse triage upgrade: blast radius, `why_live`, fix patches, ignore candidates, triage order, prompt dedupe, findings cap (72 tests green).
- [x] Docs: `project/FEATURES.md`, `SUBMISSION.md`, `DEMO_SCRIPT.md`.

### Still on you

- [ ] Commit + push the web untar fix and extension icon updates (deployed from local CLI; GitHub may still be behind).
- [ ] Add GitHub Actions secret `MODEL_API_KEY` on this repo. Do not put the value in the workflow file.
- [ ] Record the demo (history fail → Muse explanation → rotate checklist). Script: `DEMO_SCRIPT.md`.
- [ ] Submit on Cerebral Valley before **Nov 4, 9:00 PM ET** (links in `SUBMISSION.md`).
- [ ] Optional: add `GITHUB_TOKEN` on the Vercel `web` project so hosted scans survive rate limits.

---

## Design rules

1. **Muse never decides pass/fail.** Only the rule engine does.
2. No generic AI code review product.
3. The demo works with no API key (`SENTINEL_MUSE=false` or an empty key).
4. Prefer the CLI, the Action, and the README over a dashboard.
5. Mask secrets in logs and in Muse prompts. Refuse `*-contributor` model ids.

---

## How to run

```bash
cd project
node --test test/*.test.js
node scripts/demo-history.mjs
SENTINEL_MUSE=false node src/cli.js fixtures/leaky-repo
```

Details: [`project/README.md`](./project/README.md).

---

## Partners / credits (event)

- Baseten — credits + TPM for open weights
- Modal — credits / Endpoints / GPUs
- Fireworks — credits + workshop

Not used. The explanation path is Meta Model API. The gate stays local.

---

## Links

| What | URL |
|------|-----|
| Event | https://cerebralvalley.ai/e/meta-ai-developer-hackathon |
| Details (sign-in) | https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details |
| Discord (sign-in) | https://cerebralvalley.ai/e/meta-ai-developer-hackathon/discord |
| Kickoff / replay | https://cerebralvalley.ai/e/meta-ai-developer-hackathon/live |
| Model API | https://ai.developer.meta.com |
| Billing | https://ai.developer.meta.com/billing |
| SecSentry | https://github.com/umeraamir69/secsentry |

---

## Submission notes (draft)

- **Track:** Indie
- **Theme:** Build for Your World
- **Problem:** A secret deleted from HEAD still lives in `git log`. A diff-only grep misses it.
- **Solution:** Deterministic tree + diff + history gate. Muse explains and drafts rotation. Muse cannot pass the check.
- **Proof:** `node scripts/demo-history.mjs` exits the scanner with code 1 on a removed key. Unit tests cover the PR diff, allowlist, and Muse fallback. One live Muse call returned HTTP 200.

---

## Log

| When (ET) | Note |
|-----------|------|
| 2026-10-23 11:37 | Applied Indie · PR Diff Sentinel |
| 2026-10-25 23:18 | Accepted |
| 2026-10-26 11:30 | Day 1 scaffold |
| 2026-10-26 23:20 | Private status repo |
| 2026-10-26 23:55 | Gate, history, Action, Muse client, tests, Obsidian notes. Key stored only in `project/.env`. Muse verification HTTP 200. |
| 2026-10-27 | Next.js site, Chrome extension, GitHub URL scan. Credits confirmed, rules accepted, Discord joined. |
| 2026-10-27 | Pre-commit hook + how-to docs. Separate in-progress src/ edits (rules, scan, decode, rotate) broke the self-scan test; hook work is green. |
| 2026-10-27 | Muse triage upgrade + docs. Blast radius, why_live, fix patches, ignore candidates, triage order, prompt dedupe, 25-finding cap. Full suite 72/72 green. |
| 2026-10-28/29 | AI-authorship detection (advisory Layer 1 + Muse-verdict Layer 2, rule-scoped strict), Chrome extension polish, 400-PR eval (97% recall, 0 clean-human false verdicts, GO), paper draft. Full suite 93/93 green. |
