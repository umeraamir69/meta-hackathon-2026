# Chrome Web Store listing — PR Diff Sentinel

Use this when finishing the draft after the ZIP upload.

## Package

- Zip: `/Users/umeraamir/Documents/meta-hackathon-2026/extension/pr-diff-sentinel-0.5.1.zip`
- Version: `0.5.1` (from `manifest.json`) — popup picker on repo home, local dashboard, merge-gate report links
- Account: `umeraamir45@gmail.com` (1/2 extension slots used by ApplySafe)
- Item ID: `ahlihmimlioaieccfbgbpmfabfjhmfch`

## Listing copy

**Name:** PR Diff Sentinel

**Summary (132 chars max):**  
Scan a public GitHub PR for secrets still in the diff or commit history. Rules decide Pass/Fail. Muse only explains.

**Description:**

PR Diff Sentinel is a merge gate for secrets that survive a delete.

Paste or open a public GitHub pull request. The extension reads the tab URL and scans through the hosted Sentinel API. The gate fails if a secret is in the PR diff or still recoverable from those commits. Muse can label and explain a hit. Muse cannot clear the check.

How to use
1. Install the extension and pin it.
2. Open a public GitHub pull request.
3. Click the Sentinel icon. The PR link fills from the tab and scans the hosted backend automatically.
4. Pass or Fail appears with masked findings.

What it checks
- Pull request diff
- Recent commits on that request (including removed lines and commit messages)
- AI authorship signals (advisory only — never blocks)

Privacy
- Scans run against public GitHub URLs you choose.
- Secrets are masked in results.
- The extension does not store personal data; it only reads the active tab URL.
- No account required inside the extension.

Public GitHub repositories only.

**Category:** Developer Tools  
**Language:** English  

## Store assets still needed

Chrome requires these before you can submit for review:

1. Store icon **128×128** (we have `icon128.png` — may need a padded marketing version)
2. At least **1 screenshot** 1280×800 or 640×400 (popup on a GitHub PR)
3. Small promo tile optional: 440×280
4. Privacy practices questionnaire (single purpose, storage, host permissions)

## Chrome Web Store status (submitted)

- Item ID: `ahlihmimlioaieccfbgbpmfabfjhmfch`
- Status: **Pending review** — public page returns “Item not available” until Google publishes
- Listing URL: https://chromewebstore.google.com/detail/pr-diff-sentinel/ahlihmimlioaieccfbgbpmfabfjhmfch
- Visibility selected at submit: Public (all regions), Free
- Privacy policy: https://pr-diff-sentinel.vercel.app/privacy
- Store assets: `extension/store-assets/store-icon-128.png`, `screenshot-1280x800.png`
- When live: set `STORE_LIVE = true` in `web/app/extension/page.js`
