# Sentinel extension (v0.5.1)

Chrome (Manifest V3) popup + **local dashboard**. Scans go through the hosted `/api/scan` backend. History stays in `chrome.storage.local`.

## Install / reload for the video

1. Open `chrome://extensions` → Developer mode.
2. **Load unpacked** → select this `extension/` folder (or **Reload** if already loaded).
3. Confirm version **0.5.1** on the card.
4. Open a public GitHub pull request → click the Sentinel icon.

No API URL to paste — talks to `https://pr-diff-sentinel.vercel.app` automatically.

## Popup

- **PR or commit tab** → prefills and auto-scans.
- **File page pinned to a commit SHA** → scans that commit.
- **Repo home / branch file-folder / pulls index** → lists recent PRs + commits; you pick up to 5, then scan. Never auto-scans the whole repo.
- Shows Pass/Fail, risk score, top findings, Muse summary.
- **Open merge gate report** → hosted `/report` (score, findings, fix plan, PDF, Muse chat).
- **Local dashboard** → on-device overview + history.

## Dashboard (local, on-device)

Opens as `chrome-extension://…/dashboard.html`.

- **Overview** — fail rate, scans, average risk, AI advisory note · link to Testing demos
- **Scan history** — verdict, score/grade, Muse headline blurb, merge gate report + GitHub
- **Settings** — clear history · backend URL

Metadata only (URL, source, verdict, score, counts, headline). No raw secrets stored.

## Permissions

- `activeTab` — prefill from the current tab
- `storage` — save scan history for the dashboard
- `https://github.com/*` — read the tab URL
- `https://pr-diff-sentinel.vercel.app/*` — hosted scan + report

## Check

```bash
node --check popup.js history.js dashboard.js
```
