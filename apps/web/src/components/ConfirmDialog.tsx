/**
 * ConfirmDialog — reusable modal confirmation dialog.
 * Uses a div-based overlay (avoids native <dialog> showModal quirks).
 * Supports async onConfirm with loading state + error display.
 */
import { useState, useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Avbryt',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) { setLoading(false); setError(null); }
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e: any) {
      setError(e?.message ?? 'Något gick fel');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        style={{
          background: '#2a2926',
          border: '1px solid #3a3835',
          borderRadius: 10,
          padding: '24px 28px',
          minWidth: 300,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#c8965a' }}>{title}</h3>
        <p style={{ margin: '0 0 16px', color: '#a89a84', fontSize: 14 }}>{message}</p>
        {error && (
          <p style={{ margin: '0 0 12px', color: '#c45a4a', fontSize: 13, background: 'rgba(168,84,84,0.15)', padding: '8px 10px', borderRadius: 6 }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #3a3835',
              background: '#232321',
              color: '#e8dcc8',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: danger ? '#a85454' : '#c8965a',
              color: '#e8dcc8',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading ? 0.75 : 1,
              minWidth: 80,
            }}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
