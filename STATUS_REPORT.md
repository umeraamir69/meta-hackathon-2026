# PR Diff Sentinel — status report

**Verified:** 2026-11-02 ~1:40 PM ET  
**Deadline:** 2026-11-04 9:00 PM ET (**~50 hours left**)  
**Track:** Indie · Theme: Build for Your World  
**Owner:** Muhammad Umer Aamir (`umeraamir69`)

Companion canvas (open beside chat):  
`~/.cursor/projects/Users-umeraamir-Documents-meta-hackathon-2026/canvases/hackathon-status.canvas.tsx`

---

## Verdict

The product works. The merge gate, Muse triage, hosted site, extension, and CI are green. What is left is **submission packaging**, not more features: make the repo visible to judges, record the demo, set the Actions secret, submit on Cerebral Valley.

---

## Verified today

| Check | Result |
|-------|--------|
| Unit tests (`cd project && npm test`) | **94/94 pass** |
| History demo (`node scripts/demo-history.mjs`) | **FAIL as expected** — `likely_live: 2`, `likely_example: 2`, local Muse fallback |
| Next.js build (`cd web && npm run build`) | **OK** — `/`, `/extension`, `/api/scan`, `/api/list` |
| Live site `https://pr-diff-sentinel.vercel.app` | **HTTP 200** |
| Live scan `octocat/Hello-World` | **OK** — `ok: true`, 0 findings |
| Live scan this repo | **Blocked** — GitHub returns 404 (repo is **private**) |
| Extension `popup.js` syntax | **OK** |
| Recent GitHub Actions CI | **5/5 success** on latest pushes |
| Local `project/.env` | **Present** (gitignored) |
| GitHub Actions secret `MODEL_API_KEY` | **Set** (2026-11-02) |
| Git sync | `main` matches `origin/main` (only local `META.md` dirty + untracked trajectory file) |

---

## What is already done

- Indie acceptance, Official Rules, Discord, $150 Meta credits + spend limit  
- Deterministic gate: working tree, git history (including deleted secrets + commit messages), PR diff  
- Muse Spark labels + Muse Wonder rotate path; Muse never decides pass/fail  
- Offline fallback when no key  
- GitHub Action + pre-commit hook  
- Local report app, Next.js site, Chrome MV3 extension  
- AI-authorship advisory signals + eval notes  
- Docs: `SUBMISSION.md`, `DEMO_SCRIPT.md`, `project/FEATURES.md`, Obsidian vault notes  
- Site live at https://pr-diff-sentinel.vercel.app  

---

## Gaps that block a strong submit

1. **GitHub repo is private**  
   Judges cannot open https://github.com/umeraamir69/meta-hackathon-2026.  
   The hosted scanner also cannot scan it without a token.  
   **Action:** Settings → Change visibility → **Public** (or publish a public fork / demo repo and put that URL on the form).

2. **Demo video URL — deferred to tomorrow**  
   `SUBMISSION.md` still has `Demo video: <URL>`.  
   **Action tomorrow:** Record ~3 min from `DEMO_SCRIPT.md`, upload (YouTube unlisted / Loom), paste the link.

3. **Cerebral Valley submit — deferred to tomorrow**  
   Build window ends **Nov 4, 9:00 PM ET**.  
   **Action tomorrow:** Submit Indie + Build for Your World with repo, site, and video links.

4. ~~**GitHub Actions secret missing**~~ **Done (2026-11-02)**  
   `MODEL_API_KEY` is set on the repo. Workflow reads `${{ secrets.MODEL_API_KEY }}`. Do not commit the key.

5. **Optional: `GITHUB_TOKEN` on Vercel**  
   Raises rate limits for `/api/scan` on busy public repos. Not required for Hello-World smoke tests.

---

## Do this next (order)

| # | Task | Why | Est. |
|---|------|-----|------|
| 1 | Make the GitHub repo **public** | Judges + live site need it | 2 min |
| 2 | Set Actions secret `MODEL_API_KEY` | Muse in CI / PR demo | 3 min |
| 3 | **Tomorrow:** Record demo per `DEMO_SCRIPT.md` | Required proof | 30–45 min |
| 4 | **Tomorrow:** Fill `SUBMISSION.md` video URL | Ready to paste into form | 2 min |
| 5 | **Tomorrow:** Submit on Cerebral Valley | Only thing that counts | 15 min |
| 6 | (Optional) Add `GITHUB_TOKEN` on Vercel `web` project | Rate limits | 5 min |

Freeze new features after the video. Deadline is packaging, not scope.

---

## Demo path (when you record)

```bash
cd project
npm test                          # expect 94 pass
SENTINEL_MUSE=false node scripts/demo-history.mjs   # expect FAIL
# then with key: unset SENTINEL_MUSE and show Muse rotate section
```

Browser cuts:

1. https://pr-diff-sentinel.vercel.app — scan a **public** PR  
2. Chrome extension popup on that same PR tab  
3. (If public) a failing PR check + comment on GitHub  

---

## Links

| What | URL |
|------|-----|
| Live site | https://pr-diff-sentinel.vercel.app |
| Repo (currently private) | https://github.com/umeraamir69/meta-hackathon-2026 |
| Event | https://cerebralvalley.ai/e/meta-ai-developer-hackathon |
| Billing / credits | https://ai.developer.meta.com/billing |
| Demo script | [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) |
| Submission draft | [SUBMISSION.md](./SUBMISSION.md) |

---

## Design rules (do not break before submit)

1. Muse never decides pass/fail.  
2. Not a generic AI code reviewer.  
3. Demo must work with no API key.  
4. Mask secrets in logs and Muse prompts.
