import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import Spinner from '../../components/ui/Spinner';
import { useAuth } from '../../hooks/useAuth';

const T = {
navy: '#080E1A',
card: '#0D1526',
border: '#1A2A45',
teal: '#00D4B4',
cyan: '#22D3EE',
amber: '#F59E0B',
red: '#EF4444',
green: '#10B981',
white: '#F0F4FF',
gray: '#8A9BB5',
grayDim: '#4A5F7A',
};

const css = `
  .mono{font-family:'JetBrains Mono',monospace}
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .live-dot{width:8px;height:8px;background:${T.green};border-radius:50%;animation:pulse 2s infinite;display:inline-block}
  .card{background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:18px;transition:all .2s}
  .card:hover{border-color:rgba(0,212,180,.28)}
  .kpi{background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:16px}
  .kpi-num{font-size:26px;font-weight:700;line-height:1.1}
  .chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
  .chip-teal{background:rgba(0,212,180,.15);color:${T.teal};border:1px solid rgba(0,212,180,.3)}
  .chip-amber{background:rgba(245,158,11,.15);color:${T.amber};border:1px solid rgba(245,158,11,.3)}
  .chip-red{background:rgba(239,68,68,.15);color:${T.red};border:1px solid rgba(239,68,68,.3)}
  .chip-green{background:rgba(16,185,129,.15);color:${T.green};border:1px solid rgba(16,185,129,.3)}
  .btn-primary{background:linear-gradient(135deg,${T.teal},${T.cyan});color:#000;font-weight:700;font-size:13px;padding:10px 16px;border:none;border-radius:8px;cursor:pointer;transition:all .2s}
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,212,180,.35)}
  .btn-ghost{background:transparent;color:${T.teal};font-weight:600;font-size:13px;padding:9px 14px;border:1px solid ${T.teal};border-radius:8px;cursor:pointer;transition:all .2s}
  .btn-ghost:hover{background:rgba(0,212,180,.08)}
  .section-label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${T.grayDim};margin-bottom:12px}
`;

const CHAT_STORAGE_KEY = 'driver:chat:messages';
const PROFILE_STORAGE_KEY = 'driver:profile:settings';

const fmtStatus = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown');
const fmtDate = (iso) => {
if (!iso) return '-';
try {
return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
} catch {
return iso;
}
};

const chipVariant = (s) => {
if (s === 'delivered') return 'green';
if (s === 'delayed') return 'red';
if (['in_transit', 'picked_up', 'at_port', 'customs'].includes(String(s))) return 'teal';
return 'amber';
};

const Chip = ({ label, variant = 'teal', dot = false }) => (
<div className={`chip chip-${variant}`}>
{dot && <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />}
{label}
</div>
);

const InfoRow = ({ k, v }) => (
<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
<span style={{ color: T.gray }}>{k}</span>
<span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
</div>
);

const RouteMap = ({ assignment }) => {
const waypoints = assignment?.route_waypoints || [];
const currentPos = assignment?.current_latitude && assignment?.current_longitude
? [Number(assignment.current_latitude), Number(assignment.current_longitude)]
: null;

if (!waypoints.length && !currentPos) {
return <div className="card" style={{ color: T.gray }}>No route coordinates available yet.</div>;
}

const positions = waypoints.map((p) => [Number(p.lat), Number(p.lng)]);
const center = currentPos || (positions.length ? positions[Math.floor(positions.length / 2)] : [20, 60]);

return (
<div className="card" style={{ padding: 0, overflow: 'hidden' }}>
<div style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span style={{ fontSize: 13, fontWeight: 700 }}>Live Route Map</span>
{currentPos && <span className="chip chip-teal" style={{ fontSize: 10 }}>GPS Active</span>}
</div>
<div style={{ height: 290, marginTop: 8 }}>
<MapContainer center={center} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
<TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM &copy; CARTO" />
{positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#22D3EE', weight: 3, opacity: 0.8, dashArray: '8 4' }} />}
{positions.length > 0 && (
<CircleMarker center={positions[0]} radius={7} pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }}>
<Tooltip>{assignment.origin_port_name || 'Origin'}</Tooltip>
</CircleMarker>
)}
{positions.length > 1 && (
<CircleMarker center={positions[positions.length - 1]} radius={7} pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 }}>
<Tooltip>{assignment.destination_port_name || 'Destination'}</Tooltip>
</CircleMarker>
)}
{currentPos && (
<CircleMarker center={currentPos} radius={9} pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 0.9, weight: 2 }}>
<Tooltip permanent direction="top" offset={[0, -10]}>You Are Here</Tooltip>
</CircleMarker>
)}
</MapContainer>
</div>
</div>
);
};

