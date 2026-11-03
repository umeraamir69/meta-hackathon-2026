# PR Diff Sentinel

**A merge gate for secrets that survive a delete.**

Rules decide Pass/Fail over the working tree, the PR diff, and the commits behind it. **Muse Spark** labels each masked hit. **Muse Wonder** writes rotate steps and powers live report chat. Muse explains only — it cannot clear a Fail.

Indie · Build for Your World · [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)

| | |
|---|---|
| **Live site** | https://pr-diff-sentinel.vercel.app |
| **Demo video** | https://www.loom.com/share/568f5bb5a2d04286b8c8a803de925843 |
| **Chrome extension** | [Chrome Web Store](https://chromewebstore.google.com/detail/pr-diff-sentinel/ahlihmimlioaieccfbgbpmfabfjhmfch) |
| **Team** | Someone (#1032) · Muhammad Umer Aamir |

---

## The problem

People remove a key from a file, open a PR, and assume they are safe. Diff-only scanners miss git history; CI goes green; the merge still ships the leak. That failure mode got worse with vibe coding.

## What this does

1. **Rules scan** the working tree, the PR diff, and history for 40+ secret patterns (encoded layers unwrapped).
2. **Gate stays red** until a human rotates the credential — documentation examples still Fail; only a person clears them.
3. **Muse Spark** (`muse-spark-1.3`) labels masked hits: `likely_live` · `likely_example` · `likely_fixture` · `unclear`.
4. **Muse Wonder** (`muse-wonder-1.0`) writes rotate / blast-radius triage and streams **report-only** Muse chat.
5. **AI-authorship advisories** (bot trailers, agent branches, workspace artifacts) never block the secrets gate.

**Not an AI code reviewer.** Secrets are masked before any Meta Model API call. Contributor-tier models are refused. Missing `MODEL_API_KEY` → local checklist fallback; Pass/Fail never flips.

---

## Try it

**Hosted scan** — paste a public PR: https://pr-diff-sentinel.vercel.app  
**Known Fail demo** — https://pr-diff-sentinel.vercel.app/testing → Secrets.Sandbox#1

```bash
# CLI + tests
cd project
node --test test/*.test.js          # 94 tests
node scripts/demo-history.mjs       # deleted key still Fails (by design)
node src/cli.js fixtures/leaky-repo

# Site (local)
cd web && npm install && npm run dev   # http://127.0.0.1:3000

# Pre-commit / pre-push on another repo
cd project && node scripts/install-hook.mjs /path/to/your/repo
```

**Chrome** — Load unpacked from [`extension/`](./extension/) (v0.5.2), or install from the Store link above. On a GitHub PR tab it prefills and scans; on a repo home you pick PRs/commits (never auto-scans the whole repo).

---

## Meta models

| Model | Role |
|-------|------|
| **Muse Spark** | Labels each masked finding after a Fail |
| **Muse Wonder** | Rotate steps, blast radius, streaming Muse chat on `/report` |

Called via `https://api.meta.ai` (Responses API) with `MODEL_API_KEY`.

---

## Repo layout

```
project/     CLI, rules engine, GitHub Action, hooks, tests
web/         Next.js site (Vercel root directory = web)
extension/   Chrome MV3 popup + local dashboard
demo/        Leaky-push demo (fake secrets for local hooks)
```

| Doc | Purpose |
|-----|---------|
| [`project/README.md`](./project/README.md) | Detectors, Action, CLI flags |
| [`web/README.md`](./web/README.md) | Site + Vercel |
| [`extension/README.md`](./extension/README.md) | Extension install |
| [`project/AI_SIGNALS.md`](./project/AI_SIGNALS.md) | Advisory AI-authorship signals |

---

## GitHub Action

```yaml
permissions:
  contents: read
  pull-requests: write
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0   # required — shallow clones fail closed
  - uses: ./project
    with:
      base: ${{ github.event.pull_request.base.sha }}
      head: ${{ github.event.pull_request.head.sha }}
      model_api_key: ${{ secrets.MODEL_API_KEY }}
      github_token: ${{ github.token }}
```

Copy `project/` into another repo if you cannot `uses:` this path directly — see [`project/README.md`](./project/README.md).

---

## License / hackathon

Built for the Meta Global AI Developer Hackathon (2026). Demo secrets in fixtures and `demo/leaky-push-demo` are fake — do not use them anywhere real.
