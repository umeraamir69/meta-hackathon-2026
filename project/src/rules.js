/** Deterministic secret patterns. Gate never calls an LLM. */

export function shannonEntropy(value) {
  const text = String(value || '');
  if (!text) return 0;
  const freq = new Map();
  for (const char of text) freq.set(char, (freq.get(char) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const PLACEHOLDER_PASSWORDS = new Set([
  '', 'password', 'changeme', 'xxx', 'xxxxxxxx', '<password>',
  'yourpassword', 'example', 'test', 'secret', 'postgres', 'root', 'admin',
]);

export function placeholderPassword(pass) {
  return PLACEHOLDER_PASSWORDS.has(String(pass || '').toLowerCase());
}

export function genericValueOk(secret) {
  if (!secret || secret.startsWith('$') || secret.startsWith('{')) return false;
  if (placeholderPassword(secret)) return false;
  if (shannonEntropy(secret) < 3.5) return false;
  return true;
}

export function looksLikeAwsSecret(value) {
  const s = String(value || '');
  if (s.length !== 40) return false;
  const low = s.toLowerCase();
  if (low.includes('example') || low.includes('placeholder')) return false;
  for (const prefix of ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'akia', 'asia']) {
    if (low.startsWith(prefix)) return false;
  }
  let hexOnly = true;
  let hasUpper = false;
  let hasLower = false;
  let hasSym = false;
  for (const c of s) {
    if (c >= 'A' && c <= 'Z') {
      hasUpper = true;
      if (c > 'F') hexOnly = false;
    } else if (c >= 'a' && c <= 'z') {
      hasLower = true;
      if (c > 'f') hexOnly = false;
    } else if (c >= '0' && c <= '9') {
      // digit: neutral
    } else if (c === '/' || c === '+' || c === '=') {
      hasSym = true;
      hexOnly = false;
    } else {
      return false;
    }
  }
  if (hexOnly && !hasUpper) return false;
  if (shannonEntropy(s) < 3.5) return false;
  return (hasUpper && hasLower) || hasSym;
}

function jdbcPassword(url) {
  const low = String(url).toLowerCase();
  const i = low.indexOf('password=');
  if (i === -1) return '';
  const rest = String(url).slice(i + 'password='.length);
  const cut = rest.search(/[;& \t"']/);
  return cut === -1 ? rest : rest.slice(0, cut);
}

export function dbPasswordPlaceholder(url) {
  const text = String(url || '');
  const low = text.toLowerCase();
  if (low.includes('password=')) return placeholderPassword(jdbcPassword(text));
  const at = text.lastIndexOf('@');
  if (at === -1) return true;
  const head = text.slice(0, at);
  const colon = head.lastIndexOf(':');
  if (colon === -1) return true;
  return placeholderPassword(head.slice(colon + 1));
}

export function jdbcWithoutPassword(url) {
  const text = String(url || '');
  const low = text.toLowerCase();
  if (!low.startsWith('jdbc:')) return false;
  const at = text.lastIndexOf('@');
  if (at !== -1 && text.slice(0, at + 1).includes(':')) return false;
  return !low.includes('password=');
}

function pemRestLooksLikeBody(value) {
  const s = String(value || '');
  if (s.includes('END') && s.includes('PRIVATE KEY')) return true;
  const compact = s.replaceAll('\\n', '').replaceAll('\n', '').trim();
  return compact.length >= 16;
}

export function pemHasBody(lines, beginIdx) {
  if (!Array.isArray(lines) || beginIdx == null || beginIdx < 0) return false;
  const line = String(lines[beginIdx] || '');
  const marker = 'PRIVATE KEY-----';
  const idx = line.indexOf(marker);
  if (idx >= 0 && pemRestLooksLikeBody(line.slice(idx + marker.length).replaceAll('\\n', '\n'))) {
    const rest = line.slice(idx + marker.length).replaceAll('\\n', '');
    if (rest.trim().length >= 16 && !rest.trim().startsWith('-----')) return true;
    if (line.slice(idx + marker.length).includes('END')) return true;
  }
  const end = Math.min(lines.length, beginIdx + 8);
  for (let i = beginIdx + 1; i < end; i += 1) {
    const row = String(lines[i] || '');
    if (pemRestLooksLikeBody(row)) {
      const s = row.replaceAll('\\n', '').trim();
      if (s.length >= 16 && !s.startsWith('-----')) return true;
      if (row.includes('END') && row.includes('PRIVATE KEY')) return true;
    }
  }
  return false;
}

export const RULES = [
  { id: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'critical' },
  { id: 'aws_session_key', re: /\bASIA[0-9A-Z]{16}\b/g, severity: 'high' },
  { id: 'aws_secret_access_key', re: /(?:aws_)?secret_access_key.{0,32}['"]?([A-Za-z0-9/+=]{40})['"]?/gi, severity: 'critical' },
  { id: 'github_pat', re: /\bghp_[A-Za-z0-9]{36}\b/g, severity: 'critical' },
  { id: 'github_oauth', re: /\bgho_[A-Za-z0-9]{36}\b/g, severity: 'high' },
  { id: 'github_user', re: /\bghu_[A-Za-z0-9]{36}\b/g, severity: 'high' },
  { id: 'github_server', re: /\bghs_[A-Za-z0-9]{36}\b/g, severity: 'high' },
  { id: 'github_refresh', re: /\bghr_[A-Za-z0-9]{36}\b/g, severity: 'high' },
  { id: 'github_fine_grained', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, severity: 'high' },
  { id: 'openai_key', re: /\bsk-[A-Za-z0-9]{20,}\b/g, severity: 'high' },
  { id: 'anthropic_api_key', re: /\bsk-ant-(?:api03|admin01)-[A-Za-z0-9\-_]{80,}AA\b/g, severity: 'high' },
  { id: 'google_api_key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/g, severity: 'high' },
  { id: 'stripe_live', re: /\bsk_live_[0-9a-zA-Z]{24,}\b/g, severity: 'high' },
  { id: 'stripe_test', re: /\bsk_test_[0-9a-zA-Z]{24,}\b/g, severity: 'medium' },
  { id: 'stripe_restricted', re: /\brk_(?:live|test)_[0-9a-zA-Z]{24,}\b/g, severity: 'high' },
  { id: 'stripe_webhook', re: /\bwhsec_[0-9A-Za-z]{32,}\b/g, severity: 'high' },
  { id: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, severity: 'high' },
  { id: 'slack_webhook', re: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{16,}/g, severity: 'high' },
  { id: 'discord_bot_token', re: /\b[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,40}\b/g, severity: 'high' },
  { id: 'telegram_bot_token', re: /\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b/g, severity: 'high' },
  { id: 'azure_storage_key', re: /AccountKey=([A-Za-z0-9+/]{86}={0,2})/gi, severity: 'critical' },
  { id: 'datadog_api_key', re: /(?:datadog[_-]?api[_-]?key|dd[_-]?(?:api|app)[_-]?key).{0,32}([a-f0-9]{32})/gi, severity: 'high' },
  { id: 'digitalocean_token', re: /\bdo(?:p|o|r)_v1_[a-f0-9]{64}\b/g, severity: 'high' },
  { id: 'groq_api_key', re: /\bgsk_[A-Za-z0-9]{20,}\b/g, severity: 'high' },
  { id: 'huggingface_token', re: /\bhf_[A-Za-z0-9]{20,}\b/g, severity: 'high' },
  { id: 'square_token', re: /\b(?:sq0atp-|sq0csp-|EAAA)[0-9A-Za-z\-_]{22,}\b/g, severity: 'high' },
  { id: 'shopify_token', re: /\bshp(?:ss|at|ca|pa)_[0-9a-fA-F]{32}\b/g, severity: 'high' },
  { id: 'gitlab_pat', re: /\bglpat-[0-9A-Za-z\-_]{20,}\b/g, severity: 'high' },
  { id: 'sendgrid_key', re: /\bSG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}\b/g, severity: 'high' },
  { id: 'twilio_key', re: /\bSK[0-9a-fA-F]{32}\b/g, severity: 'high' },
  { id: 'twilio_key', re: /twilio[_-]?(?:api[_-]?key|auth[_-]?token).{0,24}([0-9a-fA-F]{32})/gi, severity: 'high' },
  { id: 'npm_token', re: /\bnpm_[0-9A-Za-z]{36}\b/g, severity: 'high' },
  { id: 'pypi_token', re: /\bpypi-AgEIcHlwaS5?[0-9A-Za-z\-_]{50,}\b/g, severity: 'high' },
  { id: 'private_key_pem', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g, severity: 'critical' },
  { id: 'xai_api_key', re: /\bxai-[A-Za-z0-9]{20,}\b/g, severity: 'high' },
  { id: 'perplexity_api_key', re: /\bpplx-[A-Za-z0-9]{20,}\b/g, severity: 'high' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'medium' },
  { id: 'basic_auth', re: /authorization.{0,12}basic\s+["']?([A-Za-z0-9+/=]{16,})/gi, severity: 'high' },
  // No dots or slashes in the value: `api_key: process.env.SOMETHING_LONG` is code, not a credential.
  { id: 'generic_api_key', re: /(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"]?([A-Za-z0-9_\-+=]{20,})['"]?/gi, severity: 'medium' },
  { id: 'generic_password', re: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{12,})['"]?/gi, severity: 'medium' },
  { id: 'db_url', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?|nats|sqlserver|mysql\+[a-z0-9]+|postgresql\+[a-z0-9]+):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, severity: 'high' },
  { id: 'db_jdbc', re: /jdbc:[a-z0-9]+:(?::\/\/)?[^\s'"]+/gi, severity: 'high' },
];

/**
 * Second-stage validation for a regex hit. Returns false to drop the hit.
 * Unlike an incident scanner, the gate still flags documentation examples:
 * Muse labels them, but only a person clears the merge.
 */
export function acceptHit(ruleId, secret, lines = null, lineIndex = 0) {
  switch (ruleId) {
    case 'generic_api_key':
    case 'generic_password':
      return genericValueOk(secret);
    case 'aws_secret_access_key':
      return looksLikeAwsSecret(secret);
    case 'db_url':
      return !dbPasswordPlaceholder(secret) && !jdbcWithoutPassword(secret);
    case 'db_jdbc':
      return !dbPasswordPlaceholder(secret) && !jdbcWithoutPassword(secret);
    case 'private_key_pem':
      if (!lines) return true;
      return pemHasBody(lines, lineIndex);
    case 'discord_bot_token':
      return !String(secret).startsWith('eyJ');
    case 'twilio_key':
      return !String(secret).toUpperCase().startsWith('AC');
    default:
      return true;
  }
}

const AWS_ID = /\bA[KS]IA[0-9A-Z]{16}\b/;
const AWS_SECRET_BARE = /\b[A-Za-z0-9/+=]{40}\b/g;
const GCP_EMAIL = /[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com/;
// Split so this source file never contains the marker it searches for.
const GCP_MARK = ['service_', 'account'].join('');

/**
 * Hits that need more than one line: an AWS id with a bare 40-char secret
 * nearby, and a GCP service-account blob. Full text only, never patch lines.
 */
export function compositeHits(text) {
  const out = [];
  const body = String(text || '');
  if (!body || body.includes('\0')) return out;
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!AWS_ID.test(lines[i])) continue;
    const end = Math.min(lines.length, i + 3);
    for (let j = i; j < end; j += 1) {
      if (lines[j].toLowerCase().includes('secret_access_key')) continue;
      AWS_SECRET_BARE.lastIndex = 0;
      let match;
      while ((match = AWS_SECRET_BARE.exec(lines[j])) !== null) {
        if (looksLikeAwsSecret(match[0])) {
          out.push({ rule: 'aws_secret_access_key', severity: 'critical', raw: match[0], line: j + 1 });
        }
        if (match.index === AWS_SECRET_BARE.lastIndex) AWS_SECRET_BARE.lastIndex += 1;
      }
    }
  }
  if (body.includes(GCP_MARK)) {
    const hasPem = body.includes('BEGIN') && body.includes('PRIVATE KEY');
    const hasEmail = body.includes('iam.gserviceaccount.com');
    if (hasPem || hasEmail) {
      const email = body.match(GCP_EMAIL)?.[0] || 'gcp-service-key-json';
      const at = lines.findIndex((line) => line.includes(GCP_MARK));
      out.push({ rule: 'gcp_service_key', severity: 'critical', raw: email, line: at === -1 ? 1 : at + 1 });
    }
  }
  return out;
}

export function mask(value) {
  if (!value || value.length < 8) return '••••';
  return value.slice(0, 4) + '•'.repeat(Math.min(12, value.length - 8)) + value.slice(-4);
}
