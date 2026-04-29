/**
 * Badges page — Älgskyttemärket + Vildsvinspasset + Björnpasset.
 * Computes awards from moose_range, wild_boar_test and bear_test sessions client-side.
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/useData';

// ── Älgskyttemärket scoring ────────────────────────────────────────────────────
const _BPTS2: Record<string, number> = {'5^1':5,'5':5,'4':4,'3':3,'T':0,'O':0,'X':0};
function _bPts2(shots: (string|null)[]): number { return shots.reduce((s,v)=>s+(v?(_BPTS2[v]??0):0),0); }
function _bApproved2(shots: (string|null)[]): boolean { return shots.every(s=>s!==null&&s!=='O'&&s!=='X'); }
function _bComplete2(shots: (string|null)[]): boolean { return shots.every(s=>s!==null); }

interface _BQ2 { sid:string; sessId:string; dt:Date; pts:number; approved:boolean; }
interface _BAward { badge:string; dt:Date; qualIds:string[]; qualSeries:_BQ2[]; }
interface _BResult2 { awards:_BAward[]; prog:{bn:number;sv:number;gd:number}; allSeries:_BQ2[]; }

function _computeBY2(sessions:any[], year:number): _BResult2 {
  const all:_BQ2[]=[];
  for(const s of sessions){
    if(s.type!=='moose_range') continue;
    if(new Date(s.timestampStart).getFullYear()!==year) continue;
    for(const sr of (s.series??[])){
      if(!_bComplete2(sr.shots)) continue;
      all.push({sid:sr.id,sessId:s.id,dt:new Date(s.timestampStart),pts:_bPts2(sr.shots),approved:_bApproved2(sr.shots)});
    }
  }
  const sorted=[...all].sort((a,b)=>b.pts-a.pts||a.dt.getTime()-b.dt.getTime());
  const bQ=sorted.filter(s=>s.approved);
  const sQ=sorted.filter(s=>s.approved&&s.pts>=14);
  const gQ=sorted.filter(s=>s.pts>=17);
  const awards:_BAward[]=[];
  const mk=(badge:string,cands:_BQ2[],n:number)=>{
    const q=cands.slice(0,n);
    const d=q.reduce((m,s)=>s.dt>m?s.dt:m,q[0].dt);
    awards.push({badge,dt:d,qualIds:q.map(s=>s.sid),qualSeries:q});
  };
  if(bQ.length>=3) mk('alg_brons',bQ,3);
  if(sQ.length>=3) mk('alg_silver',sQ,3);
  if(gQ.length>=4) mk('alg_guld',gQ,4);
  return {awards,prog:{bn:bQ.length,sv:sQ.length,gd:gQ.length},allSeries:all};
}

// ── Vildsvinspasset scoring ────────────────────────────────────────────────────
type WBRoundBadge = { momentActive:[boolean,boolean,boolean]; shots:(boolean|null)[]; };
function _wbMomentOk(r: WBRoundBadge, m: number): boolean {
  if(!r.momentActive[m]) return false;
  const b=m*4;
  return r.shots[b]===true&&r.shots[b+1]===true&&r.shots[b+2]===true&&r.shots[b+3]===true;
}
function _wbPassed(rounds: WBRoundBadge[]): boolean {
  return [0,1,2].every(m=>rounds.some(r=>_wbMomentOk(r,m)));
}
interface WBYearResult { sessions:{id:string;dt:Date;passed:boolean}[]; firstPassDate:Date|null; }
function _computeWBYear2(sessions: any[], calYear: number): WBYearResult {
  const res: WBYearResult = { sessions:[], firstPassDate:null };
  for(const s of sessions){
    if(s.type!=='wild_boar_test') continue;
    if(new Date(s.timestampStart).getFullYear()!==calYear) continue;
    const passed = Array.isArray(s.rounds)&&s.rounds.length>0&&_wbPassed(s.rounds as WBRoundBadge[]);
    const dt = new Date(s.timestampStart);
    res.sessions.push({id:s.id,dt,passed});
    if(passed && (!res.firstPassDate || dt < res.firstPassDate)) res.firstPassDate = dt;
  }
  return res;
}

// ── Björnpasset scoring ────────────────────────────────────────────────────────
type BTRoundBadge = { shots:(boolean|null)[]; };
const _BT_BASES2=[0,4,8];
const _BT_SIZES2=[4,4,3];
function _btMomentOk2(r: BTRoundBadge, m: number): boolean {
  const base=_BT_BASES2[m]??0; const size=_BT_SIZES2[m]??0;
  for(let i=0;i<size;i++){if(r.shots[base+i]!==true)return false;}
  return true;
}
function _btPassed2(rounds: BTRoundBadge[]): boolean {
  return [0,1,2].every(m=>rounds.some(r=>_btMomentOk2(r,m)));
}
interface BearYearResult { sessions:{id:string;dt:Date;passed:boolean}[]; firstPassDate:Date|null; }
function _computeBearYear2(sessions: any[], calYear: number): BearYearResult {
  const res: BearYearResult = { sessions:[], firstPassDate:null };
  for(const s of sessions){
    if(s.type!=='bear_test') continue;
    if(new Date(s.timestampStart).getFullYear()!==calYear) continue;
    const passed = Array.isArray(s.btRounds)&&s.btRounds.length>0&&_btPassed2(s.btRounds as BTRoundBadge[]);
    const dt = new Date(s.timestampStart);
    res.sessions.push({id:s.id,dt,passed});
    if(passed && (!res.firstPassDate || dt < res.firstPassDate)) res.firstPassDate = dt;
  }
  return res;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function _huntYearFromCalendar(y:number): string { return `${y}/${y+1}`; }
function _validUntil(y:number): Date { return new Date(y+1,5,30); }

export function Badges() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const isEn = lang === 'en';
  const { data } = useData();
  const navigate = useNavigate();

  const today = new Date();
  const curYear = today.getFullYear();

  // All calendar years with moose, wild_boar, or bear_test sessions
  const allBadgeYears = useMemo(()=>{
    const years = new Set<number>();
    for(const s of data.sessions){
      if(s.type==='moose_range'||s.type==='wild_boar_test'||s.type==='bear_test'){
        years.add(new Date((s as any).timestampStart).getFullYear());
      }
    }
    const arr = [...years].sort((a,b)=>b-a);
    if(arr.length===0||!arr.includes(curYear)) arr.unshift(curYear);
    return arr;
  },[data.sessions,curYear]);

  const [selectedYear, setSelectedYear] = useState<number>(curYear);
  const [calView, setCalView] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);

  const mooseResult = useMemo(()=>_computeBY2(data.sessions,selectedYear),[data.sessions,selectedYear]);
  const wbResult    = useMemo(()=>_computeWBYear2(data.sessions,selectedYear),[data.sessions,selectedYear]);
  const bearResult  = useMemo(()=>_computeBearYear2(data.sessions,selectedYear),[data.sessions,selectedYear]);

  const BADGE_ORDER = ['alg_guld','alg_silver','alg_brons'];

  const badgeShield = (b:string, size=26) => {
    const sc = b==='alg_guld'?'#b8860b':b==='alg_silver'?'#8a8a8a':'#8b4513';
    const st = b==='alg_guld'?'#1a1a18':b==='alg_silver'?'#1a1a18':'#e8dcc8';
    const sl = b==='alg_guld'?'G':b==='alg_silver'?'S':'B';
    return (<svg width={size} height={Math.round(size*1.18)} viewBox="0 0 22 26" style={{flexShrink:0}}><path d="M11 1L2 5v8c0 6.5 4 10 9 12 5-2 9-5.5 9-12V5L11 1z" fill={sc} stroke={sc} strokeWidth="0.5"/><text x="11" y="17" textAnchor="middle" fill={st} fontSize="11" fontWeight="700" fontFamily="Inter,sans-serif">{sl}</text></svg>);
  };
  const badgeName  = (b:string) => b==='alg_guld'?(isEn?'Gold':'Guld'):b==='alg_silver'?'Silver':(isEn?'Bronze':'Brons');

  const fmtDate = (d:Date) => d.toLocaleDateString(isEn?'en-SE':'sv-SE',{day:'numeric',month:'long',year:'numeric'});
  const fmtShort = (d:Date) => d.toLocaleDateString(isEn?'en-SE':'sv-SE',{day:'numeric',month:'short',year:'numeric'});

  const historyYears = useMemo(()=>{
    const years = new Set<number>();
    for(const s of data.sessions){
      if((s as any).type==='moose_range'||(s as any).type==='wild_boar_test'||(s as any).type==='bear_test'){
        years.add(new Date((s as any).timestampStart).getFullYear());
      }
    }
    return [...years].sort((a,b)=>b-a);
  },[data.sessions]);

  const heading = isEn ? 'Badges' : 'Märken';
  const cardStyle = {border:'1px solid #3a3835',borderRadius:10,padding:'16px 18px',background:'#2a2926',marginBottom:16};
  const vu = _validUntil(selectedYear);
  const wbValid = today<=vu;
  // Bear: calendar year validity
  const bearValid = today <= new Date(selectedYear,11,31,23,59,59);

  return (
    <div style={{maxWidth:720,margin:'0 auto'}}>
      <h1 style={{marginBottom:20}}>{heading}</h1>

      {/* Controls */}
      <div style={{display:'flex',gap:12,marginBottom:20,alignItems:'center',flexWrap:'wrap'}}>
        <select
          value={selectedYear}
          onChange={e=>setSelectedYear(Number(e.target.value))}
          style={{padding:'6px 12px',borderRadius:6,border:'1px solid #3a3835',background:'#2a2926',color:'#e8dcc8',fontSize:14}}
        >
          {allBadgeYears.map(y=>(
            <option key={y} value={y}>
              {calView?String(y):(isEn?`Hunting year ${y}/${y+1}`:`Jaktår ${y}/${y+1}`)}
            </option>
          ))}
        </select>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',userSelect:'none',whiteSpace:'nowrap',height:36,paddingRight:4}}>
          <input type="checkbox" checked={calView} onChange={e=>setCalView(e.target.checked)} style={{flexShrink:0}} />
          {isEn?'Calendar year':'Kalenderår'}
        </label>
      </div>

      {/* ── Älgskyttemärket ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{fontWeight:700,fontSize:15,color:'#c8965a',marginBottom:4}}>
          Älgskyttemärket
        </div>
        <div style={{fontSize:12,color:'#a89a84',marginBottom:14}}>
          {isEn?'Qualifying window: 1 Jan – 31 Dec ':'Kvalificeringsfönster: 1 jan – 31 dec '}{selectedYear}
          {' · '}
          {isEn?`Valid until 30 Jun ${selectedYear+1}`:`Gäller t.o.m. 30 jun ${selectedYear+1}`}
        </div>

        {BADGE_ORDER.map(badge=>{
          const award = mooseResult.awards.find(a=>a.badge===badge);
          const count = badge==='alg_guld'?mooseResult.prog.gd:badge==='alg_silver'?mooseResult.prog.sv:mooseResult.prog.bn;
          const target = badge==='alg_guld'?4:3;
          const reqPts = badge==='alg_guld'?17:badge==='alg_silver'?14:null;
          const valid = today<=vu;
          const key = `${selectedYear}-${badge}`;
          const isExpanded = expanded===key;

          return (
            <div key={badge} style={{borderBottom:'1px solid #3a3835'}}>
              <div
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',cursor:award?'pointer':'default'}}
                onClick={()=>award&&setExpanded(isExpanded?null:key)}
              >
                {badgeShield(badge, 26)}
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:'#e8dcc8'}}>
                    {badgeName(badge)}
                  </div>
                  {award ? (
                    <div style={{fontSize:12,color:valid?'#6b8f5e':'#a89a84',marginTop:2}}>
                      ✅ {isEn?'Qualified ':'Kvalat '}{fmtDate(award.dt)}
                      {' · '}
                      {isEn?`Valid until 30 Jun ${selectedYear+1}`:`Gäller t.o.m. 30 jun ${selectedYear+1}`}
                    </div>
                  ) : count>0 ? (
                    <div style={{fontSize:12,color:'#a89a84',marginTop:2}}>
                      ⏳ {count}/{target} {reqPts?(isEn?`approved series ≥${reqPts}p`:`godk. serier ≥${reqPts}p`):(isEn?'approved series':'godkända serier')}
                    </div>
                  ) : (
                    <div style={{fontSize:12,color:'#bbb',marginTop:2}}>
                      ○ 0/{target} {reqPts?(isEn?`series ≥${reqPts}p`:`serier ≥${reqPts}p`):(isEn?'approved series':'godkända serier')}
                    </div>
                  )}
                </div>
                {award&&<span style={{fontSize:11,color:'#999'}}>{isExpanded?'▲':'▼'}</span>}
              </div>

              {isExpanded&&award&&(
                <div style={{paddingBottom:10,paddingLeft:40}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#5a4a3a',marginBottom:6}}>
                    {isEn?'Qualifying series:':'Kvalificerande serier:'}
                  </div>
                  {award.qualSeries.map((qs,i)=>(
                    <div key={qs.sid} style={{display:'flex',alignItems:'center',gap:10,padding:'4px 0',borderBottom:'1px solid rgba(58,56,53,0.5)'}}>
                      <span style={{fontSize:12,color:'#888',minWidth:100}}>{fmtShort(qs.dt)}</span>
                      <span style={{fontSize:12,background:'#1a2e1a',color:'#c8965a',padding:'2px 8px',borderRadius:10,fontWeight:600}}>{qs.pts}p</span>
                      <span style={{fontSize:12,color:'#888'}}>{isEn?'Series':'Serie'} #{i+1}</span>
                      <button type="button" onClick={()=>navigate('/sessions')} style={{fontSize:11,color:'#4a6741',background:'none',border:'none',cursor:'pointer',padding:0,marginLeft:'auto',minHeight:0}}>
                        {isEn?'View session →':'Visa session →'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {mooseResult.allSeries.length===0&&(
          <p style={{color:'#888',fontSize:13,marginTop:12}}>
            {isEn?`No completed series in ${selectedYear}.`:`Inga genomförda serier under ${selectedYear}.`}
          </p>
        )}
      </div>

      {/* ── Vildsvinspasset ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{fontWeight:700,fontSize:15,color:'#c8965a',marginBottom:4}}>
          {isEn?'Wild Boar Shooting Test':'Vildsvinspasset'}
        </div>
        <div style={{fontSize:12,color:'#a89a84',marginBottom:14}}>
          {isEn?'Qualifying window: 1 Jan – 31 Dec ':'Kvalificeringsfönster: 1 jan – 31 dec '}{selectedYear}
          {' · '}
          {isEn?`Valid until 30 Jun ${selectedYear+1}`:`Gäller t.o.m. 30 jun ${selectedYear+1}`}
        </div>

        <div style={{borderBottom:'1px solid #3a3835'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0'}}>
            <svg width="26" height="26" viewBox="0 0 22 22" style={{flexShrink:0}}><circle cx="11" cy="11" r="8" fill="none" stroke="#c8965a" strokeWidth="1.5"/><circle cx="11" cy="11" r="4" fill="none" stroke="#c8965a" strokeWidth="1"/><circle cx="11" cy="11" r="1.5" fill="#c8965a"/><line x1="11" y1="1" x2="11" y2="5" stroke="#c8965a" strokeWidth="1"/><line x1="11" y1="17" x2="11" y2="21" stroke="#c8965a" strokeWidth="1"/><line x1="1" y1="11" x2="5" y2="11" stroke="#c8965a" strokeWidth="1"/><line x1="17" y1="11" x2="21" y2="11" stroke="#c8965a" strokeWidth="1"/></svg>
            <div style={{flex:1}}>
              {wbResult.firstPassDate ? (
                <>
                  <div style={{fontWeight:600,fontSize:14,color:'#e8dcc8'}}>
                    {isEn?'Wild Boar Test':'Vildsvinspasset'}
                  </div>
                  <div style={{fontSize:12,color:wbValid?'#155724':'#888',marginTop:2}}>
                    ✅ {isEn?'Passed ':'Godkänt '}{fmtDate(wbResult.firstPassDate)}
                    {' · '}
                    {isEn?`Valid until 30 Jun ${selectedYear+1}`:`Gäller t.o.m. 30 jun ${selectedYear+1}`}
                  </div>
                </>
              ) : (
                <>
                  <div style={{fontWeight:600,fontSize:14,color:'#e8dcc8'}}>
                    {isEn?'Wild Boar Test':'Vildsvinspasset'}
                  </div>
                  <div style={{fontSize:12,color:'#bbb',marginTop:2}}>
                    ○ {isEn?`No approved test in ${selectedYear}.`:`Inget godkänt pass under ${selectedYear}.`}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {wbResult.sessions.length===0&&(
          <p style={{color:'#888',fontSize:13,marginTop:12}}>
            {isEn?`No wild boar test sessions in ${selectedYear}.`:`Inga Vildsvinspasset-sessioner under ${selectedYear}.`}
          </p>
        )}
      </div>

      {/* ── Björnpasset ──────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{fontWeight:700,fontSize:15,color:'#c8965a',marginBottom:4}}>
          {isEn?'Bear Test':'Björnpasset'}
        </div>
        <div style={{fontSize:12,color:'#a89a84',marginBottom:14}}>
          {isEn?'Qualifying window: 1 Jan – 31 Dec ':'Kvalificeringsfönster: 1 jan – 31 dec '}{selectedYear}
          {' · '}
          {isEn?`Valid until 31 Dec ${selectedYear}`:`Gäller t.o.m. 31 dec ${selectedYear}`}
        </div>

        <div style={{borderBottom:'1px solid #3a3835'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0'}}>
            <svg width="26" height="26" viewBox="0 0 22 22" style={{flexShrink:0}}><ellipse cx="11" cy="14" rx="5" ry="4" fill="#c8965a"/><circle cx="6" cy="7" r="2.5" fill="#c8965a"/><circle cx="11" cy="5" r="2.5" fill="#c8965a"/><circle cx="16" cy="7" r="2.5" fill="#c8965a"/></svg>
            <div style={{flex:1}}>
              {bearResult.firstPassDate ? (
                <>
                  <div style={{fontWeight:600,fontSize:14,color:'#e8dcc8'}}>
                    {isEn?'Bear Test':'Björnpasset'}
                  </div>
                  <div style={{fontSize:12,color:bearValid?'#155724':'#888',marginTop:2}}>
                    ✅ {isEn?'Passed ':'Godkänt '}{fmtDate(bearResult.firstPassDate)}
                    {' · '}
                    {isEn?`Valid until 31 Dec ${selectedYear}`:`Gäller t.o.m. 31 dec ${selectedYear}`}
                  </div>
                </>
              ) : (
                <>
                  <div style={{fontWeight:600,fontSize:14,color:'#e8dcc8'}}>
                    {isEn?'Bear Test':'Björnpasset'}
                  </div>
                  <div style={{fontSize:12,color:'#bbb',marginTop:2}}>
                    ○ {isEn?`No approved bear test in ${selectedYear}.`:`Inget godkänt pass under ${selectedYear}.`}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {bearResult.sessions.length===0&&(
          <p style={{color:'#888',fontSize:13,marginTop:12}}>
            {isEn?`No bear test sessions in ${selectedYear}.`:`Inga Björnpasset-sessioner under ${selectedYear}.`}
          </p>
        )}
      </div>

      {/* History */}
      {historyYears.length>0&&(
        <div>
          <h2 style={{fontSize:15,fontWeight:700,color:'#1a2e1a',marginBottom:10}}>
            {isEn?'History':'Historik'}
          </h2>
          <div style={{border:'1px solid #3a3835',borderRadius:10,overflow:'hidden'}}>
            {historyYears.map((y,i)=>{
              const r = _computeBY2(data.sessions,y);
              const wb = _computeWBYear2(data.sessions,y);
              const bear = _computeBearYear2(data.sessions,y);
              const vu2 = _validUntil(y);
              const bearVu2 = new Date(y,11,31,23,59,59);
              const isActive = (today<=vu2&&(r.awards.length>0||wb.firstPassDate!==null))||(today<=bearVu2&&bear.firstPassDate!==null);
              return (
                <div
                  key={y}
                  style={{
                    display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                    background:i%2===0?'#2a2926':'#232321',
                    borderBottom:i<historyYears.length-1?'1px solid #3a3835':'none',
                    cursor:'pointer',
                  }}
                  onClick={()=>{setSelectedYear(y);window.scrollTo({top:0,behavior:'smooth'});}}
                >
                  <span style={{fontSize:13,color:'#5a4a3a',minWidth:80,fontWeight:600}}>
                    {calView?String(y):_huntYearFromCalendar(y)}
                  </span>
                  <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap',alignItems:'center'}}>
                    {['alg_guld','alg_silver','alg_brons'].filter(b=>r.awards.some(a=>a.badge===b)).map(b=>(
                      <span key={b}>{badgeShield(b, 20)}</span>
                    ))}
                    {wb.firstPassDate&&<svg width="16" height="16" viewBox="0 0 22 22" style={{verticalAlign:'middle'}}><circle cx="11" cy="11" r="8" fill="none" stroke="#c8965a" strokeWidth="1.5"/><circle cx="11" cy="11" r="4" fill="none" stroke="#c8965a" strokeWidth="1"/><circle cx="11" cy="11" r="1.5" fill="#c8965a"/><line x1="11" y1="1" x2="11" y2="5" stroke="#c8965a" strokeWidth="1"/><line x1="11" y1="17" x2="11" y2="21" stroke="#c8965a" strokeWidth="1"/><line x1="1" y1="11" x2="5" y2="11" stroke="#c8965a" strokeWidth="1"/><line x1="17" y1="11" x2="21" y2="11" stroke="#c8965a" strokeWidth="1"/></svg>}
                    {bear.firstPassDate&&<svg width="16" height="16" viewBox="0 0 22 22" style={{verticalAlign:'middle'}}><ellipse cx="11" cy="14" rx="5" ry="4" fill="#c8965a"/><circle cx="6" cy="7" r="2.5" fill="#c8965a"/><circle cx="11" cy="5" r="2.5" fill="#c8965a"/><circle cx="16" cy="7" r="2.5" fill="#c8965a"/></svg>}
                    {r.awards.length===0&&!wb.firstPassDate&&!bear.firstPassDate&&<span style={{fontSize:13,color:'#bbb'}}>{isEn?'No qualifications':'— Inga kvalificeringar'}</span>}
                    {isActive&&<span style={{fontSize:11,color:'#155724',background:'#d4edda',padding:'2px 8px',borderRadius:10,marginLeft:4}}>{isEn?'Active':'Aktivt'}</span>}
                  </div>
                  <span style={{fontSize:11,color:'#ccc'}}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
