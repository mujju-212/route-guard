import { useEffect, useMemo, useState } from 'react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_ANALYTICS } from '../../dummy/analytics';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import Spinner from '../../components/ui/Spinner';

const REROUTE_HISTORY = [
	{ route: 'Southern Pacific', original: 91, next: 28, outcome: 'Approved', delay: '17.7h saved' },
	{ route: 'Bab-el-Mandeb diversion', original: 68, next: 41, outcome: 'Approved', delay: '6.0h saved' },
	{ route: 'Guam waypoint hold', original: 79, next: 18, outcome: 'Rejected', delay: '0h saved' },
	{ route: 'Cape route bypass', original: 64, next: 39, outcome: 'Approved', delay: '4.2h saved' },
	{ route: 'Speed-up direct', original: 72, next: 65, outcome: 'Rejected', delay: '0h saved' },
];

export default function AnalyticsPage() {
	const [overview, setOverview] = useState(null);
	const [accuracy, setAccuracy] = useState(null);
	const [riskHistory, setRiskHistory] = useState([]);
	const [loading, setLoading] = useState(true);
	const [usingDummy, setUsingDummy] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const [overviewRes, accuracyRes] = await Promise.all([
					api.get(ENDPOINTS.OVERVIEW),
					api.get(ENDPOINTS.MODEL_ACCURACY),
				]);
				setOverview(overviewRes.data);
				setAccuracy(accuracyRes.data);
				setRiskHistory(overviewRes.data.risk_history_7_days || []);
			} catch {
				setOverview(DUMMY_ANALYTICS.overview);
				setAccuracy(DUMMY_ANALYTICS.accuracy);
				setRiskHistory(DUMMY_ANALYTICS.risk_history_7_days);
				setUsingDummy(true);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	const pieData = useMemo(() => {
		if (!overview) return [];
		return [
			{ name: 'Critical', value: overview.critical_count, color: '#ef4444' },
			{ name: 'High', value: overview.high_risk_count, color: '#f97316' },
			{ name: 'Medium', value: overview.medium_risk_count, color: '#eab308' },
			{ name: 'Low', value: overview.low_risk_count, color: '#22c55e' },
		];
	}, [overview]);

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div>
			<DemoModeBanner usingDummy={usingDummy} />
			<div className="page-header">
				<div>
					<h1 className="page-title">Model Analytics</h1>
					<p className="page-subtitle">Operational intelligence and model performance overview</p>
				</div>
			</div>

			<div className="grid-three" style={{ marginBottom: 14 }}>
				<div className="card">
					<h3 className="section-title">XGBoost Accuracy</h3>
					<div className="mono" style={{ fontSize: 34, fontWeight: 700 }}>
						{((accuracy?.xgboost_r2 || 0) * 100).toFixed(1)}%
					</div>
					<p className="page-subtitle">R² quality score</p>
				</div>
				<div className="card">
					<h3 className="section-title">Delay Prediction MAE</h3>
					<div className="mono" style={{ fontSize: 34, fontWeight: 700 }}>
						{accuracy?.random_forest_delay_mae || 0}h
					</div>
					<p className="page-subtitle">Average absolute error</p>
				</div>
				<div className="card">
					<h3 className="section-title">Reroute Decision Accuracy</h3>
					<div className="mono" style={{ fontSize: 34, fontWeight: 700 }}>
						{accuracy?.gradient_boost_accuracy || 0}%
					</div>
					<p className="page-subtitle">Correct reroute decisions</p>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 14, height: 320 }}>
				<h3 className="section-title">Daily Shipment Risk Distribution</h3>
				<ResponsiveContainer width="100%" height="90%">
					<BarChart data={riskHistory}>
						<CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="4 4" />
						<XAxis dataKey="date" tick={{ fill: '#94a3b8' }} />
						<YAxis tick={{ fill: '#94a3b8' }} />
						<Tooltip />
						<Bar dataKey="critical" stackId="risk" fill="#ef4444" />
						<Bar dataKey="high" stackId="risk" fill="#f97316" />
						<Bar dataKey="medium" stackId="risk" fill="#eab308" />
						<Bar dataKey="low" stackId="risk" fill="#22c55e" />
					</BarChart>
				</ResponsiveContainer>
			</div>

			<div className="grid-two" style={{ alignItems: 'start' }}>
				<div className="card">
					<h3 className="section-title">Rerouting Success</h3>
					<table className="data-table">
						<thead>
							<tr>
								<th>Route Decision</th>
								<th>Original Risk</th>
								<th>New Risk</th>
								<th>Outcome</th>
								<th>Delay Saved</th>
							</tr>
						</thead>
						<tbody>
							{REROUTE_HISTORY.map((row) => (
								<tr key={row.route}>
									<td>{row.route}</td>
									<td className="mono">{row.original}</td>
									<td className="mono">{row.next}</td>
									<td>{row.outcome}</td>
									<td className="mono">{row.delay}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div style={{ display: 'grid', gap: 12 }}>
					<div className="card" style={{ height: 240 }}>
						<h3 className="section-title">Current Risk Mix</h3>
						<ResponsiveContainer width="100%" height="85%">
							<PieChart>
								<Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70}>
									{pieData.map((slice) => (
										<Cell key={slice.name} fill={slice.color} />
									))}
								</Pie>
								<Tooltip />
							</PieChart>
						</ResponsiveContainer>
					</div>

					<div className="card">
						<h3 className="section-title">Performance Stats</h3>
						<div className="info-list">
							<div className="info-row"><span>Predictions made</span><strong className="mono">{accuracy?.total_predictions_made || 0}</strong></div>
							<div className="info-row"><span>Avg detection time before impact</span><strong className="mono">4.2 hours</strong></div>
							<div className="info-row"><span>Total disruptions prevented</span><strong className="mono">44</strong></div>
							<div className="info-row"><span>Financial losses prevented</span><strong className="mono">${(overview?.financial_losses_prevented_usd || 0).toLocaleString()}</strong></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
