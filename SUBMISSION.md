# Submission draft — PR Diff Sentinel

**Track:** Indie developer · **Theme:** Build for Your World
**Event:** Meta Global AI Developer Hackathon · Submit by Nov 4, 9:00 PM ET

## Problem

Deleting a secret from the latest file does not delete it from git. The value
still sits in old commits, in removed lines, sometimes in a commit message —
and a diff-only grep never sees it. Every OSS maintainer has shipped this
exact leak.

## Solution

A deterministic merge gate over the working tree, the PR diff, **and** git
history. The rule engine is the only pass/fail. The check stays red until a
person rotates the credential.

Muse triages after a failure and can never clear the gate:

- **Muse Spark** labels each masked hit: `likely_live`, `likely_example`,
  `likely_fixture`, `unclear`.
- **Muse Wonder** explains only live and unclear hits: a `why_live` verdict,
  a repo-specific rotate runbook with blast radius and a `filter-repo` purge
  command, a redacted fix patch, and `.sentinelignore` candidates for samples.

Secrets are masked before any model call. Contributor-tier models are refused.
A failed call falls back to a local checklist; the exit code never changes.

## Why not an AI code reviewer

The crowded lane is "an LLM reviews your PR." This inverts it: rules block the
merge, models explain. That is the responsible pattern for AI in security
tooling — a model that can wave through a leak is a liability, not a feature.

## How it differs from existing scanners

gitleaks and trufflehog find secrets; GitHub push protection blocks some at
push time. Sentinel is the merge gate that combines tree + PR diff + history
in one check, fails closed on shallow clones, marks
deleted-from-files-but-still-in-git hits explicitly, and ships Muse triage
(labels, blast radius, runbook, fix patch) in the same PR comment — with
pre-commit parity so the same rule fails locally before it fails in CI.

## Proof it works

- 93 unit tests green, including a self-scan (the tool scans its own tree).
- `node scripts/demo-history.mjs`: a removed key fails the gate with code 1.
- One live Muse call verified (HTTP 200); demo runs with no key via fallback.
- AI-authorship signals (advisory): 400-PR eval, 97.0% agent recall, 0 false verdicts on 165 verified-clean human PRs (see `project/AI_SIGNALS.md` §10).
- Ships as CLI, GitHub Action, pre-commit hook, local report app, hosted
  Next.js site, and Chrome extension.

## Links (fill in at submit time)

- Demo video: <URL>
- Live site: https://pr-diff-sentinel.vercel.app
- Repo: https://github.com/umeraamir69/meta-hackathon-2026
