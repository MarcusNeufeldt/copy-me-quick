import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto'; // Import crypto module

// Example scopes: 'repo' for private repo access, 'read:user' for user profile info
// Adjust scopes based on the required permissions for your app.
const GITHUB_SCOPES = ['repo', 'read:user'].join(' ');

const GITHUB_STATE_COOKIE_NAME = 'github_oauth_state';

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    console.error('GITHUB_CLIENT_ID environment variable not set.');
    // Optionally redirect to an error page or show an error message
    return new Response('Server configuration error: GITHUB_CLIENT_ID missing.', { status: 500 });
  }

  // Generate secure random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in a short-lived HttpOnly cookie
  const cookieStore = await cookies(); // Await the cookie store
  cookieStore.set(GITHUB_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
    sameSite: 'lax',
  });

  const redirectUri = `${request.nextUrl.origin}/api/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(GITHUB_SCOPES)}&state=${state}`; // Use secure state

  redirect(githubAuthUrl);
} 