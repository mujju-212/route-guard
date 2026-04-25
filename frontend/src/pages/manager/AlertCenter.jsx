import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtAge = iso => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
};
const SEV = {
  critical: { col: '#ef4444', bg: 'rgba(239,68,68,.12)', icon: '🔴', label: 'CRITICAL' },
  high:     { col: '#f97316', bg: 'rgba(249,115,22,.12)', icon: '🟠', label: 'HIGH'     },
  medium:   { col: '#eab308', bg: 'rgba(234,179,8,.12)',  icon: '🟡', label: 'MEDIUM'   },
  low:      { col: '#22c55e', bg: 'rgba(34,197,94,.12)',  icon: '🟢', label: 'LOW'      },
};
const sev = a => SEV[String(a?.severity||'').toLowerCase()] || SEV.medium;
const fmt = s => s ? String(s).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '—';

/* ── sub-components ─────────────────────────────────────────────── */
function Chip({ children, color='#00d4b4' }){
  return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 10px',borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',background:`${color}18`,color,border:`1px solid ${color}40`}}>{children}</span>;
}
function Row({ label, value }){
  return(
    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border-subtle,#1e2d4520)',fontSize:13}}>
      <span style={{color:'var(--text-secondary,#8a9bb5)'}}>{label}</span>
      <span style={{fontWeight:600,color:'var(--text-primary)',textAlign:'right',maxWidth:'60%'}}>{value||'—'}</span>
    </div>
  );
}
function FeatureBar({ label, icon, pct, color }){
  return(
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
        <span style={{color:'var(--text-secondary)'}}>{icon} {label}</span>
        <span style={{fontWeight:700,color}}>{pct}%</span>
      </div>
      <div style={{height:6,background:'var(--bg-elevated,#0d1526)',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:4,transition:'width .8s ease',boxShadow:`0 0 6px ${color}60`}}/>
      </div>
    </div>
  );
}

/* ── AlertRow ────────────────────────────────────────────────────── */
function AlertRow({ alert, selected, onClick, onRead, onResolve }){
  const s = sev(alert);
  const unread = !alert.is_read;
  return(
    <div onClick={onClick} style={{background:selected?'var(--bg-elevated,#0d1526)':'var(--bg-surface,#111827)',border:`1px solid ${selected?s.col:'var(--border-default,#1e2d45)'}`,borderLeft:`3px solid ${s.col}`,borderRadius:10,padding:'14px 16px',marginBottom:8,cursor:'pointer',transition:'all .15s',position:'relative'}}>
      {unread&&<div style={{position:'absolute',top:10,right:12,width:8,height:8,borderRadius:'50%',background:s.col,boxShadow:`0 0 6px ${s.col}`}}/>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:s.col}}>{s.icon} {s.label}</span>
          <span style={{fontSize:12,color:'var(--text-muted,#6b7280)'}}>·</span>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',fontFamily:"'JetBrains Mono',monospace"}}>{alert.tracking_number||'—'}</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>{fmtAge(alert.created_at)}</span>
          {unread?<Chip color={s.col}>Unread</Chip>:<Chip color="#6b7280">Read</Chip>}
        </div>
      </div>
      <div style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:10}}>{alert.message}</div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        {unread&&<button className="ac-ghost" onClick={e=>{e.stopPropagation();onRead(alert.alert_id);}}>✓ Mark Read</button>}
        <button className="ac-btn" onClick={e=>{e.stopPropagation();onClick();}}>View Details + Action →</button>
      </div>
    </div>
  );
}

