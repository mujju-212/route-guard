import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

function buildData(values = []) {
	if (!values.length) return [];
	return values.map((value, index) => ({
		label: index === 0 ? 'Now' : `+${index}hr`,
		risk: Number(value),
	}));
}

export default function TrajectoryGraph({ values = [] }) {
	const data = buildData(values);
	const rising = data.length > 1 ? data[data.length - 1].risk > data[0].risk : false;
	const title = rising ? 'Risk Trajectory - Escalating ↑' : 'Risk Trajectory - Improving ↓';
	const tone = rising ? 'var(--risk-critical)' : 'var(--risk-low)';

	return (
		<div className="card" style={{ height: 280 }}>
			<h3 className="section-title" style={{ color: tone }}>
				{title}
			</h3>
			<ResponsiveContainer width="100%" height="90%">
				<AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
					<CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="4 4" />
					<XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
					<YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
					<Tooltip
						contentStyle={{
							background: '#1c2333',
							border: '1px solid rgba(255,255,255,0.12)',
							borderRadius: 8,
						}}
					/>
					<defs>
						<linearGradient id="trajectoryFill" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor={tone} stopOpacity={0.4} />
							<stop offset="100%" stopColor={tone} stopOpacity={0.04} />
						</linearGradient>
					</defs>
					<Area type="monotone" dataKey="risk" stroke="none" fill="url(#trajectoryFill)" />
					<Line type="monotone" dataKey="risk" stroke={tone} strokeWidth={3} dot={{ r: 4, fill: tone }} />
					<ReferenceLine y={75} stroke="rgba(239,68,68,0.8)" strokeDasharray="5 5" label="Critical threshold" />
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
