import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import RouteLayer from './RouteLayer';
import VesselMarker from './VesselMarker';

const RISK_COLORS = {
	low: '#22c55e',
	medium: '#eab308',
	high: '#f97316',
	critical: '#ef4444',
};

function getPortStyle(score) {
	if (score > 80) return { color: '#ef4444', radius: 14 };
	if (score > 60) return { color: '#f97316', radius: 12 };
	if (score >= 30) return { color: '#eab308', radius: 10 };
	return { color: '#22c55e', radius: 8 };
}

export default function LiveMap({
	shipments = [],
	ports = [],
	height = 'calc(100vh - 220px)',
	selectedShipmentId,
	onSelectShipment,
}) {
	const navigate = useNavigate();
	const { riskUpdates } = useSocket();
	const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);
	const [showPortOverlay, setShowPortOverlay] = useState(true);

	const mergedShipments = useMemo(() => {
		return shipments.map((shipment) => {
			const live = riskUpdates?.[shipment.shipment_id];
			if (!live) return shipment;
			return {
				...shipment,
				current_risk_level: live.risk_level || shipment.current_risk_level,
				current_risk_score: live.risk_score ?? shipment.current_risk_score,
			};
		});
	}, [shipments, riskUpdates]);

	return (
		<div className="map-panel" style={{ position: 'relative' }}>
			<div className="map-overlay-controls">
				<button
					type="button"
					onClick={() => setShowWeatherOverlay((prev) => !prev)}
					style={showWeatherOverlay ? { borderColor: '#3b82f6' } : undefined}
				>
					Weather Overlay
				</button>
				<button
					type="button"
					onClick={() => setShowPortOverlay((prev) => !prev)}
					style={showPortOverlay ? { borderColor: '#3b82f6' } : undefined}
				>
					Port Overlay
				</button>
			</div>

			<MapContainer
				center={[20, 30]}
				zoom={2.5}
				scrollWheelZoom
				style={{ height, width: '100%', background: '#0a0e1a' }}
			>
				<TileLayer
					url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
					attribution="&copy; OpenStreetMap contributors &copy; CARTO"
				/>

				{showWeatherOverlay ? (
					<CircleMarker
						center={[24.5, 162.1]}
						radius={30}
						pathOptions={{ color: 'rgba(239,68,68,0.35)', fillColor: 'rgba(239,68,68,0.15)', fillOpacity: 0.8 }}
					/>
				) : null}

				{showPortOverlay
					? ports.map((port) => {
							const style = getPortStyle(port.port_score);
							return (
								<CircleMarker
									key={port.port_id}
									center={[port.lat, port.lng]}
									radius={style.radius}
									pathOptions={{
										color: style.color,
										fillColor: style.color,
										fillOpacity: 0.35,
									}}
								/>
							);
						})
					: null}

				{mergedShipments.map((shipment) => (
					<RouteLayer
						key={`${shipment.shipment_id}-route`}
						shipment={shipment}
						selected={selectedShipmentId === shipment.shipment_id}
					/>
				))}

				{mergedShipments.map((shipment) => (
					<VesselMarker
						key={shipment.shipment_id}
						shipment={shipment}
						onSelect={onSelectShipment}
						onViewDetails={(id) => navigate(`/manager/shipments/${id}`)}
						riskColor={RISK_COLORS[shipment.current_risk_level]}
					/>
				))}
			</MapContainer>
		</div>
	);
}
