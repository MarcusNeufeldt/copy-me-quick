import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';

export interface GitHubUser {
  id: string;
  login: string;
  avatar_url?: string;
  name?: string;
}

/**
 * Get GitHub user data from the request cookies
 * Returns null if not authenticated or token is invalid
 */
export async function getGithubUser(request?: NextRequest): Promise<GitHubUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      // If token is invalid or expired, clear the cookie
      if (response.status === 401) {
        cookieStore.delete(GITHUB_TOKEN_COOKIE_NAME);
      }
      return null;
    }

    const userData = await response.json();

    return {
      id: userData.id.toString(), // Convert to string for consistency
      login: userData.login,
      avatar_url: userData.avatar_url,
      name: userData.name,
    };

  } catch (error) {
    console.error('Error fetching GitHub user data:', error);
    return null;
  }
}

/**
 * Get GitHub token from cookies
 * Returns null if not authenticated
 */
export async function getGithubToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value || null;
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
}

/**
 * Validate that a user is authenticated
 * Throws an error if not authenticated
 */
export async function requireAuth(): Promise<GitHubUser> {
  const user = await getGithubUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
} 