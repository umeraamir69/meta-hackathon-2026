/**
 * Muse Wonder explain path. Never decides pass/fail — gate already did.
 * Without META_API_KEY, returns a local checklist so demos still work.
 */
export async function explainFindings(findings) {
  if (!findings.length) return null;
  const key = process.env.META_API_KEY || process.env.MUSE_API_KEY;
  const local = {
    provider: key ? 'muse-wonder' : 'local-fallback',
    summary: `${findings.length} secret finding(s). The merge gate failed on deterministic rules, not an LLM.`,
    rotate: findings.map((f) => ({
      rule: f.rule,
      where: `${f.source}:${f.line}`,
      steps: [
        `Revoke or rotate the credential matching rule ${f.rule} (${f.masked}).`,
        'Confirm the new secret is only in a secret store / CI secret, not the repo.',
        'If it was in git history, rewrite or accept that old clones still hold it until rotated.',
      ],
    })),
  };
  if (!key || process.env.SENTINEL_MUSE === 'false') return local;
  // Day-1 stub: wire Meta Model API once kickoff credentials land.
  // Keep response shape stable so Action logs stay parseable.
  local.note = 'META_API_KEY set; Muse Wonder HTTP client lands after kickoff API docs.';
  return local;
}
