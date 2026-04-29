import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  isAdmin: boolean;
}

async function adminFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('huntledger.auth.token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    // Auto-logout on 401 — expired or invalid token
    if (res.status === 401) {
      localStorage.removeItem('huntledger.auth.token');
      localStorage.removeItem('huntledger.auth.user');
      sessionStorage.setItem('huntledger.session_expired', '1');
      window.location.replace('/login');
      throw new Error('Din session har gått ut. Logga in igen.');
    }
    throw new Error((data['error'] as string) ?? `API error ${res.status}`);
  }
  return data as T;
}

export function Admin() {
  const { user } = useAuth();
  const userAny = user as any;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (!userAny?.isAdmin) return <Navigate to="/" replace />;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const token = localStorage.getItem('huntledger.auth.token') ?? '';
    fetch('/api/v1/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem('huntledger.auth.token');
          localStorage.removeItem('huntledger.auth.user');
          sessionStorage.setItem('huntledger.session_expired', '1');
          window.location.replace('/login');
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (Array.isArray(data)) setUsers(data as AdminUser[]);
        else setError((data as any).error ?? 'Failed to load users');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, isActive: boolean) {
    setWorking(id + ':active');
    setError(null);
    try {
      await adminFetch(`/api/v1/admin/users/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
      setUsers(u => u.map(usr => usr.id === id ? { ...usr, isActive: !isActive } : usr));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(null);
    }
  }

  async function toggleAdmin(id: string, isAdmin: boolean) {
    setWorking(id + ':admin');
    setError(null);
    try {
      await adminFetch(`/api/v1/admin/users/${id}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdmin: !isAdmin }),
      });
      setUsers(u => u.map(usr => usr.id === id ? { ...usr, isAdmin: !isAdmin } : usr));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !adminPassword) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminFetch(`/api/v1/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: adminPassword }),
      });
      setUsers(u => u.filter(usr => usr.id !== deleteTarget.id));
      setDeleteTarget(null);
      setAdminPassword('');
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  const badge = (active: boolean, trueLabel: string, falseLabel: string, trueColor: string, falseColor: string, trueText = '#e8dcc8', falseText = '#a89a84') => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: active ? trueColor : falseColor,
      color: active ? trueText : falseText,
    }}>
      {active ? trueLabel : falseLabel}
    </span>
  );

  return (
    <div>
      <h1>Admin — Kontoadministration</h1>
      {error && (
        <p style={{ color: '#c45a4a' }}>{error}</p>
      )}
      {loading ? (
        <p>Laddar...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Användarnamn</th>
              <th>E-post</th>
              <th>Skapad</th>
              <th>Status</th>
              <th>Roll</th>
              <th>Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email}</td>
                <td>{new Date(u.createdAt).toLocaleDateString('sv-SE')}</td>
                <td>{badge(u.isActive, 'Aktiv', 'Avaktiverad', 'rgba(107,143,94,0.25)', 'rgba(168,84,84,0.25)', '#6b8f5e', '#c45a4a')}</td>
                <td>{badge(u.isAdmin, 'Admin', 'Användare', 'rgba(200,150,90,0.25)', 'rgba(59,58,53,0.5)', '#c8965a', '#a89a84')}</td>
                <td>
                  <button
                    disabled={working === u.id + ':active'}
                    onClick={() => toggleActive(u.id, u.isActive)}
                    className="btn-edit"
                  >
                    {working === u.id + ':active' ? '...' : u.isActive ? 'Avaktivera' : 'Aktivera'}
                  </button>
                  <button
                    disabled={working === u.id + ':admin'}
                    onClick={() => toggleAdmin(u.id, u.isAdmin)}
                    className="btn-edit"
                  >
                    {working === u.id + ':admin' ? '...' : u.isAdmin ? 'Ta bort admin' : 'Gör admin'}
                  </button>
                  <button
                    disabled={!!working}
                    onClick={() => { setDeleteTarget(u); setAdminPassword(''); setDeleteError(null); setTimeout(() => pwRef.current?.focus(), 50); }}
                    className="btn-delete"
                  >
                    Radera
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && users.length === 0 && <p>Inga konton hittades.</p>}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#2a2926', borderRadius: 8, padding: 24, maxWidth: 400, width: '90%', border: '1px solid #3a3835',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ marginTop: 0, color: '#c45a4a' }}>Radera användare</h2>
            <p>
              Radera användare <strong>{deleteTarget.name || deleteTarget.email}</strong>?
              All data tas bort permanent.
            </p>
            <p style={{ fontSize: 13, color: '#a89a84' }}>
              Ange ditt adminlösenord för att bekräfta.
            </p>
            {deleteError && <p style={{ color: '#c45a4a', fontSize: 13 }}>{deleteError}</p>}
            <input
              ref={pwRef}
              type="password"
              placeholder="Ditt lösenord"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid #3a3835', marginBottom: 16, boxSizing: 'border-box',
              }}
              disabled={deleting}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setDeleteTarget(null); setAdminPassword(''); setDeleteError(null); }}
                disabled={deleting}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #c8965a', cursor: 'pointer', background: 'transparent', color: '#c8965a' }}
              >
                Avbryt
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting || !adminPassword}
                style={{
                  padding: '8px 16px', borderRadius: 6, background: '#a85454',
                  color: '#e8dcc8', border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                {deleting ? 'Raderar...' : 'Radera permanent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
