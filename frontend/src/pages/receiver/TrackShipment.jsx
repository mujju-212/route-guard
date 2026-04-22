import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_ALERTS } from '../../dummy/alerts';
import { DUMMY_SHIPMENTS } from '../../dummy/shipments';
import Badge from '../../components/ui/Badge';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import Spinner from '../../components/ui/Spinner';
import StatusTimeline from '../../components/shipments/StatusTimeline';

export default function TrackShipment() {
	const navigate = useNavigate();
	const { id } = useParams();
	const [shipment, setShipment] = useState(null);
	const [loading, setLoading] = useState(true);
	const [usingDummy, setUsingDummy] = useState(false);

	useEffect(() => {
		const fetchShipment = async () => {
			setLoading(true);
			try {
				const response = await api.get(ENDPOINTS.SHIPMENT_DETAIL(id));
				setShipment(response.data);
			} catch {
				setShipment(DUMMY_SHIPMENTS.find((item) => item.shipment_id === id) || DUMMY_SHIPMENTS[0]);
				setUsingDummy(true);
			} finally {
				setLoading(false);
			}
		};

		fetchShipment();
	}, [id]);

	const notifications = useMemo(
		() => DUMMY_ALERTS.filter((item) => item.shipment_id === shipment?.shipment_id).slice(0, 3),
		[shipment?.shipment_id]
	);

	if (loading || !shipment) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	const elevated = ['medium', 'high', 'critical'].includes(shipment.current_risk_level);
	const confirmEnabled = shipment.status === 'delivered';

	return (
		<div>
			<DemoModeBanner usingDummy={usingDummy} />

			<div className="page-header">
				<div>
					<h1 className="page-title mono">{shipment.tracking_number}</h1>
					<p className="page-subtitle">Receiver shipment tracking</p>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<button
						type="button"
						className={confirmEnabled ? 'btn-primary' : 'btn-outline'}
						onClick={() => navigate(`/receiver/shipments/${shipment.shipment_id}/confirm`)}
						disabled={!confirmEnabled}
					>
						Confirm Delivery
					</button>
					<Badge level={shipment.current_risk_level}>{shipment.current_risk_level}</Badge>
				</div>
			</div>

			{elevated ? (
				<div className="card" style={{ marginBottom: 14, borderColor: 'var(--risk-high)', background: 'rgba(249,115,22,0.08)' }}>
					<strong>Arrival Risk Advisory:</strong> This shipment is under {shipment.current_risk_level} risk conditions.
					{shipment.is_rerouted ? (
						<span style={{ display: 'block', marginTop: 6 }}>
							Route has been updated by operations. New ETA: {new Date(shipment.expected_arrival).toLocaleString()}.
						</span>
					) : null}
				</div>
			) : null}

			<div className="map-panel" style={{ marginBottom: 14 }}>
				<MapContainer
					center={[shipment.current_coordinates.lat, shipment.current_coordinates.lng]}
					zoom={4}
					style={{ height: 380, width: '100%' }}
				>
					<TileLayer
						url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
						attribution="&copy; OpenStreetMap contributors &copy; CARTO"
					/>
					<Polyline positions={shipment.route_waypoints.map((point) => [point.lat, point.lng])} pathOptions={{ color: '#3b82f6', weight: 4 }} />
					<CircleMarker center={[shipment.current_coordinates.lat, shipment.current_coordinates.lng]} radius={8} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6' }} />
					{shipment.route_waypoints[0] ? (
						<CircleMarker
							center={[shipment.route_waypoints[0].lat, shipment.route_waypoints[0].lng]}
							radius={7}
							pathOptions={{ color: '#22c55e', fillColor: '#22c55e' }}
						/>
					) : null}
					{shipment.route_waypoints[shipment.route_waypoints.length - 1] ? (
						<CircleMarker
							center={[
								shipment.route_waypoints[shipment.route_waypoints.length - 1].lat,
								shipment.route_waypoints[shipment.route_waypoints.length - 1].lng,
							]}
							radius={7}
							pathOptions={{ color: '#94a3b8', fillColor: '#94a3b8' }}
						/>
					) : null}
				</MapContainer>
			</div>

			<div className="grid-two" style={{ alignItems: 'start' }}>
				<StatusTimeline currentStatus={shipment.status} />
				<div className="card">
					<h3 className="section-title">Delivery Info</h3>
					<div className="info-list" style={{ marginBottom: 12 }}>
						<div className="info-row"><span>Origin</span><strong>{shipment.origin}</strong></div>
						<div className="info-row"><span>Destination</span><strong>{shipment.destination}</strong></div>
						<div className="info-row"><span>Expected Arrival</span><strong>{new Date(shipment.expected_arrival).toLocaleString()}</strong></div>
						<div className="info-row"><span>Cargo Type</span><strong>{shipment.cargo_type}</strong></div>
						<div className="info-row"><span>Declared Value</span><strong>${shipment.declared_value.toLocaleString()}</strong></div>
					</div>

					<h4 style={{ marginBottom: 8 }}>Recent Notifications</h4>
					<div className="info-list">
						{notifications.length ? (
							notifications.map((note) => (
								<div className="card" key={note.alert_id} style={{ padding: 10 }}>
									<div className="mono" style={{ fontSize: 11 }}>{note.alert_type}</div>
									<div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note.message.slice(0, 120)}...</div>
								</div>
							))
						) : (
							<div className="page-subtitle">No recent alerts for this shipment.</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
