# Sentinel extension

Chrome (Manifest V3) popup. It reads the GitHub link from the current tab and scans it through the site's `/api/scan`.

## Install

1. Open `chrome://extensions` and turn on Developer mode.
2. Load unpacked → select this `extension/` folder.
3. Open a public GitHub repo or pull request, click the Sentinel icon.
4. Put the site URL in the API field (local default `http://127.0.0.1:3000`, or the Vercel URL after deploy). It is saved in the browser.

No build step. Icons and popup only; the gate runs on the server.

## What the popup shows

Verdict and finding count, severity and label per hit, masked value, where it
lives (diff, commit, removed, encoded, or deleted from current files), the
Muse summary with rotation steps, and an "Open full report" link that reopens
the same scan on the site.

## Permissions

- `storage`: remembers the API field.
- `activeTab`: reads the current tab's URL to prefill the form.
- `https://github.com/*`: the tab URL is only readable with a matching host
  permission; without it the field stays empty.
- `http://127.0.0.1/*`, `http://localhost/*`, `https://*.vercel.app/*`: scan
  endpoints. Narrow the API field to the one you use.

## Check

```bash
node --check popup.js
```

Manifest V3, no background service. To package for the Chrome Web Store, zip
this folder's contents (manifest, popup, icons).
