# PR Diff Sentinel extension (v0.5.2)

Chrome Manifest V3 popup + local dashboard. Scans go through the hosted `/api/scan` backend. History stays in `chrome.storage.local`.

## Install

**Store:** [PR Diff Sentinel](https://chromewebstore.google.com/detail/pr-diff-sentinel/ahlihmimlioaieccfbgbpmfabfjhmfch)

Or load unpacked:

1. Open `chrome://extensions` → Developer mode.
2. **Load unpacked** → select this `extension/` folder.
3. Confirm version **0.5.2**.
4. Open a public GitHub pull request → click the Sentinel icon.

Default backend: `https://pr-diff-sentinel.vercel.app`.

## Popup

- **PR or commit tab** → prefills and auto-scans.
- **File page pinned to a commit SHA** → scans that commit.
- **Repo home / branch / pulls index** → pick up to 5 PRs or commits; never auto-scans the whole repo.
- Shows Pass/Fail, risk score, top findings, Muse summary.
- **Open merge gate report** → hosted `/report` (PDF, Muse chat).
- **Local dashboard** → on-device overview + history.

## Dashboard

Opens as `chrome-extension://…/dashboard.html`.

- Overview — fail rate, scans, average risk
- Scan history — verdict, score, Muse headline, links
- Settings — clear history · backend URL

Metadata only. No raw secrets stored.

## Permissions

- `activeTab` — prefill from the current tab
- `storage` — scan history for the dashboard
- `https://github.com/*` — read the tab URL
- `https://pr-diff-sentinel.vercel.app/*` — hosted scan + report

## Check

```bash
node --check popup.js history.js dashboard.js
```
