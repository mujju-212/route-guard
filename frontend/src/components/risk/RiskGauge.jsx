const LEVEL_COLORS = {
	low: '#22c55e',
	medium: '#eab308',
	high: '#f97316',
	critical: '#ef4444',
};

function polar(cx, cy, radius, angle) {
	const radians = ((angle - 90) * Math.PI) / 180;
	return {
		x: cx + radius * Math.cos(radians),
		y: cy + radius * Math.sin(radians),
	};
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
	const start = polar(cx, cy, radius, endAngle);
	const end = polar(cx, cy, radius, startAngle);
	const large = endAngle - startAngle <= 180 ? '0' : '1';
	return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 0 ${end.x} ${end.y}`;
}

export default function RiskGauge({ score = 0, level = 'low', delayHours = 0, rerouteConfidence = 0 }) {
	const bounded = Math.max(0, Math.min(100, Number(score) || 0));
	const color = LEVEL_COLORS[level] || LEVEL_COLORS.low;
	const startAngle = 135;
	const endAngle = 360;
	const progressAngle = startAngle + (endAngle - startAngle) * (bounded / 100);

	return (
		<div className="card" style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
			<svg width="240" height="190" viewBox="0 0 240 190" role="img" aria-label="Risk score gauge">
				<path d={arcPath(120, 120, 82, startAngle, endAngle)} stroke="var(--bg-elevated)" strokeWidth="16" fill="none" />
				<path d={arcPath(120, 120, 82, startAngle, progressAngle)} stroke={color} strokeWidth="16" fill="none" strokeLinecap="round" />
				<text x="120" y="114" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="44" fontWeight="700" fill="var(--text-primary)">
					{Math.round(bounded)}
				</text>
				<text x="120" y="136" textAnchor="middle" fontFamily="var(--font-body)" fontSize="12" fill="var(--text-secondary)">
					/ 100
				</text>
				<text x="120" y="157" textAnchor="middle" fontFamily="var(--font-display)" fontSize="12" fontWeight="700" fill={color}>
					{level.toUpperCase()}
				</text>
			</svg>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', gap: 8 }}>
				<div className="card" style={{ padding: 12 }}>
					<div className="page-subtitle">Est. Delay</div>
					<div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
						{delayHours} hrs
					</div>
				</div>
				<div className="card" style={{ padding: 12 }}>
					<div className="page-subtitle">Reroute Confidence</div>
					<div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
						{rerouteConfidence}%
					</div>
				</div>
			</div>
		</div>
	);
}
