import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../src/scan.js';
import { RULES, acceptHit, compositeHits, genericValueOk, looksLikeAwsSecret, shannonEntropy } from '../src/rules.js';

const ALNUM = 'aB3dE5fG7hJ9kL1mN3pQ5rStUvWxYz2468';
const HEX = 'abcdef0123456789';

function tok(n, alphabet = ALNUM) {
  let out = '';
  while (out.length < n) out += alphabet;
  return out.slice(0, n);
}

function hits(text) {
  return scanText(text, { source: 'working-tree', path: 'app.env' }, []);
}

function hasRule(text, rule) {
  return hits(text).some((finding) => finding.rule === rule);
}

test('provider prefixes are findings', () => {
  const cases = [
    ['aws_session_key', ['ASIA', 'IOSFODNN7EXAMPLE'].join('')],
    ['github_oauth', ['gho_', tok(36)].join('')],
    ['github_user', ['ghu_', tok(36)].join('')],
    ['github_server', ['ghs_', tok(36)].join('')],
    ['github_refresh', ['ghr_', tok(36)].join('')],
    ['github_fine_grained', ['github_pat_', tok(24)].join('')],
    ['openai_key', ['sk-', tok(24)].join('')],
    ['anthropic_api_key', ['sk-ant-admin01-', tok(80), 'AA'].join('')],
    ['google_api_key', ['AIza', tok(35)].join('')],
    ['stripe_live', ['sk_live_', tok(26)].join('')],
    ['stripe_test', ['sk_test_', tok(26)].join('')],
    ['stripe_restricted', ['rk_live_', tok(26)].join('')],
    ['stripe_webhook', ['whsec_', tok(34)].join('')],
    ['slack_token', ['xoxb-', tok(20)].join('')],
    ['telegram_bot_token', [tok(9, '0123456789'), tok(35)].join(':')],
    ['digitalocean_token', ['dop_v1_', tok(64, HEX)].join('')],
    ['digitalocean_token', ['dor_v1_', tok(64, HEX)].join('')],
    ['groq_api_key', ['gsk_', tok(24)].join('')],
    ['huggingface_token', ['hf_', tok(24)].join('')],
    ['square_token', ['sq0atp-', tok(24)].join('')],
    ['square_token', ['EAAA', tok(24)].join('')],
    ['shopify_token', ['shpss_', tok(32, HEX)].join('')],
    ['gitlab_pat', ['glpat-', tok(24)].join('')],
    ['npm_token', ['npm_', tok(36)].join('')],
    ['pypi_token', ['pypi-AgEIcHlwaS5', tok(50)].join('')],
    ['xai_api_key', ['xai-', tok(24)].join('')],
    ['perplexity_api_key', ['pplx-', tok(24)].join('')],
    ['twilio_key', ['SK', tok(32, HEX)].join('')],
  ];
  for (const [rule, secret] of cases) {
    assert.equal(hasRule(`TOKEN=${secret}\n`, rule), true, rule);
  }
});

test('labeled secrets need a plausible value', () => {
  const awsSecret = ['wJalrXUtnFEMI/K7MDENG/', 'bPxRfiCYzv9Q2aB4cD'].join('');
  assert.equal(awsSecret.length, 40);
  assert.equal(hasRule(`aws_secret_access_key = "${awsSecret}"\n`, 'aws_secret_access_key'), true);
  assert.equal(hasRule(`aws_secret_access_key = "not-a-real-secret-value-here-0000"\n`, 'aws_secret_access_key'), false);
  assert.equal(hasRule(`secret_access_key = "${'a'.repeat(40)}"\n`, 'aws_secret_access_key'), false);
  assert.equal(looksLikeAwsSecret(awsSecret), true);
  assert.equal(looksLikeAwsSecret('a'.repeat(40)), false);

  assert.equal(hasRule(`datadog_api_key = "${tok(32, HEX)}"\n`, 'datadog_api_key'), true);
  assert.equal(hasRule(`twilio_api_key = "9F${tok(30, HEX)}"\n`, 'twilio_key'), true);
  assert.equal(hasRule(`twilio_api_key = "AC${tok(30, HEX)}"\n`, 'twilio_key'), false);
  assert.equal(hasRule(`AccountKey=${tok(86, `${HEX}ABCDEF+/`)}`, 'azure_storage_key'), true);

  assert.equal(hasRule(`SECRET_KEY=${tok(24)}\n`, 'generic_api_key'), true);
  assert.equal(hasRule(`access_token: ${tok(24)}\n`, 'generic_api_key'), true);
  assert.equal(hasRule('api_key: process.env.SOMETHING_LONG\n', 'generic_api_key'), false);
  assert.equal(genericValueOk(tok(24)), true);
  assert.equal(genericValueOk('k'.repeat(24)), false);
  assert.equal(genericValueOk('$VAR'), false);
});

