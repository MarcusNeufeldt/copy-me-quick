import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFilters, saveUserFilters, initializeDatabase } from '@/lib/turso';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';

// Helper to get authenticated GitHub user info
async function getGitHubUser(token: string): Promise<{ id: string; login: string } | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const userData = await response.json();
    return {
      id: String(userData.id),
      login: userData.login,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/user/filters - Get user's saved filter preferences
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await getGitHubUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Initialize database (creates tables if they don't exist)
  await initializeDatabase();

  const filters = await getUserFilters(user.id);

  if (!filters) {
    // Return default/empty filters if none saved
    return NextResponse.json({
      localExclusions: '',
      localFileTypes: '',
      githubExclusions: '',
      githubFileTypes: '',
      synced: false,
    });
  }

  return NextResponse.json({
    ...filters,
    synced: true,
  });
}

/**
 * POST /api/user/filters - Save user's filter preferences
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await getGitHubUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { localExclusions, localFileTypes, githubExclusions, githubFileTypes } = body;

  // Initialize database
  await initializeDatabase();

  const success = await saveUserFilters(user.id, user.login, {
    localExclusions,
    localFileTypes,
    githubExclusions,
    githubFileTypes,
  });

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to save filters. Database may not be configured.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
