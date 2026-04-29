/**
 * ApiAuthAdapter — server-backed auth for F2.
 * Calls /api/v1/auth/register and /api/v1/auth/login.
 * Stores the JWT and user object in localStorage for session persistence.
 */
import type { User } from '@huntledger/shared';
import type { AuthAdapter } from './AuthAdapter';

const TOKEN_KEY = 'huntledger.auth.token';
const USER_KEY  = 'huntledger.auth.user';

interface AuthSession {
  token: string;
  user: User;
}

async function authPost(
  path: string,
  body: Record<string, string>,
): Promise<AuthSession> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data['error'] as string) ?? `Request failed: ${res.status}`);
  }
  return data as unknown as AuthSession;
}

export class ApiAuthAdapter implements AuthAdapter {
  async getCurrentSession(): Promise<{ user: User } | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw   = localStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    try {
      return { user: JSON.parse(raw) as User };
    } catch {
      return null;
    }
  }

  async register(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ user: User }> {
    const session = await authPost('/api/v1/auth/register', input);
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(session.user));
    return { user: session.user };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: User }> {
    const session = await authPost('/api/v1/auth/login', input);
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(session.user));
    return { user: session.user };
  }

  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
