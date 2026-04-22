import { useState } from 'react';
import Badge from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function RouteCompareTable({
	routes = [],
	currentRiskScore,
	currentDelayHours,
	onApprove,
}) {
	const [selectedRoute, setSelectedRoute] = useState(null);

	return (
		<div className="card" style={{ overflow: 'auto' }}>
			<h3 className="section-title">Alternate Route Comparison</h3>
			<table className="data-table">
				<thead>
					<tr>
						<th>Route</th>
						<th>Risk</th>
						<th>Est. Delay</th>
						<th>Extra Distance</th>
						<th>Extra Cost</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<div style={{ fontWeight: 700 }}>Current Route</div>
							<div className="page-subtitle">Baseline plan</div>
						</td>
						<td>
							<Badge level={currentRiskScore >= 85 ? 'critical' : currentRiskScore >= 60 ? 'high' : currentRiskScore >= 35 ? 'medium' : 'low'}>
								{currentRiskScore}
							</Badge>
						</td>
						<td className="mono">{currentDelayHours} hrs</td>
						<td className="mono">--</td>
						<td className="mono">--</td>
						<td className="page-subtitle">Current</td>
					</tr>

					{routes.map((route) => (
						<tr className={route.recommended ? 'route-recommended' : ''} key={route.route_id}>
							<td>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
									<div style={{ fontWeight: 700 }}>{route.name}</div>
									{route.recommended ? (
										<Badge level="low" size="sm">
											RECOMMENDED
										</Badge>
									) : null}
								</div>
								<div className="page-subtitle">{route.description}</div>
							</td>
							<td>
								<Badge level={route.risk_level}>{route.risk_score}</Badge>
							</td>
							<td className="mono">{route.delay_hours} hrs</td>
							<td className="mono">{route.extra_distance_km} km</td>
							<td className="mono">${route.extra_cost_usd.toLocaleString()}</td>
							<td>
								<button type="button" className="btn-primary" onClick={() => setSelectedRoute(route)}>
									Approve
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<ConfirmDialog
				isOpen={Boolean(selectedRoute)}
				onClose={() => setSelectedRoute(null)}
				onConfirm={() => selectedRoute && onApprove?.(selectedRoute)}
				title="Approve reroute"
				message={`Approve reroute to ${selectedRoute?.name}? This will notify the vessel captain immediately.`}
				confirmLabel="Approve"
				confirmVariant="primary"
			/>
		</div>
	);
}
