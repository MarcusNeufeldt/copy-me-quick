import { NextResponse } from 'next/server';
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

async function fetchGitHubPaginated(url: string, token: string): Promise<any[]> {
  const results: any[] = [];
  let page = 1;

  while (true) {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}per_page=100&page=${page}`, {
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
    const linkHeader = response.headers.get('Link');
    if (!linkHeader || !linkHeader.includes('rel="next"') || data.length < 100) {
      break;
    }
    page++;
  }

  return results;
}

export async function GET() {
  const { token, source } = await resolveGitHubToken();

  if (!token) {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    clearGitHubCookie(res, source);
    return res;
  }

  try {
    const [user, orgs] = await Promise.all([
      fetchGitHub(`${GITHUB_API_BASE}/user`, token),
      fetchGitHubPaginated(`${GITHUB_API_BASE}/user/orgs`, token),
    ]);

    const owners = [
      {
        login: user.login,
        type: 'User',
        avatarUrl: user.avatar_url,
      },
      ...orgs.map((org) => ({
        login: org.login,
        type: 'Organization',
        avatarUrl: org.avatar_url,
      })),
    ];

    return NextResponse.json(owners);
  } catch (error: any) {
    console.error('Error fetching GitHub owners:', error);
    const status = error.message === 'Invalid GitHub token' ? 401 : 500;
    const res = NextResponse.json({ error: error.message || 'Failed to fetch GitHub owners' }, { status });
    if (status === 401) {
      clearGitHubCookie(res, source);
    }
    return res;
  }
}
