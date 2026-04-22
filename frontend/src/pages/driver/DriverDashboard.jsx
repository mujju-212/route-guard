import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
`;

// NavTabs Component
const NavTabs = ({ activeTab, setActiveTab, navigate }) => {
	const tabs = [
		{ id: 'dashboard', label: 'My Tasks', path: '/driver/my-tasks' },
		{ id: 'pickup', label: 'Pickup Details', path: '/driver/pickup' },
		{ id: 'navigate', label: 'Navigation', path: '/driver/navigate' },
		{ id: 'alerts', label: 'Alerts', path: '/driver/alerts' },
	];

	const handleTabClick = (tab) => {
		setActiveTab(tab.id);
		if (navigate) navigate(tab.path);
	};

	return (
		<div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: `1px solid ${T.border}` }}>
			{tabs.map((tab) => (
				<button
					key={tab.id}
					onClick={() => handleTabClick(tab)}
					style={{
						padding: '12px 18px',
						background: activeTab === tab.id ? T.card : 'transparent',
						color: activeTab === tab.id ? T.teal : T.gray,
						border: `1px solid ${activeTab === tab.id ? T.teal : 'transparent'}`,
						borderRadius: '8px 8px 0 0',
						cursor: 'pointer',
						fontSize: 13,
						fontWeight: 600,
						transition: 'all .2s',
						fontFamily: "'Space Grotesk', sans-serif",
					}}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
};

// Chip Component
const Chip = ({ label, variant = 'teal', dot = false }) => (
	<div className={`chip chip-${variant}`}>
		{dot && <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />}
		{label}
	</div>
);

// Map Visualization
const MapViz = ({ riskLevel = 'low', driverPos = 0.5 }) => (
	<div style={{ background: `linear-gradient(135deg, rgba(0,212,180,0.1), rgba(0,212,180,0.03))`, border: `1px solid rgba(0,212,180,0.2)`, borderRadius: 12, padding: 16, marginBottom: 16, height: 180 }}>
		<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 11, color: T.gray }}>
			<span>Mumbai</span>
			<span>{riskLevel === 'high' ? '⚠ High Risk' : '✓ Low Risk'}</span>
			<span>Aurangabad</span>
		</div>
		<div style={{ background: T.navy, height: 120, borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
			<div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${T.teal}, transparent)` }} />
			<svg style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
				<polyline points={`0,60 ${driverPos * 100}%,55 100%,50`} fill="none" stroke={T.teal} strokeWidth="2" />
			</svg>
			<div style={{ position: 'absolute', left: `${driverPos * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 20 }}>🚚</div>
		</div>
	</div>
);

// Main Dashboard Screen
const DriverMainDashboard = ({ setTab }) => (
	<div style={{ maxWidth: 420, margin: '0 auto' }}>
		<div className="topbar" style={{ marginBottom: 20 }}>
			<div>
				<div style={{ fontSize: 12, color: T.gray }}>Good morning,</div>
				<h1 style={{ fontSize: 20, fontWeight: 700 }}>Ravi Naik 👋</h1>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<span className="live-dot" />
				<span style={{ fontSize: 11, color: T.gray }}>DRV-04</span>
			</div>
		</div>

		<div className="card" style={{ background: `linear-gradient(135deg, rgba(0,212,180,0.1), rgba(0,212,180,0.03))`, border: `1px solid rgba(0,212,180,0.3)`, marginBottom: 16, textAlign: 'center', padding: 28 }}>
			<Chip label="New Assignment" variant="teal" dot />
			<div style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 6px' }}>ORD-2842 Assigned</div>
			<div style={{ fontSize: 13, color: T.gray, marginBottom: 20, lineHeight: 1.6 }}>
				Steel Flanges (160 units)<br />Mumbai → Aurangabad MIDC
			</div>
			<div style={{ display: 'flex', gap: 10 }}>
				<button className="btn-ghost" style={{ flex: 1 }}>Details</button>
				<button className="btn-primary" style={{ flex: 2 }} onClick={() => setTab('pickup')}>Start Pickup →</button>
			</div>
		</div>

		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
			<div className="card" style={{ textAlign: 'center' }}>
				<div className="number-big" style={{ color: T.teal, fontSize: 24 }}>3</div>
				<div style={{ fontSize: 11, color: T.gray }}>Deliveries Today</div>
			</div>
			<div className="card" style={{ textAlign: 'center' }}>
				<div className="number-big" style={{ color: T.green, fontSize: 24 }}>98%</div>
				<div style={{ fontSize: 11, color: T.gray }}>On-Time Rate</div>
			</div>
		</div>

		<div className="card">
			<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Today's Schedule</div>
			{[
				{ id: 'ORD-2842', route: 'Mumbai → Aurangabad', time: '07:45 Pickup', status: 'upcoming' },
				{ id: 'ORD-2839', route: 'Nashik → Pune', time: '14:00 Delivery', status: 'done' },
			].map((s, i) => (
				<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 1 ? `1px solid ${T.border}` : 'none', fontSize: 13 }}>
					<div>
						<span className="mono" style={{ fontSize: 10, color: T.grayDim }}>{s.id} </span>
						<span style={{ color: T.white }}>{s.route}</span>
					</div>
					<Chip label={s.status === 'done' ? 'Done' : 'Upcoming'} variant={s.status === 'done' ? 'green' : 'teal'} />
				</div>
			))}
		</div>
	</div>
);

// Pickup Details Screen
const DriverPickup = ({ setTab }) => {
	const [confirmed, setConfirmed] = useState(false);

	return (
		<div style={{ maxWidth: 420, margin: '0 auto' }}>
			<div className="topbar" style={{ marginBottom: 16 }}>
				<div>
					<h1 style={{ fontSize: 18, fontWeight: 700 }}>Pickup Details</h1>
					<div style={{ fontSize: 12, color: T.gray }}>ORD-2842</div>
				</div>
			</div>

			<MapViz riskLevel="low" driverPos={0.05} />

			<div className="card" style={{ marginBottom: 12 }}>
				<div className="section-label">Pickup Location</div>
				<div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Apex Shipper — Bay 3</div>
				<div style={{ fontSize: 13, color: T.gray, marginBottom: 14 }}>Plot 7, MIDC Industrial Area, Mumbai · 4.2 km away</div>
				<div style={{ display: 'flex', gap: 10 }}>
					<button className="btn-ghost" style={{ flex: 1 }}>📞 Call</button>
					<button className="btn-primary" style={{ flex: 2 }}>🗺 Navigate</button>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 12 }}>
				<div className="section-label">Cargo</div>
				{[['Items', 'Steel Flanges (160 units)'], ['Weight', '480 kg'], ['Dimensions', '160×80×60 cm'], ['Seal #', 'SL-9041-X']].map(([k, v]) => (
					<div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
						<span style={{ color: T.gray }}>{k}</span>
						<span style={{ fontWeight: 600 }}>{v}</span>
					</div>
				))}
			</div>

			{!confirmed ? (
				<button className="btn-primary" style={{ width: '100%', padding: 14 }} onClick={() => setConfirmed(true)}>
					✓ Confirm Pickup Collected
				</button>
			) : (
				<div>
					<div className="card card-animate" style={{ background: `rgba(16,185,129,0.08)`, border: `1px solid ${T.green}`, textAlign: 'center', padding: 20, marginBottom: 12 }}>
						<div style={{ fontSize: 14, fontWeight: 700, color: T.green }}>Pickup Confirmed ✓</div>
						<div style={{ fontSize: 12, color: T.gray, marginTop: 4 }}>Driver and Logistics Manager notified</div>
					</div>
					<button className="btn-primary" style={{ width: '100%', padding: 14 }} onClick={() => setTab('navigate')}>
						Start Delivery Route →
					</button>
				</div>
			)}
		</div>
	);
};

// Navigation Screen
const DriverNavigation = () => {
	const [rerouted, setRerouted] = useState(false);
	const [driverPos, setDriverPos] = useState(0.2);

	useEffect(() => {
		const iv = setInterval(() => setDriverPos((p) => Math.min(p + 0.005, 0.95)), 300);
		return () => clearInterval(iv);
	}, []);

	return (
		<div style={{ maxWidth: 420, margin: '0 auto' }}>
			<div className="topbar" style={{ marginBottom: 16 }}>
				<div>
					<h1 style={{ fontSize: 18, fontWeight: 700 }}>In Transit</h1>
				</div>
				<Chip label={rerouted ? 'Rerouted' : 'On Track'} variant={rerouted ? 'teal' : 'green'} dot />
			</div>

			<MapViz riskLevel="low" driverPos={driverPos} />

			<div className="card" style={{ marginBottom: 12 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between' }}>
					<div>
						<div style={{ fontSize: 12, color: T.gray }}>ETA</div>
						<div className="number-big" style={{ color: rerouted ? T.teal : T.teal, fontSize: 24 }}>
							{rerouted ? '08:55' : '08:50'}
						</div>
					</div>
					<div style={{ textAlign: 'right' }}>
						<div style={{ fontSize: 12, color: T.gray }}>Distance</div>
						<div style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(350 * (1 - driverPos))} km</div>
					</div>
				</div>
			</div>

			{!rerouted && (
				<div className="alert-card" style={{ marginBottom: 12 }}>
					<div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>⚠ Traffic Jam — NH-48</div>
					<div style={{ fontSize: 12, color: T.gray, marginBottom: 12 }}>Congestion detected. +50 min delay. AI recommends Satara bypass.</div>
					<div style={{ display: 'flex', gap: 10 }}>
						<button className="btn-ghost" style={{ flex: 1, fontSize: 12 }}>Ignore</button>
						<button className="btn-primary" style={{ flex: 2, fontSize: 12 }} onClick={() => setRerouted(true)}>Accept New Route</button>
					</div>
				</div>
			)}

			{rerouted && (
				<div className="card card-animate" style={{ marginBottom: 12, background: `rgba(0,212,180,0.06)`, border: `1px solid rgba(0,212,180,0.3)` }}>
					<div style={{ fontSize: 13, fontWeight: 700, color: T.teal, marginBottom: 4 }}>Route Updated ✓</div>
					<div style={{ fontSize: 12, color: T.gray }}>Now on Satara bypass. Saved 38 min. ETA 08:55 — still within SLA.</div>
				</div>
			)}

			<div style={{ display: 'flex', gap: 10 }}>
				<button className="btn-ghost" style={{ flex: 1 }}>Report Issue</button>
				<button className="btn-primary" style={{ flex: 2 }}>Confirm Delivery</button>
			</div>
		</div>
	);
};

// Alerts Screen
const DriverAlertsScreen = () => (
	<div style={{ maxWidth: 420, margin: '0 auto' }}>
		<div className="topbar" style={{ marginBottom: 20 }}>
			<h1 style={{ fontSize: 20, fontWeight: 700 }}>Alerts</h1>
		</div>

		<div style={{ marginBottom: 16 }}>
			<div style={{ fontSize: 11, fontWeight: 600, color: T.grayDim, marginBottom: 12, letterSpacing: '1.5px' }}>ACTIVE ALERTS</div>
			<div className="alert-card" style={{ marginBottom: 12 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
					<div style={{ fontSize: 13, fontWeight: 700, color: T.red }}>⚠ Traffic Congestion</div>
					<span className="chip chip-red">High</span>
				</div>
				<div style={{ fontSize: 12, color: T.gray, marginBottom: 10 }}>Heavy traffic on NH-48. AI suggests Satara bypass route, saving 38 minutes.</div>
				<button className="btn-primary" style={{ width: '100%', padding: 10, fontSize: 12 }}>View Alternate Route</button>
			</div>

			<div className="alert-card" style={{ borderColor: T.amber }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
					<div style={{ fontSize: 13, fontWeight: 700, color: T.amber }}>⚡ Weather Warning</div>
					<span className="chip chip-amber">Medium</span>
				</div>
				<div style={{ fontSize: 12, color: T.gray }}>Heavy rain expected in Karjat region. Slow down and exercise caution.</div>
			</div>
		</div>

		<div>
			<div style={{ fontSize: 11, fontWeight: 600, color: T.grayDim, marginBottom: 12, letterSpacing: '1.5px' }}>RECENT ACTIVITY</div>
			{[
				{ icon: '📦', title: 'Pickup Confirmed', desc: 'ORD-2842 pickup completed', time: '1 hour ago' },
				{ icon: '🚚', title: 'On Schedule', desc: 'Route progressing as planned', time: '2 hours ago' },
				{ icon: '📍', title: 'Destination Updated', desc: 'ETA adjusted to 08:55', time: '3 hours ago' },
			].map((item, i) => (
				<div key={i} className="card" style={{ marginBottom: 10 }}>
					<div style={{ display: 'flex', gap: 12 }}>
						<div style={{ fontSize: 20 }}>{item.icon}</div>
						<div style={{ flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{item.title}</div>
							<div style={{ fontSize: 12, color: T.gray }}>{item.desc}</div>
							<div style={{ fontSize: 11, color: T.grayDim, marginTop: 4 }}>{item.time}</div>
						</div>
					</div>
				</div>
			))}
		</div>
	</div>
);

// Main Export
export default function DriverDashboard({ initialTab = 'dashboard' }) {
	const [activeTab, setActiveTab] = useState(initialTab);
	const [isLoading] = useState(false);
	const [theme] = useState(() => localStorage.getItem('theme') || 'dark');
	const location = useLocation();
	const navigate = useNavigate();

	// Update activeTab when initialTab prop changes
	useEffect(() => {
		setActiveTab(initialTab);
	}, [initialTab]);

	// Update based on URL path changes
	useEffect(() => {
		const pathSegments = location.pathname.split('/');
		const tabFromPath = pathSegments[2]; // Get segment after /driver/
		if (tabFromPath && ['my-tasks', 'pickup', 'navigate', 'alerts'].includes(tabFromPath)) {
			const tabMap = {
				'my-tasks': 'dashboard',
				'pickup': 'pickup',
				'navigate': 'navigate',
				'alerts': 'alerts',
			};
			setActiveTab(tabMap[tabFromPath]);
		}
	}, [location.pathname]);

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
	}, [theme]);

	return (
		<>
			<style>{css}</style>
			<DemoModeBanner role="driver" />
			<div style={{ background: T.navy, minHeight: '100vh', width: '100%', color: T.white, fontFamily: "'Space Grotesk', sans-serif", padding: '32px 40px', overflow: 'auto' }}>
				<NavTabs activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />

				{isLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
						<Spinner size={32} />
					</div>
				) : (
					<>
						{activeTab === 'dashboard' && <DriverMainDashboard setTab={setActiveTab} />}
						{activeTab === 'pickup' && <DriverPickup setTab={setActiveTab} />}
						{activeTab === 'navigate' && <DriverNavigation />}
						{activeTab === 'alerts' && <DriverAlertsScreen />}
					</>
				)}
			</div>
		</>
	);
}
