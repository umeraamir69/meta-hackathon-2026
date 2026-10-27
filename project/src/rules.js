/** Deterministic secret patterns. Gate never calls an LLM. */
export const RULES = [
  { id: 'aws_access_key', re: /\b(AKIA[0-9A-Z]{16})\b/g, severity: 'critical' },
  { id: 'github_pat', re: /\b(ghp_[A-Za-z0-9]{36})\b/g, severity: 'critical' },
  { id: 'openai_key', re: /\b(sk-[A-Za-z0-9]{20,})\b/g, severity: 'high' },
  { id: 'slack_token', re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g, severity: 'high' },
  { id: 'generic_api_key', re: /(?:^|(?<=[^A-Za-z0-9]))(?:[A-Za-z0-9]+[_-])?api[_-]?key\s*[=:]\s*['"]?([A-Za-z0-9_-]{20,})/gi, severity: 'medium' },
  { id: 'private_key_pem', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'critical' },
];

export function mask(value) {
  if (!value || value.length < 8) return '••••';
  return value.slice(0, 4) + '•'.repeat(Math.min(12, value.length - 8)) + value.slice(-4);
}
