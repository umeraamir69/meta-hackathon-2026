# RQ2 results — Muse Spark vs human (fixture GT)

Generated: 2026-11-05T18:13:18.283Z
Classifier: muse-spark-1.3
MODEL_API_KEY: present (len 48)

**Findings labeled:** 41
**Agreement:** 41/41 (100.0%)

## Confusion (human→spark)

- likely_example→likely_example: 6
- likely_live→likely_live: 35

## Per finding

| ID | Rule | Human | Spark | Agree |
|----|------|-------|-------|-------|
| h01-aws-example-deleted#0 | aws_access_key | likely_example | likely_example | yes |
| h01-aws-example-deleted#1 | aws_access_key | likely_example | likely_example | yes |
| h02-github-pat-deleted#0 | github_pat | likely_live | likely_live | yes |
| h02-github-pat-deleted#1 | github_pat | likely_live | likely_live | yes |
| h03-db-url-deleted#0 | db_url | likely_live | likely_live | yes |
| h03-db-url-deleted#1 | db_url | likely_live | likely_live | yes |
| h04-openai-key-deleted#0 | openai_key | likely_live | likely_live | yes |
| h04-openai-key-deleted#1 | generic_api_key | likely_live | likely_live | yes |
| h04-openai-key-deleted#2 | openai_key | likely_live | likely_live | yes |
| h04-openai-key-deleted#3 | generic_api_key | likely_live | likely_live | yes |
| h05-slack-token-deleted#0 | slack_token | likely_live | likely_live | yes |
| h05-slack-token-deleted#1 | slack_token | likely_live | likely_live | yes |
| h06-stripe-key-deleted#0 | stripe_live | likely_live | likely_live | yes |
| h06-stripe-key-deleted#1 | generic_api_key | likely_live | likely_live | yes |
| h06-stripe-key-deleted#2 | stripe_live | likely_live | likely_live | yes |
| h06-stripe-key-deleted#3 | generic_api_key | likely_live | likely_live | yes |
| h07-private-key-deleted#0 | private_key_pem | likely_live | likely_live | yes |
| h08-gitlab-pat-deleted#0 | gitlab_pat | likely_live | likely_live | yes |
| h08-gitlab-pat-deleted#1 | gitlab_pat | likely_live | likely_live | yes |
| h09-sendgrid-deleted#0 | sendgrid_key | likely_live | likely_live | yes |
| h09-sendgrid-deleted#1 | sendgrid_key | likely_live | likely_live | yes |
| h10-twilio-deleted#0 | twilio_key | likely_live | likely_live | yes |
| h10-twilio-deleted#1 | twilio_key | likely_live | likely_live | yes |
| h10-twilio-deleted#2 | generic_api_key | likely_live | likely_live | yes |
| h10-twilio-deleted#3 | twilio_key | likely_live | likely_live | yes |
| h10-twilio-deleted#4 | twilio_key | likely_live | likely_live | yes |
| h10-twilio-deleted#5 | generic_api_key | likely_live | likely_live | yes |
| h11-npm-token-deleted#0 | npm_token | likely_live | likely_live | yes |
| h11-npm-token-deleted#1 | npm_token | likely_live | likely_live | yes |
| h12-slack-webhook-deleted#0 | slack_webhook | likely_live | likely_live | yes |
| h12-slack-webhook-deleted#1 | slack_webhook | likely_live | likely_live | yes |
| h13-generic-password-deleted#0 | generic_password | likely_live | likely_live | yes |
| h13-generic-password-deleted#1 | generic_password | likely_live | likely_live | yes |
| h14-anthropic-key-deleted#0 | anthropic_api_key | likely_live | likely_live | yes |
| h14-anthropic-key-deleted#1 | generic_api_key | likely_live | likely_live | yes |
| h14-anthropic-key-deleted#2 | anthropic_api_key | likely_live | likely_live | yes |
| h14-anthropic-key-deleted#3 | generic_api_key | likely_live | likely_live | yes |
| h15-aws-secret-pair-deleted#0 | aws_access_key | likely_example | likely_example | yes |
| h15-aws-secret-pair-deleted#1 | aws_secret_access_key | likely_example | likely_example | yes |
| h15-aws-secret-pair-deleted#2 | aws_access_key | likely_example | likely_example | yes |
| h15-aws-secret-pair-deleted#3 | aws_secret_access_key | likely_example | likely_example | yes |

## Ground-truth policy

- `likely_example`: AWS documentation example material (h01, h15).
- `likely_live`: other synthetic live-shaped secrets in H1.
- Labels are author-verified from fixture construction (see `scripts/secrets.mjs`).
- CSV: `results/labels.csv` (fingerprints + masked only; no raw secrets).
