/**
 * BadgeCard — Älgskyttemärket + Vildsvinspasset + Björnpasset cards for the Overview page.
 * Three-column layout on desktop, stacked on mobile (auto-fit grid).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../data/useData';

// ── Älgskyttemärket scoring ────────────────────────────────────────────────────
const _BPTS: Record<string, number> = {'5^1':5,'5':5,'4':4,'3':3,'T':0,'O':0,'X':0};
function _bPts(shots: (string|null)[]): number { return shots.reduce((s,v)=>s+(v?(_BPTS[v]??0):0),0); }
function _bApproved(shots: (string|null)[]): boolean { return shots.every(s=>s!==null&&s!=='O'&&s!=='X'); }
function _bComplete(shots: (string|null)[]): boolean { return shots.every(s=>s!==null); }

interface _BQ { sid:string; sessId:string; dt:Date; pts:number; approved:boolean; }
interface _BResult { awards:{badge:string;dt:Date;qualIds:string[]}[]; prog:{bn:number;sv:number;gd:number}; }

function _computeBY(sessions:any[], year:number): _BResult {
  const all:_BQ[]=[];
  for(const s of sessions){
    if(s.type!=='moose_range') continue;
    if(new Date(s.timestampStart).getFullYear()!==year) continue;
    for(const sr of (s.series??[])){
      if(!_bComplete(sr.shots)) continue;
      all.push({sid:sr.id,sessId:s.id,dt:new Date(s.timestampStart),pts:_bPts(sr.shots),approved:_bApproved(sr.shots)});
    }
  }
  const sorted=[...all].sort((a,b)=>b.pts-a.pts||a.dt.getTime()-b.dt.getTime());
  const bQ=sorted.filter(s=>s.approved);
  const sQ=sorted.filter(s=>s.approved&&s.pts>=14);
  const gQ=sorted.filter(s=>s.pts>=17);
  const awards:{badge:string;dt:Date;qualIds:string[]}[]=[];
  const mk=(badge:string,cands:_BQ[],n:number)=>{
    const q=cands.slice(0,n);
    const d=q.reduce((m,s)=>s.dt>m?s.dt:m,q[0].dt);
    awards.push({badge,dt:d,qualIds:q.map(s=>s.sid)});
  };
  if(bQ.length>=3) mk('alg_brons',bQ,3);
  if(sQ.length>=3) mk('alg_silver',sQ,3);
  if(gQ.length>=4) mk('alg_guld',gQ,4);
  return {awards,prog:{bn:bQ.length,sv:sQ.length,gd:gQ.length}};
}

// ── Vildsvinspasset scoring ────────────────────────────────────────────────────
type WBRound2 = { momentActive:[boolean,boolean,boolean]; shots:(boolean|null)[]; };
function _wbMomentApproved(r: WBRound2, m: number): boolean {
  if(!r.momentActive[m]) return false;
  const b=m*4;
  return r.shots[b]===true&&r.shots[b+1]===true&&r.shots[b+2]===true&&r.shots[b+3]===true;
}
function _wbSessionPassed(rounds: WBRound2[]): boolean {
  return [0,1,2].every(m=>rounds.some(r=>_wbMomentApproved(r,m)));
}
function _computeWBYear(sessions: any[], calYear: number): {passed:boolean; passDate:Date|null} {
  let passDate: Date|null = null;
  for(const s of sessions){
    if(s.type!=='wild_boar_test') continue;
    if(new Date(s.timestampStart).getFullYear()!==calYear) continue;
    if(!Array.isArray(s.rounds)||s.rounds.length===0) continue;
    if(_wbSessionPassed(s.rounds as WBRound2[])){
      const d=new Date(s.timestampStart);
      if(!passDate||d>passDate) passDate=d;
    }
  }
  return {passed:passDate!==null, passDate};
}

// ── Björnpasset scoring ────────────────────────────────────────────────────────
type BTRound3 = { shots:(boolean|null)[]; };
const _BT_BASES3=[0,4,8];
const _BT_SIZES3=[4,4,3];
function _btMomentOk3(r: BTRound3, m: number): boolean {
  const base=_BT_BASES3[m]??0; const size=_BT_SIZES3[m]??0;
  for(let i=0;i<size;i++){if(r.shots[base+i]!==true)return false;}
  return true;
}
function _btPassed3(rounds: BTRound3[]): boolean {
  return [0,1,2].every(m=>rounds.some(r=>_btMomentOk3(r,m)));
}
function _computeBearYear(sessions: any[], calYear: number): {passed:boolean; passDate:Date|null} {
  let passDate: Date|null = null;
  for(const s of sessions){
    if(s.type!=='bear_test') continue;
    if(new Date(s.timestampStart).getFullYear()!==calYear) continue;
    if(!Array.isArray(s.btRounds)||s.btRounds.length===0) continue;
    if(_btPassed3(s.btRounds as BTRound3[])){
      const d=new Date(s.timestampStart);
      if(!passDate||d>passDate) passDate=d;
    }
  }
  return {passed:passDate!==null, passDate};
}

interface BadgeCardProps { onShowHistory: () => void; }

export function BadgeCard({ onShowHistory }: BadgeCardProps) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const isEn = lang === 'en';
  const { data } = useData();

  const today = new Date();
  const curYear = today.getFullYear();
  const isTransition = today.getMonth() < 6;
  const activeYear = isTransition ? curYear - 1 : curYear;
  const progYear = curYear;

  const activeResult = useMemo(()=>_computeBY(data.sessions,activeYear),[data.sessions,activeYear]);
  const progResult   = useMemo(()=>_computeBY(data.sessions,progYear),[data.sessions,progYear]);

  const wbActive = useMemo(()=>_computeWBYear(data.sessions,activeYear),[data.sessions,activeYear]);
  const wbProg   = useMemo(()=>_computeWBYear(data.sessions,progYear),[data.sessions,progYear]);

  const bearRes  = useMemo(()=>_computeBearYear(data.sessions,curYear),[data.sessions,curYear]);

  const fmtShort = (d:Date) => d.toLocaleDateString(isEn?'en-SE':'sv-SE',{day:'numeric',month:'short',year:'numeric'});

  const BADGE_ORDER = ['alg_brons','alg_silver','alg_guld'];
  const hasMooseSessions = data.sessions.some((s:any)=>s.type==='moose_range'&&new Date(s.timestampStart).getFullYear()===progYear);

  const cardStyle: React.CSSProperties = {
    border:'1px solid #3a3835', borderRadius:10, padding:'14px 16px', background:'#2a2926',
    minWidth:0,
  };

  const BRow = ({badge,result,year}:{badge:string;result:_BResult;year:number}) => {
    const award = result.awards.find(a=>a.badge===badge);
    const {prog} = result;
    const count = badge==='alg_guld'?prog.gd:badge==='alg_silver'?prog.sv:prog.bn;
    const target = badge==='alg_guld'?4:3;
    const reqPts = badge==='alg_guld'?17:badge==='alg_silver'?14:null;
    const name  = badge==='alg_guld'?(isEn?'Gold':'Guld'):badge==='alg_silver'?'Silver':(isEn?'Bronze':'Brons');
    const shieldColor = badge==='alg_guld'?'#b8860b':badge==='alg_silver'?'#8a8a8a':'#8b4513';
    const shieldText = badge==='alg_guld'?'#1a1a18':badge==='alg_silver'?'#1a1a18':'#e8dcc8';
    const shieldLetter = badge==='alg_guld'?'G':badge==='alg_silver'?'S':'B';
    const vu = new Date(year+1,5,30);
    const valid = today<=vu;
    return (
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid #3a3835'}}>
        <svg width="22" height="26" viewBox="0 0 22 26" style={{flexShrink:0}}>
          <path d="M11 1L2 5v8c0 6.5 4 10 9 12 5-2 9-5.5 9-12V5L11 1z" fill={shieldColor} stroke={shieldColor} strokeWidth="0.5"/>
          <text x="11" y="17" textAnchor="middle" fill={shieldText} fontSize="11" fontWeight="700" fontFamily="Inter,sans-serif">{shieldLetter}</text>
        </svg>
        <span style={{fontWeight:600,fontSize:13,color:'#e8dcc8',minWidth:46,flexShrink:0}}>{name}</span>
        {award ? (
          <span style={{fontSize:12,color:valid?'#6b8f5e':'#a89a84',flex:1}}>
            ✅ {isEn?'Qualified ':'Kvalat '}{fmtShort(award.dt)}
          </span>
        ) : count>0 ? (
          <span style={{fontSize:12,color:'#a89a84',flex:1}}>
            ⏳ {count}/{target} {reqPts?(isEn?`series ≥${reqPts}p`:`serier ≥${reqPts}p`):(isEn?'approved series':'godk. serier')}
          </span>
        ) : (
          <span style={{fontSize:12,color:'#6b5e52',flex:1}}>
            ○ 0/{target} {reqPts?(isEn?`series ≥${reqPts}p`:`serier ≥${reqPts}p`):(isEn?'approved series':'godk. serier')}
          </span>
        )}
      </div>
    );
  };

  const WBCard = () => {
    const wbRes = isTransition ? wbActive : wbProg;
    const passYear = isTransition ? activeYear : progYear;
    const vu = new Date(passYear+1,5,30);
    const valid = today<=vu;
    return (
      <div style={cardStyle}>
        <div style={{fontWeight:700,fontSize:14,color:'#c8965a',marginBottom:10}}>
          {isEn?'Wild Boar Test':'Vildsvinspasset'}
        </div>
        {wbRes.passed ? (
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid #3a3835'}}>
              <svg width="22" height="22" viewBox="0 0 22 22" style={{flexShrink:0}}><circle cx="11" cy="11" r="8" fill="none" stroke="#c8965a" strokeWidth="1.5"/><circle cx="11" cy="11" r="4" fill="none" stroke="#c8965a" strokeWidth="1"/><circle cx="11" cy="11" r="1.5" fill="#c8965a"/><line x1="11" y1="1" x2="11" y2="5" stroke="#c8965a" strokeWidth="1"/><line x1="11" y1="17" x2="11" y2="21" stroke="#c8965a" strokeWidth="1"/><line x1="1" y1="11" x2="5" y2="11" stroke="#c8965a" strokeWidth="1"/><line x1="17" y1="11" x2="21" y2="11" stroke="#c8965a" strokeWidth="1"/></svg>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:valid?'#155724':'#888',fontWeight:600}}>
                  ✅ {isEn?'Passed ':'Godkänt '}{wbRes.passDate?fmtShort(wbRes.passDate):''}
                </div>
                <div style={{fontSize:11,color:'#888',marginTop:2}}>
                  {isEn?`Valid until 30 Jun ${passYear+1}`:`Gäller t.o.m. 30 jun ${passYear+1}`}
                </div>
              </div>
            </div>
            {isTransition && wbProg.passed && (
              <div style={{fontSize:12,color:'#155724',marginTop:6}}>
                ✅ {isEn?`Also passed in ${progYear}`:`Godkänt även ${progYear}`}
              </div>
            )}
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0'}}>
            <svg width="22" height="22" viewBox="0 0 22 22" style={{flexShrink:0}}><circle cx="11" cy="11" r="8" fill="none" stroke="#c8965a" strokeWidth="1.5"/><circle cx="11" cy="11" r="4" fill="none" stroke="#c8965a" strokeWidth="1"/><circle cx="11" cy="11" r="1.5" fill="#c8965a"/><line x1="11" y1="1" x2="11" y2="5" stroke="#c8965a" strokeWidth="1"/><line x1="11" y1="17" x2="11" y2="21" stroke="#c8965a" strokeWidth="1"/><line x1="1" y1="11" x2="5" y2="11" stroke="#c8965a" strokeWidth="1"/><line x1="17" y1="11" x2="21" y2="11" stroke="#c8965a" strokeWidth="1"/></svg>
            <span style={{fontSize:12,color:'#888',flex:1}}>
              ○ {isEn?`Not attempted in ${passYear}`:`Ej avlagt ${passYear}`}
            </span>
          </div>
        )}
        <div style={{textAlign:'right',marginTop:8}}>
          <button onClick={onShowHistory} style={{fontSize:12,color:'#c8965a',background:'none',border:'none',cursor:'pointer',padding:0,minHeight:0}}>
            {isEn?'Show history →':'Visa historik →'}
          </button>
        </div>
      </div>
    );
  };

  const BearCard = () => {
    const bearDecEnd = new Date(curYear,11,31,23,59,59);
    const bearValid = today<=bearDecEnd;
    return (
      <div style={cardStyle}>
        <div style={{fontWeight:700,fontSize:14,color:'#c8965a',marginBottom:10}}>
          {isEn?'Bear Test':'Björnpasset'}
        </div>
        {bearRes.passed ? (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid #3a3835'}}>
            <svg width="22" height="22" viewBox="0 0 22 22" style={{flexShrink:0}}><ellipse cx="11" cy="14" rx="5" ry="4" fill="#c8965a"/><circle cx="6" cy="7" r="2.5" fill="#c8965a"/><circle cx="11" cy="5" r="2.5" fill="#c8965a"/><circle cx="16" cy="7" r="2.5" fill="#c8965a"/></svg>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:bearValid?'#155724':'#888',fontWeight:600}}>
                ✅ {isEn?'Passed ':'Godkänt '}{bearRes.passDate?fmtShort(bearRes.passDate):''}
              </div>
              <div style={{fontSize:11,color:'#888',marginTop:2}}>
                {isEn?`Valid until 31 Dec ${curYear}`:`Gäller t.o.m. 31 dec ${curYear}`}
              </div>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0'}}>
            <svg width="22" height="22" viewBox="0 0 22 22" style={{flexShrink:0}}><ellipse cx="11" cy="14" rx="5" ry="4" fill="#c8965a"/><circle cx="6" cy="7" r="2.5" fill="#c8965a"/><circle cx="11" cy="5" r="2.5" fill="#c8965a"/><circle cx="16" cy="7" r="2.5" fill="#c8965a"/></svg>
            <span style={{fontSize:12,color:'#888',flex:1}}>
              ○ {isEn?`Not attempted in ${curYear}`:`Ej avlagt ${curYear}`}
            </span>
          </div>
        )}
        <div style={{textAlign:'right',marginTop:8}}>
          <button onClick={onShowHistory} style={{fontSize:12,color:'#c8965a',background:'none',border:'none',cursor:'pointer',padding:0,minHeight:0}}>
            {isEn?'Show history →':'Visa historik →'}
          </button>
        </div>
      </div>
    );
  };

  const MooseCard = () => {
    if (!hasMooseSessions && !isTransition) {
      return (
        <div style={cardStyle}>
          <div style={{fontWeight:700,fontSize:14,color:'#c8965a',marginBottom:8}}>
            Älgskyttemärket
          </div>
          <p style={{fontSize:13,color:'#a89a84',margin:0}}>
            {isEn?`No moose range sessions in ${curYear} yet.`:`Inga serier skjutna under ${curYear} ännu.`}
          </p>
        </div>
      );
    }
    return (
      <div style={cardStyle}>
        <div style={{fontWeight:700,fontSize:14,color:'#c8965a',marginBottom:10}}>
          Älgskyttemärket
        </div>
        {isTransition ? (
          <>
            {activeResult.awards.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:600,color:'#a89a84',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>
                  {isEn?`Active ${activeYear}/${activeYear+1}`:`Aktivt ${activeYear}/${activeYear+1}`}
                  <span style={{fontWeight:400,marginLeft:4,textTransform:'none',letterSpacing:0}}>(t.o.m. 30 jun {activeYear+1})</span>
                </div>
                {BADGE_ORDER.filter(b=>activeResult.awards.some(a=>a.badge===b)).map(badge=>(
                  <BRow key={badge} badge={badge} result={activeResult} year={activeYear} />
                ))}
              </div>
            )}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#a89a84',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>
                {isEn?`Progress ${progYear}/${progYear+1}`:`Progression ${progYear}/${progYear+1}`}
              </div>
              {BADGE_ORDER.map(badge=>(
                <BRow key={badge} badge={badge} result={progResult} year={progYear} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:11,color:'#a89a84',marginBottom:6}}>
              {isEn?`Hunting year ${curYear}/${curYear+1}`:`Jaktår ${curYear}/${curYear+1}`}
            </div>
            {BADGE_ORDER.map(badge=>(
              <BRow key={badge} badge={badge} result={activeResult} year={curYear} />
            ))}
          </>
        )}
        <div style={{textAlign:'right',marginTop:8}}>
          <button onClick={onShowHistory} style={{fontSize:12,color:'#c8965a',background:'none',border:'none',cursor:'pointer',padding:0,minHeight:0}}>
            {isEn?'Show history →':'Visa historik →'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',
      gap:12,
    }}>
      <MooseCard />
      <WBCard />
      <BearCard />
    </div>
  );
}
