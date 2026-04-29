import { useMemo, useRef, useEffect, useState, useCallback, type FormEvent, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { useData } from '../data/useData';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  formatDateTime,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../utils/format';
import type { CreateSessionInput, SessionType } from '@huntledger/shared';

export function Sessions() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const { user } = useAuth();
  const { data, createSession, updateSession, deleteSession } = useData();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [animalCounts, setAnimalCounts] = useState<Record<string, number>>({});
  const [allAnimals, setAllAnimals] = useState<any[]>([]);

  const loadAnimals = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem('huntledger.auth.token') ?? '';
    const hdrs = { Authorization: `Bearer ${token}` };
    try {
      const [cr, ar] = await Promise.all([
        fetch(`/api/v1/data/${user.id}/animal-counts`, { headers: hdrs }),
        fetch(`/api/v1/data/${user.id}/animals`, { headers: hdrs }),
      ]);
      if (cr.ok) { const d = await cr.json(); setAnimalCounts(d.counts ?? {}); }
      if (ar.ok) { const d = await ar.json(); setAllAnimals(d.animals ?? []); }
    } catch {}
  }, [user]);

  useEffect(() => { loadAnimals(); }, [loadAnimals]);

  const ordered = useMemo(
    () =>
      [...data.sessions].sort(
        (a, b) => new Date(b.timestampStart).getTime() - new Date(a.timestampStart).getTime(),
      ),
    [data.sessions],
  );

  const lookupWeapon = (id: string) => data.weapons.find((w: any) => w.id === id);
  const lookupAmmo = (id: string) => data.ammunition.find((a: any) => a.id === id);
  const lookupLocation = (id: string | undefined) =>
    id ? data.locations.find((l: any) => l.id === id) : undefined;

  const exportCsv = () => {
    if (ordered.length === 0) return;
    const allCols: Array<{ key: string; label: string; get: (s: any) => string }> = [
      { key: 'date', label: lang === 'en' ? 'Date' : 'Datum', get: (s) => s.timestampStart ? new Date(s.timestampStart).toISOString().slice(0, 16).replace('T', ' ') : '' },
      { key: 'type', label: lang === 'en' ? 'Type' : 'Typ', get: (s) => s.type ?? '' },
      { key: 'location', label: lang === 'en' ? 'Location' : 'Plats', get: (s) => lookupLocation(s.locationId)?.name ?? '' },
      { key: 'weapon', label: lang === 'en' ? 'Weapon' : 'Vapen', get: (s) => (s.weaponIds ?? []).map((id: string) => lookupWeapon(id)?.name ?? '').join('; ') },
      { key: 'ammo', label: lang === 'en' ? 'Ammunition' : 'Ammunition', get: (s) => (s.ammunitionIds ?? []).map((id: string) => { const a = lookupAmmo(id); return a ? `${a.brand} ${a.caliber}` : ''; }).join('; ') },
      { key: 'shots', label: lang === 'en' ? 'Shots fired' : 'Skott avfyrade', get: (s) => s.shotsFired != null ? String(s.shotsFired) : '' },
      { key: 'hits', label: lang === 'en' ? 'Hits' : 'Träffar', get: (s) => s.hits != null ? String(s.hits) : '' },
      { key: 'temperature', label: lang === 'en' ? 'Temperature (°C)' : 'Temperatur (°C)', get: (s) => s.temperature != null ? String(s.temperature) : '' },
      { key: 'humidity', label: lang === 'en' ? 'Humidity (%)' : 'Luftfuktighet (%)', get: (s) => s.humidity != null ? String(s.humidity) : '' },
      { key: 'air_pressure', label: lang === 'en' ? 'Air pressure (mbar)' : 'Lufttryck (mbar)', get: (s) => s.air_pressure != null ? String(s.air_pressure) : '' },
      { key: 'notes', label: lang === 'en' ? 'Notes' : 'Anteckningar', get: (s) => s.notes ?? '' },
      { key: 'game', label: lang === 'en' ? 'Game' : 'Vilt', get: (s) => {
        if (s.type !== 'hunt') return '';
        const sAnimals = allAnimals.filter((a: any) => a.session_id === s.id);
        if (sAnimals.length === 0) return '';
        const SPECIES_NAMES: Record<string, {sv: string; en: string}> = {
          roe_deer: {sv:'Rådjur',en:'Roe deer'}, wild_boar: {sv:'Vildsvin',en:'Wild boar'},
          moose: {sv:'Älg',en:'Moose'}, fallow_deer: {sv:'Dovhjort',en:'Fallow deer'},
          red_deer: {sv:'Kronhjort',en:'Red deer'}, fox: {sv:'Räv',en:'Fox'},
          hare: {sv:'Hare',en:'Hare'}, badger: {sv:'Grävling',en:'Badger'},
          beaver: {sv:'Bäver',en:'Beaver'},
        };
        return sAnimals.map((a: any) => {
          const name = a.species === 'other' ? (a.species_custom || 'Other') : (SPECIES_NAMES[a.species]?.[lang === 'en' ? 'en' : 'sv'] ?? a.species);
          const wt = a.carcass_weight != null ? ` ${a.carcass_weight}kg` : '';
          return name + wt;
        }).join(' | ');
      }},
    ];
    // Only include columns that have at least one value in the dataset
    const activeCols = allCols.filter((col) => ordered.some((s) => col.get(s) !== ''));
    const esc = (v: string) => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [activeCols.map((c) => esc(c.label)).join(',')];
    for (const s of ordered) { rows.push(activeCols.map((c) => esc(c.get(s))).join(',')); }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `huntledger-sessions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h1>{t('sessions.title')}</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setOpen((v) => !v); setEditTarget(null); }}>{t('sessions.create')}</button>
        {ordered.length > 0 ? (
          <button type="button" onClick={exportCsv} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #c8965a', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#c8965a' }}>
            {lang === 'en' ? '📥 Export CSV' : '📥 Exportera CSV'}
          </button>
        ) : null}
      </div>

      {open && !editTarget && user ? (
        <SessionForm
          userId={user.id}
          onCancel={() => setOpen(false)}
          onSubmit={async (input) => {
            await createSession(input);
            setOpen(false);
          }}
        />
      ) : null}

      {editTarget && user ? (
        <div style={{ margin: '16px 0', padding: 16, border: '1px solid #3a3835', borderRadius: 8, background: '#2a2926' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{lang === 'en' ? 'Edit session' : 'Redigera session'}</h2>
          <SessionForm
            key={editTarget.id}
            userId={user.id}
            initial={editTarget}
            onCancel={() => setEditTarget(null)}
            onSubmit={async (input) => {
              await updateSession(editTarget.id, { ...editTarget, ...input, id: editTarget.id });
              setEditTarget(null);
              await loadAnimals();
            }}
            onAnimalCountChange={(cnt) => setAnimalCounts(prev => ({ ...prev, [editTarget.id]: cnt }))}
          />
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <p>{t('sessions.empty')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('sessions.start')}</th>
              <th>{t('sessions.type')}</th>
              <th>{t('sessions.weapon')}</th>
              <th>{t('sessions.location')}</th>
              <th>{t('sessions.shots')}</th>
              <th>{t('sessions.hits')}</th>
              <th>{lang === 'en' ? 'Weather' : 'Väder'}</th>
              <th>{lang === 'en' ? 'Game' : 'Vilt'}</th>
              <th>{t('sessions.notes')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((s: any) => (
              <tr key={s.id}>
                <td>{formatDateTime(s.timestampStart, i18n.resolvedLanguage ?? 'sv')}</td>
                <td>
                  {t(
                    s.type === 'hunt'
                      ? 'sessions.typeHunt'
                      : s.type === 'shooting'
                      ? 'sessions.typeShooting'
                      : s.type === 'training'
                      ? 'sessions.typeTraining'
                      : s.type === 'moose_range'
                      ? 'sessions.typeMooseRange'
                      : s.type === 'wild_boar_test'
                      ? 'sessions.typeWildBoarTest'
                      : s.type === 'bear_test'
                      ? 'sessions.typeBearTest'
                      : 'sessions.typeMaintenance',
                  )}
                </td>
                <td>
                  {s.weaponIds.length === 0
                    ? t('sessions.noWeapon')
                    : s.weaponIds.map((id: string) => lookupWeapon(id)?.name ?? '?').join(', ')}
                </td>
                <td>{lookupLocation(s.locationId)?.name ?? '—'}</td>
                <td>{s.shotsFired ?? '—'}</td>
                <td>{(s.type === 'moose_range' || s.type === 'wild_boar_test' || s.type === 'bear_test' || s.type === 'hunt') ? '—' : (s.hits ?? '—')}</td>
                <td style={{ fontSize: 12, color: '#a89a84' }}>{[s.temperature != null ? `${s.temperature}°C` : null, s.humidity != null ? `${s.humidity}%` : null, s.air_pressure != null ? `${s.air_pressure}mbar` : null].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ fontSize: 12 }}>{s.type === 'hunt' ? (animalCounts[s.id] ? `🦌 ${animalCounts[s.id]}` : '—') : '—'}</td>
                <td>{s.notes ?? ''}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => { setEditTarget(s); setOpen(false); }}
                    className="btn-edit"
                  >
                    {lang === 'en' ? 'Edit' : 'Redigera'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        id: s.id,
                        label: formatDateTime(s.timestampStart, i18n.resolvedLanguage ?? 'sv'),
                      })
                    }
                    className="btn-delete"
                  >
                    {lang === 'en' ? 'Delete' : 'Radera'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`${lang === 'en' ? 'Delete session' : 'Radera session'} ${deleteTarget?.label ?? ''}?`}
        message={lang === 'en' ? 'Data will be permanently deleted.' : 'Data försvinner permanent.'}
        confirmLabel={lang === 'en' ? 'Delete' : 'Radera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteSession(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface SessionFormProps {
  userId: string;
  initial?: any;
  onCancel: () => void;
  onSubmit: (input: CreateSessionInput) => Promise<void>;
  onAnimalCountChange?: (count: number) => void;
}

function SessionForm({ userId, initial, onCancel, onSubmit, onAnimalCountChange }: SessionFormProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const { data, createLocation, createWeapon, createAmmunition } = useData();
  const [quickAddType, setQuickAddType] = useState<null | 'location' | 'weapon' | 'ammo'>(null);

  const [type, setType] = useState<SessionType>(initial?.type ?? 'shooting');
  const [start, setStart] = useState(toDateTimeLocalValue(initial?.timestampStart ?? new Date().toISOString()));
  const [end, setEnd] = useState(initial?.timestampEnd ? toDateTimeLocalValue(initial.timestampEnd) : '');
  const [locationId, setLocationId] = useState(initial?.locationId ?? '');
  const [weaponId, setWeaponId] = useState(initial?.weaponIds?.[0] ?? '');
  const [ammunitionId, setAmmunitionId] = useState(initial?.ammunitionIds?.[0] ?? '');
  const [shotsFired, setShotsFired] = useState(initial?.shotsFired != null ? String(initial.shotsFired) : '');
  const [hits, setHits] = useState(initial?.hits != null ? String(initial.hits) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [maintType, setMaintType] = useState(initial?.maintenance?.type ?? 'cleaning');
  const [maintDescription, setMaintDescription] = useState(initial?.maintenance?.description ?? '');
  const [series, setSeries] = useState<Array<{id: string; shots: Array<string | null>}>>(initial?.series ?? []);
  const [rounds, setRounds] = useState<WBRound[]>((initial as any)?.rounds ?? []);
  const [btRounds, setBtRounds] = useState<BTRound[]>((initial as any)?.btRounds ?? []);
  const [temperature, setTemperature] = useState(initial?.temperature != null ? String(initial.temperature) : '');
  const [humidity, setHumidity] = useState(initial?.humidity != null ? String(initial.humidity) : '');
  const [airPressure, setAirPressure] = useState(initial?.air_pressure != null ? String(initial.air_pressure) : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter out archived weapons/ammo/locations from dropdowns
  const activeWeapons = data.weapons.filter((w: any) => !w.archived);
  const activeAmmunition = data.ammunition.filter((a: any) => !a.archived);
  const activeLocations = data.locations.filter((l: any) => !l.archived);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const startIso = fromDateTimeLocalValue(start);
      if (!startIso) throw new Error('Invalid start time');
      const input: CreateSessionInput = {
        type,
        timestampStart: startIso,
        timestampEnd: fromDateTimeLocalValue(end),
        locationId: locationId || undefined,
        userId,
        weaponIds: weaponId ? [weaponId] : [],
        ammunitionIds: ammunitionId ? [ammunitionId] : [],
        dogIds: [],
        notes: notes || undefined,
        shotsFired: (type === 'maintenance') ? undefined : (!shotsFired ? undefined : Number(shotsFired)),
        hits: (type === 'maintenance' || type === 'moose_range' || type === 'wild_boar_test' || type === 'bear_test' || type === 'hunt') ? undefined : (!hits ? undefined : Number(hits)),
        maintenance:
          type === 'maintenance'
            ? { type: maintType, description: maintDescription || maintType }
            : undefined,
        series: type === 'moose_range' ? series : undefined,
        rounds: type === 'wild_boar_test' ? rounds : undefined,
        btRounds: type === 'bear_test' ? btRounds : undefined,
        temperature: temperature !== '' && !isNaN(Number(temperature)) ? Number(temperature) : undefined,
        humidity: humidity !== '' && !isNaN(Number(humidity)) ? Number(humidity) : undefined,
        air_pressure: airPressure !== '' && !isNaN(Number(airPressure)) ? Number(airPressure) : undefined,
      };
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
  <>
    <form onSubmit={handleSubmit}>
      {error ? <div className="error">{error}</div> : null}
      <div>
        <label>{t('sessions.type')}</label>
        <select value={type} onChange={(e) => setType(e.target.value as SessionType)}>
          <option value="shooting">{t('sessions.typeShooting')}</option>
          <option value="hunt">{t('sessions.typeHunt')}</option>
          <option value="training">{t('sessions.typeTraining')}</option>
          <option value="maintenance">{t('sessions.typeMaintenance')}</option>
          <option value="moose_range">{t('sessions.typeMooseRange')}</option>
          <option value="wild_boar_test">{t('sessions.typeWildBoarTest')}</option>
          <option value="bear_test">{t('sessions.typeBearTest')}</option>
        </select>
      </div>
      <div>
        <label>{t('sessions.start')}</label>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div>
        <label>{t('sessions.end')}</label>
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div>
        <label>{t('sessions.location')}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={{ flex: 1 }}>
            <option value="">{t('sessions.noLocation')}</option>
            {activeLocations.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button type="button" title={lang === 'en' ? 'Create new location' : 'Skapa ny plats'} onClick={() => setQuickAddType('location')} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#c8965a', color: '#1a1a18', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>+</button>
        </div>
      </div>
      <div>
        <label>{t('sessions.weapons')}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)} style={{ flex: 1 }}>
            <option value="">{t('sessions.noWeapon')}</option>
            {activeWeapons.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.caliber})
              </option>
            ))}
          </select>
          <button type="button" title={lang === 'en' ? 'Create new weapon' : 'Skapa nytt vapen'} onClick={() => setQuickAddType('weapon')} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#c8965a', color: '#1a1a18', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>+</button>
        </div>
      </div>
      <div>
        <label>{t('sessions.ammunition')}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={ammunitionId} onChange={(e) => setAmmunitionId(e.target.value)} style={{ flex: 1 }}>
            <option value="">{t('sessions.noAmmunition')}</option>
            {activeAmmunition.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.brand} {a.caliber}{a.bullet_name ? ` — ${a.bullet_name}` : a.bulletType ? ` — ${a.bulletType}` : ''}
              </option>
            ))}
          </select>
          <button type="button" title={lang === 'en' ? 'Create new ammunition' : 'Skapa ny ammunition'} onClick={() => setQuickAddType('ammo')} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#c8965a', color: '#1a1a18', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>+</button>
        </div>
      </div>
      {type === 'moose_range' ? (
        <>
          <div>
            <label>{t('sessions.shots')}</label>
            <input type="number" min="0" value={shotsFired} onChange={(e) => setShotsFired(e.target.value)} />
          </div>
          <MooseRangeSeriesManager series={series} onChange={setSeries} lang={lang} />
        </>
      ) : type === 'wild_boar_test' ? (
        <>
          <div>
            <label>{t('sessions.shots')}</label>
            <input type="number" min="0" value={shotsFired} onChange={(e) => setShotsFired(e.target.value)} />
          </div>
          <WildBoarRoundManager rounds={rounds} onChange={setRounds} lang={lang} />
        </>
      ) : type === 'bear_test' ? (
        <>
          <BearRoundManager btRounds={btRounds} onChange={setBtRounds} lang={lang} />
        </>
      ) : type !== 'maintenance' ? (
        <>
          <div>
            <label>{t('sessions.shots')}</label>
            <input type="number" value={shotsFired} onChange={(e) => setShotsFired(e.target.value)} />
          </div>
          {type !== 'hunt' && (
          <div>
            <label>{t('sessions.hits')}</label>
            <input type="number" value={hits} onChange={(e) => setHits(e.target.value)} />
          </div>
          )}
        </>
      ) : (
        <>
          <div>
            <label>{t('sessions.maintenanceType')}</label>
            <input value={maintType} onChange={(e) => setMaintType(e.target.value)} />
          </div>
          <div>
            <label>{t('sessions.maintenanceDescription')}</label>
            <textarea value={maintDescription} onChange={(e) => setMaintDescription(e.target.value)} />
          </div>
        </>
      )}
      {type === 'hunt' && initial?.id ? (
        <HarvestedAnimalsManager
          key={`animals-${initial.id}`}
          sessionId={initial.id}
          userId={userId}
          lang={lang}
          onCountChange={onAnimalCountChange}
        />
      ) : null}
      {type !== 'maintenance' ? (
        <div style={{ border: '1px solid #3a3835', borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 8, background: '#232321' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#a89a84', marginBottom: 8 }}>{lang === 'en' ? 'Weather conditions' : 'Väderförhållanden'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, color: '#a89a84' }}>{lang === 'en' ? 'Temperature (°C)' : 'Temperatur (°C)'}</label>
              <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder={lang === 'en' ? 'e.g. 15' : 'ex. 15'} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#a89a84' }}>{lang === 'en' ? 'Humidity (%)' : 'Luftfuktighet (%)'}</label>
              <input type="number" min="0" max="100" step="1" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder={lang === 'en' ? 'e.g. 65' : 'ex. 65'} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#a89a84' }}>{lang === 'en' ? 'Air pressure (mbar)' : 'Lufttryck (mbar)'}</label>
              <input type="number" min="800" max="1100" step="1" value={airPressure} onChange={(e) => setAirPressure(e.target.value)} placeholder={lang === 'en' ? 'e.g. 1013' : 'ex. 1013'} />
            </div>
          </div>
        </div>
      ) : null}
      <div>
        <label>{t('sessions.notes')}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={submitting} className="btn-save">
          {t('sessions.save')}
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel">
          {t('common.cancel')}
        </button>
      </div>
    </form>
    <QuickAddModal
      type={quickAddType}
      onClose={() => setQuickAddType(null)}
      onCreated={(qtype, id) => {
        if (qtype === 'location') setLocationId(id);
        else if (qtype === 'weapon') setWeaponId(id);
        else if (qtype === 'ammo') setAmmunitionId(id);
        setQuickAddType(null);
      }}
      createLocation={createLocation}
      createWeapon={createWeapon}
      createAmmunition={createAmmunition}
      t={t}
      lang={lang}
    />
  </>
  );
}

interface QuickAddModalProps {
  type: null | 'location' | 'weapon' | 'ammo';
  onClose: () => void;
  onCreated: (type: 'location' | 'weapon' | 'ammo', id: string) => void;
  createLocation: (input: any) => Promise<any>;
  createWeapon: (input: any) => Promise<any>;
  createAmmunition: (input: any) => Promise<any>;
  t: (key: string) => string;
  lang: string;
}

function QuickAddModal({ type, onClose, onCreated, createLocation, createWeapon, createAmmunition, t, lang }: QuickAddModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [locType, setLocType] = useState('other');
  const [weaponName, setWeaponName] = useState('');
  const [weaponType, setWeaponType] = useState('rifle');
  const [brand, setBrand] = useState('');
  const [caliber, setCaliber] = useState('');
  const [bulletType, setBulletType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (type) {
      setName(''); setLocType('other'); setWeaponName(''); setWeaponType('rifle');
      setBrand(''); setCaliber(''); setBulletType(''); setError(null); setSubmitting(false);
    }
  }, [type]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (type) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [type]);

  if (!type) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent submit from bubbling to parent SessionForm
    setError(null);
    setSubmitting(true);
    try {
      let created: any;
      if (type === 'location') {
        created = await createLocation({ name: name.trim(), location_type: locType, country: 'SE' });
      } else if (type === 'weapon') {
        created = await createWeapon({ name: weaponName.trim(), type: weaponType, caliber: '', serialNumber: '' });
      } else {
        created = await createAmmunition({ brand: brand.trim(), caliber: caliber.trim(), bulletType: bulletType.trim() });
      }
      onCreated(type, created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  const titles: Record<string, string> = {
    location: lang === 'en' ? 'New Location' : 'Ny plats',
    weapon: lang === 'en' ? 'New Weapon' : 'Nytt vapen',
    ammo: lang === 'en' ? 'New Ammunition' : 'Ny ammunition',
  };

  const inputStyle: any = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #3a3835', fontSize: 15, background: '#232321', color: '#e8dcc8', boxSizing: 'border-box' };
  const labelStyle: any = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14, color: '#a89a84' };
  const fieldStyle: any = { marginBottom: 14 };

  const dialogStyle: any = isMobile
    ? { position: 'fixed', inset: 'unset', bottom: 0, left: 0, right: 0, width: '100%', borderRadius: '16px 16px 0 0', margin: 0, padding: '20px 16px 32px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #3a3835', boxShadow: '0 -4px 32px rgba(0,0,0,0.5)', background: '#2a2926' }
    : { border: '1px solid #3a3835', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', background: '#2a2926', overflowY: 'auto', maxHeight: '90vh' };

  return (
    <dialog ref={dialogRef} style={dialogStyle} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, color: '#e8dcc8', fontWeight: 700 }}>{titles[type]}</h3>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer', fontSize: 22, color: '#a89a84', padding: '0 4px', lineHeight: 1 }}>×</button>
      </div>
      <form onSubmit={handleSubmit}>
        {error ? <p style={{ color: '#c45a4a', margin: '0 0 12px', fontSize: 14, background: 'rgba(168,84,84,0.15)', padding: '8px 12px', borderRadius: 6 }}>{error}</p> : null}
        {type === 'location' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Name *' : 'Namn *'}</label>
              <input type="text" required autoFocus value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Type *' : 'Typ *'}</label>
              <select value={locType} onChange={(e) => setLocType(e.target.value)} style={inputStyle}>
                <option value="shooting_range">{lang === 'en' ? 'Shooting Range' : 'Skjutbana'}</option>
                <option value="hunting_ground">{lang === 'en' ? 'Hunting Ground' : 'Jaktmark'}</option>
                <option value="home">{lang === 'en' ? 'Home' : 'Hem'}</option>
                <option value="other">{lang === 'en' ? 'Other' : 'Annan'}</option>
              </select>
            </div>
          </>
        )}
        {type === 'weapon' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Name *' : 'Namn *'}</label>
              <input type="text" required autoFocus value={weaponName} onChange={(e) => setWeaponName(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Type *' : 'Typ *'}</label>
              <select value={weaponType} onChange={(e) => setWeaponType(e.target.value)} style={inputStyle}>
                <option value="rifle">{t('weapons.type_rifle')}</option>
                <option value="shotgun">{t('weapons.type_shotgun')}</option>
                <option value="handgun">{t('weapons.type_handgun')}</option>
                <option value="air_rifle">{t('weapons.type_air_rifle')}</option>
                <option value="other">{t('weapons.type_other')}</option>
              </select>
            </div>
          </>
        )}
        {type === 'ammo' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Brand / Name *' : 'Märke / Namn *'}</label>
              <input type="text" required autoFocus value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Caliber *' : 'Kaliber *'}</label>
              <input type="text" required value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder="e.g. 9mm, .308, 12/70" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{lang === 'en' ? 'Bullet Type' : 'Kultyp'}</label>
              <input type="text" value={bulletType} onChange={(e) => setBulletType(e.target.value)} placeholder={lang === 'en' ? 'e.g. FMJ, HP, Soft Point' : 't.ex. FMJ, HP, Spetskulor'} style={inputStyle} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #c8965a', background: 'transparent', color: '#c8965a', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            {lang === 'en' ? 'Cancel' : 'Avbryt'}
          </button>
          <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: submitting ? '#6b5e52' : '#c8965a', color: '#1a1a18', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
            {submitting ? '...' : (lang === 'en' ? 'Create' : 'Skapa')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ── Moose Range Series Manager ────────────────────────────────────────────────

const MOOSE_SHOT_PTS: Record<string, number> = {'5^1': 5, '5': 5, '4': 4, '3': 3, 'T': 0, 'O': 0, 'X': 0};
type ShotVal = '5^1' | '5' | '4' | '3' | 'T' | 'O' | 'X' | null;
type MooseSeries = { id: string; shots: ShotVal[] };

function mShotBg(val: ShotVal): string {
  if (!val) return '#fff';
  if (val === '5^1' || val === '5') return '#1a2e1a';
  if (val === '4') return '#4a6741';
  if (val === '3') return '#7d9a6e';
  if (val === 'T') return '#c8873e';
  if (val === 'O') return '#a85d32';
  return '#555';
}
function mShotFg(val: ShotVal): string {
  if (!val) return '#1a2e1a';
  if (val === '5^1' || val === '5') return '#c8965a';
  return '#fff';
}
function mSeriesComplete(shots: ShotVal[]): boolean { return shots.every(s => s !== null); }
function mSeriesApproved(shots: ShotVal[]): boolean { return mSeriesComplete(shots) && shots.every(s => s !== 'O' && s !== 'X'); }
function mSeriesPoints(shots: ShotVal[]): number { return shots.reduce((sum, s) => sum + (s ? (MOOSE_SHOT_PTS[s] ?? 0) : 0), 0); }
function mSeriesSup(shots: ShotVal[]): number { return shots.filter(s => s === '5^1').length; }

interface MooseRangeSeriesManagerProps {
  series: MooseSeries[];
  onChange: (s: MooseSeries[]) => void;
  lang: string;
}

function MooseRangeSeriesManager({ series, onChange, lang }: MooseRangeSeriesManagerProps) {
  const [picker, setPicker] = useState<{sid: string; si: number} | null>(null);
  const isEn = lang === 'en';

  const addSeries = () => {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    onChange([...series, { id, shots: [null, null, null, null] }]);
  };
  const deleteSeries = (id: string) => {
    if (!window.confirm(isEn ? 'Delete this series?' : 'Radera den här serien?')) return;
    onChange(series.filter(s => s.id !== id));
  };
  const setShot = (sid: string, si: number, val: ShotVal) => {
    onChange(series.map(s => {
      if (s.id !== sid) return s;
      const shots = [...s.shots] as ShotVal[];
      shots[si] = val;
      return { ...s, shots };
    }));
    setPicker(null);
  };

  const completeSeries = series.filter(s => mSeriesComplete(s.shots));
  const approvedSeries = completeSeries.filter(s => mSeriesApproved(s.shots));
  const totalPts = completeSeries.reduce((sum, s) => sum + mSeriesPoints(s.shots), 0);
  const totalSup = completeSeries.reduce((sum, s) => sum + mSeriesSup(s.shots), 0);

  const cellStyle = (val: ShotVal): React.CSSProperties => ({
    width: 48, height: 48, minWidth: 44, minHeight: 44,
    borderRadius: 6, border: '2px solid',
    borderColor: val ? mShotBg(val) : '#c8965a',
    background: mShotBg(val),
    color: mShotFg(val),
    fontWeight: 700, fontSize: 15,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  });

  const SHOT_VALS: ShotVal[] = ['5^1', '5', '4', '3', 'T', 'O', 'X'];

  return (
    <div style={{ marginTop: 8 }}>
      {series.length > 0 && (
        <div style={{ background: '#f5f0e8', border: '1px solid #3a3835', borderRadius: 6, padding: '6px 12px', marginBottom: 10, fontSize: 13, color: '#1c1c1c', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          <span><strong>{series.length}</strong> {isEn ? 'series' : 'serier'}</span>
          <span><strong>{approvedSeries.length}</strong> {isEn ? 'approved' : 'godkända'}</span>
          <span><strong>{totalPts}</strong> {isEn ? 'points' : 'poäng'}</span>
          {totalSup > 0 ? <span><strong>{totalSup}</strong>{'×'}5¹</span> : null}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {series.map((s) => {
          const complete = mSeriesComplete(s.shots);
          const approved = mSeriesApproved(s.shots);
          const pts = mSeriesPoints(s.shots);
          const sup = mSeriesSup(s.shots);
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2a2926', border: '1px solid #3a3835', borderRadius: 6, padding: '8px 10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {s.shots.map((val, i) => (
                  <button key={i} type="button" onClick={() => setPicker({sid: s.id, si: i})} style={cellStyle(val)}>
                    {val === '5^1' ? <span>5<sup style={{fontSize: '0.6em', lineHeight: 1}}>1</sup></span> : (val || '–')}
                  </button>
                ))}
              </div>
              {complete ? (
                approved ? (
                  <span style={{ background: '#d4edda', color: '#155724', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    {'✓'} {pts}p{sup > 0 ? ' · ' + sup + '×5¹' : ''}
                  </span>
                ) : (
                  <span style={{ background: '#f8d7da', color: '#721c24', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    {'✗'} {isEn ? 'Failed' : 'Underkänd'}
                  </span>
                )
              ) : (
                <span style={{ background: 'rgba(200,150,90,0.15)', color: '#a89a84', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {s.shots.filter(sh => !sh).length} {isEn ? 'missing' : 'kvar'}
                </span>
              )}
              <button type="button" onClick={() => deleteSeries(s.id)} style={{ marginLeft: 'auto', background: '#a85454', color: '#e8dcc8', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}>
                🗑
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={addSeries} style={{ width: '100%', padding: 8, border: '2px dashed #c8965a', borderRadius: 6, background: 'transparent', color: '#c8965a', cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'center', minHeight: 44 }}>
        {isEn ? '+ Add series' : '+ Lägg till serie'}
      </button>
      {picker ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) setPicker(null); }}>
          <div style={{ background: '#2a2926', borderRadius: 12, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.7)', border: '1px solid #3a3835' }}>
            <div style={{ textAlign: 'center', fontWeight: 600, color: '#c8965a', marginBottom: 14, fontSize: 15 }}>
              {isEn ? 'Select shot value' : 'Välj skottvärde'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {SHOT_VALS.map(val => (
                <button key={val!} type="button" onClick={() => setShot(picker.sid, picker.si, val)} style={{ height: 56, borderRadius: 8, border: '2px solid ' + mShotBg(val), background: mShotBg(val), color: mShotFg(val), fontWeight: 700, fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                  {val === '5^1' ? <span>5<sup style={{fontSize: '0.6em', lineHeight: 1}}>1</sup></span> : val}
                </button>
              ))}
              <button type="button" onClick={() => setShot(picker.sid, picker.si, null)} style={{ height: 56, borderRadius: 8, border: '2px dashed #c8965a', background: '#f5f0e8', color: '#3d2b1f', fontWeight: 600, fontSize: 12, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                {isEn ? 'Clear' : 'Rensa'}
              </button>
            </div>
            <button type="button" onClick={() => setPicker(null)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #3a3835', background: '#f5f0e8', color: '#e8dcc8', cursor: 'pointer', fontWeight: 500, minHeight: 44 }}>
              {isEn ? 'Cancel' : 'Avbryt'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── HarvestedAnimalsManager ───────────────────────────────────────────────────

// ── WildBoarRoundManager ─────────────────────────────────────────────────────

type WBRound = {
  id: string;
  momentActive: [boolean, boolean, boolean];
  shots: (boolean | null)[];
};

function wbMomentApproved(round: WBRound, m: number): boolean {
  if (!round.momentActive[m]) return false;
  const base = m * 4;
  return (
    round.shots[base] === true &&
    round.shots[base + 1] === true &&
    round.shots[base + 2] === true &&
    round.shots[base + 3] === true
  );
}

function wbSessionPassed(rounds: WBRound[]): boolean {
  return [0, 1, 2].every((m) => rounds.some((r) => wbMomentApproved(r, m)));
}

interface WildBoarRoundManagerProps {
  rounds: WBRound[];
  onChange: (r: WBRound[]) => void;
  lang: string;
}

function WildBoarRoundManager({ rounds, onChange, lang }: WildBoarRoundManagerProps) {
  const isEn = lang === 'en';
  const MOMENT_LABELS = isEn
    ? ['Bait hunting 50m', 'Stalk hunting 50m', 'Dog hunting 30m']
    : ['Åteljakt 50m', 'Smygjakt 50m', 'Hundjakt 30m'];

  const momentPassed = (m: number) => rounds.some((r) => wbMomentApproved(r, m));
  const passed = wbSessionPassed(rounds);

  const addRound = () => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const shots: (boolean | null)[] = Array(12).fill(null);
    onChange([...rounds, { id, momentActive: [true, true, true] as [boolean,boolean,boolean], shots }]);
  };

  const deleteRound = (id: string) => {
    if (!window.confirm(isEn ? 'Delete this round?' : 'Radera denna omgång?')) return;
    onChange(rounds.filter((r) => r.id !== id));
  };

  const toggleShot = (roundId: string, shotIdx: number) => {
    onChange(
      rounds.map((r) => {
        if (r.id !== roundId) return r;
        const shots = [...r.shots];
        const cur = shots[shotIdx];
        // Three-state: null (untouched) -> true (hit) -> false (miss) -> null
        shots[shotIdx] = cur === null ? true : cur === true ? false : null;
        return { ...r, shots };
      })
    );
  };

  const cellStyle = (val: boolean | null): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: 40, height: 40, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', fontWeight: 800, fontSize: 20,
      WebkitTapHighlightColor: 'transparent',
      flexShrink: 0,
      userSelect: 'none',
      transition: 'all 0.15s ease',
    };
    if (val === true) return { ...base, border: '2px solid #6b8f5e', background: '#6b8f5e', color: '#e8dcc8' };
    if (val === false) return { ...base, border: '2px solid #a85454', background: '#a85454', color: '#e8dcc8' };
    return { ...base, border: '2px dashed #c8965a', background: '#232321', color: 'transparent' };
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Overall status */}
      {rounds.length > 0 && (
        <div style={{
          background: passed ? '#d4edda' : '#f8d7da',
          color: passed ? '#155724' : '#721c24',
          borderRadius: 6, padding: '6px 12px', marginBottom: 10,
          fontSize: 13, fontWeight: 600,
        }}>
          {passed
            ? (isEn ? '✅ Passed — all 3 moments approved' : '✅ Godkänt — alla 3 moment godkända')
            : (isEn ? '⏳ Not yet passed' : '⏳ Ej godkänt ännu')}
        </div>
      )}

      {/* Moment status pills */}
      {rounds.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {[0, 1, 2].map((m) => {
            const ok = momentPassed(m);
            return (
              <span key={m} style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: ok ? '#d4edda' : '#f8f9fa',
                color: ok ? '#155724' : '#6c757d',
                border: ok ? '1px solid #c3e6cb' : '1px solid #dee2e6',
              }}>
                {ok ? '✓' : '○'} {MOMENT_LABELS[m]}
              </span>
            );
          })}
        </div>
      )}

      {/* Rounds */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {rounds.map((round, ri) => (
          <div key={round.id} style={{
            background: '#232321', border: '1px solid #3a3835',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8dcc8' }}>
                {isEn ? `Round ${ri + 1}` : `Omgång ${ri + 1}`}
              </span>
              <button
                type="button"
                onClick={() => deleteRound(round.id)}
                style={{ background: 'rgba(168,84,84,0.15)', color: '#c45a4a', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}
              >
                🗑
              </button>
            </div>
            {/* 12 cells in 3 groups of 4 */}
            <div className="wb-moments" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[0, 1, 2].map((m) => {
                const base = m * 4;
                const approved = wbMomentApproved(round, m);
                return (
                  <div key={m} style={{
                    border: approved ? '2px solid #c3e6cb' : '1px solid #e5e7eb',
                    borderRadius: 8, padding: '8px 10px',
                    background: approved ? '#f0faf0' : 'transparent',
                    flex: '1 1 0', minWidth: 0,
                  }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {[0, 1, 2, 3].map((si) => {
                        const shotIdx = base + si;
                        const val = round.shots[shotIdx] as boolean | null;
                        return (
                          <button key={si} type="button"
                            onClick={() => toggleShot(round.id, shotIdx)}
                            style={cellStyle(val)}
                            title={val === true ? (isEn ? 'Hit' : 'Träff') : val === false ? (isEn ? 'Miss' : 'Miss') : (isEn ? 'Not fired' : 'Ej skjuten')}
                          >
                            {val === true ? '✓' : val === false ? '✗' : ''}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 10, color: '#a89a84', marginTop: 4, fontWeight: 500 }}>
                      {MOMENT_LABELS[m]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      {rounds.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 11, color: '#6b5e4f', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 4, border: '2px dashed #c8965a', background: '#232321' }} />
            {isEn ? 'Not fired' : 'Orörd'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 4, background: '#16a34a', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{'✓'}</span>
            {isEn ? 'Hit' : 'Träff'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 4, background: '#a85454', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{'✗'}</span>
            {isEn ? 'Miss' : 'Miss'}
          </span>
          <span style={{ color: '#999', fontStyle: 'italic' }}>
            {isEn ? '(tap to cycle)' : '(tryck för att ändra)'}
          </span>
        </div>
      )}

      {/* Add round button - no dialog, directly adds */}
      <button
        type="button"
        onClick={addRound}
        style={{
          width: '100%', padding: 8, border: '2px dashed #c8965a',
          borderRadius: 6, background: 'transparent', color: '#c8965a',
          cursor: 'pointer', fontSize: 14, fontWeight: 500,
          textAlign: 'center', minHeight: 44,
        }}
      >
        {rounds.length === 0
          ? (isEn ? '+ Add first round' : '+ Lägg till första omgången')
          : (isEn ? '+ Add round' : '+ Lägg till omgång')}
      </button>
    </div>
  );
}

// ── HarvestedAnimalsManager ─────────────────────────────────────────────

// ── BearRoundManager ─────────────────────────────────────────────

type BTRound = {
  id: string;
  shots: (boolean | null)[];
};

const BT_BASES = [0, 4, 8];
const BT_SIZES = [4, 4, 3];

function btMomentApproved(round: BTRound, m: number): boolean {
  const base = BT_BASES[m] ?? 0;
  const size = BT_SIZES[m] ?? 0;
  for (let i = 0; i < size; i++) {
    if (round.shots[base + i] !== true) return false;
  }
  return true;
}

function btSessionPassed(rounds: BTRound[]): boolean {
  return [0, 1, 2].every((m) => rounds.some((r) => btMomentApproved(r, m)));
}

interface BearRoundManagerProps {
  btRounds: BTRound[];
  onChange: (r: BTRound[]) => void;
  lang: string;
}

function BearRoundManager({ btRounds, onChange, lang }: BearRoundManagerProps) {
  const isEn = lang === 'en';
  const MOMENT_LABELS = isEn
    ? ['Side figure 80m', 'Side figure 40m', 'Side & front figure 20m']
    : ['Sidofigur 80m', 'Sidofigur 40m', 'Sido- & frontfigur 20m'];

  const momentPassed = (m: number) => btRounds.some((r) => btMomentApproved(r, m));
  const passed = btSessionPassed(btRounds);

  const addRound = () => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const shots: (boolean | null)[] = Array(11).fill(null);
    onChange([...btRounds, { id, shots }]);
  };

  const deleteRound = (id: string) => {
    if (!window.confirm(isEn ? 'Delete this round?' : 'Radera denna omgång?')) return;
    onChange(btRounds.filter((r) => r.id !== id));
  };

  const toggleShot = (roundId: string, shotIdx: number) => {
    onChange(
      btRounds.map((r) => {
        if (r.id !== roundId) return r;
        const shots = [...r.shots];
        const cur = shots[shotIdx];
        shots[shotIdx] = cur === null ? true : cur === true ? false : null;
        return { ...r, shots };
      })
    );
  };

  const cellStyle = (val: boolean | null): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: 40, height: 40, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', fontWeight: 800, fontSize: 20,
      WebkitTapHighlightColor: 'transparent',
      flexShrink: 0,
      userSelect: 'none',
      transition: 'all 0.15s ease',
    };
    if (val === true) return { ...base, border: '2px solid #16a34a', background: '#16a34a', color: '#fff' };
    if (val === false) return { ...base, border: '2px solid #a85454', background: '#a85454', color: '#e8dcc8' };
    return { ...base, border: '2px dashed #c8965a', background: '#232321', color: 'transparent' };
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .bt-moments > div { flex-basis: 100% !important; min-width: 100% !important; }
        }
      `}</style>
      <div style={{ marginTop: 8 }}>
        {btRounds.length > 0 && (
          <div style={{
            background: passed ? '#d4edda' : '#f8d7da',
            color: passed ? '#155724' : '#721c24',
            borderRadius: 6, padding: '6px 12px', marginBottom: 10,
            fontSize: 13, fontWeight: 600,
          }}>
            {passed
              ? (isEn ? '✅ Passed — all 3 moments approved' : '✅ Godkänt — alla 3 moment godkända')
              : (isEn ? '⏳ Not yet passed' : '⏳ Ej godkänt ännu')}
          </div>
        )}
        {btRounds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[0, 1, 2].map((m) => {
              const ok = momentPassed(m);
              return (
                <span key={m} style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: ok ? '#d4edda' : '#f8f9fa',
                  color: ok ? '#155724' : '#6c757d',
                  border: ok ? '1px solid #c3e6cb' : '1px solid #dee2e6',
                }}>
                  {ok ? '✓' : '○'} {MOMENT_LABELS[m]}
                </span>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
          {btRounds.map((round, ri) => (
            <div key={round.id} style={{
              background: '#232321', border: '1px solid #3a3835',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8dcc8' }}>
                  {isEn ? `Round ${ri + 1}` : `Omgång ${ri + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => deleteRound(round.id)}
                  style={{ background: 'rgba(168,84,84,0.15)', color: '#c45a4a', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}
                >
                  🗑
                </button>
              </div>
              <div className="bt-moments" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[0, 1, 2].map((m) => {
                  const base = BT_BASES[m] ?? 0;
                  const size = BT_SIZES[m] ?? 0;
                  const approved = btMomentApproved(round, m);
                  return (
                    <div key={m} style={{
                      border: approved ? '2px solid #c3e6cb' : '1px solid #e5e7eb',
                      borderRadius: 8, padding: '8px 10px',
                      background: approved ? '#f0faf0' : 'transparent',
                      flex: '1 1 0', minWidth: 0,
                    }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {Array(size).fill(null).map((_, si) => {
                          const shotIdx = base + si;
                          const val = round.shots[shotIdx] as boolean | null;
                          return (
                            <button key={si} type="button"
                              onClick={() => toggleShot(round.id, shotIdx)}
                              style={cellStyle(val)}
                              title={val === true ? (isEn ? 'Hit' : 'Träff') : val === false ? (isEn ? 'Miss' : 'Miss') : (isEn ? 'Not fired' : 'Ej skjuten')}
                            >
                              {val === true ? '✓' : val === false ? '✗' : ''}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 10, color: '#a89a84', marginTop: 4, fontWeight: 500 }}>
                        {MOMENT_LABELS[m]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {btRounds.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 11, color: '#6b5e4f', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 4, border: '2px dashed #c8965a', background: '#232321' }} />
              {isEn ? 'Not fired' : 'Orörd'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 4, background: '#16a34a', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{'✓'}</span>
              {isEn ? 'Hit' : 'Träff'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 4, background: '#a85454', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{'✗'}</span>
              {isEn ? 'Miss' : 'Miss'}
            </span>
            <span style={{ color: '#999', fontStyle: 'italic' }}>
              {isEn ? '(tap to cycle)' : '(tryck för att ändra)'}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={addRound}
          style={{
            width: '100%', padding: 8, border: '2px dashed #c8965a',
            borderRadius: 6, background: 'transparent', color: '#c8965a',
            cursor: 'pointer', fontSize: 14, fontWeight: 500,
            textAlign: 'center', minHeight: 44,
          }}
        >
          {btRounds.length === 0
            ? (isEn ? '+ Add first round' : '+ Lägg till första omgången')
            : (isEn ? '+ Add round' : '+ Lägg till omgång')}
        </button>
      </div>
    </>
  );
}

const SPECIES_MAP: Record<string, {sv: string; en: string}> = {
  roe_deer:    {sv: 'Rådjur',    en: 'Roe deer'},
  wild_boar:   {sv: 'Vildsvin',  en: 'Wild boar'},
  moose:       {sv: 'Älg',       en: 'Moose'},
  fallow_deer: {sv: 'Dovhjort',  en: 'Fallow deer'},
  red_deer:    {sv: 'Kronhjort', en: 'Red deer'},
  fox:         {sv: 'Räv',       en: 'Fox'},
  hare:        {sv: 'Hare',      en: 'Hare'},
  badger:      {sv: 'Grävling',  en: 'Badger'},
  beaver:      {sv: 'Bäver',     en: 'Beaver'},
  other:       {sv: 'Annan art…', en: 'Other species…'},
};

const SPECIES_LIST = Object.entries(SPECIES_MAP).map(([value, labels]) => ({ value, ...labels }));

function speciesLabel(species: string, customName: string | null | undefined, lang: string): string {
  if (species === 'other') return customName || (lang === 'en' ? 'Other' : 'Annan art');
  return SPECIES_MAP[species]?.[lang === 'en' ? 'en' : 'sv'] ?? species;
}

interface HarvestedAnimal {
  id: string;
  session_id: string;
  species: string;
  species_custom?: string | null;
  sex?: string | null;
  estimated_age?: string | null;
  carcass_weight?: number | null;
  antler_points?: number | null;
  shot_placement?: string | null;
  trichina_id?: string | null;
  facility_id?: string | null;
  notes?: string | null;
}

interface HarvestedAnimalsManagerProps {
  sessionId: string;
  userId: string;
  lang: string;
  onCountChange?: (count: number) => void;
}

function HarvestedAnimalsManager({ sessionId, userId, lang, onCountChange }: HarvestedAnimalsManagerProps) {
  const isAnEn = lang === 'en';
  const [animals, setAnimals] = useState<HarvestedAnimal[]>([]);
  const [amLoading, setAmLoading] = useState(true);
  const [amExpandedId, setAmExpandedId] = useState<string | null>(null);
  const [amAddingNew, setAmAddingNew] = useState(false);
  const [amDeleteTarget, setAmDeleteTarget] = useState<string | null>(null);

  const amToken = () => localStorage.getItem('huntledger.auth.token') ?? '';
  const amHdrs = () => ({ Authorization: `Bearer ${amToken()}`, 'Content-Type': 'application/json' });

  const amLoad = async () => {
    try {
      const res = await fetch(`/api/v1/data/${userId}/animals/session/${sessionId}`, { headers: amHdrs() });
      if (res.ok) {
        const d = await res.json();
        setAnimals(d.animals ?? []);
        onCountChange?.(d.animals?.length ?? 0);
      }
    } catch {}
    setAmLoading(false);
  };

  useEffect(() => { amLoad(); }, [sessionId]);

  const amHandleDelete = async (id: string) => {
    await fetch(`/api/v1/data/${userId}/animals/${id}`, { method: 'DELETE', headers: amHdrs() });
    await amLoad();
    setAmDeleteTarget(null);
  };

  const sectionStyle: CSSProperties = {
    marginTop: 20,
    border: '1px solid #3a3835',
    borderRadius: 10,
    background: '#232321',
    padding: 16,
  };
  const amBtnPrimary: CSSProperties = {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#c8965a', color: '#1a1a18',
    cursor: 'pointer', fontWeight: 600, fontSize: 14, minHeight: 44,
  };

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e8dcc8' }}>
          {isAnEn ? 'Harvested game' : 'Fällt vilt'}
          {animals.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: '#a89a84' }}>
              ({animals.length} {isAnEn ? 'animals' : 'djur'})
            </span>
          )}
        </h3>
        {!amAddingNew && (
          <button type="button" style={amBtnPrimary} onClick={() => { setAmAddingNew(true); setAmExpandedId(null); }}>
            + {isAnEn ? 'Add game' : 'Lägg till vilt'}
          </button>
        )}
      </div>

      {amLoading && <p style={{ color: '#6b5e52', fontSize: 13 }}>{isAnEn ? 'Loading…' : 'Laddar…'}</p>}

      {!amLoading && animals.length === 0 && !amAddingNew && (
        <p style={{ color: '#6b5e52', fontSize: 13, margin: 0 }}>
          {isAnEn ? 'No game logged for this session.' : 'Inga vilt loggade för detta pass.'}
        </p>
      )}

      {animals.map((a) => (
        <AnimalCard
          key={a.id}
          animal={a}
          lang={lang}
          expanded={amExpandedId === a.id}
          onToggle={() => setAmExpandedId(prev => prev === a.id ? null : a.id)}
          onSave={async (updated) => {
            await fetch(`/api/v1/data/${userId}/animals/${a.id}`, {
              method: 'PUT', headers: amHdrs(), body: JSON.stringify(updated),
            });
            await amLoad();
            setAmExpandedId(null);
          }}
          onDelete={() => setAmDeleteTarget(a.id)}
          isEn={isAnEn}
        />
      ))}

      {amAddingNew && (
        <AnimalForm
          lang={lang}
          isEn={isAnEn}
          onCancel={() => setAmAddingNew(false)}
          onSave={async (body) => {
            await fetch(`/api/v1/data/${userId}/animals/session/${sessionId}`, {
              method: 'POST', headers: amHdrs(), body: JSON.stringify(body),
            });
            await amLoad();
            setAmAddingNew(false);
          }}
        />
      )}

      <ConfirmDialog
        open={amDeleteTarget !== null}
        title={isAnEn ? 'Delete this animal?' : 'Radera detta djur?'}
        message={isAnEn ? 'The record will be permanently deleted.' : 'Posten raderas permanent.'}
        confirmLabel={isAnEn ? 'Delete' : 'Radera'}
        cancelLabel={isAnEn ? 'Cancel' : 'Avbryt'}
        danger
        onConfirm={() => amDeleteTarget && amHandleDelete(amDeleteTarget)}
        onCancel={() => setAmDeleteTarget(null)}
      />
    </div>
  );
}

interface AnimalCardProps {
  animal: HarvestedAnimal;
  lang: string;
  expanded: boolean;
  onToggle: () => void;
  onSave: (updated: any) => Promise<void>;
  onDelete: () => void;
  isEn: boolean;
}

function AnimalCard({ animal, lang, expanded, onToggle, onSave, onDelete, isEn }: AnimalCardProps) {
  const acLabel = speciesLabel(animal.species, animal.species_custom, lang);
  const acWeight = animal.carcass_weight != null ? ` · ${animal.carcass_weight} kg` : '';
  const acSex = animal.sex ? ` · ${isEn ? (animal.sex === 'male' ? 'Male' : animal.sex === 'female' ? 'Female' : 'Unknown') : (animal.sex === 'male' ? 'Hane' : animal.sex === 'female' ? 'Hona' : 'Okänt')}` : '';

  return (
    <div style={{ border: '1px solid #3a3835', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#2a2926', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        onClick={onToggle}
      >
        <span style={{ fontWeight: 600, color: '#e8dcc8', fontSize: 14 }}>
          {acLabel}{acWeight}{acSex}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: 'none', background: '#a85454', cursor: 'pointer', color: '#e8dcc8', minHeight: 32 }}>
            {isEn ? 'Delete' : 'Radera'}
          </button>
          <span style={{ color: '#6b5e52', fontSize: 16 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb', background: '#2a2926' }}>
          <AnimalForm
            lang={lang}
            initial={animal}
            isEn={isEn}
            onCancel={onToggle}
            onSave={async (body) => { await onSave(body); }}
          />
        </div>
      )}
    </div>
  );
}

interface AnimalFormProps {
  lang: string;
  isEn: boolean;
  initial?: HarvestedAnimal;
  onCancel: () => void;
  onSave: (body: any) => Promise<void>;
}

function AnimalForm({ lang, isEn, initial, onCancel, onSave }: AnimalFormProps) {
  const [afSpecies, setAfSpecies]             = useState(initial?.species ?? '');
  const [afSpeciesCustom, setAfSpeciesCustom] = useState(initial?.species_custom ?? '');
  const [afSex, setAfSex]                     = useState(initial?.sex ?? '');
  const [afAge, setAfAge]                     = useState(initial?.estimated_age ?? '');
  const [afWeight, setAfWeight]               = useState(initial?.carcass_weight != null ? String(initial.carcass_weight) : '');
  const [afAntlers, setAfAntlers]             = useState(initial?.antler_points != null ? String(initial.antler_points) : '');
  const [afShot, setAfShot]                   = useState(initial?.shot_placement ?? '');
  const [afTrichina, setAfTrichina]           = useState(initial?.trichina_id ?? '');
  const [afFacility, setAfFacility]           = useState(initial?.facility_id ?? '');
  const [afNotes, setAfNotes]                 = useState(initial?.notes ?? '');
  const [afError, setAfError]                 = useState<string | null>(null);
  const [afSaving, setAfSaving]               = useState(false);

  const handleSubmit = async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
    setAfError(null);
    if (!afSpecies) { setAfError(isEn ? 'Species is required.' : 'Art är obligatoriskt.'); return; }
    if (afSpecies === 'other' && !afSpeciesCustom.trim()) { setAfError(isEn ? 'Please enter the species name.' : 'Ange artnamn.'); return; }
    const body: any = {
      species: afSpecies,
      species_custom: afSpecies === 'other' ? afSpeciesCustom.trim() : undefined,
      sex: afSex || undefined,
      estimated_age: afAge.trim() || undefined,
      carcass_weight: afWeight !== '' && !isNaN(Number(afWeight)) ? Number(afWeight) : undefined,
      antler_points: afAntlers !== '' && !isNaN(Number(afAntlers)) ? Number(afAntlers) : undefined,
      shot_placement: afShot.trim() || undefined,
      trichina_id: afTrichina.trim() || undefined,
      facility_id: afFacility.trim() || undefined,
      notes: afNotes.trim() || undefined,
    };
    setAfSaving(true);
    try { await onSave(body); } catch (err: any) { setAfError(err.message ?? 'Error'); setAfSaving(false); }
  };

  const afInput: CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #3a3835', fontSize: 14, boxSizing: 'border-box', minHeight: 40 };
  const afLabel: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#e8dcc8', marginBottom: 4 };
  const afGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 12 };

  return (
    <div>
      {afError && <div style={{ color: '#c45a4a', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'rgba(168,84,84,0.15)', borderRadius: 6 }}>{afError}</div>}

      <div style={{ marginBottom: 12 }}>
        <label style={afLabel}>{isEn ? 'Species *' : 'Art *'}</label>
        <select value={afSpecies} onChange={(e) => { setAfSpecies(e.target.value); if (e.target.value !== 'other') setAfSpeciesCustom(''); }}
          style={{ ...afInput, appearance: 'auto' as any }}>
          <option value="">{isEn ? '— Select species —' : '— Välj art —'}</option>
          {SPECIES_LIST.map(s => (
            <option key={s.value} value={s.value}>{isEn ? s.en : s.sv}</option>
          ))}
        </select>
      </div>
      {afSpecies === 'other' && (
        <div style={{ marginBottom: 12 }}>
          <label style={afLabel}>{isEn ? 'Species name *' : 'Artnamn *'}</label>
          <input style={afInput} value={afSpeciesCustom} onChange={(e) => setAfSpeciesCustom(e.target.value)} placeholder={isEn ? 'Enter species name' : 'Ange artnamn'} />
        </div>
      )}

      <div style={afGrid}>
        <div>
          <label style={afLabel}>{isEn ? 'Sex' : 'Kön'}</label>
          <select value={afSex} onChange={(e) => setAfSex(e.target.value)} style={{ ...afInput, appearance: 'auto' as any }}>
            <option value="">{isEn ? '— Not specified —' : '— Ej angett —'}</option>
            <option value="male">{isEn ? 'Male' : 'Hane'}</option>
            <option value="female">{isEn ? 'Female' : 'Hona'}</option>
            <option value="unknown">{isEn ? 'Unknown' : 'Okänt'}</option>
          </select>
        </div>
        <div>
          <label style={afLabel}>{isEn ? 'Estimated age' : 'Uppskattad ålder'}</label>
          <input style={afInput} value={afAge} onChange={(e) => setAfAge(e.target.value)} placeholder={isEn ? 'e.g. 2–3 years' : 'ex. 2–3 år'} />
        </div>
        <div>
          <label style={afLabel}>{isEn ? 'Carcass weight (kg)' : 'Slaktvikt (kg)'}</label>
          <input type="number" step="0.1" min="0" style={afInput} value={afWeight} onChange={(e) => setAfWeight(e.target.value)} placeholder="0.0" />
        </div>
        <div>
          <label style={afLabel}>{isEn ? 'Antler points' : 'Taggar (horn)'}</label>
          <input type="number" min="0" step="1" style={afInput} value={afAntlers} onChange={(e) => setAfAntlers(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={afLabel}>{isEn ? 'Shot placement' : 'Skottplacering'}</label>
          <input style={afInput} value={afShot} onChange={(e) => setAfShot(e.target.value)} placeholder={isEn ? 'e.g. Shoulder, lung, heart' : 'ex. Bog, lung, hjärta, hals'} />
        </div>
        <div>
          <label style={afLabel}>{isEn ? 'Trichinella test ID' : 'ID Trikinprov'}</label>
          <input style={afInput} value={afTrichina} onChange={(e) => setAfTrichina(e.target.value)} />
        </div>
        <div>
          <label style={afLabel}>{isEn ? 'Game handling facility ID' : 'ID Vilthanteringsanläggning'}</label>
          <input style={afInput} value={afFacility} onChange={(e) => setAfFacility(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={afLabel}>{isEn ? 'Notes' : 'Anteckningar'}</label>
        <textarea style={{ ...afInput, minHeight: 72, resize: 'vertical' }} value={afNotes} onChange={(e) => setAfNotes(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={afSaving} onClick={handleSubmit} className="btn-save">
          {afSaving ? (isEn ? 'Saving…' : 'Sparar…') : (isEn ? 'Save' : 'Spara')}
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel">
          {isEn ? 'Cancel' : 'Avbryt'}
        </button>
      </div>
    </div>
  );
}
