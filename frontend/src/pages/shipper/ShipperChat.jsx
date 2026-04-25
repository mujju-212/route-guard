import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, MessageSquare, Package, Send, ShieldCheck, Ship, Navigation, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../hooks/useAuth';

const STATUS_COLOR = { sent:'#3B82F6', negotiating:'#F59E0B', accepted:'#10B981', rejected:'#EF4444', draft:'#8A9BB5' };
const CARGO_LABELS = { standard:'Standard Dry', electronics:'Electronics', refrigerated:'Refrigerated', hazardous:'Hazardous', liquid_bulk:'Liquid Bulk', oversized:'Oversized', livestock:'Livestock', perishable:'Perishable', pharmaceutical:'Pharmaceutical' };

function StatusPill({ status }) {
  const c = STATUS_COLOR[status] || '#8A9BB5';
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, color:c, background:`${c}20`, letterSpacing:'0.06em' }}>{String(status||'').toUpperCase()}</span>;
}

export default function ShipperChat() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [selId, setSelId] = useState('');
  const [offers, setOffers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgBody, setMsgBody] = useState('');
  const [counter, setCounter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const chatRef = useRef(null);

  const sel = useMemo(() => requests.find(r => r.request_id === selId) || null, [requests, selId]);

  const loadReqs = async () => {
    const r = await api.get(ENDPOINTS.QUOTE_REQUESTS);
    const rows = Array.isArray(r.data) ? r.data : [];
    setRequests(rows);
    if (!selId && rows.length > 0) setSelId(rows[0].request_id);
  };

  const loadThread = async (id) => {
    if (!id) return;
    const [oR, mR] = await Promise.all([api.get(ENDPOINTS.QUOTE_OFFERS(id)), api.get(ENDPOINTS.QUOTE_MESSAGES(id))]);
    setOffers(Array.isArray(oR.data) ? oR.data : []);
    setMessages(Array.isArray(mR.data) ? mR.data : []);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  };

  useEffect(() => { (async () => { setLoading(true); try { await loadReqs(); } catch { toast.error('Failed to load requests.'); } finally { setLoading(false); } })(); }, []);
  useEffect(() => { if (selId) loadThread(selId).catch(() => {}); }, [selId]);

  const handleSend = async () => {
    if (!selId || (!msgBody.trim() && !counter)) return;
    setSubmitting(true);
    try {
      await api.post(ENDPOINTS.QUOTE_MESSAGES(selId), { message_type: counter ? 'counter' : 'text', body: msgBody.trim() || null, counter_amount_usd: counter ? Number(counter) : null });
      setMsgBody(''); setCounter('');
      await loadThread(selId);
    } catch(e) { toast.error(e?.response?.data?.detail || 'Send failed.'); }
    finally { setSubmitting(false); }
  };

  const handleAccept = async (offerId) => {
    try {
      const res = await api.post(ENDPOINTS.ACCEPT_OFFER(offerId));
      toast.success(`✅ Offer accepted! Shipment ${res.data?.tracking_number || 'created'}.`);
      await Promise.all([loadReqs(), loadThread(selId)]);
    } catch(e) { toast.error(e?.response?.data?.detail || 'Accept failed.'); }
  };

  const handleReject = async (offerId) => {
    try { await api.post(ENDPOINTS.REJECT_OFFER(offerId)); await loadThread(selId); toast.success('Offer rejected.'); }
    catch(e) { toast.error(e?.response?.data?.detail || 'Reject failed.'); }
  };

  if (loading) return <div style={{ minHeight:300, display:'grid', placeItems:'center' }}><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sender Negotiation Console</h1>
          <p className="page-subtitle">Review offers from logistics managers and negotiate rates for your shipments.</p>
        </div>
        {requests.filter(r => r.status === 'negotiating' || r.status === 'sent').length > 0 && (
          <span style={{ background:'rgba(245,158,11,0.15)', color:'#F59E0B', fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20 }}>
            {requests.filter(r => ['sent','negotiating'].includes(r.status)).length} Active
          </span>
        )}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No quote requests yet" description="Create a new order first, then offers and messages will appear here." />
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start' }}>

          {/* LEFT — request selector */}
          <div style={{ background:'var(--bg-card)', borderRadius:12, padding:16, border:'1px solid var(--border-default)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10, letterSpacing:'0.04em' }}>YOUR REQUESTS</div>
            {requests.map(req => (
              <div key={req.request_id} onClick={() => setSelId(req.request_id)}
                style={{ padding:'10px 12px', borderRadius:8, cursor:'pointer', marginBottom:6, border: selId===req.request_id ? '1px solid var(--accent-primary)' : '1px solid transparent', background: selId===req.request_id ? 'rgba(59,130,246,0.07)' : 'var(--bg-elevated)', transition:'all 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, color:'var(--accent-primary)' }}>REQ-{req.request_id.slice(0,6).toUpperCase()}</span>
                  <StatusPill status={req.status} />
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:2 }}>
                  <Package size={11} style={{ display:'inline', marginRight:3 }} />
                  {CARGO_LABELS[req.cargo_type] || req.cargo_type || 'Cargo'}
                  {req.weight_kg ? ` · ${Number(req.weight_kg).toLocaleString()} kg` : ''}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {req.origin_port_name || req.pickup_address || '—'} → {req.destination_port_name || req.dropoff_address || '—'}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT — thread */}
          {!sel ? (
            <div style={{ display:'grid', placeItems:'center', minHeight:300, background:'var(--bg-card)', borderRadius:12, border:'1px solid var(--border-default)' }}>
              <p style={{ color:'var(--text-muted)', fontSize:14 }}>Select a request</p>
            </div>
          ) : (
            <div style={{ background:'var(--bg-card)', borderRadius:12, border:'1px solid var(--border-default)', overflow:'hidden' }}>
              {/* Header */}
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-default)', background:'var(--bg-elevated)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <Ship size={15} style={{ color:'var(--accent-primary)' }} />
                  <span style={{ fontWeight:700, fontSize:14 }}>REQ-{sel.request_id.slice(0,6).toUpperCase()}</span>
                  <StatusPill status={sel.status} />
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  {CARGO_LABELS[sel.cargo_type] || sel.cargo_type || 'Cargo'}
                  {sel.weight_kg ? ` · ${Number(sel.weight_kg).toLocaleString()} kg` : ''}
                  {sel.pickup_address ? ` · Pickup: ${sel.pickup_address}` : ''}
                </div>
              </div>

              {/* Accepted banner */}
              {sel.status === 'accepted' && (
                <div style={{ padding:'10px 18px', background:'rgba(16,185,129,0.1)', borderBottom:'1px solid #10B981' }}>
                  <span style={{ color:'#10B981', fontWeight:700, fontSize:13 }}>✅ Offer accepted — your shipment has been created and will appear in your orders.</span>
                </div>
              )}

              {/* Offers */}
              {offers.length > 0 && (
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-default)' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10 }}>OFFERS FROM LOGISTICS MANAGER</div>
                  <div style={{ display:'grid', gap:8 }}>
                    {offers.map(o => (
                      <div key={o.offer_id} style={{ background:'var(--bg-elevated)', borderRadius:10, padding:12, borderLeft:`3px solid ${o.status==='accepted'?'#10B981':o.status==='rejected'?'#EF4444':'#3B82F6'}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:18, fontWeight:800 }}>${Number(o.offered_amount_usd).toLocaleString()} <span style={{ fontSize:12, fontWeight:400 }}>{o.currency}</span></span>
                          <span style={{ fontSize:11, fontWeight:700, color:o.status==='accepted'?'#10B981':o.status==='rejected'?'#EF4444':'#3B82F6' }}>{String(o.status).toUpperCase()}</span>
                        </div>
                        {o.estimated_pickup_at && <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>Pickup: {new Date(o.estimated_pickup_at).toLocaleString()}</div>}
                        {o.estimated_delivery_at && <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>Delivery: {new Date(o.estimated_delivery_at).toLocaleString()}</div>}
                        {o.notes && <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>{o.notes}</div>}
                        {o.status === 'pending' && sel.status !== 'accepted' && (
                          <div style={{ display:'flex', gap:8, marginTop:6 }}>
                            <button type="button" className="btn-primary" onClick={() => handleAccept(o.offer_id)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                              <ShieldCheck size={14} /> Accept Offer
                            </button>
                            <button type="button" className="btn-outline" onClick={() => handleReject(o.offer_id)} style={{ flex:1 }}>Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat thread */}
              <div ref={chatRef} style={{ padding:'14px 18px', maxHeight:300, overflowY:'auto', display:'grid', gap:8 }}>
                {messages.length === 0
                  ? <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'20px 0' }}>No messages yet — send a note to the manager below.</p>
                  : messages.map(m => {
                      const mine = String(m.sender_user_id) === String(user?.user_id);
                      return (
                        <div key={m.message_id} style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start' }}>
                          <div style={{ maxWidth:'72%', padding:'8px 12px', borderRadius:mine?'12px 12px 4px 12px':'12px 12px 12px 4px', background:mine?'var(--accent-primary)':'var(--bg-elevated)', color:mine?'#fff':'var(--text-primary)' }}>
                            <div style={{ fontSize:10, opacity:0.7, marginBottom:3 }}>
                              {mine ? 'You' : 'Manager'} · {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </div>
                            {m.body && <div style={{ fontSize:13 }}>{m.body}</div>}
                            {m.counter_amount_usd != null && <div style={{ fontSize:12, fontWeight:700, marginTop:3 }}>Counter offer: ${Number(m.counter_amount_usd).toLocaleString()}</div>}
                          </div>
                        </div>
                      );
                    })
                }
              </div>

              {/* Input */}
              {sel.status !== 'accepted' && (
                <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border-default)', background:'var(--bg-elevated)', display:'grid', gap:8 }}>
                  <textarea className="textarea" rows={2} value={msgBody} onChange={e=>setMsgBody(e.target.value)} placeholder="Message to the manager..." style={{ resize:'none' }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="number" className="input" value={counter} onChange={e=>setCounter(e.target.value)} placeholder="Counter amount USD (optional)" style={{ flex:1 }} />
                    <button type="button" className="btn-primary" disabled={submitting||(!msgBody.trim()&&!counter)} onClick={handleSend} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Send size={14} />{submitting ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
