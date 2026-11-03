import { chatWithMuse, streamChatWithMuse } from '../../../lib/sentinel/muse';

export const runtime = 'nodejs';
export const maxDuration = 60;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

function slimDigest(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const findings = Array.isArray(raw.findings) ? raw.findings.slice(0, 20).map((f) => ({
    rule: f.rule,
    severity: f.severity,
    advisory: Boolean(f.advisory),
    label: f.label,
    why: String(f.why || '').slice(0, 280),
    source: f.source,
    path: f.path,
    line: f.line,
    masked: f.masked,
    removed: Boolean(f.removed),
    author: f.author || null,
    date: f.date || null,
    blast: String(f.blast || '').slice(0, 280),
    why_live: String(f.why_live || '').slice(0, 280),
    steps: Array.isArray(f.steps)
      ? f.steps.slice(0, 4).map((step) => String(step || '').slice(0, 280))
      : [],
  })) : [];
  const fixes = Array.isArray(raw.fixes) ? raw.fixes.slice(0, 12).map((step) => ({
    where: String(step.where || '').slice(0, 160),
    text: String(step.text || '').slice(0, 400),
    why: String(step.why || '').slice(0, 280),
    blast: String(step.blast || '').slice(0, 280),
  })) : [];
  return {
    ok: Boolean(raw.ok),
    count: raw.count,
    source: raw.source,
    scope: raw.scope,
    summary: String(raw.summary || '').slice(0, 800),
    score: raw.score,
    grade: raw.grade || null,
    findings,
    fixes,
  };
}

function historyOf(body) {
  return Array.isArray(body?.history) ? body.history.slice(-8).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: String(item?.content || '').slice(0, 1200),
  })) : [];
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send JSON with message and digest.' }, { status: 400, headers: cors });
  }

  const message = String(body?.message || '').trim();
  if (!message) {
    return Response.json({ error: 'message is required.' }, { status: 400, headers: cors });
  }

  const digest = slimDigest(body?.digest);
  const history = historyOf(body);
  const stream = body?.stream !== false;

  try {
    if (stream) {
      const readable = streamChatWithMuse({ message, digest, history });
      return new Response(readable, {
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const result = await chatWithMuse({ message, digest, history });
    return Response.json(result, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message || 'Muse chat failed.' }, { status: 500, headers: cors });
  }
}
