import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import Spinner from '../../components/ui/Spinner';

const fmt     = s  => s  ? String(s).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '—';
const fmtDate = iso => { if(!iso) return '—'; try { return new Date(iso).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return iso; } };
const riskClr = l  => ({critical:'#ef4444',high:'#f97316',medium:'#eab308',low:'#22c55e'})[String(l||'').toLowerCase()]||'#22c55e';
function chipCls(l){ return ({critical:'c-red',high:'c-red',medium:'c-amb',low:'c-grn',in_transit:'c-tl',picked_up:'c-grn',delayed:'c-red',at_port:'c-tl',delivered:'c-grn'})[String(l||'').toLowerCase()]||'c-amb'; }

function useTheme(){
  const [t,setT]=useState(()=>document.documentElement.getAttribute('data-theme')||'dark');
  useEffect(()=>{
    const o=new MutationObserver(()=>setT(document.documentElement.getAttribute('data-theme')||'dark'));
    o.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    return()=>o.disconnect();
  },[]);
  return t;
}

function Row({ label, value }){
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border-subtle,#1e2d4520)',fontSize:13}}>
      <span style={{color:'var(--text-secondary,#8a9bb5)'}}>{label}</span>
      <span style={{fontWeight:600,color:'var(--text-primary,#f0f4ff)',textAlign:'right',maxWidth:'55%'}}>{value??'—'}</span>
    </div>
  );
}

function Card({ children, accent, style={} }){
  return(
    <div style={{background:'var(--bg-surface,#111827)',border:`1px solid ${accent||'var(--border-default,#1e2d45)'}`,borderLeft:accent?`3px solid ${accent}`:undefined,borderRadius:12,padding:20,marginBottom:14,...style}}>
      {children}
    </div>
  );
}

function SectionTitle({ children }){
  return <div style={{fontSize:13,fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:8,color:'var(--text-primary,#f0f4ff)'}}>{children}</div>;
}

function MetricBox({ value, label, color }){
  return(
    <div style={{textAlign:'center',padding:14,background:'var(--bg-elevated,#0d1526)',border:'1px solid var(--border-default,#1e2d45)',borderRadius:10}}>
      <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:color||'var(--text-primary)'}}>{value}</div>
      <div style={{fontSize:10,color:'var(--text-secondary,#8a9bb5)',marginTop:2}}>{label}</div>
    </div>
  );
}

