/**
 * Dashboard (Overview) — with Recharts diagrams restored.
 * Priority: 1) Summary stats  2) Badge cards  3) Recent sessions  4) Charts
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/useData';
import { useAuth } from '../auth/useAuth';
import { BadgeCard } from '../components/BadgeCard';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export function Dashboard() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'sv';
  const isEn = lang === 'en';
  const { data, isLoading } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const curYear = today.getFullYear();
  const huntYear = today.getMonth() >= 6 ? curYear : curYear - 1;
  const huntLabel = `${huntYear}/${huntYear+1}`;

  const recentSessions = useMemo(()=>(
    [...data.sessions]
      .sort((a,b)=>new Date((b as any).timestampStart).getTime()-new Date((a as any).timestampStart).getTime())
      .slice(0,5)
  ),[data.sessions]);

  const huntYearStats = useMemo(()=>{
    const start = new Date(huntYear,6,1);
    const end   = new Date(huntYear+1,5,30,23,59,59);
    const ys = data.sessions.filter((s:any)=>{
      const d=new Date(s.timestampStart); return d>=start&&d<=end;
    });
    return {
      total:ys.length,
      shooting:ys.filter((s:any)=>s.type==='shooting').length,
      hunt:ys.filter((s:any)=>s.type==='hunt').length,
      mooseRange:ys.filter((s:any)=>s.type==='moose_range').length,
      training:ys.filter((s:any)=>s.type==='training').length,
    };
  },[data.sessions,huntYear]);

  /* ── Chart data ── */
  const chartData = useMemo(()=>{
    const sorted = [...data.sessions]
      .map((s:any)=>({...s, _d: new Date(s.timestampStart)}))
      .filter((s:any)=>!isNaN(s._d.getTime()))
      .sort((a:any,b:any)=>a._d.getTime()-b._d.getTime());
    if(sorted.length===0) return [];
    const first = sorted[0]._d;
    const last  = sorted[sorted.length-1]._d;
    const buckets: {start:Date;end:Date;sessions:number;shots:number}[] = [];
    let cur = new Date(first.getFullYear(), first.getMonth(), first.getDate() < 15 ? 1 : 15);
    while(cur <= last || buckets.length === 0){
      const next = new Date(cur);
      if(cur.getDate()===1){ next.setDate(15); } else { next.setMonth(next.getMonth()+1); next.setDate(1); }
      buckets.push({start:new Date(cur),end:new Date(next),sessions:0,shots:0});
      cur = next;
    }
    sorted.forEach((s:any)=>{
      const d = s._d;
      const b = buckets.find(b=>d>=b.start&&d<b.end) ?? buckets[buckets.length-1];
      b.sessions += 1;
      if(typeof s.shotsFired==='number'){
        b.shots += s.shotsFired;
      } else if(s.type==='moose_range'&&Array.isArray(s.series)){
        b.shots += s.series.reduce((sum:number,ser:any)=>(sum+(Array.isArray(ser.shots)?ser.shots.length:0)),0);
      } else if(s.type==='wild_boar_test'&&Array.isArray(s.rounds)){
        b.shots += s.rounds.reduce((sum:number,r:any)=>(sum+((r.momentActive??[]).filter(Boolean).length*4)),0);
      } else if(s.type==='bear_test'&&Array.isArray(s.btRounds)){
        b.shots += s.btRounds.length * 11;
      }
    });
    const fmt = (d:Date)=>d.toLocaleDateString(isEn?'en-SE':'sv-SE',{month:'short',day:'numeric'});
    return buckets.map(b=>({label:fmt(b.start),sessions:b.sessions,shots:b.shots}));
  },[data.sessions,isEn]);

  const userName = ((user as any)?.name??'').split(' ')[0];
  const greeting = isEn
    ? `Hi${userName?' '+userName:''}. Hunting year ${huntLabel}.`
    : `Hej${userName?' '+userName:''}. Jaktår ${huntLabel}.`;

  const fmtDate = (iso:string) => new Date(iso).toLocaleDateString(isEn?'en-SE':'sv-SE',{day:'numeric',month:'short',year:'numeric'});

  const typeLabel = (type:string) => {
    const m:Record<string,[string,string]>={
      shooting:['Skytte','Shooting'],hunt:['Jakt','Hunt'],
      moose_range:['Älgbana','Moose range'],training:['Utbildning','Training'],
      maintenance:['Underhåll','Maintenance'],
      wild_boar_test:['Vildsvinspasset','Wild Boar Test'],
      bear_test:['Björnpasset','Bear Test'],
    };
    return (m[type]??[type,type])[isEn?1:0];
  };

  if(isLoading) return <p style={{padding:24}}>{isEn?'Loading…':'Laddar…'}</p>;

  return (
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <p style={{color:'#a89a84',fontSize:15,marginBottom:20}}>{greeting}</p>

      {/* Summary stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10,marginBottom:24}}>
        {[
          {label:isEn?'Sessions':'Aktiviteter',value:huntYearStats.total},
          {label:isEn?'Shooting':'Skytte',value:huntYearStats.shooting},
          {label:isEn?'Hunt':'Jakt',value:huntYearStats.hunt},
          {label:isEn?'Moose range':'Älgbana',value:huntYearStats.mooseRange},
        ].map(stat=>(
          <div key={stat.label} style={{background:'#2a2926',border:'1px solid #3a3835',borderRadius:10,padding:'14px 12px',textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:700,color:'#c8965a'}}>{stat.value}</div>
            <div style={{fontSize:12,color:'#a89a84',marginTop:2}}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Badge cards (two-column: Älgskyttemärket + Vildsvinspasset) */}
      <div style={{marginBottom:24}}>
        <BadgeCard onShowHistory={()=>navigate('/badges')} />
      </div>

      {/* Recent sessions */}
      <div style={{background:'#2a2926',border:'1px solid #3a3835',borderRadius:10,padding:'16px 18px',marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{margin:0,fontSize:16,fontWeight:700,color:'#c8965a'}}>
            {isEn?'Recent sessions':'Senaste pass'}
          </h2>
          <button onClick={()=>navigate('/sessions')} style={{fontSize:13,color:'#c8965a',background:'none',border:'none',cursor:'pointer',padding:'4px 0',minHeight:0}}>
            {isEn?'All sessions →':'Alla pass →'}
          </button>
        </div>
        {recentSessions.length===0 ? (
          <p style={{color:'#a89a84',fontSize:14}}>{isEn?'No sessions logged yet.':'Inga pass loggade än.'}</p>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {recentSessions.map((s:any)=>(
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#232321',border:'1px solid #3a3835',borderRadius:8,flexWrap:'wrap'}}>
                <span style={{fontSize:13,color:'#a89a84',minWidth:80,flexShrink:0}}>{fmtDate(s.timestampStart)}</span>
                <span style={{fontSize:12,background:'rgba(200,150,90,0.15)',color:'#c8965a',padding:'2px 9px',borderRadius:12,fontWeight:500,flexShrink:0}}>{typeLabel(s.type)}</span>
                {s.type==='moose_range'&&(
                  typeof s.shotsFired==='number'
                    ? <span style={{fontSize:12,color:'#a89a84',flexShrink:0}}>{s.shotsFired} {isEn?'shots':'skott'}</span>
                    : (s.series?.length??0)>0&&<span style={{fontSize:12,color:'#a89a84',flexShrink:0}}>{s.series.length} {isEn?'series':'serier'}</span>
                )}
                {s.type==='wild_boar_test'&&Array.isArray(s.rounds)&&s.rounds.length>0&&(
                  <span style={{fontSize:12,color:'#a89a84',flexShrink:0}}>
                    {s.rounds.length} {isEn?'rounds':'omgångar'}
                  </span>
                )}
                {s.type==='bear_test'&&Array.isArray(s.btRounds)&&s.btRounds.length>0&&(
                  <span style={{fontSize:12,color:'#a89a84',flexShrink:0}}>
                    {s.btRounds.length} {isEn?'rounds':'omgångar'}
                  </span>
                )}
                {s.notes&&<span style={{fontSize:12,color:'#6b5e52',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16}}>
          <div style={{background:'#2a2926',border:'1px solid #3a3835',borderRadius:10,padding:'16px 18px'}}>
            <h2 style={{margin:'0 0 12px',fontSize:16,fontWeight:700,color:'#c8965a'}}>
              {isEn?'Sessions over time':'Aktiviteter över tid'}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{top:5,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3835" />
                <XAxis dataKey="label" fontSize={11} tick={{fill:'#a89a84'}} tickLine={false} />
                <YAxis fontSize={11} tick={{fill:'#a89a84'}} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{borderRadius:8,border:'1px solid #3a3835',fontSize:13,background:'#2a2926',color:'#e8dcc8'}} />
                <Line type="monotone" dataKey="sessions" name={isEn?'Sessions':'Aktiviteter'} stroke="#3d4f2f" strokeWidth={2} dot={{fill:'#fff',stroke:'#3d4f2f',strokeWidth:2,r:4}} activeDot={{r:6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:'#2a2926',border:'1px solid #3a3835',borderRadius:10,padding:'16px 18px'}}>
            <h2 style={{margin:'0 0 12px',fontSize:16,fontWeight:700,color:'#c8965a'}}>
              {isEn?'Shots over time':'Skott över tid'}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{top:5,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3835" />
                <XAxis dataKey="label" fontSize={11} tick={{fill:'#a89a84'}} tickLine={false} />
                <YAxis fontSize={11} tick={{fill:'#a89a84'}} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{borderRadius:8,border:'1px solid #3a3835',fontSize:13,background:'#2a2926',color:'#e8dcc8'}} />
                <Bar dataKey="shots" name={isEn?'Shots':'Skott'} fill="#c8965a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
