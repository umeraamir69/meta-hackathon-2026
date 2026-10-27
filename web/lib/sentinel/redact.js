import { mask } from './rules.js';

export function configuredSecrets(env = process.env) {
  const values = [env.MODEL_API_KEY, env.META_API_KEY, env.MUSE_API_KEY];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length >= 8))];
}

export function scrubFindings(findings, secrets) {
  const full = secrets.filter((value) => value && value.length >= 8);
  const maskedValues = new Set(full.map((value) => mask(value)));
  return findings.map((finding) => {
    const masked = finding.masked || '';
    const detail = finding.detail || '';
    const contextText = (finding.context || []).map((row) => row.text).join('\n');
    const subject = finding.commitSubject || '';
    const hit = maskedValues.has(masked) || full.some((secret) => (
      masked.includes(secret) || detail.includes(secret) || contextText.includes(secret) || subject.includes(secret)
    ));
    const context = (finding.context || []).map((row) => ({
      ...row,
      text: redactText(row.text, full),
    }));
    const commitSubject = subject ? redactText(subject, full) : finding.commitSubject ?? null;
    if (!hit) return { ...finding, context, commitSubject };
    return {
      ...finding,
      masked: '[redacted-configured-credential]',
      detail: undefined,
      context,
      commitSubject,
    };
  });
}

export function redactText(text, secrets) {
  let out = String(text);
  for (const secret of secrets) {
    if (!secret || secret.length < 8) continue;
    out = out.split(secret).join('[redacted]');
    out = out.split(mask(secret)).join('[redacted]');
  }
  return out;
}
