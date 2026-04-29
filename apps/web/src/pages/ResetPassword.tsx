import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Ogiltig länk</h1>
        <p style={{ color: '#a89a84', marginBottom: 24 }}>
          Den här länken är ogiltig eller har gått ut.
        </p>
        <Link to="/forgot-password" style={{ color: '#2563eb', textDecoration: 'underline' }}>
          Begär en ny länk
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Lösenordet uppdaterat!</h1>
        <p style={{ color: '#a89a84', marginBottom: 24 }}>
          Du kan nu logga in med ditt nya lösenord.
        </p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Logga in
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Lösenorden matchar inte');
      return;
    }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setError((data['error'] as string) ?? 'Något gick fel');
      } else {
        setDone(true);
      }
    } catch {
      setError('Nätverksfel — försök igen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Nytt lösenord</h1>
      <p style={{ color: '#a89a84', marginBottom: 24 }}>
        Ange ditt nya lösenord nedan.
      </p>
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ color: '#c45a4a', marginBottom: 12, fontSize: 14 }}>{error}</div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
            Nytt lösenord
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #3a3835',
              borderRadius: 6,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
            Bekräfta lösenord
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #3a3835',
              borderRadius: 6,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            background: '#c8965a',
            color: '#1a1a18',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Sparar...' : 'Spara nytt lösenord'}
        </button>
      </form>
    </div>
  );
}
