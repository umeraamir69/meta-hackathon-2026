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

const ASSESS_VERDICTS = new Set(['likely_agent', 'likely_human', 'mixed', 'unclear']);
const ASSESS_CONFIDENCE = new Set(['high', 'medium', 'low']);

function signalBlock(finding) {
  return `signal=${finding.rule} where=${whereOf(finding)} detail=${finding.masked || ''}`;
}

function buildAssessPrompt(signals) {
  return [
    'You assess whether a pull request shows signs of AI-agent authorship.',
    'You do not decide anything about merging. You accuse no one.',
    'Base the verdict ONLY on the listed signals below.',
    'Stylistic hunches without a cited signal are forbidden: if the signals are thin, reply "unclear" and say what is missing.',
    '"likely_human" requires positive evidence; absence of signals alone means "unclear".',
    'Never invent filenames, authors, or signal text.',
    'Reply with JSON only: {"verdict": "likely_agent|likely_human|mixed|unclear", "confidence": "high|medium|low", "evidence": [{"signal": string, "why": string}], "review_focus": [string]}',
    'Keep every string under 280 characters.',
    '',
    ...signals.slice(0, 20).map(signalBlock),
  ].join('\n');
}

function buildAssessNotesPrompt(assessment, signals) {
  const evidence = (assessment.evidence || []).map((item) => `${item.signal}: ${item.why}`).join(' | ').slice(0, 800);
  const paths = [...new Set(signals.map((finding) => finding.path))].slice(0, 20).join(', ');
  return [
    `An agentic-PR triage flagged this pull request as ${assessment.verdict} with evidence: ${evidence}.`,
    'The deterministic secret gate already ran separately.',
    'Write short review-focus notes for the human reviewer: which classes of defect to scrutinize (auth, input handling, migrations, tests that assert nothing), grounded in these changed paths:',
    paths,
    'Do not rewrite code. Do not restate the verdict as fact; say "signals suggest".',
    'Reply with JSON only: {"notes": [{"path": string, "focus": string}]}',
    'Keep every string under 280 characters.',
  ].join('\n');
}

function coerceEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((item) => ({
    signal: String(item?.signal || '').slice(0, 280),
    why: String(item?.why || '').slice(0, 280),
  })).filter((item) => item.signal && item.why);
}

function coerceNotes(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((item) => ({
    path: String(item?.path || '').slice(0, 280),
    focus: String(item?.focus || '').slice(0, 280),
  })).filter((item) => item.path && item.focus);
}

function unclearAssessment(provider, model, note, usage = null) {
  return {
    provider,
    model,
    verdict: 'unclear',
    confidence: 'low',
    evidence: [],
    review_focus: [],
    notes: [],
    usage,
    usage_wonder: null,
    note,
  };
}

/**
 * Layer 2: one Spark verdict call plus, for likely_agent/mixed, one Wonder
 * review-focus call. Grounded in Layer-1 signals only; null without signals
 * or without a key. Never affects the gate.
 */
async function postAssessPrompt(fetchImpl, key, model, prompt, limit) {
  let result = await postResponses(fetchImpl, key, { model, input: prompt, reasoning: { effort: 'minimal' } }, limit);
  if (result.status === 400) {
    result = await postResponses(fetchImpl, key, { model, input: prompt }, limit);
  }
  if (!result.ok) return { ok: false, status: result.status, output: '', usage: null };
  let body;
  try {
    body = JSON.parse(result.text);
  } catch {
    return { ok: false, status: result.status, output: '', usage: null };
  }
  const output = extractOutputText(body);
  if (output.includes(key)) return { ok: false, status: result.status, output: '', usage: null, echoed: true };
  return { ok: true, status: result.status, output, usage: usageOf(body) };
}

