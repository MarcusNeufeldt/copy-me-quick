import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const GITHUB_TOKEN_COOKIE_NAME = 'github_token';

/**
 * Handle GitHub logout by clearing the auth cookie
 */
export async function POST() {
  try {
    // Get the cookies instance
    const cookieStore = cookies();
    
    // Clear the GitHub token cookie
    cookieStore.delete(GITHUB_TOKEN_COOKIE_NAME);
    
    // Return a success response
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Error in GitHub logout:', error);
    return new NextResponse(JSON.stringify({ error: 'Logout failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
} 