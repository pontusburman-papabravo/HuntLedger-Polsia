/**
 * ApiDataAdapter — Postgres-backed data adapter for F2.
 * Calls the Fastify API with a Bearer JWT for all CRUD operations.
 * Supports soft-delete (archive) for weapons/ammunition/locations,
 * and hard-delete for sessions.
 */
import type {
  Ammunition,
  CreateAmmunitionInput,
  CreateDogInput,
  CreateLocationInput,
  CreateSessionInput,
  CreateWeaponInput,
  Dog,
  Location,
  Session,
  UserData,
  Weapon,
} from '@huntledger/shared';
import type { DataAdapter } from './DataAdapter';

const TOKEN_KEY = 'huntledger.auth.token';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(url: string, options: RequestInit = {}, _retryCount = 0): Promise<T> {
  const MAX_RETRIES = 1;
  let res: Response;
  try {
    const hdrs: Record<string, string> = { ...authHeaders() };
    // Only set Content-Type for requests that carry a body (POST/PUT/PATCH)
    if (options.body != null) {
      hdrs['Content-Type'] = 'application/json';
    }
    res = await fetch(url, {
      ...options,
      headers: {
        ...hdrs,
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } catch (networkError) {
    // Network-level failure (e.g. "Load failed" in Safari, "Failed to fetch" in Chrome).
    // Retry once — covers Neon cold-start connection drops and transient network blips.
    if (_retryCount < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 800));
      return apiFetch<T>(url, options, _retryCount + 1);
    }
    throw networkError;
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    // Retry on 502/503/504 (server restarting) — once only
    if ([502, 503, 504].includes(res.status) && _retryCount < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 800));
      return apiFetch<T>(url, options, _retryCount + 1);
    }
    // Auto-logout on 401 — expired or invalid token
    if (res.status === 401) {
      localStorage.removeItem('huntledger.auth.token');
      localStorage.removeItem('huntledger.auth.user');
      sessionStorage.setItem('huntledger.session_expired', '1');
      window.location.replace('/login');
      throw new Error('Din session har gått ut. Logga in igen.');
    }
    throw new Error((data['error'] as string) ?? `API error: ${res.status}`);
  }
  return data as T;
}

export class ApiDataAdapter implements DataAdapter {
  async load(userId: string, opts?: { includeArchived?: boolean }): Promise<UserData> {
    const qs = opts?.includeArchived ? '?include_archived=1' : '';
    return apiFetch<UserData>(`/api/v1/data/${userId}${qs}`);
  }

  /** No-op: individual create/update endpoints handle persistence. */
  async save(_userId: string, _data: UserData): Promise<void> {
    // not used — individual CRUD endpoints handle persistence
  }

  async createWeapon(userId: string, input: CreateWeaponInput): Promise<Weapon> {
    return apiFetch<Weapon>(`/api/v1/data/${userId}/weapons`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async createAmmunition(
    userId: string,
    input: CreateAmmunitionInput,
  ): Promise<Ammunition> {
    return apiFetch<Ammunition>(`/api/v1/data/${userId}/ammunition`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async createDog(userId: string, input: CreateDogInput): Promise<Dog> {
    return apiFetch<Dog>(`/api/v1/data/${userId}/dogs`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async createLocation(
    userId: string,
    input: CreateLocationInput,
  ): Promise<Location> {
    return apiFetch<Location>(`/api/v1/data/${userId}/locations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async createSession(
    userId: string,
    input: CreateSessionInput,
  ): Promise<Session> {
    return apiFetch<Session>(`/api/v1/data/${userId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async archiveWeapon(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/weapons/${id}/archive`, { method: 'PATCH' });
  }

  async archiveAmmunition(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/ammunition/${id}/archive`, { method: 'PATCH' });
  }

  async archiveLocation(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/locations/${id}/archive`, { method: 'PATCH' });
  }

  async updateLocation(userId: string, id: string, input: Record<string, unknown>): Promise<Location> {
    return apiFetch<Location>(`/api/v1/data/${userId}/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...input, id }),
    });
  }

  async updateWeapon(userId: string, id: string, input: Record<string, unknown>): Promise<Weapon> {
    return apiFetch<Weapon>(`/api/v1/data/${userId}/weapons/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...input, id }),
    });
  }

  async updateAmmunition(userId: string, id: string, input: Record<string, unknown>): Promise<Ammunition> {
    return apiFetch<Ammunition>(`/api/v1/data/${userId}/ammunition/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...input, id }),
    });
  }

  async updateSession(userId: string, id: string, input: Record<string, unknown>): Promise<Session> {
    return apiFetch<Session>(`/api/v1/data/${userId}/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...input, id }),
    });
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/sessions/${id}`, { method: 'DELETE' });
  }

  async deleteWeapon(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/weapons/${id}`, { method: 'DELETE' });
  }

  async deleteAmmunition(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/ammunition/${id}`, { method: 'DELETE' });
  }

  async deleteLocation(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/locations/${id}`, { method: 'DELETE' });
  }

  async unarchiveWeapon(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/weapons/${id}/unarchive`, { method: 'PATCH' });
  }

  async unarchiveAmmunition(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/ammunition/${id}/unarchive`, { method: 'PATCH' });
  }

  async unarchiveLocation(userId: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/data/${userId}/locations/${id}/unarchive`, { method: 'PATCH' });
  }
}
