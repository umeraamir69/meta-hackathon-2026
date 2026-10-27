/** Per-provider rotation hints. Grounds the local checklist and the Muse prompt. */

const HINTS = {
  aws_access_key: 'IAM → Users → Security credentials → deactivate, then delete this key. Check CloudTrail for use.',
  aws_session_key: 'This is an STS session key. Revoke the session and rotate the long-term key that minted it.',
  aws_secret_access_key: 'IAM → Users → Security credentials → deactivate the matching access key. The secret cannot be viewed again.',
  github_pat: 'github.com/settings/tokens → revoke the token. Audit the account recent activity.',
  github_oauth: 'github.com/settings/tokens → revoke the token.',
  github_user: 'github.com/settings/tokens → revoke the token.',
  github_server: 'github.com/settings/tokens → revoke the token.',
  github_refresh: 'github.com/settings/tokens → revoke the token.',
  github_fine_grained: 'github.com/settings/tokens → revoke the fine-grained token.',
  openai_key: 'platform.openai.com/api-keys → revoke. Check usage for unexpected spend.',
  anthropic_api_key: 'console.anthropic.com → API keys → revoke.',
  google_api_key: 'console.cloud.google.com → APIs and Services → Credentials → delete the key.',
  stripe_live: 'dashboard.stripe.com/apikeys → roll the key immediately. This is a live payments credential.',
  stripe_test: 'dashboard.stripe.com/apikeys → roll the test secret key.',
  stripe_restricted: 'dashboard.stripe.com/apikeys → roll the restricted key.',
  stripe_webhook: 'Stripe dashboard → Developers → Webhooks → roll the signing secret.',
  gcp_service_key: 'console.cloud.google.com → IAM → Service accounts → Keys → delete this key, then issue a new one.',
  slack_token: 'api.slack.com/apps → your app → OAuth and Permissions → revoke and reinstall.',
  slack_webhook: 'api.slack.com/apps → Incoming Webhooks → disable the URL and create a new one.',
  discord_bot_token: 'discord.com/developers/applications → your bot → Reset Token.',
  telegram_bot_token: 'BotFather in Telegram → /revoke then /token to issue a new bot token.',
  azure_storage_key: 'Azure portal → Storage account → Access keys → rotate the keys and update every client.',
  datadog_api_key: 'app.datadoghq.com → Organization Settings → API Keys → revoke.',
  digitalocean_token: 'cloud.digitalocean.com → API → Tokens → delete the token.',
  basic_auth: 'Change the password behind this header and update every client that sends it.',
  groq_api_key: 'console.groq.com/keys → delete the key.',
  huggingface_token: 'huggingface.co/settings/tokens → revoke.',
  square_token: 'developer.squareup.com → your app → revoke the access token.',
  shopify_token: 'Shopify admin → Apps → uninstall and reinstall the app to roll its token.',
  gitlab_pat: 'gitlab.com → Preferences → Access Tokens → revoke.',
  sendgrid_key: 'app.sendgrid.com → Settings → API Keys → delete.',
  twilio_key: 'console.twilio.com → API keys and Auth Token → delete or roll.',
  npm_token: 'npmjs.com → Access Tokens → revoke.',
  pypi_token: 'pypi.org → Account settings → API tokens → revoke.',
  private_key_pem: 'Generate a new keypair, replace it on every host, then remove the old public key from authorized keys.',
  jwt: 'Rotate the signing secret so every issued token is invalidated.',
  db_url: 'Change the database password and update your secret store.',
  db_jdbc: 'Change the database password in the connection string and update your secret store.',
  generic_api_key: 'Revoke this credential with whichever provider issued it, then move it to an environment variable.',
  generic_password: 'Change this password and store it in a secret manager, not in git.',
  xai_api_key: 'console.x.ai → API keys → revoke.',
  perplexity_api_key: 'perplexity.ai → API settings → revoke the key.',
};

export const FALLBACK_HINT = 'Revoke this credential with the issuing provider and move it out of source control.';

export const PURGE_NOTE = 'Rotating is the fix. Rewriting history is optional cleanup — assume anyone who cloned the repo already has the old value.';

export function rotateHint(rule) {
  return HINTS[String(rule || '')] || FALLBACK_HINT;
}