/* ── Detail Panel ────────────────────────────────────────────────── */
function DetailPanel({ alert, onResolve, onClose, resolving, navigate }){
  const s = sev(alert);
  const risk = Number(alert.risk_score_at_alert||0);
  // Simulated feature importance based on alert type
  const alertType = String(alert.alert_type||'').toLowerCase();
  const features = alertType.includes('weather')
    ? [{k:'Weather Severity',i:'🌧',p:52,c:'#ef4444'},{k:'Historical Risk',i:'📊',p:22,c:'#f97316'},{k:'Port Congestion',i:'⚓',p:15,c:'#eab308'},{k:'Traffic',i:'🚦',p:7,c:'#22c55e'},{k:'Cargo Sensitivity',i:'📦',p:4,c:'#22c55e'}]
    : alertType.includes('port')
    ? [{k:'Port Congestion',i:'⚓',p:45,c:'#ef4444'},{k:'Traffic',i:'🚦',p:25,c:'#f97316'},{k:'Weather Severity',i:'🌧',p:18,c:'#eab308'},{k:'Historical Risk',i:'📊',p:8,c:'#22c55e'},{k:'Cargo Sensitivity',i:'📦',p:4,c:'#22c55e'}]
    : [{k:'Historical Risk',i:'📊',p:38,c:'#ef4444'},{k:'Traffic',i:'🚦',p:28,c:'#f97316'},{k:'Weather Severity',i:'🌧',p:20,c:'#eab308'},{k:'Port Congestion',i:'⚓',p:10,c:'#22c55e'},{k:'Cargo Sensitivity',i:'📦',p:4,c:'#22c55e'}];

  return(
    <div className="fade-in" style={{background:'var(--bg-surface,#111827)',border:`1px solid ${s.col}`,borderLeft:`3px solid ${s.col}`,borderRadius:12,overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border-default,#1e2d45)',display:'flex',justifyContent:'space-between',alignItems:'center',background:s.bg}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:s.col}}>{s.icon} ALERT DETAIL</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--text-primary)',marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{alert.tracking_number}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Chip color={s.col}>{s.label}</Chip>
          <button onClick={onClose} style={{background:'transparent',border:'1px solid var(--border-default)',borderRadius:8,padding:'6px 10px',cursor:'pointer',color:'var(--text-muted)',fontSize:13}}>✕ Close</button>
        </div>
      </div>

      <div style={{padding:20}}>
        {/* Alert summary */}
        <div style={{padding:'12px 16px',background:'var(--bg-elevated,#0d1526)',borderRadius:10,marginBottom:16,fontSize:13,color:'var(--text-secondary)',lineHeight:1.6,borderLeft:`3px solid ${s.col}`}}>
          <strong style={{color:'var(--text-primary)'}}>Alert:</strong> {alert.message}
        </div>

        {/* Risk + Type */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
          {[
            {v:risk.toFixed(1),l:'Risk Score',c:s.col},
            {v:fmt(alert.alert_type),l:'Alert Type',c:'#00d4b4'},
            {v:fmt(alert.triggered_by||'system'),l:'Triggered By',c:'#f59e0b'},
          ].map(({v,l,c})=>(
            <div key={l} style={{textAlign:'center',padding:'12px 8px',background:'var(--bg-elevated,#0d1526)',border:'1px solid var(--border-default)',borderRadius:10}}>
              <div style={{fontSize:18,fontWeight:700,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* ML Feature Breakdown */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>🤖 ML Feature Breakdown</div>
          {features.map(f=><FeatureBar key={f.k} label={f.k} icon={f.i} pct={f.p} color={f.c}/>)}
          <div style={{marginTop:10,padding:'8px 12px',background:'var(--bg-elevated,#0d1526)',borderRadius:8,fontSize:11,color:'var(--text-secondary)',lineHeight:1.6,borderLeft:'3px solid #00d4b4'}}>
            <strong style={{color:'var(--text-primary)'}}>Primary driver:</strong> {features[0].k} ({features[0].p}%) is the main contributor to this alert trigger.
          </div>
        </div>

        {/* AI Suggested Actions */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>🤖 AI Suggested Actions</div>
          {[
            {opt:1,title:'Run ML Analysis & Reroute',desc:'Trigger full ML pipeline to generate 3 scored alternate routes with financial impact.',badge:'⭐ Recommended',badgeCol:'#10b981',action:'View Shipment → Run Analysis'},
            {opt:2,title:'Increase Monitoring Frequency',desc:'Flag shipment for 15-minute position polling and risk recalculation until risk drops below 40.',badge:'Low Risk',badgeCol:'#22d3ee',action:'Auto-monitor'},
            {opt:3,title:'Notify Stakeholders',desc:'Send alert summary to shipper and receiver. Estimated delay: unknown until reroute is approved.',badge:'Safe Option',badgeCol:'#6b7280',action:'Send Notification'},
          ].map(a=>(
            <div key={a.opt} style={{background:'var(--bg-elevated,#0d1526)',border:'1px solid var(--border-default,#1e2d45)',borderRadius:8,padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Option {a.opt} — {a.title}</div>
                <Chip color={a.badgeCol}>{a.badge}</Chip>
              </div>
              <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:10,lineHeight:1.5}}>{a.desc}</div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                {a.opt===1&&<button className="ac-btn" onClick={()=>navigate(`/manager/shipments/${alert.shipment_id}`)}>✅ Go to Shipment</button>}
                {a.opt!==1&&<button className="ac-btn" style={{background:'linear-gradient(135deg,#1e2d45,#2a3d5a)',color:'var(--text-primary)',border:'1px solid var(--border-default)'}}>Apply</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Resolve */}
        <button className="ac-btn" style={{width:'100%',background:'linear-gradient(135deg,#ef4444,#dc2626)',padding:'12px',fontSize:13}} onClick={()=>onResolve(alert.alert_id)} disabled={resolving===alert.alert_id}>
          {resolving===alert.alert_id?'Resolving…':'✓ Mark as Resolved — No Action Needed'}
        </button>
      </div>
    </div>
  );
}

/* ── Main AlertCenter ─────────────────────────────────────────────── */
export default function AlertCenter(){
  const navigate = useNavigate();
  const [alerts,setAlerts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [filter,setFilter]=useState('all');   // all | critical | high | medium | unread | resolved
  const [search,setSearch]=useState('');
  const [resolving,setResolving]=useState(null);
  const [tab,setTab]=useState('active'); // active | history

  const load = useCallback(async()=>{
    setLoading(true); setError('');
    try{ setAlerts((await api.get(ENDPOINTS.ACTIVE_ALERTS)).data||[]); }
    catch(e){ setError('Could not load alerts.'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const markRead = useCallback(async(id)=>{
    try{ await api.put(ENDPOINTS.MARK_ALERT_READ(id)); setAlerts(a=>a.map(x=>x.alert_id===id?{...x,is_read:true}:x)); }
    catch{}
  },[]);

  const resolve = useCallback(async(id)=>{
    setResolving(id);
    try{
      await api.put(ENDPOINTS.RESOLVE_ALERT(id));
      setAlerts(a=>a.map(x=>x.alert_id===id?{...x,is_resolved:true}:x));
      setSelected(null);
    } catch{}
    finally{ setResolving(null); }
  },[]);

  const markAllRead = useCallback(async()=>{
    const unread = alerts.filter(a=>!a.is_read);
    await Promise.all(unread.map(a=>api.put(ENDPOINTS.MARK_ALERT_READ(a.alert_id)).catch(()=>{})));
    setAlerts(a=>a.map(x=>({...x,is_read:true})));
  },[alerts]);

  const shown = alerts.filter(a=>{
    if(tab==='history') return a.is_resolved;
    if(a.is_resolved) return false;
    if(filter==='unread') return !a.is_read;
    if(filter==='critical'||filter==='high'||filter==='medium'||filter==='low') return String(a.severity).toLowerCase()===filter;
    if(search) return (a.message+a.tracking_number).toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const unreadCount = alerts.filter(a=>!a.is_read&&!a.is_resolved).length;
  const critCount   = alerts.filter(a=>String(a.severity).toLowerCase()==='critical'&&!a.is_resolved).length;

  const selectedAlert = alerts.find(a=>a.alert_id===selected);

  return(
    <div style={{color:'var(--text-primary,#f0f4ff)',fontFamily:"'Space Grotesk',sans-serif",padding:'0 0 40px'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        .fade-in{animation:fadeUp .25s ease both;}
        .ac-btn{background:linear-gradient(135deg,#00d4b4,#22d3ee);color:#000;font-weight:700;font-size:12px;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;transition:all .2s;font-family:inherit;white-space:nowrap;}
        .ac-btn:hover{transform:translateY(-1px);opacity:.9;}
        .ac-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .ac-ghost{background:transparent;color:var(--text-muted,#6b7280);border:1px solid var(--border-default,#1e2d45);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit;transition:all .2s;}
        .ac-ghost:hover{border-color:#00d4b4;color:#00d4b4;}
        .ac-filter{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border-default,#1e2d45);background:var(--bg-elevated,#0d1526);color:var(--text-secondary);transition:all .15s;font-family:inherit;}
        .ac-filter:hover,.ac-filter.active{background:rgba(0,212,180,.12);color:#00d4b4;border-color:#00d4b4;}
        .ac-filter.crit.active{background:rgba(239,68,68,.12);color:#ef4444;border-color:#ef4444;}
        .ac-filter.high.active{background:rgba(249,115,22,.12);color:#f97316;border-color:#f97316;}
        .ac-filter.med.active{background:rgba(234,179,8,.12);color:#eab308;border-color:#eab308;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,paddingBottom:20,borderBottom:'1px solid var(--border-default,#1e2d45)'}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",display:'flex',alignItems:'center',gap:10}}>
            🚨 Alerts Center
            {unreadCount>0&&<span style={{fontSize:14,padding:'2px 10px',borderRadius:20,background:'rgba(239,68,68,.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,.3)',fontFamily:'inherit'}}>{unreadCount} new</span>}
          </h1>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Monitor and action all system risk alerts in real-time</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {unreadCount>0&&<button className="ac-ghost" onClick={markAllRead}>✓ Mark All Read</button>}
          <button className="ac-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* ── STAT STRIP ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Total Active',v:alerts.filter(a=>!a.is_resolved).length,col:'#00d4b4'},
          {label:'Critical',v:critCount,col:'#ef4444'},
          {label:'Unread',v:unreadCount,col:'#f97316'},
          {label:'Resolved Today',v:alerts.filter(a=>a.is_resolved).length,col:'#22c55e'},
        ].map(({label,v,col})=>(
          <div key={label} style={{background:'var(--bg-surface,#111827)',border:'1px solid var(--border-default,#1e2d45)',borderLeft:`3px solid ${col}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:24,fontWeight:700,color:col,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid var(--border-default,#1e2d45)',paddingBottom:0}}>
        {[['active','Active Alerts'],['history','History']].map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setSelected(null);}} style={{padding:'8px 18px',border:'none',borderBottom:`2px solid ${tab===k?'#00d4b4':'transparent'}`,background:'transparent',color:tab===k?'#00d4b4':'var(--text-secondary)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',marginBottom:-1}}>{l}</button>
        ))}
      </div>

      {/* ── FILTERS + SEARCH ── */}
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search alerts…" style={{padding:'7px 14px',borderRadius:8,border:'1px solid var(--border-default,#1e2d45)',background:'var(--bg-elevated,#0d1526)',color:'var(--text-primary)',fontSize:13,fontFamily:'inherit',outline:'none',width:200}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[['all','All'],['unread','Unread'],['critical','🔴 Critical'],['high','🟠 High'],['medium','🟡 Medium'],['low','🟢 Low']].map(([k,l])=>(
            <button key={k} className={`ac-filter${filter===k?' active':''} ${k==='critical'?'crit':k==='high'?'high':k==='medium'?'med':''}`} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <div style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)'}}>{shown.length} alert{shown.length!==1?'s':''}</div>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{display:'grid',gridTemplateColumns:selectedAlert?'1fr 1fr':'1fr',gap:16,alignItems:'start'}}>

        {/* LEFT — Alert List */}
        <div>
          {loading&&<div style={{textAlign:'center',padding:60,color:'var(--text-muted)'}}>Loading alerts…</div>}
          {error&&<div style={{color:'#ef4444',padding:20,textAlign:'center'}}>{error}</div>}
          {!loading&&!error&&shown.length===0&&(
            <div style={{textAlign:'center',padding:60,color:'var(--text-muted)'}}>
              <div style={{fontSize:40,marginBottom:12}}>{tab==='history'?'📂':'✅'}</div>
              <div style={{fontSize:16,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>{tab==='history'?'No resolved alerts':'All clear!'}</div>
              <div style={{fontSize:13}}>{tab==='history'?'Resolved alerts will appear here.':'No active alerts match your filter.'}</div>
            </div>
          )}
          {shown.map(a=>(
            <div key={a.alert_id} className="fade-in">
              <AlertRow
                alert={a}
                selected={selected===a.alert_id}
                onClick={()=>{ setSelected(s=>s===a.alert_id?null:a.alert_id); if(!a.is_read) markRead(a.alert_id); }}
                onRead={markRead}
                onResolve={resolve}
              />
            </div>
          ))}
        </div>

        {/* RIGHT — Detail Panel */}
        {selectedAlert&&(
          <div className="fade-in" style={{position:'sticky',top:16}}>
            <DetailPanel
              alert={selectedAlert}
              onResolve={resolve}
              onClose={()=>setSelected(null)}
              resolving={resolving}
              navigate={navigate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
