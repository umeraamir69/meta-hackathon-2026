/**
 * Muse Spark labels findings. Muse Wonder explains the live ones.
 * Neither call decides pass/fail. Only masked context is sent.
 */
import { renderComment } from './comment.js';
import { localJudgement, whereOf } from './judge.js';
import { PURGE_HOW, PURGE_NOTE, blastOf, rotateHint } from './rotate.js';

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
    `${rotateHint(finding.rule)} (${finding.masked}).`,
    'Put the replacement only in a secret manager or CI secret.',
  ];
  if (finding.removed || finding.source === 'git-history') {
    steps.push(PURGE_NOTE);
    steps.push(`Optional cleanup: ${PURGE_HOW}`);
  }
  return steps;
}

/**
 * .sentinelignore candidates for hits already labeled example or fixture.
 * Live and unclear hits never get a suggestion: ignoring them would hide
 * a real credential. The pair form keeps each line narrowly scoped.
 */
export function ignoreSuggestions(findings, labels) {
  const byWhere = new Map((labels || []).map((label) => [label?.where, label?.label]));
  const seen = new Set();
  const out = [];
  for (const finding of findings || []) {
    const label = byWhere.get(whereOf(finding));
    if (label !== 'likely_example' && label !== 'likely_fixture') continue;
    if (!finding?.path || finding.path === 'commit-message') continue;
    const pattern = `${finding.rule} ${finding.path}`;
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    out.push({
      pattern,
      reason: `${label === 'likely_example' ? 'Documentation sample' : 'Test fixture'} at ${whereOf(finding)}. Add only if no real credential shares this path.`,
    });
    if (out.length >= 10) break;
  }
  return out;
}

/** Muse sees at most a bounded slice; the local checklist stays complete. */
function capFindings(findings, env) {
  const raw = Number(env?.SENTINEL_MUSE_MAX_FINDINGS ?? 25);
  const cap = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 25;
  const list = findings || [];
  if (list.length <= cap) return { shown: list, note: null };
  return {
    shown: list.slice(0, cap),
    note: `Muse saw the first ${cap} of ${list.length} findings. Narrow the diff or split the PR for full triage.`,
  };
}

function localReport(findings, note, extra = {}) {
  const labels = (findings || []).map((finding) => localJudgement(finding));
  return {
    provider: 'local-fallback',
    model: null,
    http_status: extra.http_status ?? null,
    summary: `${findings.length} secret finding(s). The merge gate failed on deterministic rules, not an LLM.`,
    rotate: findings.map((finding) => {
      const blast = blastOf(finding, findings);
      return {
        rule: finding.rule,
        where: whereOf(finding),
        ...(blast ? { blast } : {}),
        steps: stepsFor(finding),
      };
    }),
    ignore: ignoreSuggestions(findings, labels),
    note: note || null,
    usage: null,
  };
}

function detailBlock(finding, findings) {
  const parts = [
    `rule=${finding.rule} severity=${finding.severity} where=${whereOf(finding)} masked=${finding.masked} pathClass=${finding.pathClass || 'unknown'} removed=${Boolean(finding.removed)}`,
  ];
  const caseBits = [];
  if (finding.author) caseBits.push(`author=${finding.author}`);
  if (finding.date) caseBits.push(`date=${finding.date}`);
  if (finding.encoding) caseBits.push(`encoding=${finding.encoding}`);
  if (finding.presentInTree === true) caseBits.push('inTree=yes');
  if (finding.presentInTree === false) caseBits.push('inTree=no');
  if (caseBits.length) parts.push(`case: ${caseBits.join(' ')}`);
  const blast = blastOf(finding, findings);
  if (blast) parts.push(`blast: ${blast}`);
  if (finding.removed || finding.source === 'git-history') parts.push(`purge: ${PURGE_HOW}`);
  parts.push(`rotate_hint=${rotateHint(finding.rule)}`);
  if (finding.commitSubject) parts.push(`subject=${finding.commitSubject}`);
  for (const row of finding.context || []) parts.push(`L${row.line}: ${row.text}`);
  return parts.join('\n');
}

/**
 * Identical hits share one prompt block with every where listed, so a
 * repeated secret costs one block instead of N. Blocks that differ only
 * by location still get one label entry per where from the classifier.
 */