function DashboardScreen({ assignment, shipments, alerts, loading, go }) {
const total = shipments.length;
const completed = shipments.filter((s) => String(s.current_status) === 'delivered').length;
const delayed = shipments.filter((s) => String(s.current_status) === 'delayed').length;
const history = [...shipments]
.filter((s) => ['delivered', 'delayed', 'cancelled'].includes(String(s.current_status)))
.sort((a, b) => new Date(b.updated_at || b.expected_arrival || 0) - new Date(a.updated_at || a.expected_arrival || 0))
.slice(0, 6);

return (
<div style={{ animation: 'fadeUp 0.5s ease', display: 'grid', gap: 16 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div>
<div style={{ fontSize: 12, color: T.gray }}>Driver Dashboard</div>
<h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{assignment?.driver_name || 'Driver'}</h2>
</div>
<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
<span className="live-dot" />
<span style={{ fontSize: 11, color: T.gray }}>Live Monitoring</span>
</div>
</div>

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
<div className="kpi"><div className="kpi-num" style={{ color: T.teal }}>{total}</div><div style={{ fontSize: 11, color: T.gray }}>Total Assignments</div></div>
<div className="kpi"><div className="kpi-num" style={{ color: T.green }}>{completed}</div><div style={{ fontSize: 11, color: T.gray }}>Completed</div></div>
<div className="kpi"><div className="kpi-num" style={{ color: delayed ? T.red : T.amber }}>{delayed}</div><div style={{ fontSize: 11, color: T.gray }}>Delayed</div></div>
</div>

<div className="card">
<div className="section-label">Quick Actions</div>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
<button className="btn-ghost" onClick={() => go('status')}>Update Status</button>
<button className="btn-ghost" onClick={() => go('navigation')}>Open Navigation</button>
<button className="btn-ghost" onClick={() => go('chat')}>Chat Manager</button>
<button className="btn-ghost" onClick={() => go('emergency')}>Emergency</button>
<button className="btn-ghost" onClick={() => go('alerts')}>Open Alerts</button>
<button className="btn-primary" onClick={() => go('details')}>View Active Order</button>
</div>
</div>

<div className="card">
<div className="section-label">Current Assignment</div>
{loading ? <Spinner size="md" /> : assignment ? (
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
<div>
<div className="mono" style={{ fontWeight: 700 }}>{assignment.tracking_number}</div>
<div style={{ fontSize: 12, color: T.gray }}>{assignment.origin_port_name} -&gt; {assignment.destination_port_name}</div>
<div style={{ marginTop: 6 }}><Chip label={fmtStatus(assignment.current_status)} variant={chipVariant(assignment.current_status)} dot /></div>
</div>
<button className="btn-primary" onClick={() => go('assignment')}>Open Assignment</button>
</div>
) : <div style={{ color: T.gray }}>No active assignment right now.</div>}
</div>

<div className="card">
<div className="section-label">Recent Alerts</div>
{alerts.length === 0 ? <div style={{ color: T.gray }}>No active alerts.</div> : alerts.slice(0, 4).map((a) => (
<div key={a.alert_id} style={{ padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
<div style={{ fontSize: 11, color: T.amber, fontWeight: 700 }}>{String(a.severity || 'info').toUpperCase()}</div>
<div style={{ fontSize: 13 }}>{a.message}</div>
<div style={{ fontSize: 11, color: T.gray }}>{a.tracking_number || ''}</div>
</div>
))}
</div>

<div className="card">
<div className="section-label">Order History</div>
{history.length === 0 ? <div style={{ color: T.gray }}>No history yet.</div> : history.map((s) => (
<div key={s.shipment_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
<div>
<div className="mono" style={{ fontSize: 12 }}>{s.tracking_number}</div>
<div style={{ fontSize: 11, color: T.gray }}>{s.origin_port_name || '-'} -&gt; {s.destination_port_name || '-'}</div>
</div>
<Chip label={fmtStatus(s.current_status)} variant={chipVariant(s.current_status)} />
</div>
))}
</div>
</div>
);
}

function AssignmentScreen({ assignment, go }) {
if (!assignment) {
return (
<div className="card" style={{ textAlign: 'center', padding: 32 }}>
<div style={{ fontSize: 30, marginBottom: 8 }}>No assignment</div>
<div style={{ fontSize: 16, fontWeight: 600 }}>No Active Assignment</div>
<div style={{ color: T.gray, marginTop: 8 }}>You will see your assignment here as soon as manager assigns one.</div>
<button className="btn-ghost" style={{ marginTop: 14 }} onClick={() => go('profile')}>Update Availability</button>
</div>
);
}

return (
<div style={{ display: 'grid', gap: 16, animation: 'fadeUp 0.5s ease' }}>
<div className="card">
<div className="section-label">Active Assignment</div>
<div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{assignment.tracking_number}</div>
<div style={{ marginTop: 6, color: T.gray }}>{assignment.origin_port_name} -&gt; {assignment.destination_port_name}</div>
<div style={{ marginTop: 8 }}><Chip label={fmtStatus(assignment.current_status)} variant={chipVariant(assignment.current_status)} dot /></div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
<div>
<div style={{ fontSize: 11, color: T.grayDim }}>Cargo</div>
<div>{assignment.cargo_description || fmtStatus(assignment.cargo_type)}</div>
</div>
<div>
<div style={{ fontSize: 11, color: T.grayDim }}>ETA</div>
<div>{fmtDate(assignment.expected_arrival)}</div>
</div>
</div>
</div>
<div style={{ display: 'flex', gap: 10 }}>
<button className="btn-primary" onClick={() => go('details')}>Full Details</button>
<button className="btn-ghost" onClick={() => go('status')}>Update Status</button>
<button className="btn-ghost" onClick={() => go('navigation')}>Navigation</button>
</div>
</div>
);
}

function DetailsScreen({ assignment, go }) {
if (!assignment) return <div className="card">No active order to show.</div>;
const statusHistory = assignment.status_history || [];
return (
<div style={{ display: 'grid', gap: 16, animation: 'fadeUp 0.5s ease' }}>
<div className="card">
<div className="section-label">Order Details</div>
<div className="mono" style={{ fontSize: 14, color: T.teal }}>{assignment.tracking_number}</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
<div>
<InfoRow k="Route" v={`${assignment.origin_port_name} -> ${assignment.destination_port_name}`} />
<InfoRow k="Status" v={fmtStatus(assignment.current_status)} />
<InfoRow k="ETA" v={fmtDate(assignment.expected_arrival)} />
<InfoRow k="Sender" v={assignment.shipper_name || '-'} />
<InfoRow k="Receiver" v={assignment.receiver_name || '-'} />
</div>
<div>
<InfoRow k="Cargo Type" v={fmtStatus(assignment.cargo_type)} />
<InfoRow k="Cargo" v={assignment.cargo_description || '-'} />
<InfoRow k="Weight" v={assignment.weight_kg ? `${assignment.weight_kg} kg` : '-'} />
<InfoRow k="Value" v={assignment.declared_value != null ? `$${Number(assignment.declared_value).toLocaleString()}` : '-'} />
<InfoRow k="Vessel" v={assignment.vessel_name || '-'} />
</div>
</div>
</div>

<RouteMap assignment={assignment} />

<div className="card">
<div className="section-label">Status Timeline</div>
{statusHistory.length === 0 ? <div style={{ color: T.gray }}>No timeline events yet.</div> : statusHistory.map((h, i) => (
<div key={`${h.status}-${i}`} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
<div style={{ width: 10, height: 10, borderRadius: '50%', background: T.teal, marginTop: 6, flexShrink: 0 }} />
<div>
<div style={{ fontSize: 13, fontWeight: 600 }}>{fmtStatus(h.status)}</div>
<div style={{ fontSize: 11, color: T.gray }}>{fmtDate(h.timestamp)}{h.notes ? ` - ${h.notes}` : ''}</div>
</div>
</div>
))}
</div>

<div style={{ display: 'flex', gap: 10 }}>
<button className="btn-primary" onClick={() => go('status')}>Update Status</button>
<button className="btn-ghost" onClick={() => go('navigation')}>Open Navigation</button>
</div>
</div>
);
}

function NavigationScreen({ assignment, go }) {
if (!assignment) return <div className="card">No active assignment for navigation.</div>;
return (
<div style={{ display: 'grid', gap: 16, animation: 'fadeUp 0.5s ease' }}>
<div className="card" style={{ borderLeft: assignment.is_rerouted ? '4px solid #facc15' : `1px solid ${T.border}` }}>
<div className="section-label">Navigation & Route State</div>
<div style={{ fontWeight: 700 }}>{assignment.origin_port_name} -&gt; {assignment.destination_port_name}</div>
<div style={{ color: T.gray, marginTop: 6 }}>Current status: {fmtStatus(assignment.current_status)}</div>
{assignment.is_rerouted && (
<div style={{ marginTop: 10, color: '#facc15', fontSize: 13 }}>Route changed by manager. Follow updated path on map.</div>
)}
</div>
<RouteMap assignment={assignment} />
<div style={{ display: 'flex', gap: 10 }}>
<button className="btn-primary" onClick={() => go('status')}>Update Status</button>
<button className="btn-ghost" onClick={() => go('details')}>View Full Details</button>
</div>
</div>
);
}

function StatusScreen({ assignment }) {
const navigate = useNavigate();
const [form, setForm] = useState({ status: 'in_transit', latitude: '', longitude: '', notes: '', reportIncident: false });
const [saving, setSaving] = useState(false);
const [geoLoading, setGeoLoading] = useState(false);

useEffect(() => {
if (assignment?.current_status) {
setForm((prev) => ({ ...prev, status: assignment.current_status }));
}
}, [assignment?.current_status]);

if (!assignment) return <div className="card">No active assignment to update.</div>;

const statusOptions = [
{ value: 'picked_up', label: 'Picked Up' },
{ value: 'in_transit', label: 'In Transit' },
{ value: 'at_port', label: 'At Port' },
{ value: 'customs', label: 'Customs' },
{ value: 'delivered', label: 'Delivered' },
];

const getLocation = () => {
if (!navigator.geolocation) return;
setGeoLoading(true);
navigator.geolocation.getCurrentPosition(
(pos) => {
setForm((p) => ({ ...p, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
setGeoLoading(false);
},
() => {
toast.error('Could not get location');
setGeoLoading(false);
}
);
};

const submit = async (e) => {
e.preventDefault();
setSaving(true);
try {
await api.put(ENDPOINTS.UPDATE_STATUS(assignment.shipment_id), {
new_status: form.status,
latitude: form.latitude ? Number(form.latitude) : undefined,
longitude: form.longitude ? Number(form.longitude) : undefined,
notes: form.notes || undefined,
});
if (form.reportIncident && form.notes.trim()) {
await api.post(ENDPOINTS.REPORT_INCIDENT(assignment.shipment_id), null, {
params: { incident_type: 'driver_reported', description: form.notes.trim() },
});
}
toast.success('Status updated successfully');
navigate('/driver');
} catch (err) {
toast.error(err?.response?.data?.detail || 'Failed to update status');
} finally {
setSaving(false);
}
};

return (
<div className="card" style={{ maxWidth: 620, margin: '0 auto' }}>
<div className="section-label">Update Assignment Status</div>
<div className="mono" style={{ marginBottom: 10 }}>{assignment.tracking_number}</div>
<form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
<select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }}>
{statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
</select>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
<input type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<input type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
</div>
<button type="button" className="btn-ghost" onClick={getLocation}>{geoLoading ? 'Getting GPS...' : 'Use Current GPS Location'}</button>
<textarea rows={4} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Traffic, incident, delay, delivery remarks..." style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white, resize: 'vertical' }} />
<label style={{ fontSize: 12, color: T.gray, display: 'flex', gap: 8, alignItems: 'center' }}>
<input type="checkbox" checked={form.reportIncident} onChange={(e) => setForm((p) => ({ ...p, reportIncident: e.target.checked }))} />
Also report as incident
</label>
<button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Update'}</button>
</form>
</div>
);
}

function AlertsScreen({ alerts, loading }) {
if (loading) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner size="lg" /></div>;
return (
<div className="card">
<div className="section-label">Driver Alerts</div>
{alerts.length === 0 ? <div style={{ color: T.gray }}>No active alerts</div> : alerts.map((a) => (
<div key={a.alert_id} style={{ borderBottom: `1px solid ${T.border}`, padding: '10px 0' }}>
<div style={{ fontSize: 11, color: T.amber, fontWeight: 700 }}>{String(a.severity || 'info').toUpperCase()}</div>
<div style={{ fontSize: 13 }}>{a.message}</div>
<div style={{ fontSize: 11, color: T.gray }}>{a.tracking_number || ''}</div>
</div>
))}
</div>
);
}

function buildDefaultChannels(user, assignment) {
const managerName = assignment?.manager_name || 'Manager';
const company = user?.company_name || user?.company || 'Operations';
return [
{ id: 'manager', name: `${managerName} Channel`, description: `Direct line with ${managerName}` },
{ id: 'operations', name: `${company} Operations`, description: 'Company logistics and dispatch updates' },
];
}

function defaultWelcomeMessages(user, assignment) {
const managerName = assignment?.manager_name || 'Manager';
const company = user?.company_name || user?.company || 'your company';
const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
return {
manager: [
{ id: `mgr-${Date.now()}`, sender: managerName, text: `Welcome. This is your default channel with ${managerName}.`, time: now },
],
operations: [
{ id: `ops-${Date.now()}`, sender: 'Dispatch', text: `You are connected to ${company} operations for shipment support.`, time: now },
],
};
}

function ChatScreen({ user, assignment }) {
const channels = useMemo(() => buildDefaultChannels(user, assignment), [user, assignment]);
const [activeChannel, setActiveChannel] = useState('manager');
const [messagesByChannel, setMessagesByChannel] = useState(() => {
try {
const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
return parsed && typeof parsed === 'object' ? parsed : {};
} catch {
return {};
}
});
const [draft, setDraft] = useState('');

useEffect(() => {
if (!messagesByChannel.manager || !messagesByChannel.operations) {
setMessagesByChannel((prev) => ({ ...defaultWelcomeMessages(user, assignment), ...prev }));
}
}, [messagesByChannel.manager, messagesByChannel.operations, user, assignment]);

useEffect(() => {
localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesByChannel));
}, [messagesByChannel]);

const send = () => {
if (!draft.trim()) return;
const item = {
id: `${Date.now()}`,
sender: user?.full_name || user?.name || 'Driver',
text: draft.trim(),
time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};
setMessagesByChannel((prev) => ({
...prev,
[activeChannel]: [...(prev[activeChannel] || []), item],
}));
setDraft('');
};

const currentMessages = messagesByChannel[activeChannel] || [];

return (
<div className="card" style={{ display: 'grid', gap: 12, minHeight: 430 }}>
<div className="section-label">Driver Chat</div>
<div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, minHeight: 360 }}>
<div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
<div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, color: T.gray, fontSize: 11, letterSpacing: 0.5 }}>Channels</div>
<div style={{ display: 'grid' }}>
{channels.map((channel) => {
const active = channel.id === activeChannel;
return (
<button
key={channel.id}
type="button"
onClick={() => setActiveChannel(channel.id)}
style={{
textAlign: 'left',
padding: '12px',
background: active ? 'rgba(34,211,238,.08)' : 'transparent',
border: 'none',
borderBottom: `1px solid ${T.border}`,
color: T.white,
cursor: 'pointer',
}}
>
<div style={{ fontSize: 13, fontWeight: 700 }}>{channel.name}</div>
<div style={{ fontSize: 11, color: T.gray }}>{channel.description}</div>
</button>
);
})}
</div>
</div>
<div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 10 }}>
<div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 2 }}>
{currentMessages.length === 0 && <div style={{ color: T.gray }}>No messages in this channel yet.</div>}
{currentMessages.map((m) => (
<div key={m.id} style={{ background: 'rgba(0,0,0,.2)', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10 }}>
<div style={{ fontSize: 12, marginBottom: 4 }}>{m.text}</div>
<div style={{ fontSize: 10, color: T.gray }}>{m.sender} | {m.time}</div>
</div>
))}
</div>
<div style={{ display: 'flex', gap: 8 }}>
<input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type message..." style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<button className="btn-primary" type="button" onClick={send}>Send</button>
</div>
</div>
</div>
</div>
);
}

