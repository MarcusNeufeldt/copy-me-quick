import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';

export async function GET(request: NextRequest) {
  const token = cookies().get(GITHUB_TOKEN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      // If token is invalid or expired, clear the cookie
      if (response.status === 401) {
         cookies().delete(GITHUB_TOKEN_COOKIE_NAME);
         return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      console.error('GitHub API error fetching user:', response.status, await response.text());
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const userData = await response.json();

    // Return relevant user data (e.g., login, avatar_url, name)
    return NextResponse.json({
      login: userData.login,
      avatarUrl: userData.avatar_url,
      name: userData.name,
    });

  } catch (error) {
    console.error('Error fetching GitHub user data:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
} 