function blockGroups(findings) {
  const groups = new Map();
  for (const finding of findings || []) {
    const block = detailBlock(finding, findings);
    const key = block.replace(/where=\S+/, 'where=*');
    if (!groups.has(key)) groups.set(key, { block, wheres: [] });
    groups.get(key).wheres.push(whereOf(finding));
  }
  return [...groups.values()].map((group) => (
    group.wheres.length > 1
      ? `${group.block}\noccurrences=${group.wheres.length} every_where=${group.wheres.join(' | ')}`
      : group.block
  ));
}

export function buildPrompt(findings) {
  return [
    'You explain secret-scan findings for a developer.',
    'The deterministic gate already failed. Do not say the scan passed. Do not assign pass or fail.',
    'Never invent or reconstruct secret values. Masked fields are redacted on purpose.',
    'Reply with JSON only: {"summary": string, "rotate": [{"rule": string, "where": string, "why_live": string, "fix": {"path": string, "before": string, "after": string}, "steps": string[]}], "ignore": [{"pattern": string, "reason": string}]}',
    'why_live is one sentence: why this hit looks like a live credential, grounded only in the masked context.',
    'fix is a redacted code patch: before keeps the masked value, after reads the replacement from an environment variable or secret manager. Omit fix when the hit is only in git history.',
    'Each steps array is an ordered runbook: revoke first, then contain (old clones, deploys), then prevent.',
    'ignore lists .sentinelignore lines only for documentation samples or test fixtures, never for live credentials.',
    'Blocks with occurrences=N describe identical hits; explain once per block and list one rotate entry per where.',
    '',
    'Findings:',
    ...blockGroups(findings),
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
    'Blocks with occurrences=N describe identical hits; return one label per listed where.',
    '',
    ...blockGroups(findings),
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

function coerceFix(value, key) {
  if (!value || typeof value !== 'object') return null;
  const path = typeof value.path === 'string' ? value.path.trim().slice(0, 200) : '';
  const before = typeof value.before === 'string' ? value.before.trim().slice(0, 500) : '';
  const after = typeof value.after === 'string' ? value.after.trim().slice(0, 500) : '';
  if (!path || !before || !after) return null;
  if (key && (path.includes(key) || before.includes(key) || after.includes(key))) return null;
  return { path, before, after };
}

function coerceIgnore(value, key) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const pattern = typeof item.pattern === 'string' ? item.pattern.trim().slice(0, 160) : '';
    const reason = typeof item.reason === 'string' ? item.reason.trim().slice(0, 280) : '';
    if (!pattern || !reason) continue;
    if (key && (pattern.includes(key) || reason.includes(key))) continue;
    out.push({ pattern, reason });
    if (out.length >= 10) break;
  }
  return out;
}

