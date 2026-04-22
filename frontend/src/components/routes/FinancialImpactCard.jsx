export default function FinancialImpactCard({ financialImpact }) {
	if (!financialImpact) return null;

	return (
		<div className="card">
			<h3 className="section-title">Financial Impact</h3>
			<div className="grid-two" style={{ marginBottom: 14 }}>
				<div className="card" style={{ padding: 12 }}>
					<div className="page-subtitle">Current Route</div>
					<div style={{ color: 'var(--risk-critical)', fontWeight: 700, fontSize: 24 }}>
						${Math.round(financialImpact.current_route_expected_loss_usd).toLocaleString()}
					</div>
					<div className="page-subtitle">Expected financial exposure</div>
				</div>
				<div className="card" style={{ padding: 12 }}>
					<div className="page-subtitle">Recommended Route</div>
					<div style={{ fontSize: 14 }}>
						Extra cost: <span className="mono">${financialImpact.recommended_route_extra_cost_usd.toLocaleString()}</span>
					</div>
					<div style={{ color: 'var(--risk-low)', fontWeight: 700, fontSize: 20 }}>
						${Math.round(financialImpact.recommended_route_expected_loss_usd).toLocaleString()}
					</div>
				</div>
			</div>

			<div style={{ fontSize: 16, fontWeight: 700, color: 'var(--risk-low)' }}>
				Estimated net saving: ${Math.round(financialImpact.net_saving_usd).toLocaleString()}
			</div>
		</div>
	);
}
