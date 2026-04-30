import { NextRequest, NextResponse } from 'next/server';
import { clearGitHubCookie, resolveGitHubToken } from '@/lib/githubAuth';
const GITHUB_API_BASE = 'https://api.github.com';

// Simple fetch function for branches (pagination less likely needed for branches)
async function fetchGitHubBranches(url: string, token: string): Promise<any[]> {
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
        },
        cache: 'no-store', // Don't cache branch list
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Invalid GitHub token');
        }
        const errorText = await response.text();
        console.error(`GitHub API error fetching ${url}:`, response.status, errorText);
        throw new Error(`GitHub API error: ${response.statusText}`);
    }
    return await response.json();
}


export async function GET(request: NextRequest) {
    const { token, source } = await resolveGitHubToken();
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!owner || !repo) {
        return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
    }

    try {
        const branchesUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`;
        const branches = await fetchGitHubBranches(branchesUrl, token);

        // We only need specific fields
        const branchData = branches.map(branch => ({
            name: branch.name,
            commit: {
                sha: branch.commit.sha,
            }
        }));

        return NextResponse.json(branchData);

    } catch (error: any) {
        console.error(`Error fetching branches for ${owner}/${repo}:`, error);
        let status = 500;
        if (error.message === 'Invalid GitHub token') {
            status = 401;
        }
        const res = NextResponse.json({ error: error.message || 'Failed to fetch branches' }, { status });
        if (status === 401) {
            clearGitHubCookie(res, source);
        }
        return res;
    }
}
