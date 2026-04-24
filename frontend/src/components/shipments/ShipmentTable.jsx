import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import Badge from '../ui/Badge';
import RiskDot from '../ui/RiskDot';
import { normalizeShipment } from '../../utils/shipmentView';

function formatDate(value) {
	if (!value) return '--';
	return format(new Date(value), 'MMM dd, yyyy');
}

export default function ShipmentTable({ shipments = [], onTrack, hideScore = false }) {
	return (
		<div className="card" style={{ overflow: 'auto' }}>
			<table className="data-table">
				<thead>
					<tr>
						<th>Tracking #</th>
						<th>Destination</th>
						<th>Status</th>
						<th>Risk</th>
						<th>Expected Arrival</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{shipments.map((shipment) => (
						<tr key={shipment.shipment_id}>
							{(() => {
								const normalizedShipment = normalizeShipment(shipment);
								return (
									<>
										<td className="mono">{normalizedShipment.tracking_number}</td>
										<td>
											<div>{normalizedShipment.destination}</div>
											<div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{normalizedShipment.origin}</div>
										</td>
										<td>
											<span className={`status-chip ${normalizedShipment.status}`}>{normalizedShipment.status.replace(/_/g, ' ')}</span>
										</td>
										<td>
											<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
												<RiskDot level={normalizedShipment.current_risk_level} />
												{hideScore ? (
													<span style={{ textTransform: 'capitalize' }}>{normalizedShipment.current_risk_level}</span>
												) : (
													<Badge level={normalizedShipment.current_risk_level} size="sm">
														{normalizedShipment.current_risk_score}
													</Badge>
												)}
											</div>
										</td>
										<td className="mono">{formatDate(normalizedShipment.expected_arrival)}</td>
										<td>
											<button type="button" className="btn-outline" onClick={() => onTrack?.(normalizedShipment.shipment_id)}>
												Track
												<ArrowRight size={14} />
											</button>
										</td>
									</>
								);
							})()}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
