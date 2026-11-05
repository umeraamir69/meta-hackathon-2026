# RQ1 results

Generated: 2026-11-05T03:08:11.645Z
Gitleaks: 8.30.1

**History-leak cases:** 15
**RQ1 pattern (Sentinel history Fail ∧ Sentinel tree Pass ∧ Gitleaks tree Pass):** 15/15 (100.0%)

| Case | Sent hist | Sent tree | Gitleaks tree | Gitleaks git | RQ1 |
|------|-----------|-----------|---------------|--------------|-----|
| h01-aws-example-deleted | Fail(2) | Pass | Pass | Pass | yes |
| h02-github-pat-deleted | Fail(2) | Pass | Pass | Fail(1) | yes |
| h03-db-url-deleted | Fail(2) | Pass | Pass | Pass | yes |
| h04-openai-key-deleted | Fail(4) | Pass | Pass | Fail(1) | yes |
| h05-slack-token-deleted | Fail(2) | Pass | Pass | Pass | yes |
| h06-stripe-key-deleted | Fail(4) | Pass | Pass | Fail(1) | yes |
| h07-private-key-deleted | Fail(1) | Pass | Pass | Fail(1) | yes |
| h08-gitlab-pat-deleted | Fail(2) | Pass | Pass | Fail(2) | yes |
| h09-sendgrid-deleted | Fail(2) | Pass | Pass | Fail(1) | yes |
| h10-twilio-deleted | Fail(6) | Pass | Pass | Fail(1) | yes |
| h11-npm-token-deleted | Fail(2) | Pass | Pass | Fail(1) | yes |
| h12-slack-webhook-deleted | Fail(2) | Pass | Pass | Pass | yes |
| h13-generic-password-deleted | Fail(2) | Pass | Pass | Fail(1) | yes |
| h14-anthropic-key-deleted | Fail(4) | Pass | Pass | Pass | yes |
| h15-aws-secret-pair-deleted | Fail(4) | Pass | Pass | Fail(1) | yes |
| h16-clean-control | Pass | Pass | Pass | Pass | control |

## Notes

- RQ1 targets **tree/diff-only** miss after delete-from-HEAD.
- `gitleaks git` may also Fail (history-capable); reported for honesty, not as the RQ1 baseline.
