# Meta Global AI Developer Hackathon — full status

**Last updated:** 2026-10-26 ~11:55pm ET
**Owner:** Muhammad Umer Aamir (`umeraamir69`)
**Event page:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon
**Notes:** Obsidian vault `/Users/umeraamir/Documents/Obsidian Vault/Meta Hackathon 2026`

---

## One-line status

**ACCEPTED** · Indie track · **PR Diff Sentinel** · Regex gate, Muse Spark labels, Muse Wonder notes, local report app, history demo · Credits, rules click-through, demo video, and submission are still open.

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

### Still on you

- [ ] Submit the **$150 credits form** from the Oct 26, 7:26 AM Cerebral Valley email. The link did not survive a paste; open that message and use “this form.”
- [ ] On [Billing](https://ai.developer.meta.com/billing): confirm the free credit landed, confirm a card is on the account, and set a **spend-limit notification at $150**. A successful API call does not prove the grant is what paid for it.
- [ ] Accept **Official Rules** on Cerebral Valley.
- [ ] Join Discord from the event details page.
- [ ] When this repo is on GitHub, add Actions secret `MODEL_API_KEY`. Do not put the value in the workflow file.
- [ ] Record the demo (history fail → Muse explanation → rotate checklist).
- [ ] Submit before **Nov 4, 9:00 PM ET**.

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
