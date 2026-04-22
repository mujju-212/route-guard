import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';

const STATUS_LABELS = {
	normal: 'Operational',
	busy: 'Busy',
	congested: 'Congested',
	severely_congested: 'Severely Congested',
};

function levelFromScore(score) {
	if (score > 80) return 'critical';
	if (score > 60) return 'high';
	if (score >= 30) return 'medium';
	return 'low';
}

export default function PortStatusBoard() {
	const [ports, setPorts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		const fetchPorts = async () => {
			setLoading(true);
			setError('');
			try {
				const response = await api.get(ENDPOINTS.PORT_STATUS);
				setPorts(response.data || []);
			} catch {
				setPorts([]);
				setError('Unable to load port status data.');
			} finally {
				setLoading(false);
			}
		};

		fetchPorts();
	}, []);

	const sortedPorts = useMemo(
		() => [...ports].sort((a, b) => b.port_score - a.port_score),
		[ports]
	);

	const summary = useMemo(() => {
		return {
			operational: ports.filter((item) => item.status === 'normal').length,
			busy: ports.filter((item) => item.status === 'busy').length,
			congested: ports.filter((item) => item.status === 'congested').length,
			severe: ports.filter((item) => item.status === 'severely_congested').length,
		};
	}, [ports]);

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div>
			{error ? (
				<div className="card" style={{ marginBottom: 14 }}>
					<strong>{error}</strong>
					<div className="page-subtitle">Check the backend connection and try again.</div>
				</div>
			) : null}
			<div className="page-header">
				<div>
					<h1 className="page-title">Global Port Status</h1>
					<p className="page-subtitle mono">Last updated: {new Date().toLocaleString()}</p>
				</div>
			</div>

			<div className="stats-strip">
				<div className="card" style={{ padding: 12 }}>Operational: <strong>{summary.operational}</strong></div>
				<div className="card" style={{ padding: 12 }}>Busy: <strong>{summary.busy}</strong></div>
				<div className="card" style={{ padding: 12 }}>Congested: <strong>{summary.congested}</strong></div>
				<div className="card" style={{ padding: 12 }}>Severely Congested: <strong>{summary.severe}</strong></div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
				<div className="map-panel">
					<MapContainer center={[20, 30]} zoom={2.2} style={{ height: 'calc(100vh - 260px)', width: '100%' }}>
						<TileLayer
							url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
							attribution="&copy; OpenStreetMap contributors &copy; CARTO"
						/>
						{sortedPorts.map((port) => (
							<CircleMarker
								key={port.port_id}
								center={[port.lat, port.lng]}
								radius={8 + Math.round(port.port_score / 20)}
								pathOptions={{
									color:
										port.port_score > 80
											? '#ef4444'
											: port.port_score > 60
												? '#f97316'
												: port.port_score >= 30
													? '#eab308'
													: '#22c55e',
									fillOpacity: 0.4,
								}}
							/>
						))}
					</MapContainer>
				</div>

				<div className="card" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
					{sortedPorts.map((port) => (
						<div className="card" key={port.port_id} style={{ marginBottom: 10, padding: 12 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
								<div>
									<div style={{ fontWeight: 700 }}>{port.name}</div>
									<div className="mono page-subtitle">{port.code} | {port.country}</div>
								</div>
								<Badge level={levelFromScore(port.port_score)} size="sm">
									{STATUS_LABELS[port.status] || port.status}
								</Badge>
							</div>

							<div className="info-row" style={{ marginTop: 10 }}>
								<span>Vessels in Queue</span>
								<strong className="mono">{port.vessels_in_queue}</strong>
							</div>
							<div className="info-row">
								<span>Avg Wait</span>
								<strong className="mono">{port.avg_wait_hours} hrs</strong>
							</div>
							<div style={{ marginTop: 8 }}>
								<div style={{ height: 6, borderRadius: 5, background: 'var(--bg-elevated)' }}>
									<div
										style={{
											height: 6,
											width: `${port.port_score}%`,
											borderRadius: 5,
											background:
												port.port_score > 80
													? 'var(--risk-critical)'
													: port.port_score > 60
														? 'var(--risk-high)'
														: port.port_score >= 30
															? 'var(--risk-medium)'
															: 'var(--risk-low)',
										}}
									/>
								</div>
								<div className="page-subtitle" style={{ marginTop: 4 }}>
									Port score: <span className="mono">{port.port_score}</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
