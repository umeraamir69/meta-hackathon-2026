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

The app serves a local report at http://127.0.0.1:4317. With no arguments it builds a demo repo: a key deleted from `config.env` (still in history, labeled live) and a documentation example that stays (labeled example). Both block the merge.

Exit `1` means the gate failed. Exit `0` means no findings. No `MODEL_API_KEY` is required. Without a key, labels and the rotation checklist are local.

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

## What Muse is allowed to do

| | Decides pass/fail | Sees the raw secret |
| --- | --- | --- |
| Regex gate | Yes | Yes, locally, then masked |
| Muse Spark 1.3 | No. Labels `likely_live`, `likely_example`, `likely_fixture`, or `unclear` | No |
| Muse Wonder 1.0 | No. Explains live and unclear hits | No |

Copy `.env.example` to `.env` for a real Meta Model API key. Contributor-tier models are refused. A failed or refused model call falls back to the local checklist. The exit code does not change.

## Design

1. The rule engine is the only pass/fail.
2. This is not an AI code review.
3. The demo runs with no API key.
4. Secrets are masked before they are logged or sent.
