import { Polyline } from 'react-leaflet';

function toPath(waypoints = []) {
	return waypoints
		.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
		.map((point) => [point.lat, point.lng]);
}

export default function RouteLayer({ shipment, selected = false }) {
	const path = toPath(shipment?.route_waypoints);
	if (!path.length) return null;

	const activeColor = selected ? 'rgba(59,130,246,0.95)' : 'rgba(59,130,246,0.45)';

	if (shipment?.is_rerouted && path.length > 2) {
		const split = Math.max(1, Math.floor(path.length / 2));
		const originalPath = path.slice(0, split + 1);
		const reroutePath = path.slice(split);
		return (
			<>
				<Polyline positions={originalPath} pathOptions={{ color: 'rgba(239,68,68,0.25)', weight: 3, dashArray: '6 6' }} />
				<Polyline positions={reroutePath} pathOptions={{ color: 'rgba(34,197,94,0.85)', weight: 4 }} />
			</>
		);
	}

	return <Polyline positions={path} pathOptions={{ color: activeColor, weight: selected ? 4 : 3 }} />;
}
