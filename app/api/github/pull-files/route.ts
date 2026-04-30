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
      throw Object.assign(new Error(`GitHub API error: ${response.statusText}`), {
        status: response.status,
      });
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

export async function GET(request: NextRequest) {
  const { token, source } = await resolveGitHubToken();
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const pullNumber = searchParams.get('pullNumber');

  if (!token) {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    clearGitHubCookie(res, source);
    return res;
  }

  if (!owner || !repo || !pullNumber) {
    return NextResponse.json({ error: 'Missing owner, repo, or pullNumber parameter' }, { status: 400 });
  }

  try {
    const [pull, files] = await Promise.all([
      fetchGitHub(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`, token),
      fetchGitHubPaginated(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/files`, token),
    ]);

    return NextResponse.json({
      pull: {
        number: pull.number,
        title: pull.title,
        state: pull.state,
        html_url: pull.html_url,
        updated_at: pull.updated_at,
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
      },
      files: files.map((file) => ({
        filename: file.filename,
        status: file.status,
        sha: file.sha,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        previous_filename: file.previous_filename,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching GitHub pull request files:', error);
    const status = error.message === 'Invalid GitHub token' ? 401 : (error.status || 500);
    const tokenLabel = source === 'cli' || source === 'env'
      ? 'local GitHub token'
      : 'connected GitHub OAuth token';
    const message = (status === 403 || status === 404)
      ? `The ${tokenLabel} cannot access ${owner}/${repo}. If this is an organization repository, the organization may need to approve this OAuth app or you may need to reconnect GitHub with org access.`
      : error.message || 'Failed to fetch pull request files';
    const res = NextResponse.json({ error: message }, { status });
    if (status === 401) {
      clearGitHubCookie(res, source);
    }
    return res;
  }
}
