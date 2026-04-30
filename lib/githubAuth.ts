import { execFileSync } from 'child_process';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const GITHUB_TOKEN_COOKIE_NAME = 'github_token';

type GitHubTokenSource = 'cookie' | 'cli' | 'env';

interface GitHubTokenResult {
  token: string | null;
  source: GitHubTokenSource | null;
}

function isLocalCliTokenEnabled() {
  return (
    process.env.GITHUB_USE_CLI_TOKEN === '1' &&
    process.env.NODE_ENV !== 'production' &&
    !process.env.VERCEL
  );
}

function resolveLocalToken(): GitHubTokenResult | null {
  const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (envToken?.trim()) {
    return { token: envToken.trim(), source: 'env' };
  }

  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();

    if (!token) return null;
    return { token, source: 'cli' };
  } catch {
    return null;
  }
}

export async function resolveGitHubToken(): Promise<GitHubTokenResult> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(GITHUB_TOKEN_COOKIE_NAME)?.value || null;

  if (isLocalCliTokenEnabled()) {
    const localToken = resolveLocalToken();
    if (localToken) return localToken;
  }

  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }

  return { token: null, source: null };
}

export function clearGitHubCookie(response: NextResponse, source: GitHubTokenSource | null) {
  if (source === 'cookie') {
    response.cookies.delete(GITHUB_TOKEN_COOKIE_NAME);
  }
}
