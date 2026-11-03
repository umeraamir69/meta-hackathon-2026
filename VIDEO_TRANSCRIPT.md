# Demo video — spoken transcript (≤ **3:00** — cut hard)

Official: **three-minute** demo of what you built in the hackathon.  
Judges score **Meta AI tooling 25%** — say **Muse Spark** and **Muse Wonder** on camera and show a live Muse reply.

Record 1080p. Terminal ≥ 18pt. Browser + terminal side by side.  
**Never show a real secret.**

Runbook: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) · Form: [`SUBMISSION.md`](./SUBMISSION.md) · Showcase: [`SHOWCASE.md`](./SHOWCASE.md) · VO: [`demo/video/`](./demo/video/)

---

## Open these (before record)

| Beat | Open |
|------|------|
| Site home | https://pr-diff-sentinel.vercel.app |
| Fail scan (prefilled) | https://pr-diff-sentinel.vercel.app/?url=https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1 |
| Testing (backup) | https://pr-diff-sentinel.vercel.app/testing |
| Fail PR on GitHub | https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1 |
| AI Pass scan (prefilled) | https://pr-diff-sentinel.vercel.app/?url=https://github.com/anthropics/skills/pull/66 |
| Extension help | https://pr-diff-sentinel.vercel.app/extension |
| Chrome extensions | `chrome://extensions` |
| Extension folder | [`extension/`](./extension/) (v**0.5.2**) |
| Leaky push demo | [`demo/leaky-push-demo/`](./demo/leaky-push-demo/) |
| Submit form | https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details |

**Terminal:**

```bash
cd /Users/umeraamir/Documents/meta-hackathon-2026/demo/leaky-push-demo && ./setup.sh
```

---

## 0:00–0:10 — Who I am

> Hi — I’m **Muhammad Umer Aamir**, master’s student at **Wilfrid Laurier University**, software developer in AI and security.
> This is **PR Diff Sentinel**, my Meta Global AI Hackathon project.

**Open:** https://pr-diff-sentinel.vercel.app

---

## 0:10–0:50 — What is a PR · the problem · how Sentinel works (speak naturally)

> So — what’s a pull request? It’s how developers ask to merge their code into the shared repo.
> The PR diff is just the lines they added or changed in that ask. Most secret scanners only look at that slice — then they stop.
>
> Here’s the problem with vibe coding. Developers delete a key from a file, open a PR, and think they’re safe. But that secret can still live in git history — old commits, removed lines, even a commit message. Diff-only tools miss it, CI goes green, and the merge still ships the leak.
>
> **PR Diff Sentinel** is the merge gate for that. Rules decide Pass or Fail by scanning the PR diff **and** the commits behind it. **Muse Spark** labels each masked hit — likely live, or just a docs sample. **Muse Wonder** writes the rotate steps and runs the report chat. Muse explains. Muse cannot clear a Fail.

---

## 0:50–1:30 — Site Fail → report → Muse chat (core demo)

1. Open: https://pr-diff-sentinel.vercel.app/?url=https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1 → Scan → wait for **Fail**.  
2. **Open full report**.

Say:

> Instant Fail — blocking secrets.
>
> - Risk score
> - Findings
> - Fix plan
>
> **Muse Wonder** in the side chat — “What should I fix first?”

3. Flash **Download PDF**.  
4. Muse chat: *What should I fix first?* — show streaming answer.

Say:

> Report is cached — no second scan. Rules failed the gate; Wonder only explains.

---

## 1:30–1:50 — AI advisory (Pass, never blocks)

1. Open: https://pr-diff-sentinel.vercel.app/?url=https://github.com/anthropics/skills/pull/66 → Scan.

Say:

> Agent-authored work can **Pass** the secrets gate and still show AI advisories.
>
> - Advisory only
> - Evidence for a human
> - Never a merge stop

*(Skip if behind on time.)*

---

## 1:50–2:20 — Extension

1. GitHub: https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1  
2. Sentinel icon → Fail + risk.  
3. **Full report** link.  
4. **Dashboard** flash if ≤5s.

Say:

> One click from the PR tab.
>
> - Same gate as the website
> - History on this device — metadata only, no raw secrets

---

## 2:20–2:45 — CLI hook blocks commit

```bash
cd /Users/umeraamir/Documents/meta-hackathon-2026/demo/leaky-push-demo
./setup.sh
git add app.py config.json
git commit -m "ship credentials"
```

Show **FAIL** / commit aborted.

Say:

> Same rules offline.
>
> - Pre-commit blocks the leak before push
> - CI and the Action use the same gate

---

## 2:45–3:00 — Close

**On screen:** https://pr-diff-sentinel.vercel.app

> - Rules block
> - Muse Spark labels
> - Muse Wonder explains
> - Secrets stay masked
>
> That’s PR Diff Sentinel — thanks for watching.

---

## If you’re over 3:00 — cut in this order

1. AI advisory beat  
2. Extension dashboard  
3. PDF flash  
4. Shorten PR-diff explainer to two lines  

**Never cut:** Fail showcase · Muse Wonder chat · “Muse cannot clear Fail” · hook block · Spark/Wonder names in close.

---

## Day-of checklist

- [ ] Prefill Fail URL loads; Muse chat streams  
- [ ] Extension **0.5.2** reloaded  
- [ ] Hook demo blocks commit  
- [ ] Final cut ≤ **3:00**  
- [x] Upload → https://www.loom.com/share/568f5bb5a2d04286b8c8a803de925843  
- [x] Submitted on Cerebral Valley (2026-11-03)
