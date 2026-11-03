# Showcase scan targets (video)

Use **Testing** in the site nav: https://pr-diff-sentinel.vercel.app/testing

| Kind | Expect | PR |
|------|--------|----|
| **Fail** | Fail · blocking secrets (AWS, PAT, DB…) | https://github.com/davidCrejenovschi/Secrets.Sandbox/pull/1 |
| **AI #1** | Pass · AI advisories (never blocks) | https://github.com/anthropics/skills/pull/66 |
| **AI #2** | Pass · AI advisories (never blocks) | https://github.com/Provenance-Emu/Provenance/pull/2995 |
| **Human #1** | Pass · silent | https://github.com/curl/curl/pull/23631 |
| **Human #2** | Pass · silent | https://github.com/eslint/eslint/pull/21400 |
| **Mixed** | Pass · mixed / AI checkbox | https://github.com/eslint/eslint/pull/21364 |

Backup AI PR if #1 is slow: https://github.com/crewAIInc/crewAI/pull/2633

Script beat: Fail secrets → AI Pass+signals → human silence → mixed → “signals, not proof.”
