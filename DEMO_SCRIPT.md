# Demo video runbook — ~3:30

**Spoken lines:** [`VIDEO_TRANSCRIPT.md`](./VIDEO_TRANSCRIPT.md)

Record at 1080p, terminal + browser side by side. Terminal font ≥ 18pt.
No real secrets on screen at any point.

## Open these

| Beat | Link |
|------|------|
| Site | https://pr-diff-sentinel.vercel.app |
| Testing | https://pr-diff-sentinel.vercel.app/testing |
| Fail PR | https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1 |
| Fail scan (prefilled) | https://pr-diff-sentinel.vercel.app/?url=https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1 |
| AI Pass PR | https://github.com/anthropics/skills/pull/66 |
| AI Pass scan (prefilled) | https://pr-diff-sentinel.vercel.app/?url=https://github.com/anthropics/skills/pull/66 |
| Human Pass (optional) | https://github.com/curl/curl/pull/23631 |
| Extension help | https://pr-diff-sentinel.vercel.app/extension |
| Chrome extensions | `chrome://extensions` |
| Extension folder | [`extension/`](./extension/) (v**0.5.2**) |
| Leaky push demo | [`demo/leaky-push-demo/`](./demo/leaky-push-demo/) |
| History CLI | `cd project && SENTINEL_MUSE=false node scripts/demo-history.mjs` |
| Submit form | https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details |
| Submission draft | [`SUBMISSION.md`](./SUBMISSION.md) |

Full showcase table: [`SHOWCASE.md`](./SHOWCASE.md).

## Beat sheet (match the transcript)

| Time | Beat | Do |
|------|------|----|
| 0:00–0:10 | You | Name · WLU · PR Diff Sentinel |
| 0:10–0:50 | Explain | What is PR/diff (points) · developers + history leak · how Sentinel works |
| 0:50–1:30 | Site Fail | Prefill Fail → report → Muse chat “fix first?” |
| 1:30–1:50 | AI advisory | Pass + AI signals; never blocks (cut if overtime) |
| 1:50–2:20 | Extension | PR tab → Fail → report link |
| 2:20–2:45 | CLI hook | setup → commit **blocked** |
| 2:45–3:00 | Close | Rules · Spark · Wonder · thanks |

## Day-of checklist

- [ ] Hard refresh site; Fail + AI Testing cases work
- [ ] Muse chat: “What should I fix first?” returns an ordered plan
- [ ] PDF downloads; report does **not** re-scan after Open full report
- [ ] Extension reloaded at **0.5.2** (`chrome://extensions` → Reload)
- [ ] Dashboard shows latest scan + “Merge gate report” link
- [ ] `cd demo/leaky-push-demo && ./setup.sh` then `git add app.py config.json && git commit` → hook fails
- [ ] Vercel public (no login wall); `MODEL_API_KEY` set on prod for live Muse
- [ ] Paste video URL into `SUBMISSION.md`
- [ ] Submit on Cerebral Valley details page
