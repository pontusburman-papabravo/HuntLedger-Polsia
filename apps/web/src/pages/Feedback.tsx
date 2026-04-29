import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function Feedback() {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('huntledger.auth.token');
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || t('feedback.errorGeneric'));
      }
      setTitle('');
      setBody('');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>{t('feedback.pageTitle')}</h1>
      {success ? (
        <div className="feedback-success-box">
          <p>{t('feedback.successMessage')}</p>
          <button className="btn-secondary" onClick={() => setSuccess(false)}>
            {t('feedback.sendMore')}
          </button>
        </div>
      ) : (
        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="feedback-form-group">
            <label htmlFor="fb-title">{t('feedback.labelTitle')} *</label>
            <input
              id="fb-title"
              type="text"
              placeholder={t('feedback.placeholderTitle')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="feedback-form-group">
            <label htmlFor="fb-body">{t('feedback.labelBody')}</label>
            <textarea
              id="fb-body"
              placeholder={t('feedback.placeholderBody')}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
            {loading ? t('feedback.sending') : t('feedback.submit')}
          </button>
        </form>
      )}
    </div>
  );
}
