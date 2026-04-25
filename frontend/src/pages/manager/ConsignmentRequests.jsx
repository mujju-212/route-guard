import { useEffect, useRef, useState } from 'react';
import { Bot, CheckCircle2, DollarSign, MessageSquare, Package, Send, Ship, Truck, X, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_META = {
	draft:{ label:'NEW', color:'#06B6D4', bg:'rgba(6,182,212,0.12)' },
  sent:{ label:'NEW', color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
  negotiating:{ label:'NEGOTIATING', color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
  accepted:{ label:'ACCEPTED', color:'#10B981', bg:'rgba(16,185,129,0.12)' },
  rejected:{ label:'REJECTED', color:'#EF4444', bg:'rgba(239,68,68,0.12)' },
};

const CARGO_LABELS = { standard:'Standard Dry', electronics:'Electronics', refrigerated:'Refrigerated', hazardous:'Hazardous', liquid_bulk:'Liquid Bulk', oversized:'Oversized', livestock:'Livestock', perishable:'Perishable', pharmaceutical:'Pharmaceutical' };

function timeAgo(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m/60)}h ago`;
  return `${Math.floor(m/1440)}d ago`;
}

function calcFin(req) {
  const offered = 45000;
  const wt = req.weight_kg || 2400;
  const fuel = Math.round(wt * 5.8);
  const port = Math.round(offered * 0.18);
  const crew = Math.round(offered * 0.13);
  const ins = Math.round(offered * 0.067);
  const cost = fuel + port + crew + ins;
  const profit = offered - cost;
  return { offered, fuel, port, crew, ins, cost, profit, margin: ((profit/offered)*100).toFixed(1), minRate: Math.round(cost*1.08), recommended: Math.round(offered*1.078) };
}

function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, color:m.color, background:m.bg, letterSpacing:'0.06em' }}>{m.label}</span>;
}

function FinPanel({ req }) {
  const f = calcFin(req);
  const rows = [
    { label:'Fuel', val:f.fuel, pct:(f.fuel/f.offered*100), color:'#F59E0B' },
    { label:'Port Fees', val:f.port, pct:(f.port/f.offered*100), color:'#8B5CF6' },
    { label:'Driver/Crew', val:f.crew, pct:(f.crew/f.offered*100), color:'#3B82F6' },
    { label:'Insurance', val:f.ins, pct:(f.ins/f.offered*100), color:'#10B981' },
  ];
  return (
    <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:16, marginBottom:14 }}>
      <h4 style={{ fontSize:13, fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
        <DollarSign size={15} style={{ color:'#10B981' }} /> Financial Analysis
      </h4>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
        <div style={{ background:'var(--bg-card)', borderRadius:8, padding:10, borderLeft:'3px solid #10B981' }}>
          <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>SENDER OFFERS</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#10B981' }}>${f.offered.toLocaleString()}</div>
        </div>
        <div style={{ background:'var(--bg-card)', borderRadius:8, padding:10, borderLeft:'3px solid #EF4444' }}>
          <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>OUR COST</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#EF4444' }}>${f.cost.toLocaleString()}</div>
        </div>
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ marginBottom:7 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{r.label}</span>
            <span style={{ fontSize:11, fontWeight:600 }}>${r.val.toLocaleString()}</span>
          </div>
          <div style={{ height:5, borderRadius:3, background:'var(--bg-card)', overflow:'hidden' }}>
            <div style={{ width:`${r.pct}%`, height:'100%', background:r.color, borderRadius:3 }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop:10, padding:10, borderRadius:8, background:'rgba(16,185,129,0.08)', border:'1px solid #10B981' }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:12, fontWeight:600 }}>Estimated Profit</span>
          <span style={{ fontSize:14, fontWeight:800, color:'#10B981' }}>${f.profit.toLocaleString()} ({f.margin}%)</span>
        </div>
      </div>
      <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div style={{ background:'var(--bg-card)', borderRadius:6, padding:8, textAlign:'center' }}>
          <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>MIN VIABLE</div>
          <div style={{ fontSize:13, fontWeight:700 }}>${f.minRate.toLocaleString()}</div>
        </div>
        <div style={{ background:'rgba(59,130,246,0.08)', borderRadius:6, padding:8, textAlign:'center', border:'1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize:9, color:'#3B82F6', marginBottom:2 }}>RECOMMENDED</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#3B82F6' }}>${f.recommended.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function AIPlan({ req, drivers, vessels }) {
  const avail = (drivers||[]).filter(d=>d.status==='available');
  const vessel = (vessels||[])[0];
  const legs = [
    { leg:1, Icon:Truck, mode:'LAND', from:req.pickup_address||'Origin Warehouse', to:`${req.origin_port_name||'Origin Port'}`, dist:'~45 km', time:'1.5 hrs', who:avail[0]?.full_name||'Driver TBD', what:'Heavy Truck', ok:!!avail[0] },
    { leg:2, Icon:Ship, mode:'SEA', from:req.origin_port_name||'Origin Port', to:req.destination_port_name||'Dest Port', dist:'~18,000 km', time:'~21 days', who:vessel?.vessel_name||'Vessel TBD', what:'Cargo Ship', ok:!!vessel },
    { leg:3, Icon:Truck, mode:'LAND', from:req.destination_port_name||'Dest Port', to:req.dropoff_address||'Destination', dist:'~320 km', time:'4 hrs', who:avail[1]?.full_name||'Driver TBD', what:'Heavy Truck', ok:!!avail[1] },
  ];
  return (
    <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:16, marginBottom:14 }}>
      <h4 style={{ fontSize:13, fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
        <Bot size={15} style={{ color:'#8B5CF6' }} /> AI Route Plan
      </h4>
      {legs.map((l,i) => (
        <div key={l.leg} style={{ display:'flex', gap:12, marginBottom:i<legs.length-1?12:0 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:l.mode==='SEA'?'rgba(59,130,246,0.15)':'rgba(245,158,11,0.15)', display:'grid', placeItems:'center', flexShrink:0 }}>
              <l.Icon size={16} style={{ color:l.mode==='SEA'?'#3B82F6':'#F59E0B' }} />
            </div>
            {i<legs.length-1 && <div style={{ width:2, height:20, background:'var(--border-default)', margin:'4px 0' }} />}
          </div>
          <div style={{ flex:1, paddingBottom:i<legs.length-1?0:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>LEG {l.leg} — {l.mode}</span>
              <span style={{ fontSize:10, color:l.ok?'#10B981':'#F59E0B', fontWeight:600 }}>{l.ok?'✓ Available':'⚠ TBD'}</span>
            </div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:2 }}>{l.from} → {l.to}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{l.what} · {l.who} · {l.dist} · {l.time}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop:12, padding:8, borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', fontSize:11, color:'var(--text-secondary)' }}>
        🤖 Total transit ~22 days · Risk Score <span style={{ color:'#10B981', fontWeight:700 }}>🟢 28</span>
      </div>
    </div>
  );
}

const TABS = ['all','draft','sent','negotiating','accepted'];

export default function ConsignmentRequests() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('all');
  const [view, setView] = useState('plan'); // 'plan' | 'chat'
  const [messages, setMessages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [msgBody, setMsgBody] = useState('');
  const [counter, setCounter] = useState('');
  const [offerAmt, setOfferAmt] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [chatChannel, setChatChannel] = useState('sender'); // 'sender' | 'driver' | 'emergency'
  const [driverMsg, setDriverMsg] = useState('');
  const [driverSending, setDriverSending] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const chatRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [reqRes, drvRes, vesRes] = await Promise.allSettled([
        api.get(ENDPOINTS.QUOTE_REQUESTS),
        api.get(ENDPOINTS.MANAGER_DRIVERS),
        api.get(ENDPOINTS.VESSELS),
      ]);
      if (reqRes.status === 'fulfilled') setRequests(Array.isArray(reqRes.value.data) ? reqRes.value.data : []);
      else setRequests([]);
      if (drvRes.status === 'fulfilled') setDrivers(Array.isArray(drvRes.value.data) ? drvRes.value.data : []);
      else setDrivers([]);
      if (vesRes.status === 'fulfilled') setVessels(Array.isArray(vesRes.value.data) ? vesRes.value.data : []);
      else setVessels([]);
    } catch (e) {
      console.error('ConsignmentRequests load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (id) => {
    if (!id) return;
    try {
      const [oRes, mRes] = await Promise.allSettled([
        api.get(ENDPOINTS.QUOTE_OFFERS(id)),
        api.get(ENDPOINTS.QUOTE_MESSAGES(id)),
      ]);
      setOffers(oRes.status === 'fulfilled' && Array.isArray(oRes.value.data) ? oRes.value.data : []);
      setMessages(mRes.status === 'fulfilled' && Array.isArray(mRes.value.data) ? mRes.value.data : []);
      setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
    } catch (e) { console.error('loadThread error:', e); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selected) loadThread(selected.request_id); }, [selected]);

  const filtered = requests.filter(r => tab === 'all' || r.status === tab);
  const counts = {
    all: requests.length,
    draft: requests.filter(r=>r.status==='draft').length,
    sent: requests.filter(r=>r.status==='sent').length,
    negotiating: requests.filter(r=>r.status==='negotiating').length,
    accepted: requests.filter(r=>r.status==='accepted').length,
  };

  const handleSendOffer = async () => {
    if (!offerAmt || !selected) return;
    setConfirming(true);
    try {
      await api.post(ENDPOINTS.QUOTE_OFFERS(selected.request_id), { offered_amount_usd: Number(offerAmt), currency: 'USD' });
      toast.success('Offer sent to sender!');
      setOfferAmt('');
      await Promise.all([load(), loadThread(selected.request_id)]);
    } catch(e) { toast.error(e?.response?.data?.detail || 'Failed to send offer.'); }
    finally { setConfirming(false); }
  };

  const handleSendMsg = async () => {
    if (!msgBody.trim() && !counter) return;
    setSending(true);
    try {
      await api.post(ENDPOINTS.QUOTE_MESSAGES(selected.request_id), {
        message_type: counter ? 'counter' : 'text',
        body: msgBody.trim() || null,
        counter_amount_usd: counter ? Number(counter) : null,
      });
      setMsgBody(''); setCounter('');
      await loadThread(selected.request_id);
    } catch(e) { toast.error(e?.response?.data?.detail || 'Failed to send.'); }
    finally { setSending(false); }
  };

  const handleSendOfferInChat = async () => {
    if (!offerAmt || !selected) return;
    setConfirming(true);
    try {
      await api.post(ENDPOINTS.QUOTE_OFFERS(selected.request_id), { offered_amount_usd: Number(offerAmt), currency: 'USD', notes: msgBody.trim() || null });
      await api.post(ENDPOINTS.QUOTE_MESSAGES(selected.request_id), {
        message_type: 'counter',
        body: `Offer proposal: $${Number(offerAmt).toLocaleString()} USD${msgBody.trim() ? ' — ' + msgBody.trim() : ''}`,
        counter_amount_usd: Number(offerAmt),
      });
      toast.success('Offer sent to sender!');
      setOfferAmt(''); setMsgBody(''); setShowOfferForm(false);
      await Promise.all([load(), loadThread(selected.request_id)]);
    } catch(e) { toast.error(e?.response?.data?.detail || 'Failed to send offer.'); }
    finally { setConfirming(false); }
  };

  const handleDriverEmergency = async () => {
    setDriverSending(true);
    try {
      await new Promise(r => setTimeout(r, 600)); // simulate network
      toast.success('🚨 Emergency alert sent to driver!');
      setDriverMsg('');
    } catch { toast.error('Failed to send emergency alert.'); }
    finally { setDriverSending(false); }
  };

  const handleDriverMsg = async () => {
    if (!driverMsg.trim()) return;
    setDriverSending(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      toast.success('Message sent to driver.');
      setDriverMsg('');
    } catch { toast.error('Failed to send.'); }
    finally { setDriverSending(false); }
  };

  if (loading) return <div style={{ minHeight:300, display:'grid', placeItems:'center' }}><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Consignment Requests</h1>
          <p className="page-subtitle">Incoming orders from senders — plan, price, and confirm.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {counts.sent > 0 && <span style={{ background:'rgba(59,130,246,0.15)', color:'#3B82F6', fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20 }}>{counts.sent} New</span>}
          {counts.negotiating > 0 && <span style={{ background:'rgba(245,158,11,0.15)', color:'#F59E0B', fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20 }}>{counts.negotiating} Negotiating</span>}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border-default)', background: tab===t ? 'var(--accent-primary)' : 'transparent', color: tab===t ? '#fff' : 'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer', textTransform:'capitalize', transition:'all 0.2s' }}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase()+t.slice(1)} <span style={{ opacity:0.8 }}>({counts[t]||0})</span>
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={Package} title="No consignment requests" description="When senders broadcast quote requests, they will appear here." />
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:16, alignItems:'start' }}>

          {/* LEFT — list */}
          <div style={{ display:'grid', gap:0 }}>
            {filtered.length === 0
              ? <p style={{ color:'var(--text-muted)', fontSize:13, padding:16 }}>No requests with this filter.</p>
              : filtered.map(req => (
                <div key={req.request_id} onClick={() => { setSelected(req); setView('plan'); }}
                  style={{ padding:'14px 16px', borderRadius:10, cursor:'pointer', marginBottom:8, border: selected?.request_id===req.request_id ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)', background: selected?.request_id===req.request_id ? 'rgba(59,130,246,0.07)' : 'var(--bg-card)', transition:'all 0.2s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:12, fontFamily:'monospace', fontWeight:700, color:'var(--accent-primary)' }}>REQ-{req.request_id.slice(0,6).toUpperCase()}</span>
                    <Badge status={req.status} />
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{req.shipper_name||'Sender'}{req.shipper_company?` · ${req.shipper_company}`:''}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:3 }}>
                    <Package size={11} style={{ display:'inline', marginRight:3 }} />{CARGO_LABELS[req.cargo_type]||req.cargo_type||'Cargo'}{req.weight_kg?` · ${Number(req.weight_kg).toLocaleString()} kg`:''}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8 }}>
                    <Navigation size={11} style={{ display:'inline', marginRight:3 }} />{req.origin_port_name||'Origin'} → {req.destination_port_name||'Dest'}
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{timeAgo(req.created_at)}</span>
                    {req.offer_count>0 && <span style={{ fontSize:11, color:'var(--accent-primary)' }}>· {req.offer_count} offer{req.offer_count>1?'s':''}</span>}
                    <div style={{ flex:1 }} />
                    <button type="button" onClick={e=>{e.stopPropagation();setSelected(req);setView('chat');}} style={{ fontSize:11, padding:'3px 8px', borderRadius:5, border:'1px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                      <MessageSquare size={11} /> Chat
                    </button>
                  </div>
                </div>
              ))
            }
          </div>

          {/* RIGHT — detail */}
          {!selected ? (
            <div style={{ display:'grid', placeItems:'center', minHeight:300, background:'var(--bg-card)', borderRadius:12, border:'1px solid var(--border-default)' }}>
              <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
                <Package size={40} style={{ opacity:0.3, marginBottom:10 }} />
                <p style={{ fontSize:14 }}>Select a request to view details</p>
              </div>
            </div>
          ) : (
            <div style={{ background:'var(--bg-card)', borderRadius:12, padding:20, border:'1px solid var(--border-default)' }}>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingBottom:14, borderBottom:'1px solid var(--border-default)' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, color:'var(--accent-primary)' }}>REQ-{selected.request_id.slice(0,6).toUpperCase()}</span>
                    <Badge status={selected.status} />
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{selected.shipper_name||'Sender'} {selected.shipper_company?`— ${selected.shipper_company}`:''}</div>
                </div>
                <button type="button" onClick={()=>setSelected(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={18} /></button>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, marginBottom:16 }}>
                {['plan','chat'].map(v=>(
                  <button key={v} type="button" onClick={()=>setView(v)} style={{ padding:'5px 12px', borderRadius:6, border:'none', background:view===v?'var(--accent-primary)':'var(--bg-elevated)', color:view===v?'#fff':'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    {v==='plan'?'👁 View & Plan':'💬 Negotiate'}
                  </button>
                ))}
              </div>

              {view === 'plan' && (
                <div style={{ display:'grid', gap:14 }}>
                  {/* Order details */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:12 }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, fontWeight:600 }}>CARGO</div>
                      <div style={{ fontSize:13, fontWeight:700 }}>{CARGO_LABELS[selected.cargo_type]||selected.cargo_type||'—'}</div>
                      {selected.weight_kg && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{Number(selected.weight_kg).toLocaleString()} kg</div>}
                      {selected.special_instructions && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{selected.special_instructions}</div>}
                    </div>
                    <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:12 }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, fontWeight:600 }}>ROUTE</div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{selected.origin_port_name||'Origin'}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>→ {selected.destination_port_name||'Destination'}</div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{selected.pickup_address||''}</div>
                    </div>
                  </div>

                  <FinPanel req={selected} />
                  <AIPlan req={selected} drivers={drivers} vessels={vessels} />

                  {/* Offer & action */}
                  {selected.status !== 'accepted' && (
                    <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:16 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Send Offer to Sender</div>
                      <div style={{ display:'flex', gap:8 }}>
                        <input type="number" value={offerAmt} onChange={e=>setOfferAmt(e.target.value)} placeholder="Amount in USD" className="input" style={{ flex:1 }} />
                        <button type="button" onClick={handleSendOffer} disabled={confirming||!offerAmt} className="btn-primary" style={{ whiteSpace:'nowrap' }}>
                          {confirming ? 'Sending…' : '✅ Send Offer'}
                        </button>
                      </div>
                      <div style={{ marginTop:8, fontSize:11, color:'var(--text-muted)' }}>Recommended counter: ${calcFin(selected).recommended.toLocaleString()} · Min viable: ${calcFin(selected).minRate.toLocaleString()}</div>
                    </div>
                  )}
                  {selected.status === 'accepted' && (
                    <div style={{ padding:12, borderRadius:8, background:'rgba(16,185,129,0.1)', border:'1px solid #10B981', color:'#10B981', fontWeight:700, textAlign:'center' }}>✅ This request has been accepted and a shipment created.</div>
                  )}
                </div>
              )}

              {view === 'chat' && (() => {
                const assignedDriver = drivers.find(d => d.status === 'en-route') || drivers[0];
                return (
                  <div>
                    {/* Channel selector */}
                    <div style={{ display:'flex', gap:6, marginBottom:14, background:'var(--bg-elevated)', padding:4, borderRadius:10 }}>
                      {[
                        { key:'sender', label:'💬 Sender', color:'#3B82F6' },
                        { key:'driver', label:'🚛 Driver Line', color:'#F59E0B' },
                        { key:'emergency', label:'🚨 Emergency', color:'#EF4444' },
                      ].map(ch => (
                        <button key={ch.key} type="button" onClick={() => setChatChannel(ch.key)}
                          style={{ flex:1, padding:'7px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, transition:'all 0.2s',
                            background: chatChannel===ch.key ? ch.color : 'transparent',
                            color: chatChannel===ch.key ? '#fff' : 'var(--text-secondary)',
                          }}>
                          {ch.label}
                        </button>
                      ))}
                    </div>

                    {/* ── SENDER CHANNEL ────────────────────────────── */}
                    {chatChannel === 'sender' && (
                      <div>
                        {/* Chat bubbles — messages + offer proposals interleaved */}
                        <div ref={chatRef} style={{ minHeight:220, maxHeight:300, overflowY:'auto', marginBottom:12, display:'flex', flexDirection:'column', gap:8, padding:'4px 0' }}>
                          {messages.length === 0
                            ? <div style={{ flex:1, display:'grid', placeItems:'center', color:'var(--text-muted)', fontSize:13, padding:30 }}>
                                <div style={{ textAlign:'center' }}>
                                  <MessageSquare size={28} style={{ opacity:0.25, marginBottom:8 }} />
                                  <p>No messages yet — start the negotiation</p>
                                </div>
                              </div>
                            : messages.map(m => {
                                const mine = String(m.sender_user_id) === String(user?.user_id);
                                const isOffer = m.message_type === 'counter' && m.counter_amount_usd != null;
                                return (
                                  <div key={m.message_id} style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start' }}>
                                    {isOffer ? (
                                      /* Offer bubble — special card style */
                                      <div style={{ maxWidth:'80%', background: mine ? 'linear-gradient(135deg,#3B82F6,#6366F1)' : 'var(--bg-elevated)', borderRadius:12, padding:0, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}>
                                        <div style={{ padding:'8px 14px 6px', borderBottom:`1px solid ${mine?'rgba(255,255,255,0.15)':'var(--border-default)'}` }}>
                                          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', opacity:0.7, color:mine?'#fff':'var(--text-muted)', marginBottom:2 }}>
                                            {mine ? '📤 OFFER PROPOSAL' : '📥 COUNTER OFFER'} · {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                                          </div>
                                          <div style={{ fontSize:22, fontWeight:800, color:mine?'#fff':'var(--text-primary)', lineHeight:1 }}>
                                            ${Number(m.counter_amount_usd).toLocaleString()}
                                            <span style={{ fontSize:12, fontWeight:400, marginLeft:4, opacity:0.7 }}>USD</span>
                                          </div>
                                        </div>
                                        {m.body && <div style={{ padding:'6px 14px 8px', fontSize:12, color:mine?'rgba(255,255,255,0.85)':'var(--text-secondary)' }}>{m.body}</div>}
                                      </div>
                                    ) : (
                                      /* Normal text bubble */
                                      <div style={{ maxWidth:'75%', padding:'8px 12px', borderRadius:mine?'12px 12px 4px 12px':'12px 12px 12px 4px', background:mine?'var(--accent-primary)':'var(--bg-elevated)', color:mine?'#fff':'var(--text-primary)' }}>
                                        <div style={{ fontSize:10, opacity:0.65, marginBottom:3 }}>{mine?'You (Manager)':selected.shipper_name||'Sender'} · {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                                        <div style={{ fontSize:13 }}>{m.body}</div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                          }
                        </div>

                        {/* Offer form (slides in) */}
                        {showOfferForm && (
                          <div style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:10, padding:12, marginBottom:10 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#3B82F6', marginBottom:8 }}>💰 Send Offer Proposal</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                              <div>
                                <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:3 }}>OFFER AMOUNT (USD)</div>
                                <input type="number" className="input" value={offerAmt} onChange={e=>setOfferAmt(e.target.value)} placeholder={`e.g. ${calcFin(selected).recommended.toLocaleString()}`} />
                              </div>
                              <div>
                                <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:3 }}>NOTE (optional)</div>
                                <input type="text" className="input" value={msgBody} onChange={e=>setMsgBody(e.target.value)} placeholder="Transit time, terms..." />
                              </div>
                            </div>
                            <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:8 }}>
                              Rec: ${calcFin(selected).recommended.toLocaleString()} · Min: ${calcFin(selected).minRate.toLocaleString()} · Profit at rec: ${(calcFin(selected).recommended - calcFin(selected).cost).toLocaleString()}
                            </div>
                            <div style={{ display:'flex', gap:8 }}>
                              <button type="button" className="btn-primary" disabled={confirming||!offerAmt} onClick={handleSendOfferInChat} style={{ flex:1 }}>
                                {confirming ? 'Sending…' : '✅ Send Offer in Chat'}
                              </button>
                              <button type="button" onClick={() => { setShowOfferForm(false); setOfferAmt(''); setMsgBody(''); }} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:12 }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Message input */}
                        {selected.status !== 'accepted' && !showOfferForm && (
                          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                            <textarea className="textarea" rows={2} value={msgBody} onChange={e=>setMsgBody(e.target.value)}
                              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendMsg();}}}
                              placeholder="Message to sender... (Enter to send)" style={{ flex:1, resize:'none', minHeight:42 }} />
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              <button type="button" className="btn-primary" disabled={sending||!msgBody.trim()} onClick={handleSendMsg} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px' }}>
                                <Send size={14} />{sending?'…':'Send'}
                              </button>
                              <button type="button" onClick={() => setShowOfferForm(true)}
                                style={{ padding:'8px 10px', borderRadius:6, border:'1px solid rgba(59,130,246,0.4)', background:'rgba(59,130,246,0.08)', color:'#3B82F6', cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                                💰 Offer
                              </button>
                            </div>
                          </div>
                        )}
                        {selected.status === 'accepted' && (
                          <div style={{ padding:10, borderRadius:8, background:'rgba(16,185,129,0.08)', border:'1px solid #10B981', color:'#10B981', fontWeight:600, textAlign:'center', fontSize:13 }}>
                            ✅ Deal accepted — shipment created
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── DRIVER CHANNEL ────────────────────────────── */}
                    {chatChannel === 'driver' && (
                      <div>
                        {assignedDriver ? (
                          <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:14, marginBottom:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                              <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(245,158,11,0.15)', display:'grid', placeItems:'center' }}>
                                <Truck size={20} style={{ color:'#F59E0B' }} />
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:700, fontSize:14 }}>{assignedDriver.full_name}</div>
                                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{assignedDriver.email || 'Driver'} · {assignedDriver.phone_number || 'No phone'}</div>
                                <div style={{ fontSize:11, color:assignedDriver.status==='en-route'?'#F59E0B':'#10B981', fontWeight:600, marginTop:2 }}>
                                  ● {assignedDriver.status === 'en-route' ? 'On Route' : 'Available'}
                                </div>
                              </div>
                              <div style={{ display:'flex', gap:6 }}>
                                <span style={{ padding:'4px 10px', borderRadius:6, background:'rgba(16,185,129,0.1)', color:'#10B981', fontSize:11, fontWeight:700 }}>📞 Call</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:14, marginBottom:12, color:'var(--text-muted)', fontSize:13, textAlign:'center' }}>
                            No driver assigned to this request yet. Assign one in the route plan.
                          </div>
                        )}
                        <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:14, marginBottom:10 }}>
                          <div style={{ fontSize:12, fontWeight:700, marginBottom:10, color:'var(--text-secondary)' }}>📨 MESSAGE TO DRIVER</div>
                          <textarea className="textarea" rows={3} value={driverMsg} onChange={e=>setDriverMsg(e.target.value)} placeholder="Instructions, route update, pickup notes..." style={{ marginBottom:8 }} />
                          <button type="button" className="btn-primary" disabled={driverSending||!driverMsg.trim()} onClick={handleDriverMsg} style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <Send size={14} />{driverSending?'Sending…':'Send to Driver'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── EMERGENCY CHANNEL ─────────────────────────── */}
                    {chatChannel === 'emergency' && (
                      <div>
                        <div style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:16, marginBottom:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                            <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(239,68,68,0.15)', display:'grid', placeItems:'center', animation:'pulse 1.5s infinite' }}>
                              <span style={{ fontSize:20 }}>🚨</span>
                            </div>
                            <div>
                              <div style={{ fontWeight:800, fontSize:14, color:'#EF4444' }}>Emergency Line</div>
                              <div style={{ fontSize:12, color:'var(--text-secondary)' }}>For urgent situations — driver accidents, cargo damage, route blockage</div>
                            </div>
                          </div>
                          <div style={{ display:'grid', gap:8 }}>
                            {['Driver is unresponsive', 'Cargo damage reported', 'Road accident — need assistance', 'Customs hold — urgent review'].map(preset => (
                              <button key={preset} type="button" onClick={() => setDriverMsg(preset)}
                                style={{ padding:'8px 12px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.05)', color:'var(--text-primary)', textAlign:'left', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                                ⚠️ {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea className="textarea" rows={3} value={driverMsg} onChange={e=>setDriverMsg(e.target.value)} placeholder="Describe the emergency situation..." style={{ marginBottom:8, border:'1px solid rgba(239,68,68,0.4)' }} />
                        <button type="button" disabled={driverSending} onClick={handleDriverEmergency}
                          style={{ width:'100%', padding:'12px', borderRadius:8, border:'none', background: driverSending ? 'var(--bg-elevated)' : 'linear-gradient(135deg,#EF4444,#DC2626)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                          🚨 {driverSending ? 'Sending Alert…' : 'Send Emergency Alert to All'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
