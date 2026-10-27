import { scanRemote } from '../../../lib/remote-scan';

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

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send a JSON body with a url.' }, { status: 400, headers: cors });
  }
  try {
    const report = await scanRemote(body?.url || '');
    return Response.json(report, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message || 'The scan failed.' }, { status: 400, headers: cors });
  }
}