function coerceRotate(value, findings, key = '') {
  if (!Array.isArray(value)) return localReport(findings).rotate;
  const rotate = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.steps)) continue;
    const steps = item.steps.filter((step) => typeof step === 'string' && step.trim()).slice(0, 8);
    if (!steps.length) continue;
    const where = String(item.where || '');
    const entry = {
      rule: String(item.rule || ''),
      where,
      steps,
    };
    const whyLive = typeof item.why_live === 'string' ? item.why_live.trim().slice(0, 280) : '';
    if (whyLive && !(key && whyLive.includes(key))) entry.why_live = whyLive;
    const fix = coerceFix(item.fix, key);
    if (fix) entry.fix = fix;
    const match = (findings || []).find((candidate) => whereOf(candidate) === where);
    const blast = match ? blastOf(match, findings) : null;
    if (blast) entry.blast = blast;
    rotate.push(entry);
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

  const { shown, note: capNote } = capFindings(findings, env);
  const fallback = (message, extra) => localReport(shown, capNote ? `${message} ${capNote}` : message, extra);
  const prompt = buildPrompt(shown);
  if (prompt.includes(key)) {
    return fallback('Skipped Muse because the prompt contained configured credential material.');
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
    if (!result.ok) return fallback(`Muse request failed (HTTP ${status})`, { http_status: status });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return fallback(timedOut ? 'Muse request failed (timeout)' : 'Muse request failed (network)');
  }

  if (text.includes(key)) {
    return fallback('Muse response was discarded because it echoed credential material.', { http_status: status });
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return fallback('Muse response was not JSON.', { http_status: status });
  }
  const output = extractOutputText(body);
  if (output.includes(key)) {
    return fallback('Muse response was discarded because it echoed credential material.', { http_status: status });
  }
  const parsed = parseModelJson(output);
  const summary = typeof parsed?.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim().slice(0, 2000)
    : (output.trim().slice(0, 2000) || localReport(shown).summary);
  if (summary.includes(key)) {
    return fallback('Muse response was discarded because it echoed credential material.', { http_status: status });
  }
  const ignore = coerceIgnore(parsed?.ignore, key);
  return {
    provider: String(model).startsWith('muse-wonder') ? 'muse-wonder' : 'meta-model-api',
    model,
    http_status: status,
    summary,
    rotate: coerceRotate(parsed?.rotate, shown, key),
    ignore: ignore.length ? ignore : ignoreSuggestions(shown, shown.map((item) => localJudgement(item))),
    note: capNote,
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
  const { shown, note: capNote } = capFindings(findings, env);
  const prompt = buildClassifyPrompt(shown);
  if (prompt.includes(key)) {
    return { offline: false, provider: 'local-fallback', model: null, http_status: null, usage: null, labels: local, note: capNote };
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeout = Number(env.SENTINEL_MUSE_TIMEOUT_MS || 20000);
  const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 20000;
  try {
    let result = await postResponses(fetchImpl, key, { model, input: prompt, reasoning: { effort: 'minimal' } }, limit);
    if (result.status === 400) result = await postResponses(fetchImpl, key, { model, input: prompt }, limit);
    if (!result.ok || result.text.includes(key)) {
      return { offline: false, provider: 'local-fallback', model: null, http_status: result.status, usage: null, labels: local, note: capNote };
    }
    const body = JSON.parse(result.text);
    const output = extractOutputText(body);
    if (output.includes(key)) {
      return { offline: false, provider: 'local-fallback', model: null, http_status: result.status, usage: null, labels: local, note: capNote };
    }
    const parsed = parseModelJson(output);
    return {
      offline: false,
      provider: 'muse-spark',
      model,
      http_status: result.status,
      usage: usageOf(body),
      labels: alignLabels(findings, parsed, 'muse-spark', key),
      note: capNote,
    };
  } catch {
    return { offline: false, provider: 'local-fallback', model: null, http_status: null, usage: null, labels: local, note: capNote };
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
  const blocking = findings.filter((finding) => !finding.advisory);
  if (!blocking.length) {
    return {
      provider: 'local-fallback',
      model: null,
      http_status: null,
      summary: 'Only advisory AI signals. Nothing blocks the merge.',
      rotate: [],
      ignore: [],
      note: null,
      usage: null,
      classifier: { provider: 'local-fallback', model: null },
      labels: [],
      comment: renderComment(findings, [], null),
    };
  }
  const classified = await classifyFindings(blocking, options);
  const focus = blocking.filter((finding) => {
    const label = classified.labels.find((item) => item.where === whereOf(finding));
    return label?.label === 'likely_live' || label?.label === 'unclear';
  });
  let explanation;
  if (classified.offline) {
    explanation = await explainFindings(blocking, options);
  } else if (focus.length) {
    explanation = await explainFindings(focus, options);
  } else {
    explanation = {
      provider: classified.provider,
      model: classified.model,
      http_status: classified.http_status,
      summary: 'Every finding looks like an example, fixture, or test. The merge gate still fails until a person rotates or removes it.',
      rotate: localReport(blocking).rotate,
      note: classified.note || null,
      usage: classified.usage,
    };
  }
  const localIgnore = ignoreSuggestions(blocking, classified.labels);
  const seen = new Set((explanation.ignore || []).map((item) => item?.pattern));
  explanation = {
    ...explanation,
    usage: addUsage(classified.usage, explanation.usage),
    classifier: { provider: classified.provider, model: classified.model },
    labels: classified.labels,
    ignore: [...(explanation.ignore || []), ...localIgnore.filter((item) => !seen.has(item.pattern))].slice(0, 10),
    note: explanation.note || classified.note || null,
  };
  explanation.comment = renderComment(findings, classified.labels, explanation);
  return explanation;
}
