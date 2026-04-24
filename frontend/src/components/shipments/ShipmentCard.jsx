import { ArrowRight } from 'lucide-react';
import Badge from '../ui/Badge';
import RiskDot from '../ui/RiskDot';
import { normalizeShipment } from '../../utils/shipmentView';

export default function ShipmentCard({ shipment, onTrack, actionLabel = 'Track' }) {
	const normalizedShipment = normalizeShipment(shipment);

	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
				<div>
					<div className="mono" style={{ fontWeight: 700 }}>
						{normalizedShipment.tracking_number}
					</div>
					<p className="page-subtitle">{normalizedShipment.origin}</p>
				</div>
				<Badge level={normalizedShipment.current_risk_level} size="sm">
					{normalizedShipment.current_risk_level}
				</Badge>
			</div>

			<div style={{ marginBottom: 10 }}>
				<p style={{ fontWeight: 600 }}>{normalizedShipment.destination}</p>
				<p className="page-subtitle">{normalizedShipment.cargo_description}</p>
			</div>

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
				<span className={`status-chip ${normalizedShipment.status}`}>{normalizedShipment.status.replace(/_/g, ' ')}</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<RiskDot level={normalizedShipment.current_risk_level} />
					<span style={{ textTransform: 'capitalize' }}>{normalizedShipment.current_risk_level}</span>
				</div>
			</div>

			<button type="button" className="btn-primary" onClick={() => onTrack?.(shipment.shipment_id)}>
				{actionLabel}
				<ArrowRight size={14} />
			</button>
		</div>
	);
}
