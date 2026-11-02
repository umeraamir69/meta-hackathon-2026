import { github } from '../../../lib/remote-scan';
import { parseGitHubUrl } from '../../../lib/sentinel/github-target';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

// Lists recent commits and pull requests for a repo link so the user can
// pick up to MAX_PICK items to scan. Body: { url }.
const COMMIT_COUNT = 20;
const PULL_COUNT = 10;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send a JSON body with a url.' }, { status: 400, headers: cors });
  }
  try {
    const target = parseGitHubUrl(body?.url || '');
    if (!target || target.pull || target.commit) {
      throw new Error('Send a repository link to list its recent commits and pull requests.');
    }
    const [commits, pulls] = await Promise.all([
      github(`/repos/${target.owner}/${target.repo}/commits?per_page=${COMMIT_COUNT}`),
      github(`/repos/${target.owner}/${target.repo}/pulls?state=all&sort=updated&direction=desc&per_page=${PULL_COUNT}`),
    ]);
    return Response.json(
      {
        source: target.label,
        commits: (Array.isArray(commits) ? commits : []).map((item) => ({
          kind: 'commit',
          url: `https://github.com/${target.owner}/${target.repo}/commit/${item.sha}`,
          sha: item.sha,
          subject: String(item.commit?.message || '').split('\n')[0] || '(no message)',
          author: item.commit?.author?.name || item.author?.login || 'unknown',
          date: String(item.commit?.author?.date || '').slice(0, 10) || null,
        })),
        pulls: (Array.isArray(pulls) ? pulls : []).map((item) => ({
          kind: 'pull',
          url: item.html_url,
          number: item.number,
          title: item.title || '(no title)',
          author: item.user?.login || 'unknown',
          state: item.merged_at ? 'merged' : item.state,
        })),
      },
      { headers: cors },
    );
  } catch (error) {
    return Response.json({ error: error.message || 'Could not list that repository.' }, { status: 400, headers: cors });
  }
}