function RouteMap({ shipment, prediction, approvedRouteId, hoveredRouteId, selectedRouteId }){
  const theme = useTheme();
  const tileUrl = theme==='dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const wp  = shipment.route_waypoints || [];
  if(!wp.length) return <Card><div style={{textAlign:'center',color:'var(--text-muted,#6b7280)',padding:40}}>No route data available</div></Card>;

  const pos    = wp.map(p=>[Number(p.lat),Number(p.lng)]);
  const cur    = shipment.current_latitude&&shipment.current_longitude ? [Number(shipment.current_latitude),Number(shipment.current_longitude)] : null;
  const center = cur||pos[Math.floor(pos.length/2)];
  const origWp = shipment.original_route_waypoints||[];
  const origPos= origWp.map(p=>[Number(p.lat),Number(p.lng)]);
  const altRoutes = prediction?.alternate_routes||[];
  const isRerouted= shipment.is_rerouted;

  let sailedPos=[], remainingPos=pos;
  if(cur&&pos.length>1){
    let minD=Infinity, si=0;
    pos.forEach(([la,ln],i)=>{ const d=Math.hypot(la-cur[0],ln-cur[1]); if(d<minD){minD=d;si=i;} });
    sailedPos=[...pos.slice(0,si+1),cur];
    remainingPos=[cur,...pos.slice(si+1)];
  }

  const TEAL='#00d4b4', AMBER='#f59e0b', RED='#ef4444', GREEN='#10b981', GRAY='#8a9bb5', DIM='#4a5f7a';

  return(
    <Card style={{padding:0,overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px 0 20px',flexWrap:'wrap',gap:8}}>
        <SectionTitle style={{margin:0}}>🗺️ Route Map</SectionTitle>
        <div style={{display:'flex',gap:10,fontSize:11,color:'var(--text-secondary,#8a9bb5)',flexWrap:'wrap'}}>
          {sailedPos.length>1&&<span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:16,height:2,background:GRAY,borderRadius:2,display:'inline-block',opacity:.5}}/> Sailed</span>}
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:16,height:3,background:isRerouted?'#f97316':TEAL,borderRadius:2,display:'inline-block'}}/>{isRerouted?'Rerouted':'Remaining'}</span>
          {origPos.length>0&&<span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:16,height:2,background:DIM,borderRadius:2,display:'inline-block'}}/> Original</span>}
          {altRoutes.length>0&&<span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:16,height:3,background:'#6b7280',borderRadius:2,display:'inline-block'}}/> Alt routes</span>}
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:GREEN,borderRadius:'50%',display:'inline-block'}}/> Origin</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:RED,borderRadius:'50%',display:'inline-block'}}/> Dest</span>
        </div>
      </div>
      <div style={{height:360,marginTop:10}}>
        <MapContainer center={center} zoom={3} style={{height:'100%',width:'100%'}} scrollWheelZoom>
          <TileLayer url={tileUrl} attribution="&copy; OSM &copy; CARTO" maxZoom={19}/>
          {origPos.length>0&&<Polyline positions={origPos} pathOptions={{color:DIM,weight:2,opacity:0.35,dashArray:'8 6'}}/>}
          {sailedPos.length>1&&<Polyline positions={sailedPos} pathOptions={{color:GRAY,weight:2,opacity:0.3,dashArray:'4 5'}}/>}
          <Polyline positions={remainingPos.length>1?remainingPos:pos} pathOptions={{color:isRerouted?'#f97316':TEAL,weight:3,opacity:0.9}}/>
          {altRoutes.map(r=>{
            const rPos=(r.waypoints||[]).map(p=>[Number(p.lat),Number(p.lng)]);
            if(rPos.length<2) return null;
            const isApproved=approvedRouteId===r.route_id;
            const isSelected=selectedRouteId===r.route_id;
            const isHovered =hoveredRouteId===r.route_id;
            const hi=isHovered||isSelected||isApproved;
            return(
              <Polyline key={r.route_id} positions={rPos}
                pathOptions={{color:isApproved?'#f97316':isSelected?AMBER:isHovered?'#fbbf24':'#4b5563',weight:hi?3:2,opacity:hi?0.95:0.45,dashArray:isApproved?undefined:'6 5'}}>
                {hi&&<Tooltip sticky>{r.name} — Risk {Number(r.risk_score).toFixed(1)}</Tooltip>}
              </Polyline>
            );
          })}
          <CircleMarker center={pos[0]} radius={7} pathOptions={{color:GREEN,fillColor:GREEN,fillOpacity:1,weight:2}}>
            <Tooltip direction="top" offset={[0,-8]}><strong>{shipment.origin_port_name||'Origin'}</strong></Tooltip>
          </CircleMarker>
          <CircleMarker center={pos[pos.length-1]} radius={7} pathOptions={{color:RED,fillColor:RED,fillOpacity:1,weight:2}}>
            <Tooltip direction="top" offset={[0,-8]}><strong>{shipment.destination_port_name||'Destination'}</strong></Tooltip>
          </CircleMarker>
          {cur&&(
            <CircleMarker center={cur} radius={11} pathOptions={{color:TEAL,fillColor:TEAL,fillOpacity:.9,weight:3}}>
              <Tooltip permanent direction="top" offset={[0,-15]}>
                <strong>{shipment.tracking_number}</strong>
                {altRoutes.length>0&&<> · <span style={{color:'#00d4b4'}}>↕ reroute origin</span></>}
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
    </Card>
  );
}

