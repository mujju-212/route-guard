import { divIcon } from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { useMemo } from 'react';
import Badge from '../ui/Badge';

const MARKER_COLORS = {
	low: '#22c55e',
	medium: '#eab308',
	high: '#f97316',
	critical: '#ef4444',
};

export default function VesselMarker({ shipment, onViewDetails, onSelect }) {
	const level = shipment?.current_risk_level || 'low';
	const markerIcon = useMemo(() => {
		const color = MARKER_COLORS[level] || MARKER_COLORS.low;
		const pulseClass = level === 'critical' ? 'pulse' : '';
		return divIcon({
			className: '',
			html: `<div style="position:relative;width:18px;height:18px;"><span class="${pulseClass}" style="position:absolute;inset:-8px;border:2px solid ${color};border-radius:999px;opacity:0.5;"></span><span style="position:absolute;inset:0;background:${color};border-radius:999px;box-shadow:0 0 12px ${color};"></span></div>`,
			iconSize: [18, 18],
			iconAnchor: [9, 9],
		});
	}, [level]);

	if (!shipment?.current_coordinates) return null;

	return (
		<Marker
			position={[shipment.current_coordinates.lat, shipment.current_coordinates.lng]}
			icon={markerIcon}
			eventHandlers={{ click: () => onSelect?.(shipment.shipment_id) }}
		>
			<Popup>
				<div style={{ minWidth: 220 }}>
					<div className="mono" style={{ fontWeight: 700 }}>
						{shipment.shipment_id}
					</div>
					<div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
						{shipment.cargo_type} | {shipment.assigned_vessel}
					</div>
					<Badge level={level}>
						Risk {shipment.current_risk_score}
					</Badge>
					<div style={{ marginTop: 8 }}>
						<button className="btn-primary" onClick={() => onViewDetails?.(shipment.shipment_id)}>
							View Details
						</button>
					</div>
				</div>
			</Popup>
		</Marker>
	);
}
