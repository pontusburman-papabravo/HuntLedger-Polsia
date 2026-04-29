import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setError((data['error'] as string) ?? 'Något gick fel');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Nätverksfel — försök igen');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Kolla din e-post</h1>
        <p style={{ color: '#a89a84', marginBottom: 24 }}>
          Om kontot finns skickas ett mail med en länk för att återställa lösenordet.
        </p>
        <Link to="/login" style={{ color: '#2563eb', textDecoration: 'underline' }}>
          Tillbaka till inloggning
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Glömt lösenord?</h1>
      <p style={{ color: '#a89a84', marginBottom: 24 }}>
        Ange din e-postadress så skickar vi en länk för att återställa lösenordet.
      </p>
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ color: '#c45a4a', marginBottom: 12, fontSize: 14 }}>{error}</div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
            E-postadress
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginBottom: 16,
          }}
        >
          {loading ? 'Skickar...' : 'Skicka återställningslänk'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 14 }}>
          <Link to="/login" style={{ color: '#2563eb', textDecoration: 'underline' }}>
            Tillbaka till inloggning
          </Link>
        </div>
      </form>
    </div>
  );
}
