import { NextRequest, NextResponse } from 'next/server';
import { clearGitHubCookie, resolveGitHubToken } from '@/lib/githubAuth';
const GITHUB_API_BASE = 'https://api.github.com';

async function fetchGitHub(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid GitHub token');
    }
    const errorText = await response.text();
    console.error(`GitHub API error fetching ${url}:`, response.status, errorText);
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

async function fetchGitHubPaginated(url: string, token: string, limit = 50): Promise<any[]> {
  const results: any[] = [];
  let page = 1;
  const perPage = Math.min(100, Math.max(1, limit));

  while (true) {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}per_page=${perPage}&page=${page}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid GitHub token');
      }
      const errorText = await response.text();
      console.error(`GitHub API error fetching ${url} page ${page}:`, response.status, errorText);
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Unexpected response format from GitHub API');
    }

    results.push(...data);
    if (results.length >= limit) {
      break;
    }

    const linkHeader = response.headers.get('Link');
    if (!linkHeader || !linkHeader.includes('rel="next"') || data.length < perPage) {
      break;
    }
    page++;
  }

  return results.slice(0, limit);
}

async function fetchHeadCommitDate(owner: string, repo: string, pull: any, token: string): Promise<string | null> {
  const headRepoFullName = pull.head?.repo?.full_name || `${owner}/${repo}`;
  const headSha = pull.head?.sha;

  if (!headRepoFullName || !headSha) return null;

  try {
    const commit = await fetchGitHub(`${GITHUB_API_BASE}/repos/${headRepoFullName}/commits/${headSha}`, token);
    return commit.commit?.committer?.date || commit.commit?.author?.date || null;
  } catch (error) {
    console.warn(`Failed to fetch head commit date for PR #${pull.number}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { token, source } = await resolveGitHubToken();
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const state = searchParams.get('state') || 'open';
  const limitParam = Number(searchParams.get('limit') || '50');
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 50;

  if (!token) {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    clearGitHubCookie(res, source);
    return res;
  }

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
  }

  try {
    const pulls = await fetchGitHubPaginated(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=${encodeURIComponent(state)}&sort=updated&direction=desc`,
      token,
      limit
    );

    const pullData = await Promise.all(pulls.map(async (pull) => ({
      number: pull.number,
      title: pull.title,
      state: pull.state,
      html_url: pull.html_url,
      updated_at: pull.updated_at,
      lastCommitDate: await fetchHeadCommitDate(owner, repo, pull, token),
      user: pull.user ? { login: pull.user.login } : undefined,
      head: {
        ref: pull.head.ref,
        sha: pull.head.sha,
        repo: pull.head.repo ? { full_name: pull.head.repo.full_name } : null,
      },
      base: {
        ref: pull.base.ref,
        sha: pull.base.sha,
          repo: pull.base.repo ? { full_name: pull.base.repo.full_name } : null,
        },
    })));

    pullData.sort((a, b) => {
      const aTime = new Date(a.lastCommitDate || a.updated_at).getTime();
      const bTime = new Date(b.lastCommitDate || b.updated_at).getTime();
      return bTime - aTime;
    });

    return NextResponse.json(pullData);
  } catch (error: any) {
    console.error('Error fetching GitHub pull requests:', error);
    const status = error.message === 'Invalid GitHub token' ? 401 : 500;
    const res = NextResponse.json({ error: error.message || 'Failed to fetch pull requests' }, { status });
    if (status === 401) {
      clearGitHubCookie(res, source);
    }
    return res;
  }
}
