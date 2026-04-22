import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import Spinner from '../../components/ui/Spinner';

// Theme colors
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

// Inline styles
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
  .mono { font-family: 'JetBrains Mono', monospace; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);} }
  @keyframes countUp { from{opacity:0;transform:scale(0.85);}to{opacity:1;transform:scale(1);} }
  @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.4;} }
  .card-animate { animation: fadeUp 0.5s ease both; }
  .live-dot { width:8px; height:8px; background:${T.green}; border-radius:50%; animation:pulse 2s infinite; display:inline-block; }
  .kpi-card { background:${T.card}; border:1px solid ${T.border}; border-radius:12px; padding:20px; overflow:hidden; animation:countUp .6s ease both; position:relative; }
  .kpi-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
  .kpi-card.teal::before { background:linear-gradient(90deg,${T.teal},transparent); }
  .kpi-card.amber::before { background:linear-gradient(90deg,${T.amber},transparent); }
  .kpi-card.green::before { background:linear-gradient(90deg,${T.green},transparent); }
  .kpi-card.red::before { background:linear-gradient(90deg,${T.red},transparent); }
  .chip { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; }
  .chip-teal { background:rgba(0,212,180,.15); color:${T.teal}; border:1px solid rgba(0,212,180,.3); }
  .chip-amber { background:rgba(245,158,11,.15); color:${T.amber}; border:1px solid rgba(245,158,11,.3); }
  .chip-red { background:rgba(239,68,68,.15); color:${T.red}; border:1px solid rgba(239,68,68,.3); }
  .chip-green { background:rgba(16,185,129,.15); color:${T.green}; border:1px solid rgba(16,185,129,.3); }
  .btn-primary { background:linear-gradient(135deg,${T.teal},${T.cyan}); color:#000; font-weight:700; font-size:13px; padding:10px 22px; border:none; border-radius:8px; cursor:pointer; transition:all .2s; font-family:'Space Grotesk',sans-serif; }
  .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,212,180,.35); }
  .btn-ghost { background:transparent; color:${T.teal}; font-weight:600; font-size:13px; padding:9px 20px; border:1px solid ${T.teal}; border-radius:8px; cursor:pointer; transition:all .2s; font-family:'Space Grotesk',sans-serif; }
  .btn-ghost:hover { background:rgba(0,212,180,.08); }
  .card { background:${T.card}; border:1px solid ${T.border}; border-radius:12px; padding:20px; transition:all .2s; }
  .card:hover { border-color:rgba(0,212,180,.28); }
  .alert-card { background:${T.card}; border:1px solid ${T.red}; border-radius:8px; padding:14px; }
  .section-label { font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:${T.grayDim}; margin-bottom:12px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid-3 { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
  .number-big { font-family:'Orbitron',monospace; font-size:28px; font-weight:700; }
  .input-field { background:${T.card}; border:1px solid ${T.border}; color:${T.white}; padding:10px 12px; border-radius:8px; font-family:'Space Grotesk',sans-serif; font-size:13px; transition:all 0.2s; width:100%; }
  .input-field:focus { outline:none; border-color:${T.teal}; box-shadow:0 0 0 2px rgba(0,212,180,0.1); }
`;

// Icon Component
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
	const icons = {
		activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
		box: <><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="16 2 12 7 8 2"/></>,
		plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
		map: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
		alert: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
		clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
		check: <polyline points="20 6 9 17 4 12"/>,
		route: <><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 15 15"/></>,
		truck: <><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
	};
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			{icons[name]}
		</svg>
	);
};

// KPI Card Component
const KpiCard = ({ label, value, sub, variant = 'teal', icon, delay = 0 }) => (
	<div className={`kpi-card ${variant}`} style={{ animationDelay: `${delay}ms` }}>
		<div style={{ display: 'flex', justifyContent: 'space-between' }}>
			<div>
				<div style={{ fontSize: 11, color: T.gray, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
				<div className="number-big" style={{ color: variant === 'teal' ? T.teal : variant === 'amber' ? T.amber : variant === 'green' ? T.green : T.red }}>{value}</div>
				<div style={{ fontSize: 12, color: T.gray, marginTop: 6 }}>{sub}</div>
			</div>
			<Icon name={icon} size={20} color={variant === 'teal' ? T.teal : variant === 'amber' ? T.amber : variant === 'green' ? T.green : T.red} />
		</div>
	</div>
);

// Chip Component
const Chip = ({ label, variant = 'teal', dot = false }) => (
	<span className={`chip chip-${variant}`}>
		{dot && <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />}
		{label}
	</span>
);

// Alert Banner Component
const AlertBanner = ({ type, title, msg, time }) => (
	<div className="alert-card" style={{ marginBottom: 10, borderLeft: `4px solid ${type === 'high' ? T.red : type === 'medium' ? T.amber : T.green}`, background: type === 'high' ? 'rgba(239,68,68,.08)' : type === 'medium' ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.08)' }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
			<div>
				<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{title}</div>
				<div style={{ fontSize: 12, color: T.gray, marginBottom: 4 }}>{msg}</div>
				<div style={{ fontSize: 11, color: T.grayDim }}>{time}</div>
			</div>
		</div>
	</div>
);

// Map Visualization
const MapViz = ({ riskLevel, driverPos }) => (
	<div style={{ height: 200, background: `radial-gradient(circle at 50% 50%, ${riskLevel === 'high' ? 'rgba(239,68,68,.1)' : 'rgba(0,212,180,.05)'}, transparent)`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
		<div style={{ width: '80%', height: 1, background: 'rgba(26,42,69,0.5)', position: 'relative', borderRadius: 2 }}>
			<div style={{ position: 'absolute', left: `${driverPos * 100}%`, top: -8, width: 16, height: 16, background: riskLevel === 'high' ? T.red : T.teal, borderRadius: '50%', border: `2px solid ${T.card}`, transition: 'all 0.3s' }} />
		</div>
		<div style={{ position: 'absolute', fontSize: 11, color: T.gray, bottom: 10, left: 10 }}>Route visualization</div>
	</div>
);

// Workflow Timeline Component
const WorkflowTimeline = ({ activeStep }) => (
	<div style={{ display: 'flex', justifyContent: 'space-between' }}>
		{['Order Placed', 'Packed', 'In Transit', 'Delivery Confirmation'].map((step, i) => (
			<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
				<div style={{ width: 32, height: 32, borderRadius: '50%', background: i <= activeStep ? T.teal : T.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
					{i < activeStep ? <Icon name="check" size={14} color="#000" /> : i + 1}
				</div>
				<div style={{ fontSize: 10, textAlign: 'center', color: T.gray, width: 70 }}>{step}</div>
			</div>
		))}
	</div>
);

// Main Receiver Dashboard Screen
const ReceiverMainDashboard = ({ setTab }) => (
	<div style={{ animation: 'fadeUp 0.5s ease' }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
			<div>
				<h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Dashboard</h2>
				<p style={{ margin: '4px 0 0', fontSize: 12, color: T.gray }}>Overview of your shipments</p>
			</div>
			<button onClick={() => setTab('create-order')} className="btn-primary">+ New Order</button>
		</div>

		{/* Live sync indicator */}
		<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 12 }}>
			<span className="live-dot" />
			<span style={{ color: T.gray }}>Live sync active</span>
		</div>

		{/* KPI Cards */}
		<div className="grid-3">
			<KpiCard label="Active Orders" value="3" sub="This week" variant="teal" icon="box" delay={0} />
			<KpiCard label="On-Time Rate" value="94%" sub="Last 30 days" variant="amber" icon="activity" delay={50} />
			<KpiCard label="Avg Delivery Time" value="18h" sub="Median" variant="green" icon="clock" delay={100} />
		</div>

		{/* Workflow Status */}
		<div className="card" style={{ marginTop: 24 }}>
			<div className="section-label">Current Workflow Status</div>
			<WorkflowTimeline activeStep={2} />
		</div>

		{/* Two-column grid */}
		<div className="grid-2" style={{ marginTop: 24 }}>
			{/* Active Orders */}
			<div className="card">
				<div className="section-label">Active Orders</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					{[
						{ id: 'ORD-2841', status: 'In Transit', eta: 'Today 18:30', variant: 'teal' },
						{ id: 'ORD-2836', status: 'Packing', eta: 'Tomorrow 09:00', variant: 'amber' },
						{ id: 'ORD-2829', status: 'Completed', eta: 'Delivered', variant: 'green' }
					].map((order, i) => (
						<div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'rgba(0, 0, 0, 0.2)', borderRadius: 8 }}>
							<div>
								<div style={{ fontSize: 13, fontWeight: 600 }}>{order.id}</div>
								<Chip label={order.status} variant={order.variant} dot />
							</div>
							<div style={{ fontSize: 11, color: T.gray, textAlign: 'right' }}>{order.eta}</div>
						</div>
					))}
				</div>
			</div>

			{/* Latest Alerts */}
			<div className="card">
				<div className="section-label">Latest Alerts</div>
				<AlertBanner type="high" title="Delayed Delivery" msg="Order ORD-2836 experiencing traffic" time="2 min ago" />
				<AlertBanner type="medium" title="Weather Warning" msg="Rain expected in delivery zone" time="15 min ago" />
				<div style={{ padding: 12, background: 'rgba(0, 212, 180, 0.1)', borderRadius: 8, fontSize: 12, color: T.teal, border: `1px solid rgba(0, 212, 180, 0.3)` }}>
					🤖 <strong>AI Insight:</strong> Recommend rescheduling delivery for afternoon
				</div>
			</div>
		</div>
	</div>
);

// Create Order Screen (3-step form wizard)
const CreateOrderScreen = ({ setTab }) => {
	const [step, setStep] = useState(1);
	const [formData, setFormData] = useState({ item: '', qty: '', priority: 'standard', location: '', deadline: '', notes: '' });
	const [submitted, setSubmitted] = useState(false);

	const handleNext = () => {
		if (step === 3) {
			setSubmitted(true);
			setTimeout(() => {
				setStep(1);
				setFormData({ item: '', qty: '', priority: 'standard', location: '', deadline: '', notes: '' });
				setSubmitted(false);
				setTab('track');
			}, 2500);
		} else {
			setStep(step + 1);
		}
	};

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	if (submitted) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, animation: 'fadeUp 0.5s' }}>
				<div style={{ fontSize: 28, fontWeight: 700, color: T.green, marginBottom: 12 }}>✓ Order Created</div>
				<p style={{ color: T.gray, fontSize: 13, marginBottom: 20 }}>Your shipment is now being processed</p>
				<Spinner size={24} />
			</div>
		);
	}

	return (
		<div style={{ animation: 'fadeUp 0.5s' }}>
			<h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700 }}>Create Order</h2>

			{/* Progress bar */}
			<div style={{ marginBottom: 28, display: 'flex', gap: 8 }}>
				{[1, 2, 3].map(s => (
					<div key={s} style={{ flex: 1, height: 4, background: s <= step ? T.teal : T.border, borderRadius: 2, transition: 'all 0.3s' }} />
				))}
			</div>

			{/* Step 1: Item Details */}
			{step === 1 && (
				<div className="card" style={{ animation: 'fadeUp 0.3s' }}>
					<div className="section-label">Step 1: Item Details</div>
					<input type="text" placeholder="Item name" name="item" value={formData.item} onChange={handleChange} className="input-field" style={{ marginBottom: 12 }} />
					<input type="number" placeholder="Quantity" name="qty" value={formData.qty} onChange={handleChange} className="input-field" style={{ marginBottom: 12 }} />
					<select name="priority" value={formData.priority} onChange={handleChange} className="input-field" style={{ marginBottom: 20 }}>
						<option value="standard">🟢 Standard (5-7 days)</option>
						<option value="express">🟠 Express (2-3 days)</option>
						<option value="overnight">🟠 Overnight</option>
					</select>
					<button onClick={handleNext} className="btn-primary" style={{ width: '100%' }}>Next &rarr;</button>
				</div>
			)}

			{/* Step 2: Delivery Info */}
			{step === 2 && (
				<div className="card" style={{ animation: 'fadeUp 0.3s' }}>
					<div className="section-label">Step 2: Delivery Information</div>
					<input type="text" placeholder="Delivery location / address" name="location" value={formData.location} onChange={handleChange} className="input-field" style={{ marginBottom: 12 }} />
					<input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} className="input-field" style={{ marginBottom: 12 }} />
					<textarea placeholder="Special instructions (optional)" name="notes" value={formData.notes} onChange={handleChange} className="input-field" rows="3" style={{ marginBottom: 20, fontFamily: "'Space Grotesk', sans-serif" }} />
					<div style={{ display: 'flex', gap: 10 }}>
						<button onClick={() => setStep(1)} className="btn-ghost" style={{ flex: 1 }}>← Back</button>
						<button onClick={handleNext} className="btn-primary" style={{ flex: 1 }}>Next &rarr;</button>
					</div>
				</div>
			)}

			{/* Step 3: Review & Submit */}
			{step === 3 && (
				<div className="card" style={{ animation: 'fadeUp 0.3s' }}>
					<div className="section-label">Step 3: Review & Submit</div>
					<div style={{ background: 'rgba(0, 212, 180, 0.08)', border: `1px solid rgba(0, 212, 180, 0.3)`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
						<div style={{ display: 'grid', gap: 8 }}>
							<div><span style={{ color: T.gray }}>Item:</span> <strong>{formData.item || 'N/A'}</strong></div>
							<div><span style={{ color: T.gray }}>Quantity:</span> <strong>{formData.qty || 0}</strong></div>
							<div><span style={{ color: T.gray }}>Priority:</span> <strong>{formData.priority}</strong></div>
							<div><span style={{ color: T.gray }}>Location:</span> <strong>{formData.location || 'N/A'}</strong></div>
							<div><span style={{ color: T.gray }}>Est. Confidence:</span> <strong style={{ color: T.green }}>92%</strong></div>
						</div>
					</div>
					<div style={{ display: 'flex', gap: 10 }}>
						<button onClick={() => setStep(2)} className="btn-ghost" style={{ flex: 1 }}>← Back</button>
						<button onClick={handleNext} className="btn-primary" style={{ flex: 1 }}>✓ Submit Order</button>
					</div>
				</div>
			)}
		</div>
	);
};

// Tracking Screen
const TrackingScreen = () => {
	const [driverPos, setDriverPos] = useState(0.35);

	useEffect(() => {
		const interval = setInterval(() => {
			setDriverPos(prev => (prev + 0.003) % 1);
		}, 300);
		return () => clearInterval(interval);
	}, []);

	return (
		<div style={{ animation: 'fadeUp 0.5s' }}>
			<h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700 }}>Track Shipment</h2>

			{/* KPI Row */}
			<div className="grid-3" style={{ marginBottom: 24 }}>
				<div className="kpi-card teal" style={{ animationDelay: '0ms' }}>
					<div style={{ fontSize: 11, color: T.gray, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>ETA</div>
					<div className="number-big" style={{ color: T.teal }}>Today</div>
					<div style={{ fontSize: 12, color: T.gray, marginTop: 6 }}>~ 18:30</div>
				</div>
				<div className="kpi-card amber" style={{ animationDelay: '50ms' }}>
					<div style={{ fontSize: 11, color: T.gray, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Distance</div>
					<div className="number-big" style={{ color: T.amber }}>42 km</div>
					<div style={{ fontSize: 12, color: T.gray, marginTop: 6 }}>Remaining</div>
				</div>
				<div className="kpi-card" style={{ animationDelay: '100ms' }}>
					<div style={{ fontSize: 11, color: T.gray, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Risk Score</div>
					<div className="number-big" style={{ color: T.green }}>LOW</div>
					<div style={{ fontSize: 12, color: T.gray, marginTop: 6 }}>Optimal route</div>
				</div>
			</div>

			{/* Live Map */}
			<div className="card" style={{ marginBottom: 24 }}>
				<div className="section-label">Live Route Map</div>
				<MapViz riskLevel="low" driverPos={driverPos} />
			</div>

			{/* Conditional Risk Alert */}
			<div style={{ marginBottom: 24 }}>
				<AlertBanner type="low" title="On Schedule" msg="Driver maintaining optimal route" time="Just now" />
			</div>

			{/* Delivery Timeline */}
			<div className="card">
				<div className="section-label">Delivery Timeline</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					{[
						{ step: 'Order Confirmed', time: '10:15 AM', done: true },
						{ step: 'Packed at Warehouse', time: '11:02 AM', done: true },
						{ step: 'Collected by Driver', time: '12:30 PM', done: true },
						{ step: 'In Transit', time: '14:45 PM', done: true },
						{ step: 'Approaching Destination', time: '~18:20 PM', done: false },
						{ step: 'Delivery Confirmed', time: '~18:30 PM', done: false }
					].map((item, i) => (
						<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<div style={{ width: 24, height: 24, borderRadius: '50%', background: item.done ? T.teal : T.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
								{item.done ? <Icon name="check" size={12} color="#000" /> : <div style={{ width: 8, height: 8, background: T.gray, borderRadius: '50%' }} />}
							</div>
							<div>
								<div style={{ fontSize: 13, fontWeight: 600, color: item.done ? T.white : T.gray }}>{item.step}</div>
								<div style={{ fontSize: 11, color: T.grayDim }}>{item.time}</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

// Alerts Screen
const AlertsScreen = () => {
	const [alerts, setAlerts] = useState([
		{ id: 1, type: 'high', title: 'Delayed Shipment', msg: 'ORD-2836 experiencing traffic delay', time: '2 min ago', ack: false },
		{ id: 2, type: 'medium', title: 'Weather Update', msg: 'Rain expected in delivery zone tomorrow', time: '15 min ago', ack: false },
		{ id: 3, type: 'low', title: 'On Schedule', msg: 'ORD-2841 delivering on time', time: '28 min ago', ack: false }
	]);

	const handleAck = (id) => {
		setAlerts(alerts.map(a => a.id === id ? { ...a, ack: true } : a));
	};

	return (
		<div style={{ animation: 'fadeUp 0.5s' }}>
			<h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700 }}>Alerts</h2>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				{alerts.map((alert, i) => (
					<div key={i} className="alert-card" style={{ borderLeft: `4px solid ${alert.type === 'high' ? T.red : alert.type === 'medium' ? T.amber : T.green}`, background: alert.type === 'high' ? 'rgba(239,68,68,.08)' : alert.type === 'medium' ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
						<div>
							<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{alert.title}</div>
							<div style={{ fontSize: 12, color: T.gray, marginBottom: 4 }}>{alert.msg}</div>
							<div style={{ fontSize: 11, color: T.grayDim }}>{alert.time}</div>
						</div>
						<button onClick={() => handleAck(alert.id)} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
							{alert.ack ? '✓ Acknowledged' : 'Acknowledge'}
						</button>
					</div>
				))}
			</div>
		</div>
	);
};

// Navigation Tabs Component
const NavTabs = ({ activeTab, setActiveTab }) => {
	const tabs = [
		{ id: 'dashboard', label: 'Dashboard', icon: 'activity' },
		{ id: 'create-order', label: 'Create Order', icon: 'plus' },
		{ id: 'track', label: 'Track Shipment', icon: 'map' },
		{ id: 'alerts', label: 'Alerts', icon: 'alert' }
	];

	return (
		<div style={{ borderBottom: `1px solid ${T.border}`, marginBottom: 24, display: 'flex', gap: 0 }}>
			{tabs.map(tab => (
				<button
					key={tab.id}
					onClick={() => setActiveTab(tab.id)}
					style={{
						flex: 1,
						padding: '12px 16px',
						border: 'none',
						background: 'transparent',
						color: activeTab === tab.id ? T.teal : T.gray,
						fontWeight: activeTab === tab.id ? 600 : 500,
						fontSize: 13,
						cursor: 'pointer',
						borderBottom: activeTab === tab.id ? `2px solid ${T.teal}` : 'none',
						transition: 'all 0.2s',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 6
					}}
					onMouseEnter={(e) => (!activeTab === tab.id) && (e.target.style.color = T.cyan)}
					onMouseLeave={(e) => (!activeTab === tab.id) && (e.target.style.color = T.gray)}
				>
					<Icon name={tab.icon} size={16} color="currentColor" />
					{tab.label}
				</button>
			))}
		</div>
	);
};

// Main Export
export default function ReceiverDashboard({ initialTab = 'dashboard' }) {
	const [activeTab, setActiveTab] = useState(initialTab);
	const [isLoading] = useState(false);
	const [theme] = useState(() => localStorage.getItem('theme') || 'dark');
	const location = useLocation();

	// Update activeTab when route changes
	useEffect(() => {
		const pathTab = location.pathname.split('/')[2]; // Get the tab name from URL
		if (pathTab && ['dashboard', 'create-order', 'track', 'alerts'].includes(pathTab)) {
			setActiveTab(pathTab);
		} else if (!pathTab || location.pathname === '/receiver') {
			setActiveTab('dashboard');
		}
	}, [location.pathname]);

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
	}, [theme]);

	return (
		<>
			<style>{css}</style>
			<DemoModeBanner role="receiver" />
			<div style={{ background: T.navy, minHeight: '100vh', width: '100%', color: T.white, fontFamily: "'Space Grotesk', sans-serif", padding: '32px 40px', overflow: 'auto' }}>
				<NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />
				
				{isLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
						<Spinner size={32} />
					</div>
				) : (
					<>
						{activeTab === 'dashboard' && <ReceiverMainDashboard setTab={setActiveTab} />}
						{activeTab === 'create-order' && <CreateOrderScreen setTab={setActiveTab} />}
						{activeTab === 'track' && <TrackingScreen />}
						{activeTab === 'alerts' && <AlertsScreen />}
					</>
				)}
			</div>
		</>
	);
}
