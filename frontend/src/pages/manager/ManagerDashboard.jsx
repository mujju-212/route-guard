import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, DollarSign, Ship, CheckCircle2, Truck, Users, Zap } from 'lucide-react';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_SHIPMENTS } from '../../dummy/shipments';
import { DUMMY_ALERTS } from '../../dummy/alerts';
import { DUMMY_ANALYTICS, DUMMY_PORTS } from '../../dummy/analytics';
import { useSocket } from '../../hooks/useSocket';
import Spinner from '../../components/ui/Spinner';
import DemoModeBanner from '../../components/ui/DemoModeBanner';

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
  .orb { font-family: 'Orbitron', monospace; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);} }
  @keyframes countUp { from{opacity:0;transform:scale(0.85);}to{opacity:1;transform:scale(1);} }
  @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.4;} }
  .card-animate { animation: fadeUp 0.5s ease both; }
  .live-dot { width:8px; height:8px; background:${T.green}; border-radius:50%; animation:pulse 2s infinite; display:inline-block; }
  .kpi-card { background:${T.card}; border:1px solid ${T.border}; border-radius:12px; padding:20px; overflow:hidden; animation:countUp .6s ease both; }
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
  .chip-gray { background:rgba(138,155,181,.1); color:${T.gray}; border:1px solid rgba(138,155,181,.2); }
  .btn-primary { background:linear-gradient(135deg,${T.teal},${T.cyan}); color:#000; font-weight:700; font-size:13px; padding:10px 22px; border:none; border-radius:8px; cursor:pointer; transition:all .2s; font-family:'Space Grotesk',sans-serif; }
  .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,212,180,.35); }
  .btn-ghost { background:transparent; color:${T.teal}; font-weight:600; font-size:13px; padding:9px 20px; border:1px solid ${T.teal}; border-radius:8px; cursor:pointer; transition:all .2s; font-family:'Space Grotesk',sans-serif; }
  .btn-ghost:hover { background:rgba(0,212,180,.08); }
  .card { background:${T.card}; border:1px solid ${T.border}; border-radius:12px; padding:20px; transition:all .2s; }
  .card:hover { border-color:rgba(0,212,180,.28); }
  .alert-card { background:${T.card}; border:1px solid ${T.red}; border-radius:8px; padding:14px; }
  .risk-dot { width:10px; height:10px; background:${T.red}; border-radius:50%; animation:pulse 1.5s infinite; }
  .section-label { font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:${T.grayDim}; margin-bottom:12px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .number-big { font-family:'Orbitron',monospace; font-size:28px; font-weight:700; }
`;

// Icon Component
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
	const icons = {
		activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
		box: <><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="16 2 12 7 8 2"/></>,
		package: <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 03 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
		truck: <><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
		clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
		user: <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z"/>,
		alert: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
		zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
		route: <><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 15 15"/></>,
	};
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			{icons[name]}
		</svg>
	);
};

// KPI Card Component
const KpiCard = ({ label, value, sub, variant = 'teal', icon, delay = 0 }) => {
	return (
		<div className={`kpi-card ${variant}`} style={{ animationDelay: `${delay}ms`, position: 'relative' }}>
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
};

// Chip Component
const Chip = ({ label, variant = 'teal', dot = false }) => (
	<span className={`chip chip-${variant}`}>
		{dot && <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />}
		{label}
	</span>
);

// Map Visualization Component
const MapViz = ({ riskLevel, driverPos }) => (
	<div style={{ height: 200, background: `radial-gradient(circle at 50% 50%, ${riskLevel === 'high' ? 'rgba(239,68,68,.1)' : 'rgba(0,212,180,.05)'}, transparent)`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', positions: 'relative', overflow: 'hidden' }}>
		<div style={{ width: '80%', height: 1, background: 'rgba(26,42,69,0.5)', position: 'relative', borderRadius: 2 }}>
			<div
				style={{
					position: 'absolute',
					left: `${driverPos * 100}%`,
					top: -8,
					width: 16,
					height: 16,
					background: riskLevel === 'high' ? T.red : T.teal,
					borderRadius: '50%',
					border: `2px solid ${T.card}`,
					transition: 'all 0.3s',
				}}
			/>
		</div>
		<div style={{ position: 'absolute', fontSize: 11, color: T.gray, bottom: 10, left: 10 }}>Route visualization</div>
	</div>
);

// Logistics Dashboard
const LogisticsDashboard = ({ setScreen, simMode }) => {
	const [riskScore, setRiskScore] = useState(simMode ? 78 : 24);
	useEffect(() => {
		if (simMode) setRiskScore(78);
	}, [simMode]);

	return (
		<div style={{ animation: 'fadeUp 0.4s ease' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
				<div>
					<h1 style={{ fontSize: 20, fontWeight: 700, color: T.white }}>Logistics Control Tower</h1>
					<div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>Real-time fleet and shipment orchestration</div>
				</div>
				<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
					<span className="live-dot" />
					<span style={{ fontSize: 11, color: T.gray }}>Live · 14 shipments tracked</span>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
				<KpiCard label="Active Deliveries" value="14" sub="3 high priority" variant="teal" icon="truck" delay={0} />
				<KpiCard label="Fleet Utilization" value="87%" sub="23 of 26 drivers active" variant="green" icon="user" delay={100} />
				<KpiCard label="Risk Alerts" value={simMode ? '4' : '2'} sub={simMode ? 'Simulation mode' : '2 unresolved'} variant={simMode ? 'red' : 'amber'} icon="alert" delay={200} />
				<KpiCard label="System Risk Score" value={`${riskScore}%`} sub={riskScore > 50 ? 'High — action needed' : 'Nominal'} variant={riskScore > 50 ? 'red' : 'teal'} icon="zap" delay={300} />
			</div>

			{simMode && (
				<div className="alert-card" style={{ marginBottom: 20 }}>
					<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
						<span className="risk-dot" />
						<div>
							<div style={{ fontSize: 13, fontWeight: 700, color: T.red }}>SIMULATION MODE ACTIVE — Disruption Scenario</div>
							<div style={{ fontSize: 12, color: T.gray }}>Traffic jam on NH-48, weather alert in Nashik, driver delay on Route 3</div>
						</div>
					</div>
				</div>
			)}

			<div style={{ marginBottom: 20 }}>
				<div className="card" style={{ padding: 0, overflow: 'hidden' }}>
					<div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
						<span style={{ fontSize: 13, fontWeight: 600 }}>Live Fleet Map</span>
						<button className="btn-ghost" style={{ padding: '5px 14px', fontSize: 11 }} onClick={() => setScreen('shipments')}>Full View</button>
					</div>
					<MapViz riskLevel={simMode ? 'high' : 'low'} driverPos={0.5} />
				</div>
			</div>

			<div className="grid-2">
				<div>
					<div className="section-label">Shipments Needing Action</div>
					{[
						{ id: 'ORD-2842', route: 'Mumbai → Aurangabad', driver: 'Unassigned', risk: 'high', eta: '—' },
						{ id: 'ORD-2841', route: 'Pune → Nashik', driver: 'Amit Shah', risk: simMode ? 'high' : 'medium', eta: simMode ? '19:10' : '18:30' },
					].map((s, i) => (
						<div key={i} className="card card-animate" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setScreen('drivers')}>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
								<span className="mono" style={{ fontSize: 11, color: T.grayDim }}>{s.id}</span>
								<Chip label={s.risk === 'high' ? 'High Risk' : 'Medium'} variant={s.risk === 'high' ? 'red' : 'amber'} dot />
							</div>
							<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{s.route}</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.gray }}>
								<span>Driver: {s.driver}</span>
								<span>ETA: {s.eta}</span>
							</div>
							{s.driver === 'Unassigned' && (
								<button className="btn-primary" style={{ width: '100%', marginTop: 10, padding: '8px', fontSize: 12 }}>Assign Driver →</button>
							)}
						</div>
					))}
				</div>

				<div>
					<div className="section-label">AI Recommendations</div>
					{[
						{ icon: 'route', title: 'Reroute ORD-2841', detail: 'Use NH-65 bypass. Saves 38 min.', color: T.teal },
						{ icon: 'zap', title: 'Reassign Driver', detail: 'Driver 4 is 18 km closer to pickup.', color: T.amber },
						{ icon: 'clock', title: 'Reschedule ORD-2843', detail: 'Weather clears in 2h. Delay departure.', color: T.green },
					].map((r, i) => (
						<div key={i} className="card card-animate" style={{ marginBottom: 10, borderLeft: `3px solid ${r.color}`, animationDelay: `${i * 80}ms` }}>
							<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
								<Icon name={r.icon} size={14} color={r.color} />
								<div style={{ flex: 1 }}>
									<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{r.title}</div>
									<div style={{ fontSize: 12, color: T.gray }}>{r.detail}</div>
								</div>
								<button className="btn-primary" style={{ marginLeft: 'auto', padding: '5px 14px', fontSize: 11, whiteSpace: 'nowrap' }}>Apply</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

// Drivers Panel
const DriversPanel = ({ setScreen }) => {
	const [assigned, setAssigned] = useState(false);
	const drivers = [
		{ name: 'Ravi Naik', id: 'DRV-04', dist: '12 km', status: 'available', rating: 4.9 },
		{ name: 'Suresh Mehta', id: 'DRV-07', dist: '18 km', status: 'available', rating: 4.7 },
		{ name: 'Pradeep Rao', id: 'DRV-12', dist: '24 km', status: 'en-route', rating: 4.8 },
	];
	return (
		<div style={{ animation: 'fadeUp 0.4s ease' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
				<div>
					<h1 style={{ fontSize: 20, fontWeight: 700, color: T.white }}>Driver Assignment</h1>
					<div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>ORD-2842 — Select optimal driver</div>
				</div>
				{assigned && <Chip label="Assigned ✓" variant="green" />}
			</div>

			<div className="grid-2" style={{ marginBottom: 20 }}>
				<div className="card">
					<div className="section-label">Shipment Brief</div>
					{[
						['Pickup', 'Shipper Bay 3, Mumbai'],
						['Destination', 'Aurangabad MIDC'],
						['Distance', '~350 km'],
						['Weight', '480 kg'],
						['Deadline', 'Tomorrow 09:00'],
					].map(([k, v]) => (
						<div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
							<span style={{ color: T.gray }}>{k}</span>
							<span style={{ fontWeight: 600 }}>{v}</span>
						</div>
					))}
				</div>
				<div className="card">
					<div className="section-label">Route Preview</div>
					<MapViz riskLevel="low" driverPos={0.1} />
				</div>
			</div>

			<div className="section-label">Available Drivers — Sorted by Distance</div>
			{drivers.map((d, i) => (
				<div key={i} className="card card-animate" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animationDelay: `${i * 100}ms` }}>
					<div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
						<div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,212,180,0.1)', border: `1px solid ${T.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
							{d.name.charAt(0)}
						</div>
						<div>
							<div style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</div>
							<div style={{ fontSize: 11, color: T.gray }}>{d.id} · {d.dist} away · ⭐ {d.rating}</div>
						</div>
					</div>
					<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
						<Chip label={d.status} variant={d.status === 'available' ? 'green' : 'amber'} dot />
						{d.status === 'available' && (
							<button className="btn-primary" style={{ padding: '7px 16px', fontSize: 12 }} onClick={() => setAssigned(true)}>
								{i === 0 ? '⚡ Assign (Best)' : 'Assign'}
							</button>
						)}
					</div>
				</div>
			))}

			{assigned && (
				<div className="card card-animate" style={{ background: `rgba(16,185,129,0.08)`, border: `1px solid ${T.green}`, textAlign: 'center', padding: 24, marginTop: 20 }}>
					<div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
					<div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>Ravi Naik assigned to ORD-2842</div>
					<div style={{ fontSize: 12, color: T.gray, marginTop: 6 }}>Driver notified. ETA pickup: 07:45 tomorrow</div>
				</div>
			)}
		</div>
	);
};