export async function assessAiSignals(findings, options = {}) {
  const signals = (findings || []).filter((finding) => finding.advisory);
  if (!signals.length) return null;
  const env = options.env || process.env;
  if (env.SENTINEL_MUSE === 'false') return null;
  const key = apiKey(env);
  if (!key) return null;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const classifier = env.SENTINEL_CLASSIFIER || 'muse-spark-1.3';
  const model = env.SENTINEL_MODEL || 'muse-wonder-1.0';
  const refused = [classifier, model].find((name) => String(name).endsWith('-contributor'));
  if (refused) {
    return unclearAssessment('local-fallback', null, `Refusing ${refused}: contributor-tier models are blocked.`);
  }
  const timeout = Number(env.SENTINEL_MUSE_TIMEOUT_MS || 20000);
  const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 20000;
  const truncated = signals.length > 20 ? `Assessed 20 of ${signals.length} signals.` : null;
  let spark;
  try {
    spark = await postAssessPrompt(fetchImpl, key, classifier, buildAssessPrompt(signals), limit);
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return unclearAssessment('local-fallback', classifier, timedOut ? 'Assessment call failed (timeout).' : 'Assessment call failed (network).');
  }
  if (!spark.ok) {
    return unclearAssessment('local-fallback', classifier, spark.echoed
      ? 'Assessment reply was discarded because it echoed credential material.'
      : `Assessment call failed (HTTP ${spark.status}).`);
  }
  const parsed = parseModelJson(spark.output);
  if (!parsed || !ASSESS_VERDICTS.has(parsed.verdict)) {
    return unclearAssessment('meta-model-api', classifier, 'The assessment reply was not valid JSON.', spark.usage);
  }
  const verdict = {
    provider: String(classifier).startsWith('muse-spark') ? 'muse-spark' : 'meta-model-api',
    model: classifier,
    verdict: parsed.verdict,
    confidence: ASSESS_CONFIDENCE.has(parsed.confidence) ? parsed.confidence : 'low',
    evidence: coerceEvidence(parsed.evidence),
    review_focus: Array.isArray(parsed.review_focus) ? parsed.review_focus.map((s) => String(s).slice(0, 280)).slice(0, 8) : [],
    notes: [],
    usage: spark.usage,
    usage_wonder: null,
    note: truncated,
  };
  if (verdict.verdict !== 'likely_agent' && verdict.verdict !== 'mixed') return verdict;
  try {
    const wonder = await postAssessPrompt(fetchImpl, key, model, buildAssessNotesPrompt(verdict, signals), limit);
    if (wonder.ok) {
      verdict.notes = coerceNotes(parseModelJson(wonder.output)?.notes);
      verdict.usage_wonder = wonder.usage;
    }
    if (!verdict.notes.length) verdict.note = [verdict.note, 'Review-focus notes were empty.'].filter(Boolean).join(' ');
  } catch (error) {
    verdict.note = [verdict.note, `Notes call failed: ${String(error?.message || error).slice(0, 160)}`].filter(Boolean).join(' ');
  }
  return verdict;
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

function blockingFindings(digest) {
  return (digest?.findings || []).filter((f) => !f.advisory);
}

function priorityFindings(digest) {
  const blocking = blockingFindings(digest);
  const live = blocking.filter((f) => f.label === 'likely_live' || f.label === 'unclear' || !f.label);
  return (live.length ? live : blocking);
}

function formatFindingLine(finding, index) {
  const where = `${finding.path || 'unknown'}${finding.line != null ? `:${finding.line}` : ''}`;
  const label = finding.label ? ` · ${String(finding.label).replaceAll('_', ' ')}` : '';
  return `${index}. ${finding.rule} @ ${where} (${finding.severity || 'medium'}${label})`;
}

function stepsForFinding(finding, fixes) {
  if (finding?.steps?.length) return finding.steps.slice(0, 3);
  const path = finding?.path || '';
  const matched = (fixes || []).filter((step) => String(step.where || '').includes(path)).slice(0, 3);
  if (matched.length) return matched.map((step) => step.text);
  return [
    `Revoke/rotate the ${finding?.rule || 'credential'} (${finding?.masked || 'masked value'}).`,
    `Remove it from ${finding?.path || 'source'} and purge git history if it remains in older commits.`,
    'Store the replacement in a secret manager, redeploy, then rescan.',
  ];
}

function priorityPlan(digest) {
  const top = priorityFindings(digest).slice(0, 3);
  if (!top.length) {
    return digest?.ok
      ? 'Nothing blocking. No urgent secret remediations — optional: review any AI advisories.'
      : 'No findings listed in this digest. Rescan or open a finding’s Muse button for the checklist.';
  }
  const lines = [
    `Do these first (${top.length} highest-priority blocking hit${top.length === 1 ? '' : 's'}):`,
    '',
  ];
  top.forEach((finding, index) => {
    lines.push(formatFindingLine(finding, index + 1));
    if (finding.why || finding.why_live) lines.push(`   Why: ${finding.why_live || finding.why}`);
    const steps = stepsForFinding(finding, digest?.fixes);
    steps.forEach((step) => lines.push(`   → ${step}`));
    lines.push('');
  });
  lines.push('Order: revoke live credentials → remove from code/history → rescan. Muse cannot clear a Fail.');
  return lines.join('\n').trim();
}

function matchFinding(query, digest) {
  const q = query.toLowerCase();
  const findings = digest?.findings || [];
  return findings.find((finding) => {
    const rule = String(finding.rule || '').toLowerCase();
    const path = String(finding.path || '').toLowerCase();
    const masked = String(finding.masked || '').toLowerCase();
    return (rule && q.includes(rule))
      || (path && q.includes(path))
      || (path && q.includes(path.split('/').pop()))
      || (masked && masked.length > 4 && q.includes(masked.slice(0, 6)));
  }) || null;
}

function explainFinding(finding, digest) {
  const steps = stepsForFinding(finding, digest?.fixes);
  return [
    `${finding.rule} at ${finding.path}${finding.line != null ? `:${finding.line}` : ''}`,
    `Severity ${finding.severity || 'medium'} · ${String(finding.label || 'unlabeled').replaceAll('_', ' ')}${finding.advisory ? ' · advisory (never blocks)' : ' · blocking'}`,
    finding.masked ? `Masked: ${finding.masked}` : null,
    finding.why || finding.why_live ? `Why: ${finding.why_live || finding.why}` : null,
    finding.blast ? `Blast: ${finding.blast}` : null,
    '',
    'Fix now:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
  ].filter(Boolean).join('\n');
}

const OFF_TOPIC_RE = /\b(weather|joke|poem|recipe|capital of|who won|bitcoin|stock price|write (me )?(a |an )?(song|essay|email|story)|ignore (all|previous|your)|system prompt|jailbreak|pretend you are|act as)\b/i;
const REPORT_TOPIC_RE = /\b(fix|rotate|revoke|remediat|finding|secret|credential|token|key|pat|aws|akia|gate|pass|fail|score|risk|grade|merge|pull|pr\b|diff|history|live|example|fixture|advisory|ai signal|muse|priority|first|next|explain|why|how|what|blast|mask|severity|critical|block|scan|report|checklist|rescan|purge|ignore)\b/i;

function tipLine(digest) {
  const top = priorityFindings(digest)[0];
  if (top?.rule) return `Try: “What should I fix first?” or “How do I fix ${top.rule}?”`;
  return 'Try: “Why did this Pass/Fail?” or “What should I fix first?”';
}

function refuseOffTopic(digest) {
  return `I only discuss this merge-gate report — findings, rotate steps, risk score, and Pass/Fail.\n${tipLine(digest)}`;
}

function clarifyReply(digest) {
  return `Not sure what you meant about this report.\n${tipLine(digest)}`;
}

function isOffTopic(message, digest) {
  const text = String(message || '').trim();
  if (!text) return true;
  if (OFF_TOPIC_RE.test(text)) return true;
  if (matchFinding(text.toLowerCase(), digest)) return false;
  if (REPORT_TOPIC_RE.test(text)) return false;
  if (/^(hi|hey|hello|thanks|thank you|ok|okay|cool|yo)\b/i.test(text)) return false;
  // No report keywords and no finding match → stay in lane.
  return text.length > 12;
}

function localChatReply(message, digest, history = []) {
  const text = String(message || '').trim();
  const q = text.toLowerCase();
  const findings = digest?.findings || [];
  const lastAssistant = [...(history || [])].reverse().find((item) => item.role === 'assistant')?.content || '';

  if (text.length < 2 || !/[a-z0-9]/i.test(text)) return clarifyReply(digest);

  if (/^(hi|hey|hello|yo)\b/i.test(text) && text.length < 24) {
    return `Hey — I can help with this report only.\nGate is ${digest?.ok ? 'Pass' : 'Fail'} · risk ${digest?.score ?? 0}${digest?.grade ? ` (${digest.grade})` : ''}.\n${tipLine(digest)}`;
  }

  if (/^(thanks|thank you|ok|okay|cool)\b/i.test(text)) {
    return `You’re welcome. When you’re ready: ${tipLine(digest)}`;
  }

  if (isOffTopic(text, digest)) return refuseOffTopic(digest);

  const matched = matchFinding(q, digest);
  if (matched && (
    /(fix|explain|about|what|tell|detail|how|rotate|revoke)/.test(q)
    || q.includes(String(matched.rule || '').toLowerCase())
  )) {
    return explainFinding(matched, digest);
  }

  if (/important|priority|resolve|first|urgent|now|critical|start|worst|top|what should/.test(q)) {
    if (lastAssistant && lastAssistant.includes('Do these first') && /important|priority|resolve|first|urgent|now/.test(q)) {
      const first = priorityFindings(digest)[0];
      if (first) {
        return `Same top item — start here:\n\n${explainFinding(first, digest)}\n\nWhen that credential is revoked and removed, ask “what’s next?”`;
      }
    }
    return priorityPlan(digest);
  }

  if (/bad|serious|severe|mistake|wrong|risk|danger|how.?s|how is|grade|score/.test(q)) {
    const blocking = blockingFindings(digest);
    const live = blocking.filter((f) => f.label === 'likely_live');
    const examples = blocking.filter((f) => f.label === 'likely_example' || f.label === 'likely_fixture');
    const top = priorityFindings(digest)[0];
    if (digest?.ok) {
      return `Not a secrets merge problem — gate is Pass (score ${digest.score ?? 0}${digest.grade ? ` · ${digest.grade}` : ''}). AI advisories never block.`;
    }
    return [
      `Yes — this Fail is a real merge blocker.`,
      `Risk ${digest.score ?? 0}${digest.grade ? ` (${digest.grade})` : ''} · ${blocking.length} blocking · ${live.length} likely live${examples.length ? ` · ${examples.length} sample/fixture` : ''}.`,
      top ? `Worst right now: ${top.rule} @ ${top.path}${top.line != null ? `:${top.line}` : ''}.` : null,
      'Ask “What should I fix first?” for the revoke/remove order.',
    ].filter(Boolean).join('\n');
  }

  if (/pass|fail|gate|merge|why did|why is/.test(q)) {
    if (digest?.ok) {
      return `Merge gate is Pass — no blocking secrets. Risk ${digest.score ?? 0}${digest.grade ? ` (${digest.grade})` : ''}. AI advisories never flip this gate.`;
    }
    const live = priorityFindings(digest).filter((f) => f.label === 'likely_live').length;
    return [
      `Merge gate is Fail — ${digest.count ?? blockingFindings(digest).length} blocking finding(s)${live ? `, ${live} likely live` : ''}.`,
      digest.summary ? digest.summary : null,
      'Rules failed the gate, not Muse. Rotate/remove blocking secrets, then rescan.',
      'Ask “What should I fix first?” for the ordered plan.',
    ].filter(Boolean).join('\n');
  }

  if (/fix|rotate|remediat|how do|checklist/.test(q)) {
    return priorityPlan(digest);
  }

  if (/live|example|fixture|false positive|sample/.test(q)) {
    const blocking = blockingFindings(digest);
    const live = blocking.filter((f) => f.label === 'likely_live');
    const examples = blocking.filter((f) => f.label === 'likely_example' || f.label === 'likely_fixture');
    const lines = [
      `${live.length} likely live · ${examples.length} sample/fixture · ${blocking.length} blocking.`,
      'Samples still Fail until removed — only a human clears the gate.',
    ];
    live.slice(0, 4).forEach((f, i) => {
      if (i === 0) lines.push('', 'Likely live first:');
      lines.push(formatFindingLine(f, i + 1));
    });
    examples.slice(0, 3).forEach((f, i) => {
      if (i === 0) lines.push('', 'Looks like samples:');
      lines.push(formatFindingLine(f, i + 1));
    });
    return lines.join('\n');
  }

  if (/next|then|after that|done|finished/.test(q)) {
    const top = priorityFindings(digest);
    if (top.length > 1) return explainFinding(top[1], digest);
    if (top[0]) return `After ${top[0].rule} is gone, rescan. If it still Fails, ask about the next finding.`;
  }

  if (matched) return explainFinding(matched, digest);

  if (findings.length) {
    return [
      'I only answer about this report.',
      `Gate: ${digest?.ok ? 'Pass' : 'Fail'} · ${digest.count ?? blockingFindings(digest).length} blocking.`,
      tipLine(digest),
    ].join('\n');
  }

  return 'Ask about the merge gate, a finding, or how to remediate. Secrets stay masked.';
}

function buildChatPrompt(text, digest, history = []) {
  const prior = (Array.isArray(history) ? history : [])
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'User' : 'Muse'}: ${String(item.content || '').slice(0, 700)}`)
    .join('\n');

  return [
    'You are Muse, the live triage chat inside PR Diff Sentinel.',
    'SCOPE LOCK: Answer ONLY about this merge-gate report — findings, labels, rotate/revoke steps, risk score/grade, Pass/Fail meaning, AI advisories, masked values in the digest.',
    'If the user asks anything else (weather, jokes, general coding, politics, unrelated help), refuse in one short sentence and offer 2 report-specific follow-ups.',
    'Never decide Pass/Fail — deterministic rules already did. Never invent findings. Never ask for or repeat raw secrets — masked values only.',
    'Be conversational and specific. Prefer 2–8 short sentences. Use a tight numbered plan only when they ask what to fix / how to remediate.',
    'Do NOT paste the full findings dump, the entire digest, or repeat a prior answer verbatim. Build on the recent chat.',
    'If the message is unclear noise, ask them to clarify with 2 concrete report questions.',
    '',
    'REPORT DIGEST (JSON):',
    JSON.stringify(digest || {}).slice(0, 7000),
    '',
    prior ? `Recent chat:\n${prior}\n` : '',
    `User: ${text}`,
    'Muse:',
  ].join('\n');
}

function providerLabel(model) {
  return String(model).startsWith('muse-wonder') ? 'muse-wonder' : 'meta-model-api';
}

/**
 * Short Q&A over a masked report digest. Never decides Pass/Fail.
 */
export async function chatWithMuse({ message, digest, history = [] }, options = {}) {
  const text = String(message || '').trim().slice(0, 1200);
  if (!text) return { reply: 'Ask a question about this merge gate report.', provider: 'local-fallback', model: null };

  const env = options.env || process.env;
  const key = apiKey(env);
  const fallback = localChatReply(text, digest, history);

  if (!key || env.SENTINEL_MUSE === 'false') {
    return { reply: fallback, provider: 'local-fallback', model: null };
  }

  const model = env.SENTINEL_MODEL || 'muse-wonder-1.0';
  if (String(model).endsWith('-contributor')) {
    return { reply: fallback, provider: 'local-fallback', model: null };
  }

  const prompt = buildChatPrompt(text, digest, history);
  if (prompt.includes(key)) {
    return { reply: fallback, provider: 'local-fallback', model: null };
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeout = Number(env.SENTINEL_MUSE_TIMEOUT_MS || 35000);
  const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 35000;

  try {
    let result = await postResponses(fetchImpl, key, { model, input: prompt, reasoning: { effort: 'minimal' } }, limit);
    if (result.status === 400) result = await postResponses(fetchImpl, key, { model, input: prompt }, limit);
    if (!result.ok || result.text.includes(key)) {
      return { reply: fallback, provider: 'local-fallback', model: null, http_status: result.status };
    }
    const body = JSON.parse(result.text);
    const output = extractOutputText(body).trim().slice(0, 4000);
    if (!output || output.includes(key)) {
      return { reply: fallback, provider: 'local-fallback', model: null, http_status: result.status };
    }
    return {
      reply: output,
      provider: providerLabel(model),
      model,
      http_status: result.status,
    };
  } catch {
    return { reply: fallback, provider: 'local-fallback', model: null };
  }
}

function sseEncode(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function parseMetaSse(response, onDelta) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    const body = JSON.parse(text);
    const output = extractOutputText(body).trim();
    if (output) onDelta(output);
    return output;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n');
    buffer = chunks.pop() || '';
    for (const line of chunks) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event?.type === 'response.output_text.delta') {
        const delta = typeof event.delta === 'string'
          ? event.delta
          : (typeof event.delta?.text === 'string' ? event.delta.text : '');
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } else if (event?.type === 'response.failed') {
        throw new Error(event?.response?.error?.message || 'Muse stream failed.');
      }
    }
  }
  return full.trim();
}

/**
 * SSE ReadableStream for live Muse chat. Falls back to local reply chunks.
 * Events: {type:'delta', text}, {type:'done', provider, model}, {type:'error', message}
 */
export function streamChatWithMuse({ message, digest, history = [] }, options = {}) {
  const text = String(message || '').trim().slice(0, 1200);
  const env = options.env || process.env;
  const key = apiKey(env);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const model = env.SENTINEL_MODEL || 'muse-wonder-1.0';
  const fallback = localChatReply(text || '?', digest, history);

  return new ReadableStream({
    async start(controller) {
      let started = false;
      const push = (payload) => {
        if (payload?.type === 'delta' && payload.text) started = true;
        controller.enqueue(new TextEncoder().encode(sseEncode(payload)));
      };
      const streamLocal = (reason) => {
        for (const part of fallback.split(/(\s+)/)) {
          if (part) push({ type: 'delta', text: part });
        }
        push({ type: 'done', provider: 'local-fallback', model: null, reply: fallback, note: reason || null });
        controller.close();
      };

      try {
        if (!text) {
          push({ type: 'delta', text: 'Ask a question about this merge gate report.' });
          push({ type: 'done', provider: 'local-fallback', model: null });
          controller.close();
          return;
        }
        if (!key || env.SENTINEL_MUSE === 'false' || String(model).endsWith('-contributor')) {
          streamLocal();
          return;
        }

        const prompt = buildChatPrompt(text, digest, history);
        if (prompt.includes(key)) {
          streamLocal('prompt-echo-guard');
          return;
        }

        const timeout = Number(env.SENTINEL_MUSE_TIMEOUT_MS || 45000);
        const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 45000;
        const response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            model,
            input: prompt,
            stream: true,
            reasoning: { effort: 'minimal' },
          }),
          signal: AbortSignal.timeout(limit),
        });

        if (!response.ok) {
          const once = await chatWithMuse({ message: text, digest, history }, options);
          push({ type: 'delta', text: once.reply });
          push({ type: 'done', provider: once.provider, model: once.model || null, http_status: response.status });
          controller.close();
          return;
        }

        const full = await parseMetaSse(response, (delta) => {
          push({ type: 'delta', text: delta });
        });

        if (!full || full.includes(key)) {
          if (!started) streamLocal('empty-or-echo');
          else {
            push({ type: 'done', provider: 'local-fallback', model: null, note: 'empty-or-echo' });
            controller.close();
          }
          return;
        }
        push({
          type: 'done',
          provider: providerLabel(model),
          model,
          reply: full.slice(0, 4000),
        });
        controller.close();
      } catch (error) {
        try {
          if (!started) streamLocal(error?.message || 'stream-error');
          else {
            push({ type: 'done', provider: providerLabel(model), model, note: error?.message || 'stream-error' });
            controller.close();
          }
        } catch {
          controller.error(error);
        }
      }
    },
  });
}
