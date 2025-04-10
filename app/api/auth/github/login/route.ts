import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

// Example scopes: 'repo' for private repo access, 'read:user' for user profile info
// Adjust scopes based on the required permissions for your app.
const GITHUB_SCOPES = ['repo', 'read:user'].join(' ');

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    console.error('GITHUB_CLIENT_ID environment variable not set.');
    // Optionally redirect to an error page or show an error message
    return new Response('Server configuration error: GITHUB_CLIENT_ID missing.', { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(GITHUB_SCOPES)}&state=${Math.random()
    .toString(36)
    .substring(7)}`; // Add CSRF protection state

  redirect(githubAuthUrl);
} 