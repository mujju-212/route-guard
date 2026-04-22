import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';

function normalizeData(featureImportance = {}) {
	return Object.entries(featureImportance).map(([key, value]) => ({
		name: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
		value: Math.round((Number(value) || 0) * 100),
	}));
}

export default function FeatureChart({ featureImportance }) {
	const data = normalizeData(featureImportance);

	return (
		<div className="card" style={{ height: 280 }}>
			<h3 className="section-title">Risk Factor Breakdown</h3>
			<ResponsiveContainer width="100%" height="92%">
				<BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 30, bottom: 0 }}>
					<XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
					<YAxis type="category" dataKey="name" width={120} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
					<Bar dataKey="value" radius={[0, 8, 8, 0]} fill="url(#featureGradient)">
						<LabelList dataKey="value" position="right" formatter={(value) => `${value}%`} fill="#e2e8f0" />
					</Bar>
					<defs>
						<linearGradient id="featureGradient" x1="0" x2="1" y1="0" y2="0">
							<stop offset="0%" stopColor="#3b82f6" />
							<stop offset="100%" stopColor="#f97316" />
						</linearGradient>
					</defs>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
