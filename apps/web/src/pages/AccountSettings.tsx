import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';

export function AccountSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const currentLang = i18n.language?.startsWith('sv') ? 'sv' : 'en';

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  async function handleDelete() {
    if (!password) return;
    setDeleting(true);
    setError(null);
    try {
      const token = localStorage.getItem('huntledger.auth.token') ?? '';
      const res = await fetch('/api/v1/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      if (res.status === 204) {
        // Success — clear local session and redirect
        localStorage.removeItem('huntledger.auth.token');
        localStorage.removeItem('huntledger.auth.user');
        navigate('/login', { replace: true });
        return;
      }
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setError((data['error'] as string) ?? `Fel ${res.status}`);
    } catch (e: any) {
      setError(e.message ?? 'Okänt fel');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 8 }}>{t('settings.title', 'Kontoinställningar')}</h1>
      <p style={{ color: '#a89a84', marginBottom: 32 }}>
        {t('settings.loggedInAs', 'Inloggad som')} <strong>{(user as any).email}</strong>
      </p>

      {/* Language selector */}
      <div style={{
        border: '1px solid #3a3835', borderRadius: 8, padding: 20,
        background: '#2a2926', marginBottom: 24,
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: '#c8965a' }}>
          {t('settings.language', 'Språk')}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => i18n.changeLanguage('sv')}
            style={{
              padding: '8px 20px', borderRadius: 6, fontWeight: 600, fontSize: 14,
              border: currentLang === 'sv' ? '2px solid #c8965a' : '1px solid #3a3835',
              background: currentLang === 'sv' ? '#c8965a' : 'transparent',
              color: currentLang === 'sv' ? '#1a1a18' : '#c8965a',
              cursor: 'pointer',
            }}
          >
            SV — Svenska
          </button>
          <button
            onClick={() => i18n.changeLanguage('en')}
            style={{
              padding: '8px 20px', borderRadius: 6, fontWeight: 600, fontSize: 14,
              border: currentLang === 'en' ? '2px solid #c8965a' : '1px solid #3a3835',
              background: currentLang === 'en' ? '#c8965a' : 'transparent',
              color: currentLang === 'en' ? '#1a1a18' : '#c8965a',
              cursor: 'pointer',
            }}
          >
            EN — English
          </button>
        </div>
      </div>

      <div style={{
        border: '1px solid #a85454', borderRadius: 8, padding: 20,
        background: '#2a2926',
      }}>
        <h2 style={{ color: '#c45a4a', marginTop: 0, marginBottom: 8, fontSize: 18 }}>
          Radera konto
        </h2>
        <p style={{ color: '#a89a84', marginBottom: 16, fontSize: 14 }}>
          Ditt konto och all tillhörande data (vapen, ammunition, platser, loggbok) raderas
          permanent. Detta kan inte ångras.
        </p>

        {!showConfirm ? (
          <button
            onClick={() => { setShowConfirm(true); setTimeout(() => pwRef.current?.focus(), 50); }}
            style={{
              padding: '8px 16px', borderRadius: 6, background: '#a85454',
              color: '#e8dcc8', border: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Radera mitt konto
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#a89a84', marginBottom: 8 }}>
              Ange ditt lösenord för att bekräfta radering:
            </p>
            {error && <p style={{ color: '#c45a4a', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <input
              ref={pwRef}
              type="password"
              placeholder="Ditt lösenord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              disabled={deleting}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid #3a3835', marginBottom: 12, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowConfirm(false); setPassword(''); setError(null); }}
                disabled={deleting}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #c8965a',
                  cursor: 'pointer', background: 'transparent', color: '#c8965a',
                }}
              >
                Avbryt
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !password}
                style={{
                  padding: '8px 16px', borderRadius: 6, background: '#a85454',
                  color: '#e8dcc8', border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                {deleting ? 'Raderar...' : 'Radera ditt konto permanent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
