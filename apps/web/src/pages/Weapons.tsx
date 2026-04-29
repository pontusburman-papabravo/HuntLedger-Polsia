import { useState, useMemo, type CSSProperties, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../data/useData';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CreateWeaponInput, WeaponType } from '@huntledger/shared';

// Button classes defined in CSS (btn-edit, btn-archive, etc.)

export function Weapons() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const { data, createWeapon, updateWeapon, archiveWeapon, unarchiveWeapon, deleteWeapon } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<{ id: string; name: string } | null>(null);

  // Count sessions per weapon for delete eligibility
  const weaponSessionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of data.sessions) {
      for (const wId of ((s as any).weaponIds ?? [])) {
        map[wId] = (map[wId] ?? 0) + 1;
      }
    }
    return map;
  }, [data.sessions]);

  const weapons = data.weapons.filter((w: any) => showArchived || !w.archived);

  return (
    <>
      <h1>{t('weapons.title')}</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <button onClick={() => { setOpen((v) => !v); setEditTarget(null); }}>{t('weapons.create')}</button>
        <label style={{ fontSize: 14, color: '#a89a84', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          {lang === 'en' ? 'Show archived' : 'Visa arkiverade'}
        </label>
      </div>

      {open && !editTarget ? (
        <WeaponForm
          onCancel={() => setOpen(false)}
          onSubmit={async (input) => {
            await createWeapon(input);
            setOpen(false);
          }}
        />
      ) : null}

      {editTarget ? (
        <div style={{ margin: '16px 0', padding: 16, border: '1px solid #3a3835', borderRadius: 8, background: '#2a2926' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{lang === 'en' ? 'Edit weapon' : 'Redigera vapen'}</h2>
          <WeaponForm
            key={editTarget.id}
            initial={editTarget}
            onCancel={() => setEditTarget(null)}
            onSubmit={async (input) => {
              await updateWeapon(editTarget.id, { ...editTarget, ...input, id: editTarget.id });
              setEditTarget(null);
            }}
          />
        </div>
      ) : null}

      {weapons.length === 0 ? (
        <p>{showArchived ? (lang === 'en' ? 'No weapons found.' : 'Inga vapen hittades.') : t('weapons.empty')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('weapons.name')}</th>
              <th>{t('weapons.type')}</th>
              <th>{t('weapons.caliber')}</th>
              <th>{t('weapons.serialNumber')}</th>
              <th>{lang === 'en' ? 'Barrel length' : 'Piplängd'}</th>
              <th>{lang === 'en' ? 'Purchase date' : 'Inköpsdatum'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weapons.map((w: any) => {
              const sessCount = weaponSessionCounts[w.id] ?? 0;
              const canDelete = sessCount === 0;
              const deleteTitle = canDelete
                ? (lang === 'en' ? 'Delete permanently' : 'Radera permanent')
                : (lang === 'en'
                    ? `Used in ${sessCount} ${sessCount === 1 ? 'session' : 'sessions'}. Remove or reassign sessions to delete.`
                    : `Används i ${sessCount} ${sessCount === 1 ? 'session' : 'sessioner'}. Radera eller flytta sessionerna till ett annat vapen för att kunna radera.`);
              return (
                <tr key={w.id} style={w.archived ? { opacity: 0.5 } : undefined}>
                  <td>
                    {w.name}
                    {w.archived ? <span style={{ marginLeft: 8, fontSize: 12, color: '#a89a84' }}>({lang === 'en' ? 'archived' : 'arkiverat'})</span> : null}
                  </td>
                  <td>{t('weapons.type_' + w.type)}</td>
                  <td>{w.caliber}</td>
                  <td>{w.serialNumber}</td>
                  <td>{w.barrelLength ? `${w.barrelLength} mm (${(w.barrelLength / 25.4).toFixed(2)}″)` : '—'}</td>
                  <td>{(w as any).purchaseDate ?? '—'}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!w.archived ? (
                      <>
                        <button type="button" onClick={() => { setEditTarget(w); setOpen(false); }} className="btn-edit">
                          {lang === 'en' ? 'Edit' : 'Redigera'}
                        </button>
                        <button type="button" onClick={() => setArchiveTarget({ id: w.id, name: w.name })} className="btn-archive">
                          {lang === 'en' ? 'Archive' : 'Arkivera'}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setUnarchiveTarget({ id: w.id, name: w.name })} className="btn-unarchive">
                        {lang === 'en' ? 'Restore' : 'Återställ'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canDelete}
                      title={deleteTitle}
                      onClick={() => canDelete ? setDeleteTarget({ id: w.id, name: w.name }) : undefined}
                      className={canDelete ? "btn-delete" : "btn-delete-disabled"}
                    >
                      {lang === 'en' ? 'Delete' : 'Radera'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        title={`${lang === 'en' ? 'Archive' : 'Arkivera'} ${archiveTarget?.name ?? ''}?`}
        message={lang === 'en' ? 'The weapon will be hidden but kept in historical sessions.' : 'Vapnet döljs men finns kvar i historiska sessioner.'}
        confirmLabel={lang === 'en' ? 'Archive' : 'Arkivera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        onConfirm={async () => {
          if (archiveTarget) { await archiveWeapon(archiveTarget.id); setArchiveTarget(null); }
        }}
        onCancel={() => setArchiveTarget(null)}
      />

      <ConfirmDialog
        open={unarchiveTarget !== null}
        title={`${lang === 'en' ? 'Restore' : 'Återställ'} ${unarchiveTarget?.name ?? ''}?`}
        message={lang === 'en' ? 'The weapon will be made active again.' : 'Vapnet blir aktivt igen och syns i formulären.'}
        confirmLabel={lang === 'en' ? 'Restore' : 'Återställ'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        onConfirm={async () => {
          if (unarchiveTarget) { await unarchiveWeapon(unarchiveTarget.id); setUnarchiveTarget(null); }
        }}
        onCancel={() => setUnarchiveTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`${lang === 'en' ? 'Delete' : 'Radera'} ${deleteTarget?.name ?? ''}?`}
        message={lang === 'en' ? 'This will permanently delete the weapon. This cannot be undone.' : 'Vapnet raderas permanent. Detta kan inte ångras.'}
        confirmLabel={lang === 'en' ? 'Delete' : 'Radera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        danger={true}
        onConfirm={async () => {
          if (deleteTarget) { await deleteWeapon(deleteTarget.id); setDeleteTarget(null); }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface WeaponFormProps {
  initial?: any;
  onCancel: () => void;
  onSubmit: (input: CreateWeaponInput) => Promise<void>;
}

function WeaponForm({ initial, onCancel, onSubmit }: WeaponFormProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'rifle');
  const [caliber, setCaliber] = useState(initial?.caliber ?? '');
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? '');
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? '');
  const [barrelLength, setBarrelLength] = useState(initial?.barrelLength != null ? String(initial.barrelLength) : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const barrelLengthInches = barrelLength && !isNaN(Number(barrelLength)) ? (Number(barrelLength) / 25.4).toFixed(2) : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: any = { name, type, caliber, serialNumber };
      if (purchaseDate) payload.purchaseDate = purchaseDate;
      if (barrelLength && !isNaN(Number(barrelLength))) payload.barrelLength = Number(barrelLength);
      await onSubmit(payload as CreateWeaponInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error ? <div className="error">{error}</div> : null}
      <div>
        <label>{t('weapons.name')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label>{t('weapons.type')}</label>
        <select value={type} onChange={(e) => setType(e.target.value as WeaponType)}>
          <option value="rifle">{t('weapons.type_rifle')}</option>
          <option value="shotgun">{t('weapons.type_shotgun')}</option>
          <option value="handgun">{t('weapons.type_handgun')}</option>
          <option value="air_rifle">{t('weapons.type_air_rifle')}</option>
          <option value="other">{t('weapons.type_other')}</option>
        </select>
      </div>
      <div>
        <label>{t('weapons.caliber')}</label>
        <input value={caliber} onChange={(e) => setCaliber(e.target.value)} />
      </div>
      <div>
        <label>{t('weapons.serialNumber')}</label>
        <input
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />
      </div>
      <div>
        <label>{lang === 'en' ? 'Barrel length (mm)' : 'Piplängd (mm)'}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min="0"
            step="1"
            value={barrelLength}
            onChange={(e) => setBarrelLength(e.target.value)}
            placeholder={lang === 'en' ? 'e.g. 600' : 'ex. 600'}
            style={{ flex: 1 }}
          />
          {barrelLengthInches ? <span style={{ fontSize: 13, color: '#a89a84', whiteSpace: 'nowrap' }}>= {barrelLengthInches}″</span> : null}
        </div>
      </div>
      <div>
        <label>{t('weapons.purchaseDate') ?? 'Inköpsdatum'}</label>
        <input
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={submitting} className="btn-save">
          {t('weapons.save')}
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