function EmergencyScreen({ assignment }) {
const [form, setForm] = useState({ type: 'emergency', description: '', location: '' });
const [files, setFiles] = useState([]);
const [saving, setSaving] = useState(false);

const submit = async (e) => {
e.preventDefault();
if (!assignment?.shipment_id) {
toast.error('No active assignment for emergency report');
return;
}
if (!form.description.trim()) {
toast.error('Please enter emergency description');
return;
}
setSaving(true);
try {
const attachmentNote = files.length ? ` | attachments: ${files.map((f) => f.name).join(', ')}` : '';
const payload = `${form.description.trim()}${form.location ? ` | location: ${form.location}` : ''}${attachmentNote}`;
await api.post(ENDPOINTS.REPORT_INCIDENT(assignment.shipment_id), null, {
params: { incident_type: form.type, description: payload },
});
toast.success('Emergency sent to manager channel');
setForm({ type: 'emergency', description: '', location: '' });
setFiles([]);
} catch (err) {
toast.error(err?.response?.data?.detail || 'Failed to send emergency');
} finally {
setSaving(false);
}
};

return (
<div className="card" style={{ maxWidth: 700 }}>
<div className="section-label">Emergency Channel</div>
<form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
<select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }}>
<option value="emergency">Emergency</option>
<option value="accident">Accident</option>
<option value="breakdown">Vehicle Breakdown</option>
<option value="security">Security Issue</option>
</select>
<input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="Current location details" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<textarea rows={5} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the emergency in detail..." style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white, resize: 'vertical' }} />
<input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} style={{ color: T.gray, fontSize: 12 }} />
{files.length > 0 && <div style={{ fontSize: 12, color: T.gray }}>Selected: {files.map((f) => f.name).join(', ')}</div>}
<button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Sending...' : 'Send Emergency Alert'}</button>
</form>
</div>
);
}

