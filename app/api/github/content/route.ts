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
            // Don't delete cookie here, just throw specific error
            throw new Error('Invalid GitHub token');
        }
        const errorText = await response.text();
        console.error(`GitHub API error fetching ${url}:`, response.status, errorText);
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies(); // Await cookie store
    const token = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value; // Use resolved store
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const path = searchParams.get('path');
    const sha = searchParams.get('sha');
    const ref = searchParams.get('ref');

    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!owner || !repo || (!path && !sha)) {
        return NextResponse.json(
            { error: 'Missing required parameters. Provide owner, repo, and either path or sha.' }, 
            { status: 400 }
        );
    }

    try {
        let contentUrl: string;
        
        // Use either path-based or blob-based API depending on what parameters were provided
        if (path) {
            // Use contents API (easier, handles encoding)
            contentUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
            
            // Add ref parameter if we have a branch, sha, or ref reference
            const refParam = ref || sha;
            if (refParam) {
                contentUrl += `?ref=${encodeURIComponent(refParam)}`;
            }
        } else {
            // Use git blob API with the provided SHA
            contentUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs/${sha}`;
        }

        console.log(`Fetching file content: ${contentUrl}`);
        const contentData = await fetchGitHub(contentUrl, token);

        // Handle different API response formats
        let content: string;
        let encoding: string;

        if (path) {
            // Contents API response
            content = contentData.content || '';
            encoding = contentData.encoding || 'base64';
        } else {
            // Blob API response
            content = contentData.content || '';
            encoding = contentData.encoding || 'base64';
        }

        // Decode content if necessary
        if (encoding === 'base64') {
            // First, normalize the base64 string by removing newlines
            const normalizedBase64 = content.replace(/\s/g, '');
            
            // Use built-in atob for base64 decoding in Node.js environment
            try {
                content = Buffer.from(normalizedBase64, 'base64').toString('utf-8');
            } catch (error) {
                console.error('Error decoding base64 content:', error);
                throw new Error('Failed to decode file content');
            }
        }

        return NextResponse.json({ 
            content,
            path: path || '',
            sha: contentData.sha || sha || '',
            size: contentData.size || content.length
        });

    } catch (error: any) {
        console.error(`Error fetching content for ${path || sha}:`, error);
        const status = error.message === 'Invalid GitHub token' ? 401 : 
                      error.message.includes('404') ? 404 : 500;

        // Check for the specific error and delete cookie here
        if (status === 401 && error.message === 'Invalid GitHub token') {
             const storeToDelete = await cookies(); // Get store again for deletion
             storeToDelete.delete(GITHUB_TOKEN_COOKIE_NAME);
        }

        let errorMessage = error.message || 'Failed to fetch file content';
        if (status === 404) {
            errorMessage = `File not found. Ensure the path or SHA is correct and you have access.`;
        }
        
        return NextResponse.json({ error: errorMessage }, { status });
    }
} 