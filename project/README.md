# PR Diff Sentinel

Deterministic merge gate for secrets in a pull request **diff** and in **git history**.

Deleting a key from the latest file does not delete it from old commits. The check stays red until a person rotates the credential. **Muse Spark** labels each hit. **Muse Wonder** writes the rotation note for hits that look live. Neither model can pass the gate.

Indie track · Build for Your World · Meta Global AI Developer Hackathon.

## Run

```bash
cd project
node --test test/*.test.js
node scripts/demo-history.mjs
node src/cli.js fixtures/leaky-repo
node src/app.js
```

The app serves a local report at http://127.0.0.1:4317. Paste a public GitHub repository or pull request link and press Scan. The clone stays on this computer. **Run the built-in demo** uses a repo where a key was deleted from `config.env` and a documentation example remains. Both block the merge.

Exit `1` means the gate failed. Exit `0` means no findings. No `MODEL_API_KEY` is required. Without a key, labels and the rotation checklist are local.

## Pre-commit hook

The staged diff, on every commit. Muse stays off so it is fast and offline. CI still scans history; the hook checks only what you are about to commit.

```bash
cd project
node scripts/install-hook.mjs /path/to/your/repo
```

`git commit` now fails when the staged change adds secrets. Bypass one commit with `git commit --no-verify`. Knob: `SENTINEL_MUSE=true` for Muse labels. Re-run with `--force` to replace a hook this tool did not install.

## GitHub Action

```yaml
permissions:
  contents: read
  pull-requests: write
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
  - uses: ./
    with:
      base: ${{ github.event.pull_request.base.sha }}
      head: ${{ github.event.pull_request.head.sha }}
      model_api_key: ${{ secrets.MODEL_API_KEY }}
      github_token: ${{ github.token }}
```

`fetch-depth: 0` is required. A shallow checkout cannot see a deleted secret, and the scan fails closed on that.

### Protect another repository

This tracker repo is private, so a second repo cannot `uses:` it directly. Copy the `project/` folder into that repo and add this workflow at `.github/workflows/sentinel.yml`:

```yaml
name: Sentinel
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
jobs:
  sentinel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./project
        with:
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}
          model_api_key: ${{ secrets.MODEL_API_KEY }}
          github_token: ${{ github.token }}
```

If this repo ever goes public, replace `./project` with `umeraamir69/meta-hackathon-2026/project@<sha>`. Put the Model API key in that repo's Actions secrets as `MODEL_API_KEY`. Without it the gate fails exactly the same way; only the Muse labels fall back to local. Then enforce it: Settings → Branches → branch protection → require the `sentinel` status check before merging.

## What Muse is allowed to do

| | Decides pass/fail | Sees the raw secret |
| --- | --- | --- |
| Regex gate | Yes | Yes, locally, then masked |
| Muse Spark 1.3 | No. Labels `likely_live`, `likely_example`, `likely_fixture`, or `unclear` | No |
| Muse Wonder 1.0 | No. Runbook + `why_live` + redacted fix patch for live and unclear hits, ignore candidates for samples | No |

At most two batched model calls per scan; Wonder is skipped when every hit is an
example or fixture; identical hits share one prompt block; findings are capped
(`SENTINEL_MUSE_MAX_FINDINGS`, default 25) with a disclosure note.

Copy `.env.example` to `.env` for a real Meta Model API key. Contributor-tier models are refused. A failed or refused model call falls back to the local checklist. The exit code does not change.

Full inventory: [`FEATURES.md`](./FEATURES.md).

## Design

1. The rule engine is the only pass/fail.
2. This is not an AI code review.
3. The demo runs with no API key.
4. Secrets are masked before they are logged or sent.
