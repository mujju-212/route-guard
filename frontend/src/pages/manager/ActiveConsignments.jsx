import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	Anchor,
	CalendarClock,
	Package,
	RefreshCcw,
	Route,
	ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { normalizeShipment } from '../../utils/shipmentView';

const STATUS_TABS = [
	{ key: 'all', label: 'All' },
	{ key: 'pick_pending', label: 'Pick Pending' },
	{ key: 'in_transit', label: 'In Transit' },
	{ key: 'at_port', label: 'At Port' },
	{ key: 'delayed', label: 'Delayed' },
	{ key: 'delivered', label: 'Delivered' },
];

const STATUS_META = {
	created: { label: 'Created', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
	picked_up: { label: 'Picked Up', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
	in_transit: { label: 'In Transit', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
	at_port: { label: 'At Port', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
	customs: { label: 'Customs', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
	delayed: { label: 'Delayed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
	delivered: { label: 'Delivered', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
	cancelled: { label: 'Cancelled', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const RISK_META = {
	critical: { label: 'Critical', color: '#ef4444' },
	high: { label: 'High', color: '#f97316' },
	medium: { label: 'Medium', color: '#eab308' },
	low: { label: 'Low', color: '#22c55e' },
};

function matchTab(status, tab) {
	if (tab === 'all') return true;
	if (tab === 'pick_pending') return ['created', 'picked_up', 'customs'].includes(status);
	if (tab === 'in_transit') return status === 'in_transit';
	if (tab === 'at_port') return status === 'at_port';
	if (tab === 'delayed') return status === 'delayed';
	if (tab === 'delivered') return status === 'delivered';
	return true;
}

function timeAgo(iso) {
	if (!iso) return 'N/A';
	const deltaMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
	if (deltaMin < 60) return `${Math.max(deltaMin, 1)}m ago`;
	if (deltaMin < 1440) return `${Math.floor(deltaMin / 60)}h ago`;
	return `${Math.floor(deltaMin / 1440)}d ago`;
}

function formatDate(iso) {
	if (!iso) return 'N/A';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return String(iso);
	return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(iso) {
	if (!iso) return null;
	const ms = new Date(iso).getTime() - Date.now();
	if (!Number.isFinite(ms)) return null;
	return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }) {
	const meta = STATUS_META[status] || STATUS_META.created;
	return (
		<span
			style={{
				fontSize: 10,
				fontWeight: 700,
				padding: '2px 8px',
				borderRadius: 6,
				color: meta.color,
				background: meta.bg,
				letterSpacing: '0.04em',
				textTransform: 'uppercase',
			}}
		>
			{meta.label}
		</span>
	);
}

function RiskBadge({ level, score }) {
	const key = String(level || 'low').toLowerCase();
	const meta = RISK_META[key] || RISK_META.low;
	return (
		<span
			style={{
				fontSize: 10,
				fontWeight: 700,
				padding: '2px 8px',
				borderRadius: 6,
				color: meta.color,
				background: `${meta.color}1f`,
				letterSpacing: '0.04em',
				textTransform: 'uppercase',
			}}
		>
			{meta.label} {score ? `• ${Math.round(Number(score))}` : ''}
		</span>
	);
}

function DetailRow({ label, value }) {
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				padding: '8px 0',
				borderBottom: '1px solid var(--border-subtle)',
				fontSize: 12,
				gap: 8,
			}}
		>
			<span style={{ color: 'var(--text-secondary)' }}>{label}</span>
			<span style={{ fontWeight: 600, textAlign: 'right' }}>{value || 'N/A'}</span>
		</div>
	);
}

export default function ActiveConsignments() {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [shipments, setShipments] = useState([]);
	const [selectedId, setSelectedId] = useState('');
	const [selectedDetail, setSelectedDetail] = useState(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [tab, setTab] = useState('all');
	const [riskFilter, setRiskFilter] = useState('all');
	const [search, setSearch] = useState('');

	const loadShipments = useCallback(async () => {
		setLoading(true);
		try {
			const res = await api.get(ENDPOINTS.ALL_SHIPMENTS, { params: { include_all: true } });
			const rows = Array.isArray(res.data) ? res.data.map(normalizeShipment) : [];
			setShipments(rows);
			setSelectedId((prev) => (prev && rows.some((r) => r.shipment_id === prev) ? prev : rows[0]?.shipment_id || ''));
		} catch {
			setShipments([]);
			setSelectedId('');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadShipments();
	}, [loadShipments]);

	useEffect(() => {
		const run = async () => {
			if (!selectedId) {
				setSelectedDetail(null);
				return;
			}
			setDetailLoading(true);
			try {
				const res = await api.get(ENDPOINTS.SHIPMENT_DETAIL(selectedId));
				setSelectedDetail(res.data || null);
			} catch {
				setSelectedDetail(null);
			} finally {
				setDetailLoading(false);
			}
		};
		run();
	}, [selectedId]);

	const counts = useMemo(() => {
		const out = { all: shipments.length, pick_pending: 0, in_transit: 0, at_port: 0, delayed: 0, delivered: 0 };
		for (const item of shipments) {
			const status = String(item.current_status || item.status || 'created').toLowerCase();
			if (matchTab(status, 'pick_pending')) out.pick_pending += 1;
			if (matchTab(status, 'in_transit')) out.in_transit += 1;
			if (matchTab(status, 'at_port')) out.at_port += 1;
			if (matchTab(status, 'delayed')) out.delayed += 1;
			if (matchTab(status, 'delivered')) out.delivered += 1;
		}
		return out;
	}, [shipments]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return shipments.filter((item) => {
			const status = String(item.current_status || item.status || 'created').toLowerCase();
			if (!matchTab(status, tab)) return false;
			if (riskFilter !== 'all' && String(item.current_risk_level || '').toLowerCase() !== riskFilter) return false;
			if (!q) return true;
			const blob = [
				item.tracking_number,
				item.shipper_name,
				item.receiver_name,
				item.origin_port_name,
				item.destination_port_name,
				item.cargo_description,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return blob.includes(q);
		});
	}, [shipments, tab, riskFilter, search]);

	const selected = useMemo(() => filtered.find((item) => item.shipment_id === selectedId) || shipments.find((item) => item.shipment_id === selectedId) || null, [filtered, shipments, selectedId]);

	const timeline = useMemo(() => {
		const list = Array.isArray(selectedDetail?.status_history) ? selectedDetail.status_history : [];
		if (!list.length && selected) {
			return [
				{ status: 'created', timestamp: selected.created_at, notes: 'Shipment created' },
				{ status: selected.current_status, timestamp: selected.updated_at || selected.created_at, notes: 'Current state' },
			];
		}
		return list;
	}, [selectedDetail, selected]);

	if (loading) {
		return (
			<div style={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	if (!shipments.length) {
		return (
			<EmptyState
				icon={Package}
				title="No consignments in database"
				description="No shipment records are available yet. Create or accept consignments to populate this page."
			/>
		);
	}

	return (
		<div>
			<div className="page-header" style={{ marginBottom: 14 }}>
				<div>
					<h1 className="page-title">Active Consignments</h1>
					<p className="page-subtitle">Track live consignments with status filters, route context, and drill-down details.</p>
				</div>
				<button
					type="button"
					onClick={loadShipments}
					className="btn-outline"
					style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
				>
					<RefreshCcw size={14} /> Refresh
				</button>
			</div>

			<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
				{STATUS_TABS.map((entry) => (
					<button
						key={entry.key}
						type="button"
						onClick={() => setTab(entry.key)}
						style={{
							padding: '6px 12px',
							borderRadius: 8,
							border: '1px solid var(--border-default)',
							background: tab === entry.key ? 'var(--accent-primary)' : 'transparent',
							color: tab === entry.key ? '#fff' : 'var(--text-secondary)',
							fontSize: 12,
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						{entry.label} ({counts[entry.key] || 0})
					</button>
				))}
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 8, marginBottom: 12 }}>
				<input
					type="text"
					className="input"
					placeholder="Search by tracking number, shipper, ports..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<select className="input" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
					<option value="all">All Risk Levels</option>
					<option value="critical">Critical</option>
					<option value="high">High</option>
					<option value="medium">Medium</option>
					<option value="low">Low</option>
				</select>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>
				<div>
					{filtered.length === 0 ? (
						<div style={{ padding: 16, border: '1px solid var(--border-default)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13 }}>
							No consignments match this filter.
						</div>
					) : (
						filtered.map((item) => {
							const status = String(item.current_status || item.status || 'created').toLowerCase();
							const dueDays = daysUntil(item.expected_arrival);
							return (
								<div
									key={item.shipment_id}
									onClick={() => setSelectedId(item.shipment_id)}
									style={{
										padding: '14px 14px 12px',
										borderRadius: 10,
										cursor: 'pointer',
										marginBottom: 8,
										background: selectedId === item.shipment_id ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)',
										border: selectedId === item.shipment_id ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
									}}
								>
									<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
										<span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>
											{item.tracking_number || `SHP-${item.shipment_id.slice(0, 6).toUpperCase()}`}
										</span>
										<StatusBadge status={status} />
									</div>
									<div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
										<Route size={12} style={{ display: 'inline', marginRight: 4 }} />
										{item.origin_port_name || 'Origin'} to {item.destination_port_name || 'Destination'}
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
										<RiskBadge level={item.current_risk_level} score={item.current_risk_score} />
										<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(item.created_at)}</span>
									</div>
									<div style={{ fontSize: 11, color: dueDays !== null && dueDays < 0 ? '#ef4444' : 'var(--text-muted)' }}>
										<CalendarClock size={11} style={{ display: 'inline', marginRight: 4 }} />
										ETA {formatDate(item.expected_arrival)}
										{dueDays !== null ? ` • ${dueDays >= 0 ? `${dueDays}d left` : `${Math.abs(dueDays)}d overdue`}` : ''}
									</div>
								</div>
							);
						})
					)}
				</div>

				<div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16 }}>
					{!selected ? (
						<div style={{ minHeight: 260, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
							Select a consignment from the left list.
						</div>
					) : (
						<>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
								<div>
									<div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
										{selected.tracking_number || `SHP-${selected.shipment_id.slice(0, 6).toUpperCase()}`}
									</div>
									<div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
										{selected.origin_port_name || 'Origin'} to {selected.destination_port_name || 'Destination'}
									</div>
								</div>
								<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
									<StatusBadge status={selected.current_status} />
									<RiskBadge level={selected.current_risk_level} score={selected.current_risk_score} />
								</div>
							</div>

							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
								<div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12 }}>
									<div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>Cargo</div>
									<DetailRow label="Type" value={selected.cargo_type || 'N/A'} />
									<DetailRow label="Description" value={selected.cargo_description || 'N/A'} />
									<DetailRow label="Weight" value={selected.weight_kg ? `${Number(selected.weight_kg).toLocaleString()} kg` : 'N/A'} />
									<DetailRow label="Declared Value" value={selected.declared_value ? `$${Number(selected.declared_value).toLocaleString()}` : 'N/A'} />
								</div>
								<div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12 }}>
									<div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>Assignment</div>
									<DetailRow label="Shipper" value={selected.shipper_name} />
									<DetailRow label="Receiver" value={selected.receiver_name} />
									<DetailRow label="Manager" value={selected.manager_name} />
									<DetailRow label="Driver" value={selected.driver_name} />
									<DetailRow label="Vessel" value={selected.vessel_name} />
								</div>
							</div>

							<div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
								<div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
									<ShieldAlert size={13} /> Status Timeline
								</div>
								{detailLoading ? (
									<div style={{ minHeight: 90, display: 'grid', placeItems: 'center' }}>
										<Spinner size="sm" />
									</div>
								) : (
									<div style={{ display: 'grid', gap: 6 }}>
										{timeline.map((entry, idx) => {
											const st = String(entry.status || 'created').toLowerCase();
											return (
												<div key={`${entry.status}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
													<span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[st]?.color || '#64748b', flexShrink: 0 }} />
													<div style={{ fontSize: 12, flex: 1 }}>
														<strong style={{ marginRight: 6 }}>{STATUS_META[st]?.label || st}</strong>
														<span style={{ color: 'var(--text-muted)' }}>{formatDate(entry.timestamp)}</span>
														{entry.notes ? <div style={{ color: 'var(--text-secondary)' }}>{entry.notes}</div> : null}
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>

							<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
								<button className="btn-primary" type="button" onClick={() => navigate(`/manager/shipments/${selected.shipment_id}`)}>
									View Full Details
								</button>
								<button className="btn-outline" type="button" onClick={() => navigate('/manager?tab=shipments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
									<Anchor size={13} /> Open Live Map
								</button>
								<button className="btn-outline" type="button" onClick={() => navigate('/manager?tab=requests')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
									<AlertCircle size={13} /> Open Requests
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
