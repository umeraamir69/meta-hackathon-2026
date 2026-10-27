# Demo video script — 3 minutes

Record at 1080p. Terminal + browser side by side. No key needed for most of
it; use the real `MODEL_API_KEY` for the Muse segment to prove the live call.

## 0:00–0:30 — The gut punch

1. Open the fixture repo. Show `config.env` — the key was deleted.
2. Run `git log -p -- config.env | head -40` — the key is still there.
3. Say: "The secret is gone, but it isn't. A diff-only grep misses this."

## 0:30–1:30 — The gate

1. `cd project && node scripts/demo-history.mjs`
   Show: `history gate: FAIL`, `likely_live: 2`, `likely_example: 2`.
2. Open a PR in the demo repo; show the Sentinel check red.
3. Scroll the single PR comment: findings table, triage order (live history
   hit first, doc example last).
4. Say: "Rules block the merge. Both the removed key and the doc sample fail.
   The check stays red until a person rotates the credential."

## 1:30–2:30 — The triage (live Muse call)

1. Show the masked values on screen — nothing raw ever leaves the machine.
2. Scroll to the Muse section: Spark labels with reasons.
3. Scroll to Rotate: `why_live` verdict, blast radius (commits, files,
   authors, dates), ordered runbook, `filter-repo` purge command, redacted
   fix patch as a diff block.
4. Show the suggested `.sentinelignore` line for the doc sample only.
5. Flash the terminal usage line / HTTP 200 to prove the call is live.
6. Say: "Muse explains. Muse can never pass the gate."

## 2:30–3:00 — The close

1. Quick cuts: pre-commit hook blocking a commit, the hosted site scanning a
   PR link, the Chrome extension popup.
2. `node --test test/*.test.js` → 72 passing.
3. Closing line: "Rules block the merge. Muse explains. Secrets stay masked."

## Checklist before recording

- [ ] `MODEL_API_KEY` Actions secret set (for the CI segment if shown live)
- [ ] Vercel site deployed (for the site cut)
- [ ] Fixture repo reset so the demo is reproducible
- [ ] Terminal font ≥ 18pt, no real secrets visible anywhere