// Live Shipments Screen
const LiveShipmentsScreen = () => (
	<div style={{ animation: 'fadeUp 0.4s ease' }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
			<div>
				<h1 style={{ fontSize: 20, fontWeight: 700, color: T.white }}>Live Shipments</h1>
				<div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>Real-time tracking of all deliveries</div>
			</div>
			<span style={{ fontSize: 11, color: T.teal, fontWeight: 600 }}>• 14 Active</span>
		</div>
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
			{[
				{ id: 'ORD-2842', from: 'Mumbai', to: 'Aurangabad', progress: 35, driver: 'Unassigned', status: 'pending' },
				{ id: 'ORD-2841', from: 'Pune', to: 'Nashik', progress: 68, driver: 'Amit Shah', status: 'in-transit' },
				{ id: 'ORD-2843', from: 'Bangalore', to: 'Hyderabad', progress: 92, driver: 'Ravi Naik', status: 'near-delivery' },
				{ id: 'ORD-2840', from: 'Chennai', to: 'Coimbatore', progress: 15, driver: 'Pradeep Rao', status: 'pending' },
				{ id: 'ORD-2839', from: 'Delhi', to: 'Noida', progress: 88, driver: 'Suresh Mehta', status: 'near-delivery' },
				{ id: 'ORD-2838', from: 'Kolkata', to: 'Darjeeling', progress: 45, driver: 'James Okafor', status: 'in-transit' },
			].map((s, i) => (
				<div key={i} className="card card-animate" style={{ animationDelay: `${i * 80}ms` }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
						<span className="mono" style={{ fontSize: 12, color: T.teal }}>{s.id}</span>
						<Chip label={s.status === 'in-transit' ? 'In Transit' : s.status === 'near-delivery' ? 'Near Delivery' : 'Pending'} variant={s.status === 'in-transit' ? 'teal' : s.status === 'near-delivery' ? 'green' : 'amber'} />
					</div>
					<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{s.from} → {s.to}</div>
					<div style={{ marginBottom: 10 }}>
						<div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
							<div style={{ height: '100%', width: `${s.progress}%`, background: `linear-gradient(90deg, ${T.teal}, ${T.cyan})`, transition: 'width 0.3s' }} />
						</div>
						<div style={{ fontSize: 11, color: T.gray, marginTop: 6 }}>{s.progress}% completed</div>
					</div>
					<div style={{ fontSize: 12, color: T.gray }}>Driver: {s.driver}</div>
				</div>
			))}
		</div>
	</div>
);

// Driver Pool Screen
const DriverPoolScreen = () => (
	<div style={{ animation: 'fadeUp 0.4s ease' }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
			<div>
				<h1 style={{ fontSize: 20, fontWeight: 700, color: T.white }}>Driver Pool</h1>
				<div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>Manage and monitor your fleet</div>
			</div>
			<Chip label="23 Active" variant="green" />
		</div>
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
			{[
				{ name: 'Ravi Naik', id: 'DRV-04', status: 'active', rating: 4.9, shipments: 3, vehicle: 'MH-02-AB-1234' },
				{ name: 'Suresh Mehta', id: 'DRV-07', status: 'active', rating: 4.7, shipments: 2, vehicle: 'MH-02-CD-5678' },
				{ name: 'Pradeep Rao', id: 'DRV-12', status: 'en-route', rating: 4.8, shipments: 1, vehicle: 'KA-01-EF-9012' },
				{ name: 'James Okafor', id: 'DRV-15', status: 'break', rating: 4.6, shipments: 0, vehicle: 'TN-01-GH-3456' },
				{ name: 'Amit Shah', id: 'DRV-08', status: 'active', rating: 4.5, shipments: 2, vehicle: 'GJ-01-IJ-7890' },
				{ name: 'Vikram Singh', id: 'DRV-22', status: 'active', rating: 4.8, shipments: 3, vehicle: 'UP-01-KL-2345' },
			].map((d, i) => (
				<div key={i} className="card card-animate" style={{ animationDelay: `${i * 80}ms` }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
						<div>
							<div style={{ fontSize: 14, fontWeight: 700 }}>{d.name}</div>
							<div style={{ fontSize: 11, color: T.gray }}>{d.id}</div>
						</div>
						<Chip label={d.status === 'active' ? 'Active' : d.status === 'en-route' ? 'En Route' : 'Break'} variant={d.status === 'active' ? 'green' : d.status === 'en-route' ? 'teal' : 'amber'} />
					</div>
					<div style={{ fontSize: 13, color: T.gray, margin: '8px 0' }}>⭐ {d.rating}</div>
					<div style={{ fontSize: 12, color: T.gray, margin: '6px 0' }}>Shipments: {d.shipments}</div>
					<div style={{ fontSize: 11, color: T.grayDim, mono: true }}>{d.vehicle}</div>
				</div>
			))}
		</div>
	</div>
);

// AI Optimizer Screen
const AIOptimizerScreen = () => (
	<div style={{ animation: 'fadeUp 0.4s ease' }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
			<div>
				<h1 style={{ fontSize: 20, fontWeight: 700, color: T.white }}>AI Optimizer</h1>
				<div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>ML-powered logistics optimization</div>
			</div>
			<Chip label="5 Active" variant="teal" />
		</div>
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
			{[
				{ title: 'Route Optimization', detail: 'Reroute ORD-2841 via NH-65', impact: 'Save 38 min', icon: 'route', confidence: 94 },
				{ title: 'Driver Reassignment', detail: 'DRV-04 is 18km closer to pickup', impact: 'ETA -25 min', icon: 'user', confidence: 87 },
				{ title: 'Load Balancing', detail: 'Redistribute 3 shipments', impact: 'Reduce wait 45 min', icon: 'box', confidence: 91 },
				{ title: 'Predictive Delay', detail: 'ORD-2843 traffic ahead detected', impact: 'Alert driver now', icon: 'alert', confidence: 85 },
				{ title: 'Demand Forecasting', detail: 'Expect 8 shipments next 2hrs', impact: 'Pre-stage 2 drivers', icon: 'activity', confidence: 92 },
			].map((r, i) => (
				<div key={i} className="card card-animate" style={{ animationDelay: `${i * 80}ms`, borderLeft: `3px solid ${T.teal}` }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
						<div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
						<div style={{ fontSize: 11, color: T.teal, fontWeight: 700 }}>{r.confidence}%</div>
					</div>
					<div style={{ fontSize: 12, color: T.gray, marginBottom: 8 }}>{r.detail}</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>↓ {r.impact}</span>
						<button className="btn-primary" style={{ padding: '5px 12px', fontSize: 11 }}>Apply</button>
					</div>
				</div>
			))}
		</div>
		<div className="card" style={{ marginTop: 20, borderLeft: `3px solid ${T.amber}` }}>
			<div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📊 Optimization Impact</div>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
				<div>
					<div style={{ fontSize: 11, color: T.gray }}>Avg Time Saved</div>
					<div style={{ fontSize: 16, fontWeight: 700, color: T.teal }}>34 min</div>
				</div>
				<div>
					<div style={{ fontSize: 11, color: T.gray }}>Cost Reduction</div>
					<div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>12.3%</div>
				</div>
				<div>
					<div style={{ fontSize: 11, color: T.gray }}>Success Rate</div>
					<div style={{ fontSize: 16, fontWeight: 700, color: T.cyan }}>89%</div>
				</div>
				<div>
					<div style={{ fontSize: 11, color: T.gray }}>This Month</div>
					<div style={{ fontSize: 16, fontWeight: 700, color: T.amber }}>424 applied</div>
				</div>
			</div>
		</div>
	</div>
);

// Risk Alerts Screen
const RiskAlertsScreen = () => (
	<div style={{ animation: 'fadeUp 0.4s ease' }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
			<div>
				<h1 style={{ fontSize: 20, fontWeight: 700, color: T.white }}>Risk Alerts</h1>
				<div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>Monitor and manage operational risks</div>
			</div>
			<Chip label="7 Unresolved" variant="red" />
		</div>
		<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
			{[
				{ severity: 'critical', title: 'Traffic Congestion on MH-48', detail: 'ORD-2841: ETA delayed +45 min', time: '12 min ago', shipment: 'ORD-2841' },
				{ severity: 'high', title: 'Driver Fatigue Warning', detail: 'DRV-07 (Suresh Mehta) - 8.5 hrs driving', time: '8 min ago', shipment: 'ORD-2843' },
				{ severity: 'high', title: 'Weather Alert', detail: 'Heavy rain in Nashik region', time: '18 min ago', shipment: 'ORD-2841' },
				{ severity: 'medium', title: 'Low Fuel Warning', detail: 'DRV-12 (Pradeep) - 12% fuel remaining', time: '25 min ago', shipment: 'ORD-2840' },
				{ severity: 'medium', title: 'Pickup Delay', detail: 'Shipper Bay 3 delayed - cargo not ready', time: '35 min ago', shipment: 'ORD-2842' },
				{ severity: 'low', title: 'Vehicle Maintenance Due', detail: 'DRV-15 vehicle: oil change in 500 km', time: '2 hrs ago', shipment: 'N/A' },
				{ severity: 'low', title: 'Route Deviation', detail: 'DRV-04 took alternate route (approved)', time: '3 hrs ago', shipment: 'ORD-2839' },
			].map((a, i) => (
				<div key={i} className="alert-card" style={{ borderLeft: `4px solid ${a.severity === 'critical' ? T.red : a.severity === 'high' ? T.amber : a.severity === 'medium' ? T.amber : T.gray}`, background: a.severity === 'critical' ? `rgba(239,68,68,.08)` : a.severity === 'high' ? `rgba(245,158,11,.08)` : `rgba(138,155,181,.05)` }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
						<div style={{ flex: 1 }}>
							<div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
								<span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: a.severity === 'critical' ? T.red : a.severity === 'high' ? T.amber : T.gray }}>{a.severity}</span>
								<span className="mono" style={{ fontSize: 10, color: T.grayDim }}>{a.shipment}</span>
							</div>
							<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
							<div style={{ fontSize: 12, color: T.gray, marginBottom: 6 }}>{a.detail}</div>
							<div style={{ fontSize: 11, color: T.grayDim }}>{a.time}</div>
						</div>
						<button className="btn-primary" style={{ padding: '6px 14px', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 10 }}>Resolve</button>
					</div>
				</div>
			))}
		</div>
	</div>
);

// Navigation Sidebar
const NavSidebar = ({ activeTab, setActiveTab }) => (
	<div style={{ width: 260, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 16px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 8 }}>
		<div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.grayDim, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>Features</div>
		{[
			{ id: 'dashboard', label: 'Control Tower', icon: 'activity' },
			{ id: 'shipments', label: 'Live Shipments', icon: 'truck' },
			{ id: 'drivers', label: 'Driver Pool', icon: 'user' },
			{ id: 'optimize', label: 'AI Optimizer', icon: 'zap' },
			{ id: 'alerts', label: 'Risk Alerts', icon: 'alert' },
		].map((tab) => (
			<button
				key={tab.id}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 12,
					padding: '12px 14px',
					border: activeTab === tab.id ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
					background: activeTab === tab.id ? `rgba(0,212,180,.1)` : 'transparent',
					color: activeTab === tab.id ? T.teal : T.gray,
					borderRadius: 8,
					cursor: 'pointer',
					fontSize: 13,
					fontWeight: activeTab === tab.id ? 700 : 500,
					transition: 'all 0.2s',
					fontFamily: "'Space Grotesk', sans-serif",
					width: '100%',
					justifyContent: 'flex-start',
				}}
				onClick={() => setActiveTab(tab.id)}
				onMouseEnter={(e) => {
					if (activeTab !== tab.id) {
						e.target.style.borderColor = T.teal;
						e.target.style.color = T.teal;
					}
				}}
				onMouseLeave={(e) => {
					if (activeTab !== tab.id) {
						e.target.style.borderColor = T.border;
						e.target.style.color = T.gray;
					}
				}}
			>
				<Icon name={tab.icon} size={16} color="currentColor" />
				<span>{tab.label}</span>
			</button>
		))}
	</div>
);

export default function ManagerDashboard() {
	const [screen, setScreen] = useState('logistics');
	const [activeTab, setActiveTab] = useState('dashboard');
	const [simMode, setSimMode] = useState(false);
	const [loading, setLoading] = useState(false);
	const [usingDummy, setUsingDummy] = useState(true);

	useEffect(() => {
		setLoading(false);
	}, []);

	// Map active tab to screen
	const displayScreen = activeTab === 'dashboard' ? 'logistics' : activeTab;

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<>
			<style>{css}</style>
			<DemoModeBanner usingDummy={usingDummy} />
			<div style={{ color: T.white, padding: '0 32px 28px 32px' }}>
				<div style={{ display: 'flex', gap: 24 }}>
					<NavSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
					<div style={{ flex: 1 }}>
						{displayScreen === 'logistics' && <LogisticsDashboard setScreen={setScreen} simMode={simMode} />}
						{displayScreen === 'shipments' && <LiveShipmentsScreen />}
						{displayScreen === 'drivers' && (activeTab === 'drivers' ? <DriverPoolScreen /> : <DriversPanel setScreen={setScreen} />)}
						{displayScreen === 'optimize' && <AIOptimizerScreen />}
						{displayScreen === 'alerts' && <RiskAlertsScreen />}
					</div>
				</div>
			</div>
		</>
	);
}
