# RQ3 results — Muse cannot change Pass/Fail

Generated: 2026-11-05T18:12:14.241Z
MODEL_API_KEY present: yes (length 48; value never logged)

**Cases:** 16
**Flips (ok off ≠ ok on):** 0
**Verdict:** PASS — 0 flips
Muse live provider runs: 15
Local-fallback muse runs: 0

| Case | ok Muse off | ok Muse on | Flip | Muse provider | Labels |
|------|-------------|------------|------|---------------|--------|
| h01-aws-example-deleted | false | false | no | muse-spark | 2 |
| h02-github-pat-deleted | false | false | no | muse-spark | 2 |
| h03-db-url-deleted | false | false | no | muse-spark | 2 |
| h04-openai-key-deleted | false | false | no | muse-spark | 4 |
| h05-slack-token-deleted | false | false | no | muse-spark | 2 |
| h06-stripe-key-deleted | false | false | no | muse-spark | 4 |
| h07-private-key-deleted | false | false | no | muse-spark | 1 |
| h08-gitlab-pat-deleted | false | false | no | muse-spark | 2 |
| h09-sendgrid-deleted | false | false | no | muse-spark | 2 |
| h10-twilio-deleted | false | false | no | muse-spark | 6 |
| h11-npm-token-deleted | false | false | no | muse-spark | 2 |
| h12-slack-webhook-deleted | false | false | no | muse-spark | 2 |
| h13-generic-password-deleted | false | false | no | muse-spark | 2 |
| h14-anthropic-key-deleted | false | false | no | muse-spark | 4 |
| h15-aws-secret-pair-deleted | false | false | no | muse-spark | 4 |
| h16-clean-control | true | true | no | — | 0 |

## Method

1. `collectReport(dir)` with `SENTINEL_MUSE=false`.
2. Same with `SENTINEL_MUSE=true` (Spark + Wonder via Meta Model API).
3. Compare boolean `report.ok` only. Findings counts should match; Muse may only add labels/notes.
