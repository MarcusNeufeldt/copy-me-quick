import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';
const GITHUB_API_BASE = 'https://api.github.com';

// Helper to fetch a single resource, handling errors and token
async function fetchGitHub(url: string, token: string, cacheMode: RequestCache = 'no-store') {
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
        },
        cache: cacheMode,
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Invalid GitHub token');
        }
        const errorText = await response.text();
        console.error(`GitHub API error fetching ${url}:`, response.status, errorText);
        // Include status in error message for better context
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value;
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    let branch = searchParams.get('branch'); // Branch name

    if (!token) {
        const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        res.cookies.delete(GITHUB_TOKEN_COOKIE_NAME);
        return res;
    }

    if (!owner || !repo || !branch) {
        return NextResponse.json({ error: 'Missing owner, repo, or branch parameter' }, { status: 400 });
    }
    // Sanitize branch name just in case (though unlikely needed for GET param)
    branch = encodeURIComponent(branch); 

    try {
        // 1. Get the commit SHA and date for the branch head
        // Use commits endpoint which seems more reliable than branches endpoint for the tree sha sometimes
        const branchCommitUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${branch}`;
        console.log(`Fetching commit info for branch: ${branchCommitUrl}`); // Debug log
        const commitInfo = await fetchGitHub(branchCommitUrl, token);
        let treeSha = commitInfo?.commit?.tree?.sha;
        let commitDate = commitInfo?.commit?.committer?.date || commitInfo?.commit?.author?.date || null;

        if (!treeSha) {
            console.error('Could not find tree SHA directly from commit info:', commitInfo);
            // Fallback: Try getting branch info directly if commit failed (e.g., branch name needs different encoding?)
             console.log(`Fallback: Fetching branch info directly for ${branch}`);
            const branchInfoUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`;
            const branchInfo = await fetchGitHub(branchInfoUrl, token);
            const fallbackTreeSha = branchInfo?.commit?.commit?.tree?.sha;
            if (!fallbackTreeSha) {
                 console.error('Could not find tree SHA via branch info either:', branchInfo);
                 throw new Error('Could not find tree SHA for the specified branch commit');
            }
             console.warn("Using fallback tree SHA from branch info for branch:", branch);
             treeSha = fallbackTreeSha;
             commitDate = branchInfo?.commit?.commit?.committer?.date || branchInfo?.commit?.commit?.author?.date || commitDate;
        }

        // 2. Get the tree recursively using the SHA
        const treeUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
        console.log(`Fetching tree recursively: ${treeUrl}`); // Debug log
        const treeData = await fetchGitHub(treeUrl, token);

        // The recursive tree response might be truncated if it's too large.
        // The `truncated` field will be true in that case.
        if (treeData?.truncated) {
            console.warn(`GitHub tree data for ${owner}/${repo}/${branch} was truncated. Some files may be missing.`);
            // We might need to handle this more gracefully in the future, 
            // maybe by making non-recursive calls for subtrees as needed,
            // but for now, we proceed with the truncated data.
        }

        if (!treeData || !Array.isArray(treeData.tree)) {
             console.error('Invalid tree data received from GitHub API:', treeData);
             throw new Error('Invalid tree data received from GitHub API');
        }

        // Filter out non-blob/tree types (like gitlinks/submodules if not needed)
        const filteredTree = treeData.tree.filter((item: { type: string }) => 
            item.type === 'blob' || item.type === 'tree'
        );

        console.log(`Successfully fetched tree with ${filteredTree.length} items. Commit date: ${commitDate}`); // Debug log including date
        return NextResponse.json({
            tree: filteredTree,
            truncated: treeData.truncated ?? false,
            commitDate: commitDate
        }); 

    } catch (error: any) {
        console.error(`Error fetching tree for ${owner}/${repo}/${branch}:`, error);
        const status = error.message === 'Invalid GitHub token' ? 401 : 
                       error.message.includes('404') ? 404 : 500; // Check for 404

        let errorMessage = error.message || 'Failed to fetch file tree';
        if (status === 404) {
            errorMessage = `Repository or branch not found, or access denied. Ensure '${decodeURIComponent(owner)}/${decodeURIComponent(repo)}' and branch '${decodeURIComponent(branch)}' exist and you have access.`;
        }
        const res = NextResponse.json({ error: errorMessage }, { status });
        if (status === 401) {
            res.cookies.delete(GITHUB_TOKEN_COOKIE_NAME);
        }
        return res;
    }
} 