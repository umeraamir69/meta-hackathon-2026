/**
 * Muse Spark labels findings. Muse Wonder explains the live ones.
 * Neither call decides pass/fail. Only masked context is sent.
 */
import { renderComment } from './comment.js';
import { localJudgement, whereOf } from './judge.js';

const ENDPOINT = 'https://api.meta.ai/v1/responses';
const LABELS = new Set(['likely_live', 'likely_example', 'likely_fixture', 'unclear']);

function stepsFor(finding) {
  if (finding.rule === 'shallow_clone') {
    return [
      'Re-run the checkout with fetch-depth: 0.',
      'Scan again so commits older than the shallow copy are visible.',
    ];
  }
  if (finding.rule === 'scan_error') {
    return [
      'Fix the git error and re-run the scan.',
      'Do not treat this run as a clean result.',
    ];
  }
  const steps = [
    `Revoke or rotate the credential matching ${finding.rule} (${finding.masked}).`,
    'Put the replacement only in a secret manager or CI secret.',
  ];
  if (finding.removed || finding.source === 'git-history') {
    steps.push('The value remains in git history. Clones already taken keep it until the credential is rotated.');
  }
  return steps;
}

function localReport(findings, note, extra = {}) {
  return {
    provider: 'local-fallback',
    model: null,
    http_status: extra.http_status ?? null,
    summary: `${findings.length} secret finding(s). The merge gate failed on deterministic rules, not an LLM.`,
    rotate: findings.map((finding) => ({
      rule: finding.rule,
      where: whereOf(finding),
      steps: stepsFor(finding),
    })),
    note: note || null,
    usage: null,
  };
}

function detailBlock(finding) {
  const parts = [
    `rule=${finding.rule} severity=${finding.severity} where=${whereOf(finding)} masked=${finding.masked} pathClass=${finding.pathClass || 'unknown'} removed=${Boolean(finding.removed)}`,
  ];
  if (finding.commitSubject) parts.push(`subject=${finding.commitSubject}`);
  for (const row of finding.context || []) parts.push(`L${row.line}: ${row.text}`);
  return parts.join('\n');
}

export function buildPrompt(findings) {
  return [
    'You explain secret-scan findings for a developer.',
    'The deterministic gate already failed. Do not say the scan passed. Do not assign pass or fail.',
    'Never invent or reconstruct secret values. Masked fields are redacted on purpose.',
    'Reply with JSON only: {"summary": string, "rotate": [{"rule": string, "where": string, "steps": string[]}]}',
    'Each steps array is a short rotate checklist: revoke the credential, store the new one outside the repo, and assume old clones keep a history secret until rotation.',
    '',
    'Findings:',
    ...findings.map((finding) => detailBlock(finding)),
  ].join('\n');
}

export function buildClassifyPrompt(findings) {
  return [
    'You classify secret-scan findings. You do not decide whether the merge passes.',
    'The deterministic gate already failed. Do not say the scan passed.',
    'Never invent or reconstruct secret values.',
    'Labels: likely_live, likely_example, likely_fixture, unclear.',
    'likely_example means documentation, a sample, or a placeholder.',
    'likely_fixture means test or fixture data.',
    'likely_live means application code, config, or a value that remains in git history.',
    'Reply with JSON only: {"labels":[{"where": string, "label": string, "why": string}]}',
    'Copy each where string exactly.',
    '',
    ...findings.map((finding) => detailBlock(finding)),
  ].join('\n');
}

function extractOutputText(body) {
  if (typeof body?.output_text === 'string') return body.output_text;
  const parts = [];
  for (const item of body?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

function parseModelJson(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerceRotate(value, findings) {
  if (!Array.isArray(value)) return localReport(findings).rotate;
  const rotate = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.steps)) continue;
    const steps = item.steps.filter((step) => typeof step === 'string' && step.trim()).slice(0, 8);
    if (!steps.length) continue;
    rotate.push({
      rule: String(item.rule || ''),
      where: String(item.where || ''),
      steps,
    });
  }
  return rotate.length ? rotate : localReport(findings).rotate;
}

function usageOf(body) {
  const usage = body?.usage;
  if (!usage || typeof usage !== 'object') return null;
  return {
    input_tokens: Number.isFinite(usage.input_tokens) ? usage.input_tokens : null,
    output_tokens: Number.isFinite(usage.output_tokens) ? usage.output_tokens : null,
  };
}

