import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';
const GITHUB_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
const GITHUB_STATE_COOKIE_NAME = 'github_oauth_state'; // Define cookie name

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Await the cookie store
  const cookieStore = await cookies();
  const storedState = cookieStore.get(GITHUB_STATE_COOKIE_NAME)?.value;

  // Clean up the state cookie immediately using the resolved store
  cookieStore.delete(GITHUB_STATE_COOKIE_NAME);

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variable not set.'
    );
    return new Response('Server configuration error: GitHub credentials missing.', { status: 500 });
  }

  if (!code) {
    // Handle error, user might have denied access or there was an issue
    console.error('GitHub OAuth callback error: No code received.');
    return NextResponse.redirect(new URL('/?error=github_auth_failed', request.url));
  }

  // Validate state to prevent CSRF attacks
  if (!state || !storedState || state !== storedState) {
    console.error('GitHub OAuth callback error: Invalid state parameter.');
    return NextResponse.redirect(new URL('/?error=github_invalid_state', request.url));
  }

  // State is valid, proceed with token exchange

  try {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json', // Request JSON response
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          // redirect_uri is optional here if it matches the one used in the initial request
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('GitHub token exchange failed:', errorData);
      throw new Error(
        `GitHub token exchange failed: ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();

    if (data.error) {
        console.error('GitHub OAuth Error:', data.error_description || data.error);
        throw new Error(data.error_description || `GitHub OAuth Error: ${data.error}`);
    }

    const accessToken = data.access_token;

    if (!accessToken) {
      console.error('Access token not found in GitHub response:', data);
      throw new Error('Access token not found in GitHub response.');
    }

    // Use the same resolved cookie store to set the token
    // Securely store the access token in an HTTP-only cookie
    cookieStore.set(GITHUB_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
      maxAge: GITHUB_TOKEN_MAX_AGE,
      path: '/', // Cookie available application-wide
      sameSite: 'lax', // Protects against CSRF in most cases
    });

    // Redirect user back to the main application page or a dashboard
    return NextResponse.redirect(new URL('/', request.url));

  } catch (error) {
    console.error('Error during GitHub OAuth callback:', error);
    // Redirect to an error page or show an error message
    return NextResponse.redirect(new URL('/?error=github_token_exchange_failed', request.url));
  }
} 