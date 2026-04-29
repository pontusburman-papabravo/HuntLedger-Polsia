import { useState, useMemo, type CSSProperties, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../data/useData';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CreateAmmunitionInput } from '@huntledger/shared';

// Button classes defined in CSS (btn-edit, btn-archive, etc.)

export function Ammunition() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const { data, createAmmunition, updateAmmunition, archiveAmmunition, unarchiveAmmunition, deleteAmmunition } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<{ id: string; name: string } | null>(null);

  // Count sessions per ammo for delete eligibility
  const ammoSessionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of data.sessions) {
      for (const aId of ((s as any).ammunitionIds ?? [])) {
        map[aId] = (map[aId] ?? 0) + 1;
      }
    }
    return map;
  }, [data.sessions]);

  const ammunition = data.ammunition.filter((a: any) => showArchived || !a.archived);

  return (
    <>
      <h1>{t('ammunition.title')}</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <button onClick={() => { setOpen((v) => !v); setEditTarget(null); }}>{t('ammunition.create')}</button>
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
        <AmmoForm
          onCancel={() => setOpen(false)}
          onSubmit={async (input) => {
            await createAmmunition(input);
            setOpen(false);
          }}
        />
      ) : null}

      {editTarget ? (
        <div style={{ margin: '16px 0', padding: 16, border: '1px solid #3a3835', borderRadius: 8, background: '#2a2926' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{lang === 'en' ? 'Edit ammunition' : 'Redigera ammunition'}</h2>
          <AmmoForm
            key={editTarget.id}
            initial={editTarget}
            onCancel={() => setEditTarget(null)}
            onSubmit={async (input) => {
              await updateAmmunition(editTarget.id, { ...editTarget, ...input, id: editTarget.id });
              setEditTarget(null);
            }}
          />
        </div>
      ) : null}

      {ammunition.length === 0 ? (
        <p>{showArchived ? (lang === 'en' ? 'No ammunition found.' : 'Ingen ammunition hittades.') : t('ammunition.empty')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('ammunition.brand')}</th>
              <th>{lang === 'en' ? 'Type' : 'Typ'}</th>
              <th>{t('ammunition.caliber')}</th>
              <th>{lang === 'en' ? 'Details' : 'Detaljer'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ammunition.map((a: any) => {
              const sessCount = ammoSessionCounts[a.id] ?? 0;
              const canDelete = sessCount === 0;
              const deleteTitle = canDelete
                ? (lang === 'en' ? 'Delete permanently' : 'Radera permanent')
                : (lang === 'en'
                    ? `Used in ${sessCount} ${sessCount === 1 ? 'session' : 'sessions'}. Remove or reassign sessions to delete.`
                    : `Används i ${sessCount} ${sessCount === 1 ? 'session' : 'sessioner'}. Radera eller flytta sessionerna till annan ammunition för att kunna radera.`);
              return (
                <tr key={a.id} style={a.archived ? { opacity: 0.5 } : undefined}>
                  <td>
                    {a.brand}
                    {a.archived ? <span style={{ marginLeft: 8, fontSize: 12, color: '#a89a84' }}>({lang === 'en' ? 'archived' : 'arkiverat'})</span> : null}
                  </td>
                  <td>{a.ammo_type === 'rifle' ? (lang === 'en' ? 'Rifle' : 'Kula') : a.ammo_type === 'shotgun' ? (lang === 'en' ? 'Shotgun' : 'Hagel') : '—'}</td>
                  <td>{a.caliber}</td>
                  <td style={{ fontSize: 13, color: '#a89a84' }}>{a.ammo_type === 'rifle' ? [a.bullet_name, a.bullet_weight ? `${a.bullet_weight}gr` : null, a.muzzle_velocity ? `${a.muzzle_velocity}m/s` : null].filter(Boolean).join(', ') || a.bulletType || '—' : a.ammo_type === 'shotgun' ? [a.shot_size, a.charge_weight ? `${a.charge_weight}g` : null, a.shot_material].filter(Boolean).join(', ') || a.bulletType || '—' : a.bulletType || '—'}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!a.archived ? (
                      <>
                        <button type="button" onClick={() => { setEditTarget(a); setOpen(false); }} className="btn-edit">
                          {lang === 'en' ? 'Edit' : 'Redigera'}
                        </button>
                        <button type="button" onClick={() => setArchiveTarget({ id: a.id, name: `${a.brand} ${a.caliber}` })} className="btn-archive">
                          {lang === 'en' ? 'Archive' : 'Arkivera'}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setUnarchiveTarget({ id: a.id, name: `${a.brand} ${a.caliber}` })} className="btn-unarchive">
                        {lang === 'en' ? 'Restore' : 'Återställ'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canDelete}
                      title={deleteTitle}
                      onClick={() => canDelete ? setDeleteTarget({ id: a.id, name: `${a.brand} ${a.caliber}` }) : undefined}
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
        message={lang === 'en' ? 'The ammunition will be hidden but kept in historical sessions.' : 'Ammunitionen döljs men finns kvar i historiska sessioner.'}
        confirmLabel={lang === 'en' ? 'Archive' : 'Arkivera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        onConfirm={async () => {
          if (archiveTarget) { await archiveAmmunition(archiveTarget.id); setArchiveTarget(null); }
        }}
        onCancel={() => setArchiveTarget(null)}
      />

      <ConfirmDialog
        open={unarchiveTarget !== null}
        title={`${lang === 'en' ? 'Restore' : 'Återställ'} ${unarchiveTarget?.name ?? ''}?`}
        message={lang === 'en' ? 'The ammunition will be made active again.' : 'Ammunitionen blir aktiv igen och syns i formulären.'}
        confirmLabel={lang === 'en' ? 'Restore' : 'Återställ'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        onConfirm={async () => {
          if (unarchiveTarget) { await unarchiveAmmunition(unarchiveTarget.id); setUnarchiveTarget(null); }
        }}
        onCancel={() => setUnarchiveTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`${lang === 'en' ? 'Delete' : 'Radera'} ${deleteTarget?.name ?? ''}?`}
        message={lang === 'en' ? 'This will permanently delete the ammunition. This cannot be undone.' : 'Ammunitionen raderas permanent. Detta kan inte ångras.'}
        confirmLabel={lang === 'en' ? 'Delete' : 'Radera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        danger={true}
        onConfirm={async () => {
          if (deleteTarget) { await deleteAmmunition(deleteTarget.id); setDeleteTarget(null); }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface AmmoFormProps {
  initial?: any;
  onCancel: () => void;
  onSubmit: (input: CreateAmmunitionInput) => Promise<void>;
}

function AmmoForm({ initial, onCancel, onSubmit }: AmmoFormProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const [ammoType, setAmmoType] = useState<'rifle' | 'shotgun' | ''>(initial?.ammo_type ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [caliber, setCaliber] = useState(initial?.caliber ?? '');
  const [leadFree, setLeadFree] = useState<boolean>(initial?.lead_free ?? false);
  const [cartridgeLength, setCartridgeLength] = useState(initial?.cartridge_length != null ? String(initial.cartridge_length) : '');
  // Rifle fields
  const [bulletName, setBulletName] = useState(initial?.bullet_name ?? '');
  const [bulletConstruction, setBulletConstruction] = useState(initial?.bullet_construction ?? '');
  const [bcValue, setBcValue] = useState(initial?.bc_value != null ? String(initial.bc_value) : '');
  const [bcType, setBcType] = useState(initial?.bc_type ?? 'G1');
  const [bulletWeight, setBulletWeight] = useState(initial?.bullet_weight != null ? String(initial.bullet_weight) : '');
  const [muzzleVelocity, setMuzzleVelocity] = useState(initial?.muzzle_velocity != null ? String(initial.muzzle_velocity) : '');
  // Shotgun fields
  const [shotSize, setShotSize] = useState(initial?.shot_size ?? '');
  const [chargeWeight, setChargeWeight] = useState(initial?.charge_weight != null ? String(initial.charge_weight) : '');
  const [shotMaterial, setShotMaterial] = useState(initial?.shot_material ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bulletWeightGrams = bulletWeight && !isNaN(Number(bulletWeight)) ? (Number(bulletWeight) * 0.0648).toFixed(2) : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ammoType) { setError(lang === 'en' ? 'Select ammunition type' : 'Välj ammunitionstyp'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const payload: any = {
        brand, caliber, ammo_type: ammoType,
        lead_free: leadFree,
      };
      if (cartridgeLength && !isNaN(Number(cartridgeLength))) payload.cartridge_length = Number(cartridgeLength);
      if (ammoType === 'rifle') {
        if (bulletName.trim()) payload.bullet_name = bulletName.trim();
        if (bulletConstruction.trim()) payload.bullet_construction = bulletConstruction.trim();
        if (bcValue && !isNaN(Number(bcValue))) payload.bc_value = Number(bcValue);
        payload.bc_type = bcType;
        if (bulletWeight && !isNaN(Number(bulletWeight))) payload.bullet_weight = Number(bulletWeight);
        if (muzzleVelocity && !isNaN(Number(muzzleVelocity))) payload.muzzle_velocity = Number(muzzleVelocity);
        payload.bulletType = bulletName.trim() || (initial?.bulletType ?? '');
      } else {
        if (shotSize.trim()) payload.shot_size = shotSize.trim();
        if (chargeWeight && !isNaN(Number(chargeWeight))) payload.charge_weight = Number(chargeWeight);
        if (shotMaterial.trim()) payload.shot_material = shotMaterial.trim();
        payload.bulletType = shotSize.trim() || (initial?.bulletType ?? '');
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStyle = (active: boolean): CSSProperties => ({
    flex: 1, padding: '8px 12px', border: active ? '2px solid #1a2e1a' : '1px solid #3a3835',
    borderRadius: 6, background: active ? '#c8965a' : 'transparent', color: active ? '#1a1a18' : '#c8965a',
    fontWeight: 600, cursor: 'pointer', fontSize: 14, textAlign: 'center' as const,
  });

  return (
    <form onSubmit={handleSubmit}>
      {error ? <div className="error">{error}</div> : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setAmmoType('rifle')} style={toggleStyle(ammoType === 'rifle')}>
          {lang === 'en' ? 'Rifle ammunition' : 'Kulammunition'}
        </button>
        <button type="button" onClick={() => setAmmoType('shotgun')} style={toggleStyle(ammoType === 'shotgun')}>
          {lang === 'en' ? 'Shotgun ammunition' : 'Hagelammunition'}
        </button>
      </div>

      <div>
        <label>{t('ammunition.brand')}</label>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={lang === 'en' ? 'e.g. Norma, Gyttorp' : 'ex. Norma, Gyttorp'} />
      </div>
      <div>
        <label>{t('ammunition.caliber')}</label>
        <input value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder={lang === 'en' ? 'e.g. .308 Win, 12/70' : 'ex. .308 Win, 12/70'} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={leadFree} onChange={(e) => setLeadFree(e.target.checked)} />
          {lang === 'en' ? 'Lead-free' : 'Blyfri'}
        </label>
      </div>
      <div>
        <label>{lang === 'en' ? 'Cartridge length (mm)' : 'Patronlängd (mm)'}</label>
        <input type="number" min="0" step="0.1" value={cartridgeLength} onChange={(e) => setCartridgeLength(e.target.value)} placeholder={lang === 'en' ? 'e.g. 70' : 'ex. 70'} />
      </div>

      {ammoType === 'rifle' ? (
        <>
          <div>
            <label>{lang === 'en' ? 'Bullet name' : 'Kulnamn'}</label>
            <input value={bulletName} onChange={(e) => setBulletName(e.target.value)} placeholder={lang === 'en' ? 'e.g. Oryx, Ecostrike' : 'ex. Oryx, Ecostrike'} />
          </div>
          <div>
            <label>{lang === 'en' ? 'Bullet construction' : 'Kulkonstruktion'}</label>
            <input value={bulletConstruction} onChange={(e) => setBulletConstruction(e.target.value)} placeholder={lang === 'en' ? 'e.g. Bonded, Solid copper' : 'ex. Bonded, Solid copper'} />
          </div>
          <div>
            <label>{lang === 'en' ? 'Ballistic coefficient' : 'Ballistisk koefficient'}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" step="0.001" value={bcValue} onChange={(e) => setBcValue(e.target.value)} placeholder="0.415" style={{ flex: 1 }} />
              <select value={bcType} onChange={(e) => setBcType(e.target.value)} style={{ width: 70 }}>
                <option value="G1">G1</option>
                <option value="G7">G7</option>
              </select>
            </div>
          </div>
          <div>
            <label>{lang === 'en' ? 'Bullet weight (grains)' : 'Kulvikt (grains)'}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" step="0.1" value={bulletWeight} onChange={(e) => setBulletWeight(e.target.value)} placeholder={lang === 'en' ? 'e.g. 180' : 'ex. 180'} style={{ flex: 1 }} />
              {bulletWeightGrams ? <span style={{ fontSize: 13, color: '#a89a84', whiteSpace: 'nowrap' }}>= {bulletWeightGrams} g</span> : null}
            </div>
          </div>
          <div>
            <label>{lang === 'en' ? 'Muzzle velocity (m/s)' : 'Mynningshastighet (m/s)'}</label>
            <input type="number" min="0" step="1" value={muzzleVelocity} onChange={(e) => setMuzzleVelocity(e.target.value)} placeholder={lang === 'en' ? 'e.g. 800' : 'ex. 800'} />
          </div>
        </>
      ) : ammoType === 'shotgun' ? (
        <>
          <div>
            <label>{lang === 'en' ? 'Shot size' : 'Hagelstorlek'}</label>
            <input value={shotSize} onChange={(e) => setShotSize(e.target.value)} placeholder={lang === 'en' ? 'e.g. #4, BB' : 'ex. #4, BB'} />
          </div>
          <div>
            <label>{lang === 'en' ? 'Charge weight (g)' : 'Laddvikt (g)'}</label>
            <input type="number" min="0" step="0.1" value={chargeWeight} onChange={(e) => setChargeWeight(e.target.value)} placeholder={lang === 'en' ? 'e.g. 36' : 'ex. 36'} />
          </div>
          <div>
            <label>{lang === 'en' ? 'Shot material' : 'Hagelmaterial'}</label>
            <input value={shotMaterial} onChange={(e) => setShotMaterial(e.target.value)} placeholder={lang === 'en' ? 'e.g. Steel, Bismuth' : 'ex. Stål, Bismut'} />
          </div>
        </>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={submitting} className="btn-save">
          {t('ammunition.save')}
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
