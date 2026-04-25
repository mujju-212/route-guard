import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { normalizeShipment } from '../../utils/shipmentView';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import Spinner from '../../components/ui/Spinner';

const MONITOR_KEY = 'receiver:monitored:shipments';

function fmtStatus(status) {
	return status ? String(status).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown';
}

function fmtDate(value) {
	if (!value) return '-';
	try {
		return new Date(value).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return value;
	}
}

function statusTone(status) {
	const s = String(status || '').toLowerCase();
	if (s === 'delivered') return { fg: '#22c55e', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.35)' };
	if (s === 'delayed') return { fg: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)' };
	if (['in_transit', 'picked_up', 'at_port', 'customs'].includes(s)) return { fg: '#3b82f6', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)' };
	return { fg: '#eab308', bg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.35)' };
}

function severityTone(severity) {
	const s = String(severity || '').toLowerCase();
	if (s === 'critical') return { fg: '#ef4444', bg: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.35)' };
	if (s === 'high') return { fg: '#f97316', bg: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.35)' };
	return { fg: '#eab308', bg: 'rgba(234,179,8,0.16)', border: 'rgba(234,179,8,0.35)' };
}

function StatusPill({ status }) {
	const tone = statusTone(status);
	return (
		<span
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 6,
				padding: '4px 10px',
				borderRadius: 999,
				fontSize: 11,
				fontWeight: 700,
				textTransform: 'uppercase',
				color: tone.fg,
				background: tone.bg,
				border: `1px solid ${tone.border}`,
			}}
		>
			<span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.fg }} />
			{fmtStatus(status)}
		</span>
	);
}

function KpiCard({ title, value, subtitle, accent }) {
	return (
		<div className="card" style={{ borderTop: `3px solid ${accent}` }}>
			<div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{title}</div>
			<div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
			<div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{subtitle}</div>
		</div>
	);
}

function ShipmentRow({ shipment, actionLabel = 'View', onAction }) {
	return (
		<div
			className="card"
			style={{
				padding: 14,
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				gap: 12,
			}}
		>
			<div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
					<span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
						{shipment.tracking_number || shipment.shipment_id}
					</span>
					<StatusPill status={shipment.current_status} />
				</div>
				<div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
					{shipment.origin || shipment.origin_port_name || '-'} {'->'} {shipment.destination || shipment.destination_port_name || '-'}
				</div>
				<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
					ETA: {shipment.current_status === 'delivered' ? 'Delivered' : fmtDate(shipment.expected_arrival)}
				</div>
			</div>
			<button className="btn-outline" onClick={onAction} style={{ minWidth: 90 }}>
				{actionLabel}
			</button>
		</div>
	);
}