function ProfileScreen({ user, onProfileUpdated }) {
const [settings, setSettings] = useState(() => {
try {
const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');
return {
availability: parsed.availability || 'available',
shareLocation: parsed.shareLocation ?? true,
currentLocation: parsed.currentLocation || '',
vehicleType: parsed.vehicleType || '',
licenseNumber: parsed.licenseNumber || '',
vehiclePlateNumber: parsed.vehiclePlateNumber || '',
};
} catch {
return { availability: 'available', shareLocation: true, currentLocation: '', vehicleType: '', licenseNumber: '', vehiclePlateNumber: '' };
}
});
const [form, setForm] = useState(() => ({
full_name: user?.full_name || user?.name || '',
email: user?.email || '',
phone_number: user?.phone_number || '',
country: user?.country || '',
company_name: user?.company_name || user?.company || '',
account_type: user?.account_type || 'individual',
}));
const [saving, setSaving] = useState(false);

useEffect(() => {
setForm({
full_name: user?.full_name || user?.name || '',
email: user?.email || '',
phone_number: user?.phone_number || '',
country: user?.country || '',
company_name: user?.company_name || user?.company || '',
account_type: user?.account_type || 'individual',
});
}, [user]);

useEffect(() => {
localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(settings));
}, [settings]);

const detectLocation = () => {
if (!navigator.geolocation) return;
navigator.geolocation.getCurrentPosition(
(pos) => setSettings((p) => ({ ...p, currentLocation: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` })),
() => toast.error('Unable to get current location')
);
};

const saveProfile = async () => {
if (!form.full_name.trim() || !form.email.trim() || !form.phone_number.trim()) {
toast.error('Full name, email and phone are required');
return;
}
setSaving(true);
const result = await onProfileUpdated({
full_name: form.full_name.trim(),
email: form.email.trim().toLowerCase(),
phone_number: form.phone_number.trim(),
country: form.country.trim() || null,
company_name: form.company_name.trim() || null,
account_type: form.account_type || null,
});
setSaving(false);
if (result?.success) {
toast.success('Profile updated');
} else {
toast.error(result?.error || 'Failed to update profile');
}
};

return (
<div className="card" style={{ maxWidth: 700 }}>
<div className="section-label">Driver Profile & Visibility</div>
<div style={{ display: 'grid', gap: 12 }}>
<input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Full name" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
<input value={form.phone_number} onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))} placeholder="Phone number" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} placeholder="Country" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
<input value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} placeholder="Company / fleet name" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<select value={form.account_type || 'individual'} onChange={(e) => setForm((p) => ({ ...p, account_type: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }}>
<option value="individual">Individual</option>
<option value="company">Company</option>
</select>
</div>
<div style={{ fontSize: 12, color: T.gray }}>Driver registration details</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
<select value={settings.vehicleType} onChange={(e) => setSettings((p) => ({ ...p, vehicleType: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }}>
<option value="">Vehicle Type</option>
<option value="Heavy Truck (18-Wheeler)">Heavy Truck (18-Wheeler)</option>
<option value="Cargo Ship / Vessel">Cargo Ship / Vessel</option>
<option value="Delivery Van">Delivery Van</option>
</select>
<input value={settings.licenseNumber} onChange={(e) => setSettings((p) => ({ ...p, licenseNumber: e.target.value }))} placeholder="License Number" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
</div>
<input value={settings.vehiclePlateNumber} onChange={(e) => setSettings((p) => ({ ...p, vehiclePlateNumber: e.target.value }))} placeholder="Vehicle ID / Plate Number" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<div>
<div style={{ fontSize: 12, color: T.gray, marginBottom: 6 }}>Availability</div>
<select value={settings.availability} onChange={(e) => setSettings((p) => ({ ...p, availability: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }}>
<option value="available">Available</option>
<option value="on_trip">On Trip</option>
<option value="off_duty">Off Duty</option>
</select>
</div>
<label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
<input type="checkbox" checked={settings.shareLocation} onChange={(e) => setSettings((p) => ({ ...p, shareLocation: e.target.checked }))} />
<span style={{ fontSize: 13 }}>Share my live location to operations</span>
</label>
<input value={settings.currentLocation} onChange={(e) => setSettings((p) => ({ ...p, currentLocation: e.target.value }))} placeholder="Current location label or coordinates" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.navy, color: T.white }} />
<div style={{ display: 'flex', gap: 8 }}>
<button className="btn-ghost" type="button" onClick={detectLocation}>Use Current GPS</button>
<button className="btn-primary" type="button" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
</div>
</div>
</div>
);
}

function normalizeAssignment(data) {
if (!data) return null;
if (Array.isArray(data)) return data[0] || null;
return data.shipment || data.assignment || data;
}

export default function DriverDashboard({ initialTab = 'dashboard' }) {
const navigate = useNavigate();
const { user, updateProfile } = useAuth();
const [assignment, setAssignment] = useState(null);
const [shipments, setShipments] = useState([]);
const [alerts, setAlerts] = useState([]);
const [loading, setLoading] = useState(true);

const activeTab = useMemo(() => {
const map = {
dashboard: 'dashboard',
'my-tasks': 'dashboard',
assignment: 'assignment',
details: 'details',
pickup: 'details',
navigation: 'navigation',
navigate: 'navigation',
status: 'status',
'status-update': 'status',
alerts: 'alerts',
chat: 'chat',
emergency: 'emergency',
profile: 'profile',
};
return map[initialTab] || 'dashboard';
}, [initialTab]);

useEffect(() => {
const load = async () => {
setLoading(true);
try {
const [assignmentRes, shipmentsRes, alertsRes] = await Promise.allSettled([
api.get(ENDPOINTS.MY_ASSIGNMENT),
api.get(ENDPOINTS.MY_SHIPMENTS),
api.get(ENDPOINTS.ACTIVE_ALERTS),
]);
if (assignmentRes.status === 'fulfilled') {
setAssignment(normalizeAssignment(assignmentRes.value.data));
} else {
setAssignment(null);
}
if (shipmentsRes.status === 'fulfilled') {
setShipments(Array.isArray(shipmentsRes.value.data) ? shipmentsRes.value.data : []);
} else {
setShipments([]);
}
if (alertsRes.status === 'fulfilled') {
setAlerts(Array.isArray(alertsRes.value.data) ? alertsRes.value.data : []);
} else {
setAlerts([]);
}
} finally {
setLoading(false);
}
};
load();
}, []);

const go = (tab) => {
const routeMap = {
dashboard: '/driver',
assignment: '/driver/assignment',
details: '/driver/details',
navigation: '/driver/navigation',
status: '/driver/status-update',
alerts: '/driver/alerts',
chat: '/driver/chat',
emergency: '/driver/emergency',
profile: '/driver/profile',
};
navigate(routeMap[tab] || '/driver');
};

return (
<>
<style>{css}</style>
<div style={{ background: T.navy, minHeight: '100vh', width: '100%', color: T.white, fontFamily: "'Space Grotesk',sans-serif", padding: '24px 30px', overflow: 'auto' }}>
{loading && activeTab === 'dashboard' ? (
<div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner size="lg" /></div>
) : (
<>
{activeTab === 'dashboard' && <DashboardScreen assignment={assignment} shipments={shipments} alerts={alerts} loading={loading} go={go} />}
{activeTab === 'assignment' && <AssignmentScreen assignment={assignment} go={go} />}
{activeTab === 'details' && <DetailsScreen assignment={assignment} go={go} />}
{activeTab === 'navigation' && <NavigationScreen assignment={assignment} go={go} />}
{activeTab === 'status' && <StatusScreen assignment={assignment} />}
{activeTab === 'alerts' && <AlertsScreen alerts={alerts} loading={loading} />}
{activeTab === 'chat' && <ChatScreen user={user} assignment={assignment} />}
{activeTab === 'emergency' && <EmergencyScreen assignment={assignment} />}
{activeTab === 'profile' && <ProfileScreen user={user} onProfileUpdated={updateProfile} />}
</>
)}
</div>
</>
);
}