async function postResponses(fetchImpl, key, payload, timeout) {
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

export async function explainFindings(findings, options = {}) {
  if (!findings?.length) return null;
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const key = env.MODEL_API_KEY || env.META_API_KEY || env.MUSE_API_KEY || '';
  if (!key) return localReport(findings, 'No MODEL_API_KEY; local rotate checklist. The gate does not depend on Muse.');
  if (env.SENTINEL_MUSE === 'false') return localReport(findings, 'SENTINEL_MUSE=false; local rotate checklist.');

  const model = env.SENTINEL_MODEL || 'muse-wonder-1.0';
  if (String(model).endsWith('-contributor')) {
    return localReport(findings, 'Refusing a contributor-tier model because prompts may be used for training. Use muse-wonder-1.0 or muse-spark-1.3.');
  }

  const prompt = buildPrompt(findings);
  if (prompt.includes(key)) {
    return localReport(findings, 'Skipped Muse because the prompt contained configured credential material.');
  }

  const timeout = Number(env.SENTINEL_MUSE_TIMEOUT_MS || 20000);
  const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 20000;
  let status = null;
  let text = '';
  try {
    let result = await postResponses(fetchImpl, key, { model, input: prompt, reasoning: { effort: 'minimal' } }, limit);
    if (result.status === 400) {
      result = await postResponses(fetchImpl, key, { model, input: prompt }, limit);
    }
    status = result.status;
    text = result.text;
    if (!result.ok) return localReport(findings, `Muse request failed (HTTP ${status})`, { http_status: status });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return localReport(findings, timedOut ? 'Muse request failed (timeout)' : 'Muse request failed (network)');
  }

  if (text.includes(key)) {
    return localReport(findings, 'Muse response was discarded because it echoed credential material.', { http_status: status });
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return localReport(findings, 'Muse response was not JSON.', { http_status: status });
  }
  const output = extractOutputText(body);
  if (output.includes(key)) {
    return localReport(findings, 'Muse response was discarded because it echoed credential material.', { http_status: status });
  }
  const parsed = parseModelJson(output);
  const summary = typeof parsed?.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim().slice(0, 2000)
    : (output.trim().slice(0, 2000) || localReport(findings).summary);
  if (summary.includes(key)) {
    return localReport(findings, 'Muse response was discarded because it echoed credential material.', { http_status: status });
  }
  return {
    provider: String(model).startsWith('muse-wonder') ? 'muse-wonder' : 'meta-model-api',
    model,
    http_status: status,
    summary,
    rotate: coerceRotate(parsed?.rotate, findings),
    note: null,
    usage: usageOf(body),
  };
}

function apiKey(env) {
  return env.MODEL_API_KEY || env.META_API_KEY || env.MUSE_API_KEY || '';
}

function alignLabels(findings, parsed, provider, key) {
  const byWhere = new Map();
  for (const item of parsed?.labels || []) {
    if (item?.where) byWhere.set(String(item.where), item);
  }
  return findings.map((finding) => {
    const fallback = localJudgement(finding);
    const got = byWhere.get(whereOf(finding));
    const label = LABELS.has(got?.label) ? got.label : fallback.label;
    let why = typeof got?.why === 'string' && got.why.trim() ? got.why.trim().slice(0, 280) : fallback.why;
    if (key && why.includes(key)) why = fallback.why;
    return {
      rule: finding.rule,
      where: whereOf(finding),
      label,
      why,
      provider: LABELS.has(got?.label) ? provider : 'local-fallback',
    };
  });
}

export async function classifyFindings(findings, options = {}) {
  const env = options.env || process.env;
  const key = apiKey(env);
  const local = alignLabels(findings, null, 'local-fallback', key);
  if (env.SENTINEL_MUSE === 'false' || !key) {
    return { offline: true, provider: 'local-fallback', model: null, http_status: null, usage: null, labels: local };
  }
  const model = env.SENTINEL_CLASSIFIER || 'muse-spark-1.3';
  if (String(model).endsWith('-contributor')) {
    return {
      offline: false,
      provider: 'local-fallback',
      model: null,
      http_status: null,
      usage: null,
      labels: local,
      note: 'Refusing a contributor-tier classifier because prompts may be used for training.',
    };
  }
  const prompt = buildClassifyPrompt(findings);
  if (prompt.includes(key)) {
    return { offline: false, provider: 'local-fallback', model: null, http_status: null, usage: null, labels: local };
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeout = Number(env.SENTINEL_MUSE_TIMEOUT_MS || 20000);
  const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 20000;
  try {
    let result = await postResponses(fetchImpl, key, { model, input: prompt, reasoning: { effort: 'minimal' } }, limit);
    if (result.status === 400) result = await postResponses(fetchImpl, key, { model, input: prompt }, limit);
    if (!result.ok || result.text.includes(key)) {
      return { offline: false, provider: 'local-fallback', model: null, http_status: result.status, usage: null, labels: local };
    }
    const body = JSON.parse(result.text);
    const output = extractOutputText(body);
    if (output.includes(key)) {
      return { offline: false, provider: 'local-fallback', model: null, http_status: result.status, usage: null, labels: local };
    }
    const parsed = parseModelJson(output);
    return {
      offline: false,
      provider: 'muse-spark',
      model,
      http_status: result.status,
      usage: usageOf(body),
      labels: alignLabels(findings, parsed, 'muse-spark', key),
    };
  } catch {
    return { offline: false, provider: 'local-fallback', model: null, http_status: null, usage: null, labels: local };
  }
}

function addUsage(left, right) {
  if (!left && !right) return null;
  const a = left || {};
  const b = right || {};
  const input = (a.input_tokens || 0) + (b.input_tokens || 0);
  const output = (a.output_tokens || 0) + (b.output_tokens || 0);
  if (!input && !output) return null;
  return { input_tokens: input, output_tokens: output };
}

export async function reviewFindings(findings, options = {}) {
  if (!findings?.length) return null;
  const classified = await classifyFindings(findings, options);
  const focus = findings.filter((finding) => {
    const label = classified.labels.find((item) => item.where === whereOf(finding));
    return label?.label === 'likely_live' || label?.label === 'unclear';
  });
  let explanation;
  if (classified.offline) {
    explanation = await explainFindings(findings, options);
  } else if (focus.length) {
    explanation = await explainFindings(focus, options);
  } else {
    explanation = {
      provider: classified.provider,
      model: classified.model,
      http_status: classified.http_status,
      summary: 'Every finding looks like an example, fixture, or test. The merge gate still fails until a person rotates or removes it.',
      rotate: localReport(findings).rotate,
      note: classified.note || null,
      usage: classified.usage,
    };
  }
  explanation = {
    ...explanation,
    usage: addUsage(classified.usage, explanation.usage),
    classifier: { provider: classified.provider, model: classified.model },
    labels: classified.labels,
  };
  explanation.comment = renderComment(findings, classified.labels, explanation);
  return explanation;
}
