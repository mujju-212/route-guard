import { ArrowRight } from 'lucide-react';
import Badge from '../ui/Badge';
import RiskDot from '../ui/RiskDot';

export default function ShipmentCard({ shipment, onTrack, actionLabel = 'Track' }) {
	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
				<div>
					<div className="mono" style={{ fontWeight: 700 }}>
						{shipment.tracking_number}
					</div>
					<p className="page-subtitle">{shipment.origin}</p>
				</div>
				<Badge level={shipment.current_risk_level} size="sm">
					{shipment.current_risk_level}
				</Badge>
			</div>

			<div style={{ marginBottom: 10 }}>
				<p style={{ fontWeight: 600 }}>{shipment.destination}</p>
				<p className="page-subtitle">{shipment.cargo_description}</p>
			</div>

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
				<span className={`status-chip ${shipment.status}`}>{shipment.status.replace(/_/g, ' ')}</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<RiskDot level={shipment.current_risk_level} />
					<span style={{ textTransform: 'capitalize' }}>{shipment.current_risk_level}</span>
				</div>
			</div>

			<button type="button" className="btn-primary" onClick={() => onTrack?.(shipment.shipment_id)}>
				{actionLabel}
				<ArrowRight size={14} />
			</button>
		</div>
	);
}
