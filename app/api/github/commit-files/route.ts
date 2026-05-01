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
  const sha = searchParams.get('sha');

  if (!token) {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    clearGitHubCookie(res, source);
    return res;
  }

  if (!owner || !repo || !sha) {
    return NextResponse.json({ error: 'Missing owner, repo, or sha parameter' }, { status: 400 });
  }

  try {
    const commit = await fetchGitHub(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`, token);

    return NextResponse.json({
      commit: {
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
      },
      files: Array.isArray(commit.files)
        ? commit.files.map((file: any) => ({
            filename: file.filename,
            status: file.status,
            sha: file.sha,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch,
            previous_filename: file.previous_filename,
          }))
        : [],
    });
  } catch (error: any) {
    console.error('Error fetching GitHub commit files:', error);
    const status = error.message === 'Invalid GitHub token' ? 401 : (error.status || 500);
    const res = NextResponse.json({ error: error.message || 'Failed to fetch commit files' }, { status });
    if (status === 401) {
      clearGitHubCookie(res, source);
    }
    return res;
  }
}
