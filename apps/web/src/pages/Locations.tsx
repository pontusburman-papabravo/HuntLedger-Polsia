import { useState, useMemo, useEffect, useRef, type FormEvent, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../data/useData';
import { ConfirmDialog } from '../components/ConfirmDialog';

// ── Leaflet dynamic loader ────────────────────────────────────────────────────
let leafletReady = false;
let leafletPending = false;
const leafletQueue: Array<() => void> = [];
function loadLeaflet(cb: () => void): void {
  if (leafletReady) { cb(); return; }
  leafletQueue.push(cb);
  if (leafletPending) return;
  leafletPending = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = () => { leafletReady = true; leafletQueue.forEach((f) => f()); leafletQueue.length = 0; };
  document.head.appendChild(script);
}

// ── LocationMap component ─────────────────────────────────────────────────────
interface LocationMapProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  lang: string;
  editMode?: boolean;
  onCoordChange?: (lat: number | null, lng: number | null) => void;
}

function LocationMap({ lat, lng, lang, editMode = false, onCoordChange }: LocationMapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pinModeRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const cbRef = useRef(onCoordChange);
  useEffect(() => { cbRef.current = onCoordChange; });
  const hasCoords = lat != null && !isNaN(Number(lat)) && lng != null && !isNaN(Number(lng));

  useEffect(() => {
    if (!expanded) return;
    loadLeaflet(() => {
      if (mapRef.current || !divRef.current) return;
      const L = (window as any).L;
      if (!L) return;
      const cLat = hasCoords ? Number(lat) : 62.0;
      const cLng = hasCoords ? Number(lng) : 15.0;
      const m = L.map(divRef.current, { scrollWheelZoom: false })
        .setView([cLat, cLng], hasCoords ? 13 : 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(m);
      if (hasCoords) {
        markerRef.current = L.marker([Number(lat), Number(lng)]).addTo(m);
      }
      m.on('click', (e: any) => {
        if (!pinModeRef.current) return;
        doPlacePin(m, e.latlng.lat, e.latlng.lng);
        pinModeRef.current = false;
        setPinMode(false);
        m.getContainer().style.cursor = '';
      });
      mapRef.current = m;
      setTimeout(() => m.invalidateSize(), 80);
    });
  }, [expanded]);

  function doPlacePin(m: any, pLat: number, pLng: number) {
    const L = (window as any).L;
    if (markerRef.current) {
      markerRef.current.setLatLng([pLat, pLng]);
    } else {
      markerRef.current = L.marker([pLat, pLng]).addTo(m);
    }
    m.setView([pLat, pLng], Math.max(m.getZoom(), 13));
    if (cbRef.current) cbRef.current(pLat, pLng);
  }

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 60);
  }

  function handleSetPin() {
    if (!mapRef.current) {
      setExpanded(true);
      setTimeout(() => {
        pinModeRef.current = true;
        setPinMode(true);
        if (mapRef.current) mapRef.current.getContainer().style.cursor = 'crosshair';
      }, 250);
      return;
    }
    const next = !pinModeRef.current;
    pinModeRef.current = next;
    setPinMode(next);
    mapRef.current.getContainer().style.cursor = next ? 'crosshair' : '';
  }

  function handleGps() {
    if (!navigator.geolocation) {
      alert(lang === 'en' ? 'Geolocation not supported.' : 'Webbläsaren stöder inte geolokalisering.');
      return;
    }
    setGpsLoading(true);
    if (!expanded) setExpanded(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const pLat = pos.coords.latitude;
        const pLng = pos.coords.longitude;
        if (mapRef.current) {
          doPlacePin(mapRef.current, pLat, pLng);
        } else {
          const wait = setInterval(() => {
            if (mapRef.current) { clearInterval(wait); doPlacePin(mapRef.current, pLat, pLng); }
          }, 100);
          setTimeout(() => clearInterval(wait), 5000);
          if (cbRef.current) cbRef.current(pLat, pLng);
        }
      },
      () => {
        setGpsLoading(false);
        alert(lang === 'en' ? 'Could not get your location. Check permissions.' : 'Kunde inte hämta position. Kontrollera behörigheter.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleClear() {
    if (mapRef.current && markerRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (cbRef.current) cbRef.current(null, null);
  }

  const headerLabel = hasCoords
    ? (lang === 'en' ? 'Coordinates saved' : 'Koordinater sparade')
    : (lang === 'en' ? 'Add map position' : 'Lägg till kartposition');
  const mapH = editMode ? 300 : 220;

  return (
    <div style={{ border: '1px solid #3a3835', borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: '#232321', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, color: '#e8dcc8' }}
      >
        <span>📍</span>
        <span style={{ flex: 1 }}>{headerLabel}</span>
        <span style={{ fontSize: 11, color: '#a89a84', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {expanded && (
        <div>
          <div ref={divRef} style={{ width: '100%', height: mapH }} />
          {!hasCoords && !editMode && (
            <div style={{ padding: '8px 14px', background: '#232321', fontSize: 13, color: '#a89a84', borderTop: '1px solid #e5e7eb' }}>
              {lang === 'en' ? 'No coordinates set.' : 'Inga koordinater inlagda.'}
            </div>
          )}
          {editMode && (
            <>
              {pinMode && (
                <div style={{ padding: '6px 14px', background: 'rgba(200,150,90,0.15)', borderTop: '1px solid #c8965a', fontSize: 13, color: '#c8965a' }}>
                  {'👆 ' + (lang === 'en' ? 'Tap the map to place the pin' : 'Tryck på kartan för att sätta pin')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, padding: '8px 14px', background: '#232321', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSetPin}
                  style={{ fontSize: 13, padding: '5px 12px', borderRadius: 6, border: '1px solid ' + (pinMode ? '#c8965a' : '#3a3835'), background: pinMode ? 'rgba(59,58,53,0.5)' : '#fff', cursor: 'pointer', color: pinMode ? '#a89a84' : '#374151', fontWeight: 500 }}
                >
                  {pinMode ? ('✕ ' + (lang === 'en' ? 'Cancel' : 'Avbryt')) : ('📌 ' + (lang === 'en' ? 'Set pin' : 'Sätt pin'))}
                </button>
                <button
                  type="button"
                  onClick={handleGps}
                  disabled={gpsLoading}
                  style={{ fontSize: 13, padding: '5px 12px', borderRadius: 6, border: '1px solid #c8965a', background: 'transparent', cursor: gpsLoading ? 'not-allowed' : 'pointer', color: '#c8965a', opacity: gpsLoading ? 0.6 : 1, fontWeight: 500 }}
                >
                  {gpsLoading ? ('⏳ ' + (lang === 'en' ? 'Getting position...' : 'Hämtar position...')) : ('🎯 ' + (lang === 'en' ? 'Use my position' : 'Använd min position'))}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  style={{ fontSize: 13, padding: '5px 12px', borderRadius: 6, border: '1px solid #3a3835', background: 'transparent', cursor: 'pointer', color: '#a89a84', marginLeft: 'auto' }}
                >
                  {'🗑 ' + (lang === 'en' ? 'Clear' : 'Rensa')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type LocationType = 'shooting_range' | 'hunting_ground' | 'home' | 'other';

const LOCATION_TYPES: Record<LocationType, { sv: string; en: string; emoji: string; color: string; bg: string }> = {
  shooting_range: { sv: 'Skjutbana', en: 'Shooting Range', emoji: '\u{1F3AF}', color: '#c8965a', bg: 'rgba(200,150,90,0.25)' },
  hunting_ground: { sv: 'Jaktmark', en: 'Hunting Ground', emoji: '\u{1F332}', color: '#6b8f5e', bg: 'rgba(107,143,94,0.2)' },
  home: { sv: 'Hem', en: 'Home', emoji: '\u{1F3E0}', color: '#a89a84', bg: 'rgba(59,58,53,0.5)' },
  other: { sv: 'Annan', en: 'Other', emoji: '\u{1F4CD}', color: '#a89a84', bg: 'rgba(59,58,53,0.5)' },
};

function TypeBadge({ type, lang }: { type: string | undefined; lang: string }) {
  const key: LocationType = (type as LocationType) in LOCATION_TYPES ? (type as LocationType) : 'other';
  const info = LOCATION_TYPES[key];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      color: info.color, background: info.bg, whiteSpace: 'nowrap',
    }}>
      {lang === 'en' ? info.en : info.sv}
    </span>
  );
}

export function Locations() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const { data, createLocation, archiveLocation, unarchiveLocation, deleteLocation, updateLocation } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Count sessions per location for delete eligibility
  const locationSessionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of data.sessions) {
      const lId = (s as any).locationId;
      if (lId) map[lId] = (map[lId] ?? 0) + 1;
    }
    return map;
  }, [data.sessions]);

  const locations = data.locations.filter((l: any) => showArchived || !l.archived);

  return (
    <>
      <h1>{lang === 'en' ? 'Locations' : 'Platser'}</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => { setOpen((v) => !v); setEditTarget(null); }}>
          {lang === 'en' ? '+ New location' : '+ Ny plats'}
        </button>
        <label style={{ fontSize: 14, color: '#a89a84', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
          {lang === 'en' ? 'Show archived' : 'Visa arkiverade'}
        </label>
      </div>

      {open && !editTarget ? (
        <LocationForm
          lang={lang}
          onCancel={() => setOpen(false)}
          onSubmit={async (input) => {
            await createLocation(input as any);
            setOpen(false);
          }}
        />
      ) : null}

      {locations.length === 0 ? (
        <p style={{ color: '#a89a84', fontSize: 14 }}>
          {showArchived
            ? (lang === 'en' ? 'No locations found.' : 'Inga platser hittades.')
            : (lang === 'en' ? 'No locations yet. Add one above.' : 'Inga platser ännu. Lägg till en ovan.')}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #3a3835', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>{lang === 'en' ? 'Name' : 'Namn'}</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>{lang === 'en' ? 'Type' : 'Typ'}</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>{lang === 'en' ? 'Address' : 'Adress'}</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>{lang === 'en' ? 'City' : 'Ort'}</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>{lang === 'en' ? 'County' : 'Län'}</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l: any) => {
              const sessCount = locationSessionCounts[l.id] ?? 0;
              const canDelete = sessCount === 0;
              const deleteTitle = canDelete
                ? (lang === 'en' ? 'Delete permanently' : 'Radera permanent')
                : (lang === 'en'
                    ? `Used in ${sessCount} ${sessCount === 1 ? 'session' : 'sessions'}. Remove or reassign sessions to delete.`
                    : `Används i ${sessCount} ${sessCount === 1 ? 'session' : 'sessioner'}. Radera eller flytta sessionerna till en annan plats för att kunna radera.`);
              return (
                <LocationRow
                  key={l.id}
                  location={l}
                  lang={lang}
                  expanded={expanded === l.id}
                  onToggleExpand={() => setExpanded(expanded === l.id ? null : l.id)}
                  onEdit={() => { setEditTarget(l); setOpen(false); }}
                  onArchive={() => setArchiveTarget({ id: l.id, name: l.name })}
                  onUnarchive={() => setUnarchiveTarget({ id: l.id, name: l.name })}
                  onDelete={() => setDeleteTarget({ id: l.id, name: l.name })}
                  canDelete={canDelete}
                  deleteTitle={deleteTitle}
                />
              );
            })}
          </tbody>
        </table>
      )}

      {editTarget ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#2a2926', borderRadius: 10, padding: '24px 28px', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: '1px solid #3a3835' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{lang === 'en' ? 'Edit location' : 'Redigera plats'}</h2>
            <LocationForm
              key={editTarget.id}
              lang={lang}
              initial={editTarget}
              onCancel={() => setEditTarget(null)}
              onSubmit={async (input) => {
                await updateLocation(editTarget.id, { ...editTarget, ...input, id: editTarget.id });
                setEditTarget(null);
              }}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={archiveTarget !== null}
        title={(lang === 'en' ? 'Archive ' : 'Arkivera ') + (archiveTarget?.name ?? '') + '?'}
        message={lang === 'en' ? 'The location will be hidden but preserved in session history.' : 'Platsen döljs men finns kvar i historiska sessioner.'}
        confirmLabel={lang === 'en' ? 'Archive' : 'Arkivera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        onConfirm={async () => {
          if (archiveTarget) { await archiveLocation(archiveTarget.id); setArchiveTarget(null); }
        }}
        onCancel={() => setArchiveTarget(null)}
      />

      <ConfirmDialog
        open={unarchiveTarget !== null}
        title={(lang === 'en' ? 'Restore ' : 'Återställ ') + (unarchiveTarget?.name ?? '') + '?'}
        message={lang === 'en' ? 'The location will be made active again.' : 'Platsen blir aktiv igen och syns i formulären.'}
        confirmLabel={lang === 'en' ? 'Restore' : 'Återställ'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        onConfirm={async () => {
          if (unarchiveTarget) { await unarchiveLocation(unarchiveTarget.id); setUnarchiveTarget(null); }
        }}
        onCancel={() => setUnarchiveTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={(lang === 'en' ? 'Delete ' : 'Radera ') + (deleteTarget?.name ?? '') + '?'}
        message={lang === 'en' ? 'This will permanently delete the location. This cannot be undone.' : 'Platsen raderas permanent. Detta kan inte ångras.'}
        confirmLabel={lang === 'en' ? 'Delete' : 'Radera'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Avbryt'}
        danger={true}
        onConfirm={async () => {
          if (deleteTarget) { await deleteLocation(deleteTarget.id); setDeleteTarget(null); }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface LocationRowProps {
  location: any;
  lang: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleteTitle: string;
}

// Button classes defined in CSS (btn-edit, btn-archive, etc.)

function LocationRow({ location: l, lang, expanded, onToggleExpand, onEdit, onArchive, onUnarchive, onDelete, canDelete, deleteTitle }: LocationRowProps) {
  return (
    <>
      <tr style={{ borderBottom: '1px solid #3a3835', opacity: l.archived ? 0.5 : 1 }}>
        <td style={{ padding: '8px 12px' }}>
          <button
            type="button"
            onClick={onToggleExpand}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, color: '#e8dcc8', fontSize: 14, textAlign: 'left' }}
          >
            {l.name}
            {l.archived ? <span style={{ marginLeft: 8, fontSize: 12, color: '#a89a84' }}>({lang === 'en' ? 'archived' : 'arkiverat'})</span> : null}
          </button>
        </td>
        <td style={{ padding: '8px 12px' }}>
          <TypeBadge type={l.location_type} lang={lang} />
        </td>
        <td style={{ padding: '8px 12px', color: '#a89a84' }}>{l.address ?? '—'}</td>
        <td style={{ padding: '8px 12px', color: '#a89a84' }}>{l.city ?? '—'}</td>
        <td style={{ padding: '8px 12px', color: '#a89a84' }}>{l.county ?? '—'}</td>
        <td style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!l.archived ? (
              <>
                <button type="button" onClick={onEdit} className="btn-edit">
                  {lang === 'en' ? 'Edit' : 'Redigera'}
                </button>
                <button type="button" onClick={onArchive} className="btn-archive">
                  {lang === 'en' ? 'Archive' : 'Arkivera'}
                </button>
              </>
            ) : (
              <button type="button" onClick={onUnarchive} className="btn-unarchive">
                {lang === 'en' ? 'Restore' : 'Återställ'}
              </button>
            )}
            <button
              type="button"
              disabled={!canDelete}
              title={deleteTitle}
              onClick={() => canDelete ? onDelete() : undefined}
              className={canDelete ? "btn-delete" : "btn-delete-disabled"}
            >
              {lang === 'en' ? 'Delete' : 'Radera'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: '4px 12px 12px 32px', background: '#232321', borderBottom: '1px solid #3a3835' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 16px', paddingTop: 6, fontSize: 13 }}>
              {l.latitude != null && l.longitude != null && (
                <div><span style={{ color: '#a89a84' }}>GPS: </span>{Number(l.latitude).toFixed(6)}, {Number(l.longitude).toFixed(6)}</div>
              )}
              {l.country && (
                <div><span style={{ color: '#a89a84' }}>{lang === 'en' ? 'Country: ' : 'Land: '}</span>{l.country}</div>
              )}
              {l.notes && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#a89a84' }}>{lang === 'en' ? 'Notes: ' : 'Anteckningar: '}</span>{l.notes}</div>
              )}
              {l.latitude == null && l.longitude == null && !l.country && !l.notes && (
                <div style={{ color: '#6b5e52' }}>{lang === 'en' ? 'No additional details.' : 'Inga ytterligare detaljer.'}</div>
              )}
            </div>
            <LocationMap lat={l.latitude} lng={l.longitude} lang={lang} editMode={false} />
          </td>
        </tr>
      )}
    </>
  );
}

interface LocationFormProps {
  lang: string;
  initial?: any;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}

function LocationForm({ lang, initial, onCancel, onSubmit }: LocationFormProps) {
  const [name, setName] = useState<string>(initial?.name ?? '');
  const [locationType, setLocationType] = useState<LocationType>(
    (initial?.location_type as LocationType) in LOCATION_TYPES
      ? (initial?.location_type as LocationType)
      : 'other'
  );
  const [latitude, setLatitude] = useState<string>(
    initial?.latitude != null ? String(initial.latitude) : ''
  );
  const [longitude, setLongitude] = useState<string>(
    initial?.longitude != null ? String(initial.longitude) : ''
  );
  const [address, setAddress] = useState<string>(initial?.address ?? '');
  const [city, setCity] = useState<string>(initial?.city ?? '');
  const [county, setCounty] = useState<string>(initial?.county ?? '');
  const [country, setCountry] = useState<string>(initial?.country ?? 'SE');
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');
  const [lansstyrelseId, setLansstyrelseId] = useState<string>(initial?.lansstyrelse_id ?? '');
  const [fastighetsbeteckning, setFastighetsbeteckning] = useState<string>(initial?.fastighetsbeteckning ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        location_type: locationType,
        country: country.trim() || 'SE',
      };
      if (address.trim()) payload.address = address.trim();
      if (city.trim()) payload.city = city.trim();
      if (county.trim()) payload.county = county.trim();
      if (notes.trim()) payload.notes = notes.trim();
      if (lansstyrelseId.trim()) payload.lansstyrelse_id = lansstyrelseId.trim();
      if (fastighetsbeteckning.trim()) payload.fastighetsbeteckning = fastighetsbeteckning.trim();
      if (latitude !== '' && !isNaN(Number(latitude))) payload.latitude = Number(latitude);
      if (longitude !== '' && !isNaN(Number(longitude))) payload.longitude = Number(longitude);
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const L: CSSProperties = { display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#e8dcc8' };
  const I: CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #3a3835', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
  const F: CSSProperties = { marginBottom: 14 };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#232321', border: '1px solid #3a3835', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
      {error ? <div style={{ color: '#c45a4a', marginBottom: 12, fontSize: 14 }}>{error}</div> : null}

      <div style={F}>
        <label style={L}>{lang === 'en' ? 'Name *' : 'Namn *'}</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} style={I} placeholder={lang === 'en' ? 'Location name' : 'Platsnamn'} />
      </div>

      <div style={F}>
        <label style={L}>{lang === 'en' ? 'Type' : 'Typ'}</label>
        <select value={locationType} onChange={(e) => setLocationType(e.target.value as LocationType)} style={I}>
          <option value="other">{lang === 'en' ? 'Other' : 'Annan'}</option>
          <option value="shooting_range">{lang === 'en' ? 'Shooting Range' : 'Skjutbana'}</option>
          <option value="hunting_ground">{lang === 'en' ? 'Hunting Ground' : 'Jaktmark'}</option>
          <option value="home">{lang === 'en' ? 'Home' : 'Hem'}</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <div style={F}>
          <label style={L}>{lang === 'en' ? 'Latitude (WGS84)' : 'Latitud (WGS84)'}</label>
          <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} style={I} placeholder="59.334591" />
        </div>
        <div style={F}>
          <label style={L}>{lang === 'en' ? 'Longitude (WGS84)' : 'Longitud (WGS84)'}</label>
          <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} style={I} placeholder="18.063240" />
        </div>
      </div>

      <div style={F}>
        <label style={L}>{lang === 'en' ? 'Address' : 'Adress'}</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} style={I} placeholder={lang === 'en' ? 'Street address or description' : 'Gatuadress eller beskrivning'} />
      </div>

      <div style={F}>
        <label style={L}>{lang === 'en' ? 'City' : 'Ort'}</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} style={I} placeholder={lang === 'en' ? 'e.g. Stockholm' : 'ex. Stockholm'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <div style={F}>
          <label style={L}>{lang === 'en' ? 'County (Län)' : 'Län'}</label>
          <input value={county} onChange={(e) => setCounty(e.target.value)} style={I} placeholder={lang === 'en' ? 'e.g. Stockholm' : 'ex. Stockholm'} />
        </div>
        <div style={F}>
          <label style={L}>{lang === 'en' ? 'Country' : 'Land'}</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} style={I} placeholder="SE" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <div style={F}>
          <label style={L}>{lang === 'en' ? 'County board ID' : 'Länsstyrelsens ID'}</label>
          <input value={lansstyrelseId} onChange={(e) => setLansstyrelseId(e.target.value)} style={I} placeholder={lang === 'en' ? 'e.g. 01-234-5678' : 'ex. 01-234-5678'} />
        </div>
        <div style={F}>
          <label style={L}>{lang === 'en' ? 'Property designation' : 'Fastighetsbeteckning'}</label>
          <input value={fastighetsbeteckning} onChange={(e) => setFastighetsbeteckning(e.target.value)} style={I} placeholder={lang === 'en' ? 'e.g. Berga 1:23' : 'ex. Berga 1:23'} />
        </div>
      </div>

      <div style={F}>
        <label style={L}>{lang === 'en' ? 'Notes' : 'Anteckningar'}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...I, resize: 'vertical' }} placeholder={lang === 'en' ? 'Directions, terrain info, etc.' : 'Vägbeskrivning, terränginfo, etc.'} />
      </div>

      <LocationMap
        lat={latitude !== '' && !isNaN(Number(latitude)) ? Number(latitude) : null}
        lng={longitude !== '' && !isNaN(Number(longitude)) ? Number(longitude) : null}
        lang={lang}
        editMode={true}
        onCoordChange={(pLat, pLng) => {
          if (pLat != null && pLng != null) {
            setLatitude(String(pLat.toFixed(6)));
            setLongitude(String(pLng.toFixed(6)));
          } else {
            setLatitude('');
            setLongitude('');
          }
        }}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={submitting} className="btn-save">
          {submitting ? (lang === 'en' ? 'Saving...' : 'Sparar...') : (lang === 'en' ? 'Save' : 'Spara')}
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel">
          {lang === 'en' ? 'Cancel' : 'Avbryt'}
        </button>
      </div>
    </form>
  );
}
