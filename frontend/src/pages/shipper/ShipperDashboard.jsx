import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	PackagePlus,
	Search,
	Package,
	TrendingUp,
	Clock,
	Star,
	X,
	CheckCircle2,
	AlertCircle,
	ChevronRight,
	Zap,
	Truck,
	Building2,
} from 'lucide-react';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_SHIPMENTS } from '../../dummy/shipments';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ShipmentTable from '../../components/shipments/ShipmentTable';
import ShipmentCard from '../../components/shipments/ShipmentCard';
import DemoModeBanner from '../../components/ui/DemoModeBanner';

// KPI Component
function KPICard({ icon: Icon, label, value, subtitle }) {
	return (
		<div className="card" style={{ padding: 16, borderTop: '3px solid var(--accent)' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
				<div style={{ padding: 8, backgroundColor: 'var(--bg-secondary)', borderRadius: 8 }}>
					<Icon size={20} style={{ color: 'var(--accent)' }} />
				</div>
			</div>
			<p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>{label}</p>
			<p style={{ fontSize: 32, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>{value}</p>
			<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>
		</div>
	);
}

// Order Review Modal
function OrderReviewModal({ order, onClose, onStageChange }) {
	const [stage, setStage] = useState(order.stage || 'reviewing');
	const [checklist, setChecklist] = useState({
		itemsPulled: order.checklist?.itemsPulled || false,
		qualityCheck: order.checklist?.qualityCheck || false,
		packaging: order.checklist?.packaging || false,
		sealed: order.checklist?.sealed || false,
	});
	const [notification, setNotification] = useState('');

	const stages = ['reviewing', 'accepted', 'packing', 'ready', 'dispatched'];
	const stageLabels = {
		reviewing: 'Reviewing',
		accepted: 'Accepted',
		packing: 'Packing',
		ready: 'Ready for Pickup',
		dispatched: 'Dispatched',
	};

	const handleAccept = () => {
		setStage('accepted');
		onStageChange?.(order.id, 'accepted');
	};

	const handleReject = () => {
		setStage('reviewing');
		onStageChange?.(order.id, 'reviewing');
	};

	const handleBeginPacking = () => {
		setStage('packing');
		onStageChange?.(order.id, 'packing');
	};

	const handleMarkReady = () => {
		setStage('ready');
		onStageChange?.(order.id, 'ready');
	};

	const handleNotifyManager = () => {
		setNotification('Manager notified successfully');
		setTimeout(() => setNotification(''), 3000);
		setStage('dispatched');
		onStageChange?.(order.id, 'dispatched');
	};

	const handleChecklistChange = (key) => {
		setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const stageIndex = stages.indexOf(stage);
	const progressPercent = ((stageIndex + 1) / stages.length) * 100;

	return (
		<div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
			<div className="card" style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto', borderRadius: 12 }}>
				{/* Header */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-default)' }}>
					<div>
						<h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Order {order.id}</h2>
						<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review & Process Order</p>
					</div>
					<button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
						<X size={20} color="var(--text-muted)" />
					</button>
				</div>

				{/* Order Details */}
				<div className="card" style={{ backgroundColor: 'var(--bg-elevated)', marginBottom: 16, padding: 12 }}>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
						<div>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Item</p>
							<p style={{ fontWeight: 600 }}>{order.item}</p>
						</div>
						<div>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Quantity</p>
							<p style={{ fontWeight: 600 }}>{order.quantity}</p>
						</div>
						<div>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Deadline</p>
							<p style={{ fontWeight: 600 }}>{order.deadline}</p>
						</div>
						<div>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Priority</p>
							<p style={{ fontWeight: 600, color: order.priority === 'urgent' ? 'var(--danger)' : 'var(--success)' }}>
								{order.priority?.toUpperCase()}
							</p>
						</div>
					</div>
				</div>

				{/* Stage Progress */}
				<div style={{ marginBottom: 20 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
						<p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Processing Stage</p>
						<p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{stageLabels[stage]}</p>
					</div>
					<div style={{ width: '100%', height: 4, backgroundColor: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
						<div
							style={{
								width: `${progressPercent}%`,
								height: '100%',
								backgroundColor: 'var(--accent)',
								transition: 'width 0.3s ease',
							}}
						/>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
						{stages.map((s) => (
							<span key={s} style={{ opacity: stages.indexOf(s) <= stageIndex ? 1 : 0.5 }}>
								{stageLabels[s]}
							</span>
						))}
					</div>
				</div>

				{/* Packing Checklist */}
				{stage === 'accepted' && (
				<div style={{ marginBottom: 20, padding: 12, backgroundColor: 'var(--bg-elevated)', borderRadius: 8 }}>
						<p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Warehouse Stock Check</p>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<CheckCircle2 size={16} color="var(--success)" />
							<p style={{ fontSize: 12 }}>All items available in stock</p>
						</div>
					</div>
				)}

				{stage === 'packing' && (
				<div style={{ marginBottom: 20, padding: 12, backgroundColor: 'var(--bg-elevated)', borderRadius: 8 }}>
						<p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Packing Checklist</p>
						{[
							{ key: 'itemsPulled', label: 'Items Pulled from Shelves' },
							{ key: 'qualityCheck', label: 'Quality Check Passed' },
							{ key: 'packaging', label: 'Packaging & Labeling Complete' },
							{ key: 'sealed', label: 'Sealed & Scanned' },
						].map(({ key, label }) => (
							<div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
								<input
									type="checkbox"
									checked={checklist[key]}
									onChange={() => handleChecklistChange(key)}
									style={{ cursor: 'pointer', width: 14, height: 14 }}
								/>
								<label style={{ fontSize: 12, cursor: 'pointer', flex: 1 }}>{label}</label>
								{checklist[key] && <CheckCircle2 size={14} color="var(--success)" />}
							</div>
						))}
					</div>
				)}

				{/* AI Advisory */}
				{stage === 'packing' && order.priority === 'urgent' && (
					<div style={{ marginBottom: 20, padding: 12, backgroundColor: 'rgba(255, 193, 7, 0.1)', borderLeft: '3px solid var(--warning)', borderRadius: 8 }}>
						<div style={{ display: 'flex', gap: 8 }}>
							<AlertCircle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
							<div>
								<p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>AI Advisory</p>
								<p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Recommend completing packing by {order.deadline} to meet SLA deadline.</p>
							</div>
						</div>
					</div>
				)}

				{/* Notification */}
				{notification && (
					<div style={{ marginBottom: 12, padding: 8, backgroundColor: 'var(--success)', color: 'white', borderRadius: 4, fontSize: 12 }}>
						✓ {notification}
					</div>
				)}

				{/* Stage-Specific Actions */}
				<div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
					{stage === 'reviewing' && (
						<>
							<button onClick={handleReject} style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
								Reject
							</button>
							<button onClick={handleAccept} style={{ flex: 1, padding: '10px 12px', backgroundColor: 'var(--success)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
								Accept Order
							</button>
						</>
					)}
					{stage === 'accepted' && (
					<button onClick={handleBeginPacking} style={{ flex: 1, padding: '10px 12px', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
							Begin Packing
						</button>
					)}
					{stage === 'packing' && (
					<button onClick={handleMarkReady} disabled={!Object.values(checklist).every(Boolean)} style={{ flex: 1, padding: '10px 12px', backgroundColor: Object.values(checklist).every(Boolean) ? 'var(--accent-primary)' : 'var(--bg-elevated)', color: Object.values(checklist).every(Boolean) ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 6, cursor: Object.values(checklist).every(Boolean) ? 'pointer' : 'not-allowed', fontSize: 13 }}>
							Mark Ready for Pickup
						</button>
					)}
					{stage === 'ready' && (
						<div style={{ flex: 1 }}>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>📍 Waiting Bay: Zone B-12</p>
						<button onClick={handleNotifyManager} style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
								Notify Logistics Manager
							</button>
						</div>
					)}
					{stage === 'dispatched' && (
						<div style={{ flex: 1, padding: '10px 12px', backgroundColor: 'var(--success)', color: 'white', borderRadius: 6, textAlign: 'center', fontSize: 13 }}>
							✓ Order Dispatched
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// Order Card Component
function OrderCardWithActions({ order, onReview, onAccept, onReject }) {
	const getStatusColor = (priority) => {
		switch (priority) {
			case 'urgent':
				return '#ff4444';
			case 'high':
				return '#ff9800';
			case 'standard':
				return '#999999';
			default:
				return 'var(--text-muted)';
		}
	};

	const getPriorityLabel = (priority) => {
		return priority?.toUpperCase() || 'NORMAL';
	};

	return (
		<div className="card" style={{ padding: 16, marginBottom: 12 }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
				<div style={{ flex: 1 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
						<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{order.id}</span>
						<span
							style={{
								fontSize: 11,
								padding: '4px 8px',
								backgroundColor: getStatusColor(order.priority) + '20',
								color: getStatusColor(order.priority),
								borderRadius: 4,
								fontWeight: 600,
								textTransform: 'uppercase',
							}}
						>
							{getPriorityLabel(order.priority)}
						</span>
					</div>
					<h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{order.item}</h3>
					<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>From: {order.fromCompany}</p>
				</div>
				<div style={{ textAlign: 'right' }}>
					<p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Deadline</p>
					<p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{order.deadline}</p>
				</div>
			</div>

			<div style={{ display: 'flex', gap: 8 }}>
				<button
					onClick={() => onReview?.(order)}
					style={{
						flex: 1,
						padding: '10px 12px',
						backgroundColor: 'transparent',
						color: 'var(--accent-primary)',
						border: '1px solid var(--accent-primary)',
						borderRadius: 4,
						cursor: 'pointer',
						fontSize: 12,
						fontWeight: 600,
						transition: 'all 0.16s ease',
					}}
					onMouseEnter={(e) => (e.target.style.background = 'var(--bg-elevated)')}
					onMouseLeave={(e) => (e.target.style.background = 'transparent')}
				>
					Review
				</button>
				<button
					onClick={() => onReject?.(order.id)}
					style={{
						flex: 1,
						padding: '10px 12px',
						backgroundColor: 'rgba(239, 68, 68, 0.16)',
						color: '#fda4af',
						border: '1px solid rgba(239, 68, 68, 0.35)',
						borderRadius: 4,
						cursor: 'pointer',
						fontSize: 12,
						fontWeight: 600,
						transition: 'all 0.16s ease',
					}}
					onMouseEnter={(e) => (e.target.style.background = 'rgba(239, 68, 68, 0.24)')}
					onMouseLeave={(e) => (e.target.style.background = 'rgba(239, 68, 68, 0.16)')}
				>
					Reject
				</button>
				<button
					onClick={() => onAccept?.(order.id)}
					style={{
						flex: 1,
						padding: '10px 12px',
						backgroundColor: 'var(--accent-primary)',
						color: 'white',
						border: 'none',
						borderRadius: 4,
						cursor: 'pointer',
						fontSize: 12,
						fontWeight: 600,
						transition: 'all 0.16s ease',
					}}
					onMouseEnter={(e) => (e.target.style.background = 'var(--accent-hover)')}
					onMouseLeave={(e) => (e.target.style.background = 'var(--accent-primary)')}
				>
					Accept
				</button>
			</div>
		</div>
	);
}

export default function ShipperDashboard() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [shipments, setShipments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [usingDummy, setUsingDummy] = useState(false);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [selectedOrder, setSelectedOrder] = useState(null);
	const [orders, setOrders] = useState([
		{
			id: 'ORD-2842',
			item: 'Steel Flanges (160 units)',
			quantity: 160,
			fromCompany: 'Apex Manufacturing',
			deadline: 'Tomorrow 09:00',
			priority: 'urgent',
			stage: 'reviewing',
			checklist: {},
		},
		{
			id: 'ORD-2843',
			item: 'Sensor Modules (500 units)',
			quantity: 500,
			fromCompany: 'TechDrive India',
			deadline: 'Jan 22, 14:00',
			priority: 'high',
			stage: 'reviewing',
			checklist: {},
		},
		{
			id: 'ORD-2844',
			item: 'Polymer Sheets (40 units)',
			quantity: 40,
			fromCompany: 'BuildRight Co.',
			deadline: 'Jan 24, 11:00',
			priority: 'standard',
			stage: 'reviewing',
			checklist: {},
		},
	]);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const response = await api.get(ENDPOINTS.MY_SHIPMENTS);
				setShipments(response.data || []);
			} catch {
				const mine = DUMMY_SHIPMENTS.filter((item) =>
					user?.name ? item.shipper_name?.toLowerCase().includes(user.name.toLowerCase()) : true
				);
				setShipments(mine.length ? mine : DUMMY_SHIPMENTS.slice(0, 2));
				setUsingDummy(true);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [user?.name]);

	const filteredShipments = useMemo(() => {
		return shipments.filter((item) => {
			const matchesSearch =
				item.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
				item.shipment_id.toLowerCase().includes(search.toLowerCase());
			const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
			return matchesSearch && matchesStatus;
		});
	}, [shipments, search, statusFilter]);

	const kpiData = {
		incomingRequests: { value: 3, subtitle: '1 urgent' },
		packingToday: { value: 7, subtitle: '5 completed' },
		readyToDispatch: { value: 2, subtitle: 'Awaiting pickup' },
		avgPackTime: { value: '2.4h', subtitle: 'Target: 3h' },
	};

	const handleStageChange = (orderId, newStage) => {
		setOrders((prev) =>
			prev.map((o) =>
				o.id === orderId ? { ...o, stage: newStage } : o
			)
		);
	};

	const handleRejectOrder = (orderId) => {
		setOrders((prev) =>
			prev.filter((o) => o.id !== orderId)
		);
	};

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div>
			<DemoModeBanner usingDummy={usingDummy} />

			{/* Page Header */}
			<div className="page-header">
				<div>
					<h1 className="page-title">Shipper Operations</h1>
					<p className="page-subtitle">Manage incoming requests and dispatch pipeline</p>
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<span style={{ fontSize: 12, color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 6, fontWeight: 600 }}>
						● {orders.filter((o) => o.priority === 'urgent').length} PENDING ACTION
					</span>
					<button type="button" className="btn-primary" onClick={() => navigate('/shipper/create')}>
						<PackagePlus size={16} />
						New Shipment
					</button>
				</div>
			</div>

			{/* KPI Section */}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
				<KPICard icon={Package} label="Incoming Requests" value={kpiData.incomingRequests.value} subtitle={kpiData.incomingRequests.subtitle} />
				<KPICard icon={Zap} label="Packing Today" value={kpiData.packingToday.value} subtitle={kpiData.packingToday.subtitle} />
				<KPICard icon={Truck} label="Ready to Dispatch" value={kpiData.readyToDispatch.value} subtitle={kpiData.readyToDispatch.subtitle} />
				<KPICard icon={Clock} label="Avg Pack Time" value={kpiData.avgPackTime.value} subtitle={kpiData.avgPackTime.subtitle} />
			</div>

			{/* Incoming Orders Section */}
			<div style={{ marginBottom: 28 }}>
				<h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>INCOMING ORDER REQUESTS</h2>
				<div>
					{orders.length > 0 ? (
						orders.map((order) => (
							<OrderCardWithActions
								key={order.id}
								order={order}
								onReview={setSelectedOrder}
								onReject={handleRejectOrder}
								onAccept={(id) => {
									handleStageChange(id, 'accepted');
									setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, stage: 'accepted' } : o)));
								}}
							/>
						))
					) : (
						<div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
							<p>No pending orders at this time</p>
						</div>
					)}
				</div>
			</div>

			{/* Shipments Section */}
			<div style={{ marginBottom: 24 }}>
				<h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: 'var(--text-primary)' }}>All Shipments</h2>
				<div className="card" style={{ marginBottom: 14 }}>
					<div className="grid-three">
						<div>
							<label className="label">Search</label>
							<div style={{ position: 'relative' }}>
								<Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
								<input
									className="input"
									style={{ paddingLeft: 32 }}
									placeholder="Tracking number"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
								/>
							</div>
						</div>
						<div>
							<label className="label">Status</label>
							<select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
								<option value="all">All</option>
								<option value="created">Created</option>
								<option value="in_transit">In Transit</option>
								<option value="at_port">At Port</option>
								<option value="delivered">Delivered</option>
							</select>
						</div>
						<div>
							<label className="label">Date Range</label>
							<input className="input" type="text" placeholder="Any time" readOnly value="Last 30 days" />
						</div>
					</div>
				</div>

				{filteredShipments.length ? (
					<>
						<ShipmentTable
							shipments={filteredShipments}
							hideScore
							onTrack={(shipmentId) => navigate(`/shipper/shipments/${shipmentId}`)}
						/>
						<div className="grid-two" style={{ marginTop: 14 }}>
							{filteredShipments.map((shipment) => (
								<ShipmentCard
									key={shipment.shipment_id}
									shipment={shipment}
									onTrack={(shipmentId) => navigate(`/shipper/shipments/${shipmentId}`)}
									actionLabel="Track"
								/>
							))}
						</div>
					</>
				) : (
					<EmptyState
						icon={PackagePlus}
						title="No shipments yet"
						description="Create your first shipment to get started."
						action={
							<button type="button" className="btn-primary" onClick={() => navigate('/shipper/create')}>
								Create Shipment
							</button>
						}
					/>
				)}
			</div>

			{/* Order Review Modal */}
			{selectedOrder && (
				<OrderReviewModal
					order={selectedOrder}
					onClose={() => setSelectedOrder(null)}
					onStageChange={handleStageChange}
				/>
			)}
		</div>
	);
}