test('passwords reject placeholders and short values', () => {
  assert.equal(hasRule(`db_password = "${tok(20)}"\n`, 'generic_password'), true);
  assert.equal(hasRule('password = "yourpassword"\n', 'generic_password'), false);
  assert.equal(hasRule('password = "test"\n', 'generic_password'), false);
});

test('structured tokens and urls', () => {
  assert.equal(hasRule(`hooks.slack.com/services/T${tok(8, 'ABCDEF12')}/B${tok(8, 'ABCDEF12')}/${tok(20)}\n`, 'slack_webhook'), true);
  assert.equal(hasRule(`token = "${['SG.', tok(22), '.', tok(43)].join('')}"\n`, 'sendgrid_key'), true);
  assert.equal(hasRule(`jwt = "${['eyJhbGciOiJIUzI1NiJ9', tok(20), tok(20)].join('.')}"\n`, 'jwt'), true);

  const discord = [tok(24), tok(6), tok(30)].join('.');
  assert.equal(hasRule(`bot = "${discord}"\n`, 'discord_bot_token'), true);
  const notDiscord = [['eyJ', tok(21)].join(''), tok(6), tok(30)].join('.');
  assert.equal(hasRule(`bot = "${notDiscord}"\n`, 'discord_bot_token'), false);

  assert.equal(hasRule(`auth = "Authorization: Basic ${tok(24, `${ALNUM}+/=`)}"\n`, 'basic_auth'), true);

  const live = ['postgres://admin:', tok(16), '@db.internal:5432/app'].join('');
  assert.equal(hasRule(`url = "${live}"\n`, 'db_url'), true);
  assert.equal(hasRule('url = "postgres://admin:changeme@host/db"\n', 'db_url'), false);
  assert.equal(hasRule('url = "jdbc:postgresql://host/db"\n', 'db_jdbc'), false);
  const jdbc = ['jdbc:postgresql://host/db?password=', tok(16)].join('');
  assert.equal(hasRule(`url = "${jdbc}"\n`, 'db_jdbc'), true);
});

test('private keys need a body in files, bare markers fail closed in diffs', () => {
  const begin = ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join('');
  const withBody = [begin, tok(64), '-----END RSA PRIVATE KEY-----'].join('\n');
  assert.equal(hasRule(withBody, 'private_key_pem'), true);
  const bare = [begin, 'short'].join('\n');
  assert.equal(hasRule(bare, 'private_key_pem'), false);
  const patchLine = scanText(begin, { source: 'pr-diff', path: 'key.pem', line: 5 }, []);
  assert.equal(patchLine.some((finding) => finding.rule === 'private_key_pem'), true);
});

test('composite hits pair nearby lines', () => {
  const id = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
  const secret = ['wJalrXUtnFEMI/K7MDENG/', 'bPxRfiCYzv9Q2aB4cD'].join('');
  const found = hits([`aws_id=${id}`, '# comment', `value=${secret}`].join('\n'));
  assert.equal(found.some((finding) => finding.rule === 'aws_secret_access_key'), true);
  assert.equal(found.some((finding) => finding.rule === 'aws_access_key'), true);

  const mark = ['service_', 'account'].join('');
  const email = ['deploy@demo.iam.', 'gserviceaccount.com'].join('');
  const gcp = hits([`{"type": "${mark}", "client_email": "${email}"}`].join('\n'));
  const gcpHit = gcp.find((finding) => finding.rule === 'gcp_service_key');
  assert.ok(gcpHit);
  assert.equal(gcpHit.severity, 'critical');
  assert.equal(compositeHits('nothing here').length, 0);
});

test('documentation examples still fail the gate', () => {
  const id = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
  const found = hits(`# example only\nAWS_ACCESS_KEY_ID=${id}\n`);
  assert.equal(found.some((finding) => finding.rule === 'aws_access_key'), true);
});

test('findings carry a fingerprint and entropy, never the raw value', () => {
  const secret = ['ghp_', tok(36)].join('');
  const hit = hits(`TOKEN=${secret}\n`).find((finding) => finding.rule === 'github_pat');
  assert.ok(hit);
  assert.match(hit.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(typeof hit.entropy, 'number');
  assert.equal(JSON.stringify(hit).includes(secret), false);
});

test('entropy behaves', () => {
  assert.equal(shannonEntropy(''), 0);
  assert.equal(shannonEntropy('aaaa'), 0);
  assert.ok(shannonEntropy(tok(32)) > 3.5);
});

test('every rule id resolves in the validator', () => {
  for (const rule of RULES) {
    assert.equal(typeof acceptHit(rule.id, tok(40), null, 0), 'boolean');
  }
});
