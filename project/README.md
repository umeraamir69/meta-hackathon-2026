# PR Diff Sentinel

**Meta Global AI Developer Hackathon** · Indie · Build for Your World

Deterministic secret scan on PR **diff + git history**. Exit non-zero on hit. **Muse Wonder** only explains findings and drafts a rotate checklist — it never decides pass/fail.

## Why

AI code review is crowded. A merge gate that fails on real secret patterns, then uses Muse for triage, is a sharper wedge. Built on the same problem space as [SecSentry](https://github.com/umeraamir69/secsentry).

## Quick start

```bash
node src/cli.js .
# exit 1 + JSON findings if secrets present
```

GitHub Action: see `action.yml` and `.github/workflows/sentinel.yml`.

## Design

| Layer | Role |
|-------|------|
| Rules + scan | Pass/fail. Offline. No LLM. |
| Muse Wonder | Explain + rotate checklist after a fail |

## Status

Day 1 scaffold (2026-10-26). Next: planted-secret demo PR, Muse HTTP client after kickoff credentials.
