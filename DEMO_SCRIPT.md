# Demo video runbook — 3:00 sharp

Record at 1080p, terminal + browser side by side. Terminal font ≥ 18pt.
No real secrets on screen at any point.

## Links to use (pre-verified 2026-10-31, re-check day-of)

- **Agent PR (fires):** `https://github.com/anthropics/skills/pull/66`
  — Claude-labeled agent PR; scans `likely_agent` with `ai_trailer` signals
  and Muse evidence. Backup: `https://github.com/crewAIInc/crewAI/pull/2633`.
- **Human PR (silent):** `https://github.com/curl/curl/pull/23631`
  — maintainer PR, zero signals, stays silent (Layer 2 never runs).
- **Big repo (graceful path):** `https://github.com/psf/requests`
  — tree skipped over the cap, commits scanned, nothing hidden.
- Proof numbers to quote: 400-PR eval, 97.0% agent recall,
  0 false verdicts on 165 verified-clean humans (`project/AI_SIGNALS.md` §10).

## 0:00–0:25 — The gut punch (secrets survive delete)

1. Open the fixture repo. Show `config.env` — the key was deleted.
2. Run `git log -p -- config.env | head -40` — the key is still there.
3. Say: *"The secret is gone, but it isn't. A diff-only grep misses this."*

## 0:25–1:05 — The gate (rules block, Muse explains)

1. `cd project && node scripts/demo-history.mjs`
   Show: `history gate: FAIL`, `likely_live` vs `likely_example` labels.
2. Scroll one PR comment: findings table → Muse section (Spark labels with
   reasons) → Rotate (blast radius, runbook, `filter-repo` command).
3. Say: *"Rules block the merge. Muse explains — and Muse can never pass it.
   Masked values only; raw secrets never leave the machine."*

## 1:05–2:15 — The AI detector (live, the centerpiece)

1. On the site, paste the **agent PR**. Scan. Verdict stays green: Pass.
2. Click the **AI signals bar** to expand. Show, top to bottom:
   `likely_agent (medium confidence)` → evidence lines (`ai_trailer` + why)
   → review-focus checks → the masked trailer text.
3. Say: *"Signals, not proof — advisory, never blocking. Every claim shows
   its evidence, and unclear cases abstain instead of guessing."*
4. Paste the **human PR**. Scan. Zero signals, stays silent.
   Say: *"A human PR: nothing fires, and the model is never even called —
   silence costs zero tokens."*
5. Flash the eval numbers: *"400 PRs measured: 97% of agent PRs caught,
   zero false verdicts on verified-clean humans."*

## 2:15–2:45 — The picker + extension (30-second montage)

1. Paste a repo link → tick 3 commits → progress bar
   (`Checking 2/3…`) → per-item Pass/Fail rows with avatars.
2. Open a GitHub PR → click the Sentinel icon → popup auto-scans →
   expand the AI panel in the popup.
3. Say: *"Pick any commits, scan ten at once, or one-click from any PR tab."*

## 2:45–3:00 — The close

1. `node --test test/*.test.js` → **94 passing**.
2. Closing line: *"Rules block the merge. Muse explains. AI authorship is
   flagged with evidence, never accused."*

## Day-before checklist

- [ ] Re-scan all four demo links once; confirm agent→fires, human→silent
- [ ] Vercel login wall OFF (public must reach the site)
- [ ] `MODEL_API_KEY` set so the live verdicts run (else Layer 2 stays dark)
- [ ] Fixture repo reset so the secret segment is reproducible
- [ ] Extension loaded unpacked, API field set to the live site URL
- [ ] AI_SIGNALS.md §10 open in a tab in case judges ask for the numbers
