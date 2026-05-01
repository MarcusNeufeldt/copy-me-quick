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
    throw Object.assign(new Error(`GitHub API error: ${response.statusText}`), {
      status: response.status,
    });
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const { token, source } = await resolveGitHubToken();
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref');
  const limitParam = Number(searchParams.get('limit') || '30');
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 30;

  if (!token) {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    clearGitHubCookie(res, source);
    return res;
  }

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      per_page: String(limit),
      page: '1',
    });

    if (ref) {
      params.set('sha', ref);
    }

    const commits = await fetchGitHub(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?${params.toString()}`,
      token
    );

    if (!Array.isArray(commits)) {
      throw new Error('Unexpected response format from GitHub API');
    }

    return NextResponse.json(commits.map((commit: any) => ({
      sha: commit.sha,
      shortSha: commit.sha?.slice(0, 7),
      message: (commit.commit?.message || '').split('\n')[0] || commit.sha?.slice(0, 7),
      authorName: commit.commit?.author?.name || commit.commit?.committer?.name || null,
      authorLogin: commit.author?.login || commit.committer?.login || null,
      date: commit.commit?.committer?.date || commit.commit?.author?.date || null,
      html_url: commit.html_url,
      parents: Array.isArray(commit.parents)
        ? commit.parents.map((parent: any) => ({ sha: parent.sha, html_url: parent.html_url }))
        : [],
    })));
  } catch (error: any) {
    console.error('Error fetching GitHub commits:', error);
    const status = error.message === 'Invalid GitHub token' ? 401 : (error.status || 500);
    const res = NextResponse.json({ error: error.message || 'Failed to fetch commits' }, { status });
    if (status === 401) {
      clearGitHubCookie(res, source);
    }
    return res;
  }
}
