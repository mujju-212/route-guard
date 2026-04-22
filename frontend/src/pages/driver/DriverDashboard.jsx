import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MapPin, Route, Truck } from 'lucide-react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_ALERTS } from '../../dummy/alerts';
import { DUMMY_SHIPMENTS } from '../../dummy/shipments';
import Badge from '../../components/ui/Badge';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import Spinner from '../../components/ui/Spinner';

function pickFallbackAssignment() {
	const active = DUMMY_SHIPMENTS.filter((item) => item.status !== 'delivered');
	const sorted = [...active].sort((a, b) => b.current_risk_score - a.current_risk_score);
	return sorted[0] || null;
}

export default function DriverDashboard() {
	const navigate = useNavigate();
	const [assignment, setAssignment] = useState(null);
	const [loading, setLoading] = useState(true);
	const [usingDummy, setUsingDummy] = useState(false);

	useEffect(() => {
		const fetchAssignment = async () => {
			setLoading(true);
			try {
				const response = await api.get(ENDPOINTS.MY_ASSIGNMENT);
				const payload = response?.data;
				const nextAssignment = Array.isArray(payload)
					? payload[0]
					: payload?.shipment || payload?.assignment || payload;
				if (!nextAssignment?.shipment_id) {
					throw new Error('No assignment found');
				}
				setAssignment(nextAssignment);
			} catch {
				setAssignment(pickFallbackAssignment());
				setUsingDummy(true);
			} finally {
				setLoading(false);
			}
		};

		fetchAssignment();
	}, []);

	const assignmentAlerts = useMemo(() => {
		if (!assignment?.shipment_id) return [];
		return DUMMY_ALERTS.filter((item) => item.shipment_id === assignment.shipment_id).slice(0, 3);
	}, [assignment?.shipment_id]);

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	if (!assignment) {
		return (
			<div className="card">
				<h2 className="section-title">No assignment available</h2>
				<p className="page-subtitle" style={{ marginBottom: 12 }}>
					There is no active shipment assigned right now.
				</p>
				<button type="button" className="btn-primary" onClick={() => window.location.reload()}>
					Refresh Assignment
				</button>
			</div>
		);
	}

	const highRisk = ['high', 'critical'].includes(assignment.current_risk_level);

	return (
		<div>
			<DemoModeBanner usingDummy={usingDummy} />

			<div className="page-header">
				<div>
					<h1 className="page-title">My Assignment</h1>
					<p className="page-subtitle mono">
						{assignment.shipment_id} | {assignment.tracking_number}
					</p>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<span className={`status-chip ${assignment.status}`}>{assignment.status.replace(/_/g, ' ')}</span>
					<Badge level={assignment.current_risk_level}>{assignment.current_risk_level}</Badge>
				</div>
			</div>

			<div className="stats-strip">
				<div className="card" style={{ padding: 12 }}>
					<div className="info-row"><span>Cargo</span><strong>{assignment.cargo_type}</strong></div>
					<div className="info-row"><span>Weight</span><strong className="mono">{assignment.weight_kg} kg</strong></div>
				</div>
				<div className="card" style={{ padding: 12 }}>
					<div className="info-row"><span>Vessel</span><strong>{assignment.assigned_vessel}</strong></div>
					<div className="info-row"><span>Manager</span><strong>{assignment.assigned_manager}</strong></div>
				</div>
				<div className="card" style={{ padding: 12 }}>
					<div className="info-row"><span>Risk Score</span><strong className="mono">{assignment.current_risk_score}</strong></div>
					<div className="info-row"><span>ETA</span><strong className="mono">{new Date(assignment.expected_arrival).toLocaleString()}</strong></div>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
				<button
					type="button"
					className="btn-primary"
					onClick={() => navigate(`/driver/status?shipmentId=${assignment.shipment_id}`)}
				>
					<Truck size={16} />
					Update Status
				</button>
				<button
					type="button"
					className={highRisk ? 'btn-danger' : 'btn-outline'}
					onClick={() => navigate(`/driver/route-change/${assignment.shipment_id}`)}
				>
					<Route size={16} />
					{highRisk ? 'Review Urgent Route Change' : 'View Route Change Options'}
				</button>
			</div>

			<div className="map-panel" style={{ marginBottom: 14 }}>
				<MapContainer
					center={[assignment.current_coordinates.lat, assignment.current_coordinates.lng]}
					zoom={4}
					style={{ height: 360, width: '100%' }}
				>
					<TileLayer
						url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
						attribution="&copy; OpenStreetMap contributors &copy; CARTO"
					/>
					<Polyline positions={assignment.route_waypoints.map((point) => [point.lat, point.lng])} pathOptions={{ color: '#3b82f6', weight: 4 }} />
					<CircleMarker
						center={[assignment.current_coordinates.lat, assignment.current_coordinates.lng]}
						radius={8}
						pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6' }}
					/>
					{assignment.route_waypoints[0] ? (
						<CircleMarker
							center={[assignment.route_waypoints[0].lat, assignment.route_waypoints[0].lng]}
							radius={7}
							pathOptions={{ color: '#22c55e', fillColor: '#22c55e' }}
						/>
					) : null}
				</MapContainer>
			</div>

			<div className="grid-two" style={{ alignItems: 'start' }}>
				<div className="card">
					<h3 className="section-title">Operational Notes</h3>
					<div className="info-list">
						<div className="info-row"><span><MapPin size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />Origin</span><strong>{assignment.origin}</strong></div>
						<div className="info-row"><span>Destination</span><strong>{assignment.destination}</strong></div>
						<div className="info-row"><span>Priority</span><strong style={{ textTransform: 'capitalize' }}>{assignment.priority}</strong></div>
						<div className="info-row"><span>Current Level</span><strong>{assignment.current_risk_level}</strong></div>
					</div>
				</div>

				<div className="card">
					<h3 className="section-title">Recent Alerts</h3>
					{assignmentAlerts.length ? (
						<div className="info-list">
							{assignmentAlerts.map((alert) => (
								<div key={alert.alert_id} className="card" style={{ padding: 10 }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
										<div className="mono" style={{ fontSize: 11 }}>{alert.alert_type}</div>
										<Badge level={alert.severity === 'warning' ? 'medium' : alert.severity} size="sm">
											{alert.severity}
										</Badge>
									</div>
									<div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
										{alert.message.slice(0, 140)}...
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="empty-state" style={{ padding: 16 }}>
							<AlertTriangle size={18} />
							<span>No active alerts for this assignment.</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
