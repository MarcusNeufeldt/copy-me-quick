import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';
const GITHUB_API_BASE = 'https://api.github.com';

async function fetchGitHubPaginated(url: string, token: string): Promise<any[]> {
    let results: any[] = [];
    let page = 1;
    const perPage = 100; // Max allowed by GitHub API

    while (true) {
        const fullUrl = `${url}?type=all&sort=updated&per_page=${perPage}&page=${page}`;
        const response = await fetch(fullUrl, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
            cache: 'no-store', // Don't cache repo list on the server
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid GitHub token');
            }
            const errorText = await response.text();
            console.error(`GitHub API error fetching ${url} (page ${page}):`, response.status, errorText);
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            console.error("GitHub API response was not an array:", data);
            throw new Error("Unexpected response format from GitHub API");
        }

        results = results.concat(data);

        // Check Link header for next page, or break if response is less than perPage
        const linkHeader = response.headers.get('Link');
        if (!linkHeader || !linkHeader.includes('rel="next"') || data.length < perPage) {
            break;
        }
        page++;
    }
    return results;
}


export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value;

  if (!token) {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    res.cookies.delete(GITHUB_TOKEN_COOKIE_NAME);
    return res;
  }

  try {
    const repos = await fetchGitHubPaginated(`${GITHUB_API_BASE}/user/repos`, token);

    // We only need specific fields for the dropdown
    const repoData = repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name, // e.g., "owner/repo"
        private: repo.private,
        owner: {
            login: repo.owner.login,
        },
        default_branch: repo.default_branch,
    }));

    return NextResponse.json(repoData);

  } catch (error: any) {
    console.error('Error fetching GitHub repositories:', error);
    const status = error.message === 'Invalid GitHub token' ? 401 : 500;
    const res = NextResponse.json({ error: error.message || 'Failed to fetch repositories' }, { status });
    if (status === 401) {
        res.cookies.delete(GITHUB_TOKEN_COOKIE_NAME);
    }
    return res;
  }
} 