/* ── Risk gauge SVG ─────────────────────────────────────────────────────── */
function RiskGauge({ score=0 }){
  const pct=Math.min(100,Math.max(0,Number(score)));
  const col=pct>=80?'#ef4444':pct>=60?'#f97316':pct>=40?'#eab308':'#10b981';
  const R=54,cx=70,cy=70;
  const rad=d=>(d*Math.PI)/180;
  const px=a=>cx+R*Math.cos(rad(a)), py=a=>cy+R*Math.sin(rad(a));
  const start=210,sweep=300;
  const end=start+(sweep*pct)/100;
  const large=sweep*pct/100>180?1:0;
  return(
    <svg viewBox="0 0 140 100" style={{width:'100%',maxWidth:140,display:'block',margin:'0 auto'}}>
      <path d={`M ${px(start)} ${py(start)} A ${R} ${R} 0 1 1 ${px(start+sweep-0.01)} ${py(start+sweep-0.01)}`}
        fill="none" stroke="var(--bg-elevated,#0d1526)" strokeWidth={10} strokeLinecap="round"/>
      {pct>0&&<path d={`M ${px(start)} ${py(start)} A ${R} ${R} 0 ${large} 1 ${px(end)} ${py(end)}`}
        fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${col}80)`}}/>}
      <text x={cx} y={cy-4} textAnchor="middle" fill={col} fontSize={20} fontWeight={700} fontFamily="'JetBrains Mono',monospace">{Math.round(pct)}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fill="var(--text-muted,#6b7280)" fontSize={9}>/100</text>
    </svg>
  );
}

export default function ShipmentDetail(){
  const navigate=useNavigate();
  const {id}=useParams();
  const [shipment,setShipment]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [showML,setShowML]=useState(false);
  const [mlLoading,setMlLoading]=useState(false);
  const [mlError,setMlError]=useState('');
  const [approvedRouteId,setApprovedRouteId]=useState(null);
  const [hoveredRouteId,setHoveredRouteId]=useState(null);
  const [selectedRouteId,setSelectedRouteId]=useState(null);
  const [prediction,setPrediction]=useState(null);
  const [approvingRoute,setApprovingRoute]=useState(null);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{ setShipment((await api.get(ENDPOINTS.SHIPMENT_DETAIL(id))).data); }
      catch{ setError('Unable to load shipment.'); }
      finally{ setLoading(false); }
    })();
  },[id]);

  // ML fetch lives HERE so prediction state is shared with map
  const runML = useCallback(async()=>{
    setMlLoading(true); setMlError('');
    try{ setPrediction((await api.get(ENDPOINTS.ML_PREDICTION(id))).data); }
    catch(e){
      if(e?.response?.status===403) setMlError('Manager role required.');
      else setMlError('ML pipeline error — check backend.');
    } finally{ setMlLoading(false); }
  },[id]);

  const approveReroute=useCallback(async(routeId)=>{
    setApprovingRoute(routeId);
    try{
      await api.post(`${ENDPOINTS.APPROVE_REROUTE(id)}?route_id=${routeId}`);
      setApprovedRouteId(routeId); setSelectedRouteId(routeId);
      try{ const r=await api.get(ENDPOINTS.SHIPMENT_DETAIL(id)); setShipment(r.data); } catch{}
    } catch{} finally{ setApprovingRoute(null); }
  },[id]);

  if(loading) return <div style={{display:'grid',placeItems:'center',minHeight:300}}><Spinner size="lg"/></div>;
  if(error||!shipment) return(
    <div style={{padding:40,textAlign:'center',color:'var(--text-primary)'}}>
      <div style={{color:'#ef4444',marginBottom:12}}>{error||'Shipment not found'}</div>
      <button onClick={()=>navigate('/manager')} style={{background:'transparent',border:'1px solid var(--border-default)',borderRadius:8,padding:'8px 16px',cursor:'pointer',color:'#00d4b4',fontSize:12}}>← Back</button>
    </div>
  );

  const mo  = prediction?.model_outputs||{};
  const fi  = prediction?.financial_impact||{};
  const alt = prediction?.alternate_routes||[];
  const approvedAlt = alt.find(r=>r.route_id===approvedRouteId);
  const traj = prediction?.risk_trajectory||[];
  const trajData = traj.length>0
    ? traj.map((v,i)=>({label:i===0?'Now':`+${i}h`,value:Number(v).toFixed(1)}))
    : Array.from({length:7},(_,i)=>({label:i===0?'Now':`+${i}h`,value:(Number(shipment?.current_risk_score||40)+i*0.8).toFixed(1)}));
  const riskCol = Number(mo.risk_score||shipment?.current_risk_score||0)>=80?'#ef4444':Number(mo.risk_score||shipment?.current_risk_score||0)>=60?'#f97316':Number(mo.risk_score||shipment?.current_risk_score||0)>=40?'#eab308':'#10b981';

  // ── Journey progress calculations ────────────────────────────────────────
  const wp = shipment.route_waypoints||[];
  const totalDistKm = shipment.route_distance_km ? Number(shipment.route_distance_km) : 0;

  // Find nearest waypoint to current position
  const curLat = shipment.current_latitude ? Number(shipment.current_latitude) : null;
  const curLng = shipment.current_longitude ? Number(shipment.current_longitude) : null;
  let coveredDistKm = 0;
  if(curLat && curLng && wp.length>1){
    // Haversine helper
    const hav=(a,b)=>{
      const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
      const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
    };
    let minD=Infinity,splitIdx=0;
    wp.forEach((p,i)=>{ const d=hav(p,{lat:curLat,lng:curLng}); if(d<minD){minD=d;splitIdx=i;} });
    for(let i=0;i<splitIdx;i++) coveredDistKm+=hav(wp[i],wp[i+1]);
    coveredDistKm+=hav(wp[splitIdx],{lat:curLat,lng:curLng});
    coveredDistKm=Math.min(coveredDistKm,totalDistKm);
  }
  const remainingDistKm = Math.max(0, totalDistKm - coveredDistKm);
  const progressPct = totalDistKm>0 ? Math.round((coveredDistKm/totalDistKm)*100) : 0;

  // Estimate speed: distance covered / elapsed hours
  const departedAt = shipment.departure_time ? new Date(shipment.departure_time) : null;
  const elapsedHr = departedAt ? Math.max(0,(Date.now()-departedAt.getTime())/3600000) : null;
  const estimatedSpeedKmh = (elapsedHr && elapsedHr>0.5 && coveredDistKm>0) ? Math.round(coveredDistKm/elapsedHr) : null;
  const avgSpeed = estimatedSpeedKmh || 28; // fallback to average vessel speed
  const remainingHr = remainingDistKm>0 ? (remainingDistKm/avgSpeed) : null;
  const etaDate = remainingHr ? new Date(Date.now()+remainingHr*3600000) : null;

  // ── Feature importance for Why Reroute ───────────────────────────────────
  const featureImp = prediction?.feature_importance||{};
  const fiEntries = Object.entries(featureImp).sort((a,b)=>b[1]-a[1]);
  const fiMax = fiEntries.length>0 ? fiEntries[0][1] : 1;
  const featureLabels = {
    weather_score:'Weather Severity',traffic_score:'Traffic Congestion',
    port_score:'Port Congestion',historical_score:'Historical Risk',
    cargo_sensitivity:'Cargo Sensitivity',
  };
  const featureIcons = {
    weather_score:'🌧',traffic_score:'🚦',port_score:'⚓',
    historical_score:'📊',cargo_sensitivity:'📦',
  };

  return(
    <div style={{color:'var(--text-primary,#f0f4ff)',fontFamily:"'Space Grotesk',sans-serif",minHeight:'100%',background:'var(--bg-base,#080e1a)'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .sd-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
        .c-red{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);}
        .c-amb{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);}
        .c-grn{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);}
        .c-tl{background:rgba(0,212,180,.15);color:#00d4b4;border:1px solid rgba(0,212,180,.3);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        .fade-in{animation:fadeUp .3s ease both;}
        .sd-btn{background:linear-gradient(135deg,#00d4b4,#22d3ee);color:#000;font-weight:700;font-size:12px;padding:8px 18px;border:none;border-radius:8px;cursor:pointer;transition:all .2s;font-family:inherit;}
        .sd-btn:hover{transform:translateY(-1px);opacity:.9;}
        .sd-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .sd-ghost{background:transparent;color:#00d4b4;border:1px solid var(--border-default,#1e2d45);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:6px;transition:all .2s;}
        .sd-ghost:hover{border-color:#00d4b4;background:rgba(0,212,180,.06);}
        .leaflet-container{background:var(--bg-base,#0a0f1a)!important;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,paddingBottom:20,borderBottom:'1px solid var(--border-default,#1e2d45)'}}>
        <div>
          <button className="sd-ghost" onClick={()=>navigate('/manager?tab=consignments')}><ArrowLeft size={14}/> Consignments</button>
          <h1 style={{fontSize:22,fontWeight:700,marginTop:10,fontFamily:"'JetBrains Mono',monospace"}}>{shipment.tracking_number}</h1>
          <div style={{fontSize:11,color:'var(--text-muted,#6b7280)',marginTop:2}}>ID: {shipment.shipment_id}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span className={`sd-chip ${chipCls(shipment.current_status)}`}>{fmt(shipment.current_status)}</span>
          <span className={`sd-chip ${chipCls(shipment.current_risk_level)}`}>{fmt(shipment.current_risk_level)} Risk</span>
          {shipment.is_rerouted&&<span className="sd-chip c-amb">Rerouted ×{shipment.reroute_count||1}</span>}
        </div>
      </div>

      {/* ── MAP ── */}
      <RouteMap shipment={shipment} prediction={prediction} approvedRouteId={approvedRouteId} hoveredRouteId={hoveredRouteId} selectedRouteId={selectedRouteId}/>

      {/* ── APPROVED REROUTE BANNER ── */}
      {approvedAlt&&(
        <Card accent="#f97316" style={{background:'rgba(249,115,22,.06)'}}>
          <SectionTitle>🔀 Route Changed</SectionTitle>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,fontSize:13}}>
            <div><div style={{fontSize:10,color:'var(--text-muted)',marginBottom:4}}>ORIGINAL</div><div style={{fontWeight:600}}>{shipment.origin_port_name} → {shipment.destination_port_name}</div></div>
            <div><div style={{fontSize:10,color:'var(--text-muted)',marginBottom:4}}>NEW ROUTE</div><div style={{fontWeight:600,color:'#f97316'}}>{approvedAlt.name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>+${Number(approvedAlt.extra_cost_usd).toFixed(0)} cost</div></div>
            <div><div style={{fontSize:10,color:'var(--text-muted)',marginBottom:4}}>REASON</div><div style={{fontWeight:600,color:'#10b981'}}>ML: {mo.reroute_decision}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>Confidence {mo.confidence_percent}%</div></div>
          </div>
        </Card>
      )}

      {/* ── TWO COLUMN LAYOUT ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        {/* LEFT — Risk + ML Panel */}
        <div>
          {/* Risk + ML Section */}
          <Card accent={riskClr(shipment.current_risk_level)} className="fade-in">
            <SectionTitle>🎯 Risk Assessment</SectionTitle>
            {/* Gauge + metrics row */}
            <div style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:14,alignItems:'center',marginBottom:14}}>
              <RiskGauge score={mo.risk_score??shipment.current_risk_score??0}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <MetricBox value={mo.predicted_delay_hr!=null?`${Number(mo.predicted_delay_hr).toFixed(1)}h`:'—'} label="Predicted Delay" color="#f59e0b"/>
                <MetricBox value={mo.reroute_decision||fmt(shipment.current_risk_level)} label="ML Decision" color={mo.reroute_decision==='REROUTE'?'#ef4444':mo.reroute_decision==='NORMAL'||mo.reroute_decision==='STAY'?'#10b981':'#f59e0b'}/>
                <MetricBox value={mo.confidence_percent!=null?`${Number(mo.confidence_percent).toFixed(0)}%`:'—'} label="Confidence" color="#00d4b4"/>
                <MetricBox value={shipment.current_risk_score!=null?Number(shipment.current_risk_score).toFixed(1):'—'} label="Current Risk" color={riskClr(shipment.current_risk_level)}/>
              </div>
            </div>

            {/* LSTM trajectory chart */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted,#6b7280)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:6}}>6-Hour Risk Trajectory (LSTM)</div>
              <div style={{height:100}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trajData} margin={{top:2,right:4,left:0,bottom:0}}>
                    <defs><linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={riskCol} stopOpacity={0.3}/><stop offset="95%" stopColor={riskCol} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle,#1e2d4520)"/>
                    <XAxis dataKey="label" tick={{fontSize:9,fill:'var(--text-muted,#6b7280)'}} interval={0}/>
                    <YAxis domain={[0,100]} tick={{fontSize:9,fill:'var(--text-muted,#6b7280)'}} width={24}/>
                    <RTooltip contentStyle={{background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:6,fontSize:11}}/>
                    <Area type="monotone" dataKey="value" stroke={riskCol} strokeWidth={2} fill="url(#rg2)" dot={{r:2,fill:riskCol,strokeWidth:0}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {traj.length===0&&<div style={{fontSize:10,color:'var(--text-muted,#6b7280)',textAlign:'center',marginTop:2}}>Run ML Analysis for real LSTM forecast</div>}
            </div>

            <button className="sd-btn" onClick={()=>{if(!prediction)runML();setShowML(v=>!v);}}
              disabled={mlLoading} style={{width:'100%'}}>
              {mlLoading?'⚙ Running ML Pipeline…':showML?'▲ Hide Analysis':'⚡ Run ML Analysis'}
            </button>
            {mlError&&<div style={{fontSize:11,color:'#ef4444',marginTop:6}}>{mlError}</div>}
            {mo.reroute_decision&&(
              <div style={{marginTop:10,padding:'8px 12px',background:`${mo.reroute_decision==='REROUTE'?'rgba(239,68,68,.08)':'rgba(16,185,129,.08)'}`,borderRadius:8,fontSize:12,color:mo.reroute_decision==='REROUTE'?'#ef4444':'#10b981',fontStyle:'italic'}}>
                {mo.reroute_decision==='REROUTE'
                  ?`⚠ ML recommends rerouting — ${Number(mo.confidence_percent).toFixed(0)}% confident. Expected delay: ${Number(mo.predicted_delay_hr).toFixed(1)}h.`
                  :`✓ Current route is optimal — ${Number(mo.confidence_percent).toFixed(0)}% confident.`}
              </div>
            )}
          </Card>

          {/* Why Reroute? — feature importance breakdown */}
          {fiEntries.length>0&&(
            <Card className="fade-in" accent={mo.reroute_decision==='REROUTE'?'#ef4444':'#10b981'}>
              <SectionTitle>🤖 Why {mo.reroute_decision==='REROUTE'?'Reroute?':'Stay on Course?'}</SectionTitle>
              <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:10,lineHeight:1.5}}>
                {mo.reroute_decision==='REROUTE'
                  ?`The model detected elevated risk (${Number(mo.risk_score||shipment.current_risk_score||0).toFixed(1)}/100) driven by the following factors:`
                  :`Risk factors are within acceptable bounds. Primary drivers:`}
              </div>
              {fiEntries.map(([k,v])=>{
                const pct=Math.round((v/fiMax)*100);
                const col=v>0.3?'#ef4444':v>0.2?'#f97316':v>0.1?'#eab308':'#10b981';
                return(
                  <div key={k} style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                      <span style={{color:'var(--text-secondary)'}}>{featureIcons[k]||'▸'} {featureLabels[k]||k.replace(/_/g,' ')}</span>
                      <span style={{fontWeight:700,color:col}}>{Math.round(v*100)}%</span>
                    </div>
                    <div style={{height:6,background:'var(--bg-elevated,#0d1526)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:col,borderRadius:4,transition:'width .8s ease',boxShadow:`0 0 6px ${col}60`}}/>
                    </div>
                  </div>
                );
              })}
              {/* Top risk driver explanation */}
              {fiEntries[0]&&(
                <div style={{marginTop:10,padding:'8px 10px',background:'var(--bg-elevated,#0d1526)',borderRadius:8,fontSize:11,color:'var(--text-secondary)',lineHeight:1.6,borderLeft:'3px solid #00d4b4'}}>
                  <strong style={{color:'var(--text-primary)'}}>Primary driver:</strong> {featureLabels[fiEntries[0][0]]||fiEntries[0][0].replace(/_/g,' ')} contributes {Math.round(fiEntries[0][1]*100)}% to the risk score.
                  {fiEntries[0][0]==='weather_score'&&' Adverse weather conditions along the route are elevating delay probability.'}
                  {fiEntries[0][0]==='port_score'&&' Destination or transit port congestion is above normal levels.'}
                  {fiEntries[0][0]==='traffic_score'&&' High maritime traffic density detected on current route.'}
                  {fiEntries[0][0]==='historical_score'&&' Historical incident data shows elevated risk for this corridor.'}
                  {fiEntries[0][0]==='cargo_sensitivity'&&' High-sensitivity cargo increases financial exposure to delays.'}
                </div>
              )}
            </Card>
          )}


          {/* Alternate Routes with financial analytics */}
          {alt.length>0&&(
            <Card className="fade-in">
              <SectionTitle>🔀 ML-Generated Alternate Routes ({alt.length})</SectionTitle>
              {alt.map((r,i)=>{
                const isApproved=approvedRouteId===r.route_id;
                const isSelected=selectedRouteId===r.route_id;
                const isHovered=hoveredRouteId===r.route_id;
                const hi=isSelected||isHovered;
                const rCol=Number(r.risk_score)>=80?'#ef4444':Number(r.risk_score)>=60?'#f97316':Number(r.risk_score)>=40?'#eab308':'#10b981';
                return(
                  <div key={r.route_id}
                    onMouseEnter={()=>setHoveredRouteId(r.route_id)}
                    onMouseLeave={()=>setHoveredRouteId(null)}
                    onClick={()=>setSelectedRouteId(isSelected?null:r.route_id)}
                    style={{background:'var(--bg-elevated,#0d1526)',border:`1px solid ${isApproved?'#f97316':isSelected?'#f59e0b':hi?'rgba(245,158,11,.4)':'var(--border-default,#1e2d45)'}`,borderLeft:`3px solid ${isApproved?'#f97316':isSelected?'#f59e0b':r.recommended?'#10b981':'var(--border-default)'}`,borderRadius:8,padding:'12px 14px',marginBottom:8,cursor:'pointer',transition:'all .15s'}}>
                    {/* Header */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:isApproved?'#f97316':isSelected?'#f59e0b':'var(--text-primary)'}}>
                          {r.recommended?'★ ':''}{r.name||`Route ${i+1}`}
                          {isSelected&&!isApproved&&<span style={{fontSize:10,color:'#f59e0b',marginLeft:6}}>← shown on map</span>}
                        </div>
                        <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>{r.description}</div>
                      </div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        {r.recommended&&<span className="sd-chip c-grn">BEST</span>}
                        {isApproved?<span className="sd-chip c-grn">Active ✓</span>
                          :<button className="sd-btn" style={{padding:'5px 12px',fontSize:11}} onClick={e=>{e.stopPropagation();approveReroute(r.route_id);}} disabled={approvingRoute===r.route_id}>
                            {approvingRoute===r.route_id?'…':'Approve Route'}
                          </button>}
                      </div>
                    </div>
                    {/* Stats grid */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
                      <div style={{background:'var(--bg-surface,#111827)',borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                        <div style={{fontSize:14,fontWeight:700,color:rCol}}>{Number(r.risk_score).toFixed(1)}</div>
                        <div style={{fontSize:9,color:'var(--text-muted)',marginTop:1}}>Risk Score</div>
                      </div>
                      <div style={{background:'var(--bg-surface,#111827)',borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                        <div style={{fontSize:14,fontWeight:700,color:r.time_saving_hr>0?'#10b981':'#f59e0b'}}>{r.time_saving_hr>0?`-${r.time_saving_hr.toFixed(1)}h`:`+${Math.abs(r.extra_time_hours||0).toFixed(1)}h`}</div>
                        <div style={{fontSize:9,color:'var(--text-muted)',marginTop:1}}>{r.time_saving_hr>0?'Time Saved':'Extra Time'}</div>
                      </div>
                      <div style={{background:'var(--bg-surface,#111827)',borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                        <div style={{fontSize:14,fontWeight:700,color:r.profit_saving_usd>0?'#10b981':'#ef4444'}}>{r.profit_saving_usd>0?`+$${Math.round(r.profit_saving_usd).toLocaleString()}`:`-$${Math.round(r.extra_cost_usd||0).toLocaleString()}`}</div>
                        <div style={{fontSize:9,color:'var(--text-muted)',marginTop:1}}>{r.profit_saving_usd>0?'Net Profit Saved':'Extra Cost'}</div>
                      </div>
                    </div>
                    {/* Secondary stats */}
                    <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text-secondary)',flexWrap:'wrap'}}>
                      <span>⏱ ETA: {r.alt_duration_hr>0?`${r.alt_duration_hr.toFixed(0)}h`:'—'}</span>
                      <span>📏 {Number(r.extra_distance_km)>0?`+${Number(r.extra_distance_km).toFixed(0)} km extra`:'Shortest path'}</span>
                      {r.delivery_speed_gain_pct!==0&&<span style={{color:r.delivery_speed_gain_pct>0?'#10b981':'#f59e0b'}}>{r.delivery_speed_gain_pct>0?`⚡ ${r.delivery_speed_gain_pct.toFixed(1)}% faster delivery`:`🐢 ${Math.abs(r.delivery_speed_gain_pct).toFixed(1)}% slower`}</span>}
                      <span style={{color:'var(--text-muted)'}}>{r.from_current?'📍 From current position':'📌 From origin'}</span>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {/* Financial impact */}
          {prediction?.financial_impact&&(
            <Card className="fade-in">
              <SectionTitle>💰 Financial Impact</SectionTitle>
              <Row label="Damage Probability" value={`${(fi.current_route_damage_probability*100).toFixed(1)}%`}/>
              <Row label="Expected Loss" value={`$${Number(fi.current_route_expected_loss_usd).toLocaleString()}`}/>
              <Row label="Reroute Extra Cost" value={`$${Number(fi.recommended_route_extra_cost_usd).toLocaleString()}`}/>
              <Row label="Net Saving" value={<span style={{color:'#10b981',fontWeight:700}}>${Number(fi.net_saving_usd).toLocaleString()}</span>}/>
            </Card>
          )}
        </div>

        {/* RIGHT — Info panels */}
        <div>
          <Card className="fade-in">
            <SectionTitle>📦 Shipment Info</SectionTitle>
            <Row label="Origin"          value={shipment.origin_port_name}/>
            <Row label="Destination"     value={shipment.destination_port_name}/>
            <Row label="Priority"        value={fmt(shipment.priority_level)}/>
            <Row label="Expected Arrival"value={fmtDate(shipment.expected_arrival)}/>
            <Row label="Actual Arrival"  value={fmtDate(shipment.actual_arrival)}/>
            <Row label="Departed"        value={fmtDate(shipment.departure_time)}/>
            <Row label="Rerouted"        value={shipment.is_rerouted?`Yes (×${shipment.reroute_count})`:'No'}/>
            {shipment.route_distance_km&&<Row label="Distance" value={`${Number(shipment.route_distance_km).toLocaleString()} km`}/>}
            {shipment.route_duration_hr &&<Row label="Duration" value={`${Number(shipment.route_duration_hr).toFixed(0)} hrs`}/>}
          </Card>

          {/* Journey Progress Card */}
          {(curLat||totalDistKm>0)&&(
            <Card className="fade-in" accent="#00d4b4">
              <SectionTitle>🚢 Voyage Progress</SectionTitle>
              {/* Progress bar */}
              <div style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-secondary)',marginBottom:6}}>
                  <span>{shipment.origin_port_name}</span>
                  <span style={{fontWeight:700,color:'#00d4b4'}}>{progressPct}% complete</span>
                  <span>{shipment.destination_port_name}</span>
                </div>
                <div style={{height:10,background:'var(--bg-elevated,#0d1526)',borderRadius:10,overflow:'hidden',position:'relative'}}>
                  <div style={{height:'100%',width:`${progressPct}%`,background:'linear-gradient(90deg,#00d4b4,#22d3ee)',borderRadius:10,transition:'width 1s ease',boxShadow:'0 0 10px rgba(0,212,180,.4)'}}>
                    <div style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',width:12,height:12,background:'#fff',borderRadius:'50%',boxShadow:'0 0 6px #00d4b4'}}/>
                  </div>
                </div>
              </div>
              {/* Stats grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                <div style={{background:'var(--bg-elevated,#0d1526)',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:16,fontWeight:700,color:'#00d4b4',fontFamily:"'JetBrains Mono',monospace"}}>{coveredDistKm>0?`${Math.round(coveredDistKm).toLocaleString()} km`:'—'}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Distance Covered</div>
                </div>
                <div style={{background:'var(--bg-elevated,#0d1526)',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:16,fontWeight:700,color:'#f59e0b',fontFamily:"'JetBrains Mono',monospace"}}>{remainingDistKm>0?`${Math.round(remainingDistKm).toLocaleString()} km`:'—'}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Distance Remaining</div>
                </div>
                <div style={{background:'var(--bg-elevated,#0d1526)',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:16,fontWeight:700,color:'#22d3ee',fontFamily:"'JetBrains Mono',monospace"}}>{estimatedSpeedKmh?`${estimatedSpeedKmh} km/h`:`~${avgSpeed} km/h`}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{estimatedSpeedKmh?'Actual Speed':'Avg Speed (est.)'}</div>
                </div>
                <div style={{background:'var(--bg-elevated,#0d1526)',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:16,fontWeight:700,color:etaDate?'#10b981':'var(--text-primary)',fontFamily:"'JetBrains Mono',monospace"}}>{etaDate?etaDate.toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Recalculated ETA</div>
                </div>
              </div>
              {remainingHr!=null&&(
                <div style={{marginTop:10,display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-secondary)'}}>
                  <span>⏱ {elapsedHr?`${elapsedHr.toFixed(1)}h elapsed`:'—'}</span>
                  <span>🏁 {remainingHr.toFixed(1)}h remaining</span>
                  {estimatedSpeedKmh&&<span>📡 Live speed</span>}
                </div>
              )}
            </Card>
          )}


          {(shipment.cargo_type||shipment.cargo_description)&&(
            <Card className="fade-in">
              <SectionTitle>📋 Cargo Details</SectionTitle>
              <Row label="Type"        value={fmt(shipment.cargo_type)}/>
              <Row label="Description" value={shipment.cargo_description}/>
              <Row label="Value"       value={shipment.declared_value!=null?`$${Number(shipment.declared_value).toLocaleString()}`:null}/>
              <Row label="Weight"      value={shipment.weight_kg?`${Number(shipment.weight_kg).toLocaleString()} kg`:null}/>
              <Row label="Quantity"    value={shipment.quantity?`${shipment.quantity} pcs`:null}/>
              <Row label="Sensitivity" value={shipment.cargo_sensitivity_score!=null?Number(shipment.cargo_sensitivity_score).toFixed(0):null}/>
              {shipment.special_instructions&&<Row label="Instructions" value={shipment.special_instructions}/>}
            </Card>
          )}

          <Card className="fade-in">
            <SectionTitle>👥 Team</SectionTitle>
            <Row label="Shipper"  value={shipment.shipper_name}/>
            <Row label="Receiver" value={shipment.receiver_name}/>
            <Row label="Manager"  value={shipment.manager_name}/>
            <Row label="Driver"   value={shipment.driver_name||<span style={{color:'#f59e0b'}}>Not assigned</span>}/>
            <Row label="Vessel"   value={shipment.vessel_name}/>
          </Card>

          {(shipment.current_latitude||shipment.current_longitude)&&(
            <Card className="fade-in">
              <SectionTitle>📍 Live Position</SectionTitle>
              <Row label="Latitude"  value={Number(shipment.current_latitude).toFixed(4)+'°'}/>
              <Row label="Longitude" value={Number(shipment.current_longitude).toFixed(4)+'°'}/>
              {shipment.route_fuel_cost&&<Row label="Fuel Cost" value={`$${Number(shipment.route_fuel_cost).toLocaleString()}`}/>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