function DashboardTab({ shipments, loading, onOpenOrder }) {
	const incoming = useMemo(
		() => shipments.filter((s) => !['delivered', 'cancelled'].includes(String(s.current_status || '').toLowerCase())),
		[shipments],
	);
	const delayed = useMemo(
		() => shipments.filter((s) => String(s.current_status || '').toLowerCase() === 'delayed'),
		[shipments],
	);
	const delivered = useMemo(
		() => shipments.filter((s) => String(s.current_status || '').toLowerCase() === 'delivered'),
		[shipments],
	);

	return (
		<div>
			<div className="page-header">
				<div>
					<h1 className="page-title">Receiver Dashboard</h1>
					<p className="page-subtitle">Incoming, delayed, and delivered consignments in one view.</p>
				</div>
			</div>

			<div className="grid-three" style={{ marginBottom: 18 }}>
				<KpiCard title="Incoming" value={incoming.length} subtitle="Active consignments" accent="#3b82f6" />
				<KpiCard title="Delivered" value={delivered.length} subtitle="Completed consignments" accent="#22c55e" />
				<KpiCard title="Delayed" value={delayed.length} subtitle="Need attention" accent={delayed.length ? '#ef4444' : '#22c55e'} />
			</div>

			{loading ? (
				<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
					<Spinner size="lg" />
				</div>
			) : (
				<div style={{ display: 'grid', gap: 16 }}>
					<div className="card">
						<div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Incoming Orders</div>
						<div style={{ display: 'grid', gap: 10 }}>
							{incoming.slice(0, 8).map((shipment) => (
								<ShipmentRow key={shipment.shipment_id} shipment={shipment} onAction={() => onOpenOrder(shipment.shipment_id)} />
							))}
							{incoming.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No incoming orders.</div>}
						</div>
					</div>

					<div className="card">
						<div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#ef4444' }}>Delayed Orders</div>
						<div style={{ display: 'grid', gap: 10 }}>
							{delayed.slice(0, 6).map((shipment) => (
								<ShipmentRow key={shipment.shipment_id} shipment={shipment} onAction={() => onOpenOrder(shipment.shipment_id)} />
							))}
							{delayed.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No delayed orders.</div>}
						</div>
					</div>

					<div className="card">
						<div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#22c55e' }}>Recently Delivered</div>
						<div style={{ display: 'grid', gap: 10 }}>
							{delivered.slice(0, 6).map((shipment) => (
								<ShipmentRow key={shipment.shipment_id} shipment={shipment} actionLabel="Details" onAction={() => onOpenOrder(shipment.shipment_id)} />
							))}
							{delivered.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No delivered orders yet.</div>}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function TrackTab({ shipments, loading, monitored, onAddMonitor, onRemoveMonitor, onOpenOrder }) {
	const [query, setQuery] = useState('');
	const [hasSearched, setHasSearched] = useState(false);

	const searched = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return null;
		return shipments.find((item) => String(item.tracking_number || '').toLowerCase() === q) || null;
	}, [query, shipments]);

	const monitoredOrders = useMemo(
		() => monitored.map((id) => shipments.find((s) => s.shipment_id === id)).filter(Boolean),
		[monitored, shipments],
	);

	const handleSearch = () => {
		setHasSearched(true);
	};

	return (
		<div>
			<div className="page-header">
				<div>
					<h1 className="page-title">Search & Monitor</h1>
					<p className="page-subtitle">Search a tracking number and add it to your monitored list.</p>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 16 }}>
				<label className="label">Tracking Number</label>
				<div style={{ display: 'flex', gap: 10 }}>
					<div style={{ position: 'relative', flex: 1 }}>
						<Search size={16} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--text-muted)' }} />
						<input
							className="input mono"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
							placeholder="e.g. SHP-0042"
							style={{ paddingLeft: 34 }}
						/>
					</div>
					<button className="btn-primary" onClick={handleSearch}>
						<Search size={15} /> Search
					</button>
				</div>
			</div>

			{loading ? (
				<div className="card" style={{ minHeight: 180, display: 'grid', placeItems: 'center' }}>
					<Spinner size="lg" />
				</div>
			) : (
				<>
					<div className="card" style={{ marginBottom: 16 }}>
						<div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Search Result</div>
						{!hasSearched && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Enter a tracking number to search.</div>}
						{hasSearched && !searched && (
							<div style={{ color: 'var(--warning)', fontSize: 13 }}>
								No matching order found in your receiver account.
							</div>
						)}
						{hasSearched && searched && (
							<div style={{ display: 'grid', gap: 10 }}>
								<ShipmentRow shipment={searched} onAction={() => onOpenOrder(searched.shipment_id)} />
								<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
									{monitored.includes(searched.shipment_id) ? (
										<button className="btn-outline" onClick={() => onRemoveMonitor(searched.shipment_id)}>
											Remove From Monitor
										</button>
									) : (
										<button className="btn-primary" onClick={() => onAddMonitor(searched.shipment_id)}>
											Add To Monitor
										</button>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="card">
						<div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>My Monitored Orders</div>
						<div style={{ display: 'grid', gap: 10 }}>
							{monitoredOrders.map((shipment) => (
								<div key={shipment.shipment_id} style={{ display: 'grid', gap: 8 }}>
									<ShipmentRow shipment={shipment} onAction={() => onOpenOrder(shipment.shipment_id)} />
									<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
										<button className="btn-outline" onClick={() => onRemoveMonitor(shipment.shipment_id)}>
											Remove
										</button>
									</div>
								</div>
							))}
							{monitoredOrders.length === 0 && (
								<div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
									No monitored orders yet. Search an order and add it here.
								</div>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function AlertsTab({ onOpenOrder }) {
	const [alerts, setAlerts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState('all');

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const res = await api.get(ENDPOINTS.ACTIVE_ALERTS);
				setAlerts(Array.isArray(res.data) ? res.data : []);
			} catch {
				setAlerts([]);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, []);

	const markRead = async (alertId) => {
		try {
			await api.put(ENDPOINTS.MARK_ALERT_READ(alertId));
			setAlerts((prev) => prev.map((item) => (item.alert_id === alertId ? { ...item, is_read: true } : item)));
		} catch {
			// keep UI stable even if API fails
		}
	};

	const filtered = useMemo(() => {
		if (filter === 'unread') return alerts.filter((a) => !a.is_read);
		if (filter === 'high') return alerts.filter((a) => String(a.severity).toLowerCase() === 'high');
		if (filter === 'critical') return alerts.filter((a) => String(a.severity).toLowerCase() === 'critical');
		return alerts;
	}, [alerts, filter]);

	return (
		<div>
			<div className="page-header">
				<div>
					<h1 className="page-title">Alerts</h1>
					<p className="page-subtitle">Critical and high-priority shipment alerts for receiver actions.</p>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
				{[
					{ id: 'all', label: 'All' },
					{ id: 'unread', label: 'Unread' },
					{ id: 'high', label: 'High' },
					{ id: 'critical', label: 'Critical' },
				].map((item) => (
					<button
						key={item.id}
						className={filter === item.id ? 'btn-primary' : 'btn-outline'}
						onClick={() => setFilter(item.id)}
						style={{ padding: '7px 12px' }}
					>
						{item.label}
					</button>
				))}
			</div>

			{loading ? (
				<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
					<Spinner size="lg" />
				</div>
			) : (
				<div style={{ display: 'grid', gap: 12 }}>
					{filtered.map((alert) => {
						const tone = severityTone(alert.severity);
						return (
							<div
								key={alert.alert_id}
								className="card"
								style={{ borderLeft: `4px solid ${tone.fg}`, background: tone.bg }}
							>
								<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
									<div>
										<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
											<span className="mono" style={{ fontSize: 12 }}>
												{alert.tracking_number || alert.shipment_id}
											</span>
											<span style={{ fontSize: 11, color: tone.fg, fontWeight: 700, textTransform: 'uppercase' }}>
												{String(alert.severity || '').toUpperCase()}
											</span>
											{!alert.is_read && <span style={{ fontSize: 11, color: 'var(--warning)' }}>Unread</span>}
										</div>
										<div style={{ fontSize: 13, marginBottom: 4 }}>{alert.message}</div>
										<div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDate(alert.created_at)}</div>
									</div>
									<div style={{ display: 'flex', gap: 8 }}>
										<button className="btn-outline" onClick={() => onOpenOrder(alert.shipment_id)}>
											View Order
										</button>
										{!alert.is_read && (
											<button className="btn-primary" onClick={() => markRead(alert.alert_id)}>
												Mark Read
											</button>
										)}
									</div>
								</div>
							</div>
						);
					})}
					{filtered.length === 0 && <div className="card" style={{ color: 'var(--text-muted)' }}>No alerts found for this filter.</div>}
				</div>
			)}
		</div>
	);
}

export default function ReceiverDashboard({ initialTab = 'dashboard' }) {
	const navigate = useNavigate();
	const [shipments, setShipments] = useState([]);
	const [loadingShipments, setLoadingShipments] = useState(true);
	const activeTab = useMemo(() => {
		if (initialTab === 'track' || initialTab === 'search-monitor' || initialTab === 'create-order') return 'track';
		if (initialTab === 'alerts') return 'alerts';
		return 'dashboard';
	}, [initialTab]);
	const [monitored, setMonitored] = useState(() => {
		try {
			const parsed = JSON.parse(localStorage.getItem(MONITOR_KEY) || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	});

	useEffect(() => {
		localStorage.setItem(MONITOR_KEY, JSON.stringify(monitored));
	}, [monitored]);

	useEffect(() => {
		const loadShipments = async () => {
			setLoadingShipments(true);
			try {
				const res = await api.get(ENDPOINTS.MY_SHIPMENTS);
				const rows = Array.isArray(res.data) ? res.data.map((item) => normalizeShipment(item)) : [];
				setShipments(rows);
			} catch {
				setShipments([]);
			} finally {
				setLoadingShipments(false);
			}
		};
		loadShipments();
	}, []);

	const openOrder = (shipmentId) => {
		if (!shipmentId) return;
		navigate(`/receiver/shipments/${shipmentId}`);
	};

	const addMonitor = (shipmentId) => {
		if (!shipmentId) return;
		setMonitored((prev) => (prev.includes(shipmentId) ? prev : [shipmentId, ...prev]));
	};

	const removeMonitor = (shipmentId) => {
		setMonitored((prev) => prev.filter((item) => item !== shipmentId));
	};

	return (
		<div>
			<DemoModeBanner role="receiver" />

			{activeTab === 'dashboard' && (
				<DashboardTab shipments={shipments} loading={loadingShipments} onOpenOrder={openOrder} />
			)}
			{activeTab === 'track' && (
				<TrackTab
					shipments={shipments}
					loading={loadingShipments}
					monitored={monitored}
					onAddMonitor={addMonitor}
					onRemoveMonitor={removeMonitor}
					onOpenOrder={openOrder}
				/>
			)}
			{activeTab === 'alerts' && <AlertsTab onOpenOrder={openOrder} />}
		</div>
	);
}
