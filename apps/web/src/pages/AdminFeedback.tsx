import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';

interface FeedbackItem {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string;
}

export function AdminFeedback() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userAny = user as any;

  if (!user) return <Navigate to="/login" replace />;
  if (!userAny?.isAdmin) return <Navigate to="/" replace />;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [items, setItems] = useState<FeedbackItem[]>([]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [fetchError, setFetchError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const token = localStorage.getItem('huntledger.auth.token') ?? '';
    fetch('/api/feedback', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any) => {
        if (data.feedback) setItems(data.feedback as FeedbackItem[]);
        else setFetchError(data.error ?? t('feedback.errorLoad'));
      })
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [t]);

  async function handleDelete(id: number) {
    if (!window.confirm(t('feedback.confirmDelete'))) return;
    setDeletingId(id);
    try {
      const token = localStorage.getItem('huntledger.auth.token') ?? '';
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setItems(prev => prev.filter(i => i.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  }

  return (
    <div>
      <h1>{t('feedback.adminTitle')}</h1>
      {loading && <p>{t('feedback.loading')}</p>}
      {fetchError && <p className="error">{fetchError}</p>}
      {!loading && !fetchError && items.length === 0 && (
        <p className="muted">{t('feedback.empty')}</p>
      )}
      {!loading && !fetchError && items.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('feedback.colDate')}</th>
                <th>{t('feedback.colTitle')}</th>
                <th>{t('feedback.colUser')}</th>
                <th>{t('feedback.colEmail')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.flatMap(item => {
                const rows = [
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <td className="muted">{formatDate(item.created_at)}</td>
                    <td>{item.title}</td>
                    <td>{item.user_name ?? '—'}</td>
                    <td>{item.user_email}</td>
                    <td>
                      <button
                        className="btn-danger"
                        disabled={deletingId === item.id}
                        onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                      >
                        {deletingId === item.id ? '…' : t('feedback.delete')}
                      </button>
                    </td>
                  </tr>,
                ];
                if (expandedId === item.id) {
                  rows.push(
                    <tr key={`${item.id}-body`}>
                      <td colSpan={5} className="feedback-expanded-cell">
                        {item.body
                          ? <div className="feedback-expanded-body">{item.body}</div>
                          : <span className="muted">{t('feedback.noBody')}</span>
                        }
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
