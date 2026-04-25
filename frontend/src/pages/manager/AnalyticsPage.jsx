import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import Spinner from '../../components/ui/Spinner';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import './analytics.css';

const RISK_COLORS = {
	critical: '#ef4444',
	high: '#f97316',
	medium: '#eab308',
	low: '#22c55e',
};

function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(value) {
	const parsed = toNumber(value);
	return parsed <= 1 ? parsed * 100 : parsed;
}

function currency(value) {
	return `$${toNumber(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function compactCurrency(value) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		notation: 'compact',
		maximumFractionDigits: 1,
	}).format(toNumber(value));
}

function timeLabel(value) {
	if (!value) return 'No refresh yet';
	return value.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(value, index) {
	if (!value) return `Day ${index + 1}`;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return String(value);
	return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useThemeMode() {
	const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

	useEffect(() => {
		const observer = new MutationObserver(() => {
			setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
	}, []);

	return theme;
}

function AnalyticsTooltip({ active, payload, label, tokens }) {
	if (!active || !payload?.length) return null;

	return (
		<div
			style={{
				background: tokens.tooltipBg,
				border: `1px solid ${tokens.tooltipBorder}`,
				borderRadius: 12,
				padding: '10px 12px',
				boxShadow: tokens.tooltipShadow,
				fontSize: 12,
				color: tokens.tooltipText,
			}}
		>
			<div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
			{payload.map((item) => (
				<div
					key={item.name}
					style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
				>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
						<span
							style={{
								display: 'inline-block',
								width: 8,
								height: 8,
								borderRadius: '50%',
								background: item.color,
							}}
						/>
						{item.name}
					</span>
					<strong>{item.value}</strong>
				</div>
			))}
		</div>
	);
}

function ModelMeter({ title, score, hint, tone }) {
	const value = Math.max(0, Math.min(100, toNumber(score)));
	return (
		<div className="analytics-model-row">
			<div className="analytics-model-head">
				<span>{title}</span>
				<strong>{value.toFixed(1)}%</strong>
			</div>
			<div className="analytics-meter">
				<span style={{ width: `${value}%`, background: tone }} />
			</div>
			<div className="analytics-model-hint">{hint}</div>
		</div>
	);
}

export default function AnalyticsPage() {
	const theme = useThemeMode();
	const [overview, setOverview] = useState(null);
	const [accuracy, setAccuracy] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [lastLoadedAt, setLastLoadedAt] = useState(null);

	const chartTokens = useMemo(() => {
		if (theme === 'light') {
			return {
				grid: 'rgba(15, 23, 42, 0.10)',
				axis: '#64748b',
				tooltipBg: '#ffffff',
				tooltipBorder: 'rgba(15, 23, 42, 0.16)',
				tooltipText: '#0f172a',
				tooltipShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
			};
		}
		return {
			grid: 'rgba(148, 163, 184, 0.18)',
			axis: '#9fb1c8',
			tooltipBg: '#0f172a',
			tooltipBorder: 'rgba(148, 163, 184, 0.30)',
			tooltipText: '#e2e8f0',
			tooltipShadow: '0 12px 24px rgba(2, 6, 23, 0.45)',
		};
	}, [theme]);

	const loadAnalytics = useCallback(async (silent = false) => {
		if (!silent) setLoading(true);
		setError('');

		try {
			const [overviewRes, accuracyRes] = await Promise.all([
				api.get(ENDPOINTS.OVERVIEW),
				api.get(ENDPOINTS.MODEL_ACCURACY),
			]);
			setOverview(overviewRes?.data || {});
			setAccuracy(accuracyRes?.data || {});
			setLastLoadedAt(new Date());
		} catch {
			setError('Unable to load analytics right now. Please verify backend connectivity.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadAnalytics();
	}, [loadAnalytics]);

	const riskHistory = useMemo(() => {
		const rows = Array.isArray(overview?.risk_history_7_days) ? overview.risk_history_7_days : [];
		return rows.map((row, index) => ({
			day: dayLabel(row?.date || row?.day || row?.label, index),
			critical: toNumber(row?.critical),
			high: toNumber(row?.high),
			medium: toNumber(row?.medium),
			low: toNumber(row?.low),
		}));
	}, [overview]);

	const trendData = useMemo(
		() =>
			riskHistory.map((row) => ({
				day: row.day,
				riskIndex: row.critical * 4 + row.high * 3 + row.medium * 2 + row.low,
			})),
		[riskHistory],
	);

	const pieData = useMemo(() => {
		const rows = [
			{ name: 'Critical', value: toNumber(overview?.critical_count), color: RISK_COLORS.critical },
			{ name: 'High', value: toNumber(overview?.high_risk_count), color: RISK_COLORS.high },
			{ name: 'Medium', value: toNumber(overview?.medium_risk_count), color: RISK_COLORS.medium },
			{ name: 'Low', value: toNumber(overview?.low_risk_count), color: RISK_COLORS.low },
		];
		return rows.filter((row) => row.value > 0);
	}, [overview]);

	const currentRiskTotal = pieData.reduce((sum, item) => sum + item.value, 0);
	const onTimeRate = toNumber(overview?.on_time_percentage);
	const delayedCount = toNumber(overview?.delayed_count);
	const reroutes = toNumber(overview?.rerouted_this_week);
	const lossesPrevented = toNumber(overview?.financial_losses_prevented_usd);
	const xgboostR2 = toPercent(accuracy?.xgboost_r2);
	const gradientBoost = toPercent(accuracy?.gradient_boost_accuracy);
	const overallAccuracy = toPercent(accuracy?.overall_model_accuracy);

	if (loading && !overview) {
		return (
			<div className="analytics-page">
				<div className="analytics-panel analytics-loading">
					<Spinner size="lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="analytics-page">
			<div className="analytics-panel analytics-hero">
				<div>
					<div className="analytics-eyebrow">Manager Control Plane</div>
					<h1 className="analytics-title">Analytics Intelligence</h1>
					<p className="analytics-subtitle">
						Operational risk distribution, model quality, and financial impact in one view.
					</p>
				</div>
				<div className="analytics-hero-actions">
					<div className="analytics-theme-pill">{theme === 'dark' ? 'Dark Theme' : 'Light Theme'}</div>
					<button
						type="button"
						className="analytics-btn"
						onClick={() => loadAnalytics(true)}
						disabled={loading}
					>
						{loading ? 'Refreshing...' : 'Refresh Data'}
					</button>
					<div className="analytics-last-sync">Last sync: {timeLabel(lastLoadedAt)}</div>
				</div>
			</div>

			{error ? <div className="analytics-alert">{error}</div> : null}

			<div className="analytics-kpi-grid">
				<article className="analytics-kpi analytics-kpi--teal">
					<div className="analytics-kpi-value">{toNumber(overview?.total_active_shipments)}</div>
					<div className="analytics-kpi-label">Active Shipments</div>
				</article>
				<article className="analytics-kpi analytics-kpi--green">
					<div className="analytics-kpi-value">{onTimeRate.toFixed(1)}%</div>
					<div className="analytics-kpi-label">On-Time Rate</div>
				</article>
				<article className="analytics-kpi analytics-kpi--red">
					<div className="analytics-kpi-value">{delayedCount}</div>
					<div className="analytics-kpi-label">Delayed Shipments</div>
				</article>
				<article className="analytics-kpi analytics-kpi--blue">
					<div className="analytics-kpi-value">{compactCurrency(lossesPrevented)}</div>
					<div className="analytics-kpi-label">Losses Prevented</div>
				</article>
			</div>

			<div className="analytics-grid analytics-grid--2">
				<section className="analytics-panel analytics-chart-panel">
					<div className="analytics-panel-title">7-Day Risk Distribution</div>
					<ResponsiveContainer width="100%" height={280}>
						<BarChart data={riskHistory}>
							<CartesianGrid strokeDasharray="4 4" stroke={chartTokens.grid} />
							<XAxis dataKey="day" tick={{ fill: chartTokens.axis, fontSize: 11 }} />
							<YAxis tick={{ fill: chartTokens.axis, fontSize: 11 }} />
							<Tooltip content={(props) => <AnalyticsTooltip {...props} tokens={chartTokens} />} />
							<Legend wrapperStyle={{ fontSize: 11 }} />
							<Bar dataKey="critical" stackId="risk" fill={RISK_COLORS.critical} radius={[0, 0, 0, 0]} />
							<Bar dataKey="high" stackId="risk" fill={RISK_COLORS.high} />
							<Bar dataKey="medium" stackId="risk" fill={RISK_COLORS.medium} />
							<Bar dataKey="low" stackId="risk" fill={RISK_COLORS.low} radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</section>

				<section className="analytics-panel analytics-chart-panel">
					<div className="analytics-panel-title">Current Risk Mix</div>
					<div className="analytics-pie-wrap">
						<ResponsiveContainer width="100%" height={280}>
							<PieChart>
								<Pie
									data={pieData}
									dataKey="value"
									nameKey="name"
									innerRadius={62}
									outerRadius={98}
									paddingAngle={3}
								>
									{pieData.map((segment) => (
										<Cell key={segment.name} fill={segment.color} />
									))}
								</Pie>
								<Tooltip content={(props) => <AnalyticsTooltip {...props} tokens={chartTokens} />} />
							</PieChart>
						</ResponsiveContainer>
						<div className="analytics-pie-total">
							<strong>{currentRiskTotal}</strong>
							<span>Active Risks</span>
						</div>
					</div>
				</section>
			</div>

			<div className="analytics-grid analytics-grid--2">
				<section className="analytics-panel analytics-chart-panel">
					<div className="analytics-panel-title">Risk Pressure Trend</div>
					<ResponsiveContainer width="100%" height={250}>
						<AreaChart data={trendData}>
							<CartesianGrid strokeDasharray="4 4" stroke={chartTokens.grid} />
							<XAxis dataKey="day" tick={{ fill: chartTokens.axis, fontSize: 11 }} />
							<YAxis tick={{ fill: chartTokens.axis, fontSize: 11 }} />
							<Tooltip content={(props) => <AnalyticsTooltip {...props} tokens={chartTokens} />} />
							<Area
								type="monotone"
								dataKey="riskIndex"
								name="Risk Index"
								stroke="#22d3ee"
								fill="rgba(34, 211, 238, 0.28)"
								strokeWidth={2}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</section>

				<section className="analytics-panel">
					<div className="analytics-panel-title">Model Performance Snapshot</div>
					<div className="analytics-model-list">
						<ModelMeter
							title="XGBoost Risk Fit"
							score={xgboostR2}
							hint={`RMSE ${toNumber(accuracy?.xgboost_rmse).toFixed(2)}`}
							tone="#06b6d4"
						/>
						<ModelMeter
							title="Gradient Boost Accuracy"
							score={gradientBoost}
							hint="Reroute classification"
							tone="#10b981"
						/>
						<ModelMeter
							title="Overall Model Accuracy"
							score={overallAccuracy}
							hint={`Predictions ${toNumber(accuracy?.total_predictions_made)}`}
							tone="#8b5cf6"
						/>
					</div>
					<div className="analytics-mini-grid">
						<div className="analytics-mini-metric">
							<span>Delay MAE</span>
							<strong>{toNumber(accuracy?.random_forest_delay_mae).toFixed(1)}h</strong>
						</div>
						<div className="analytics-mini-metric">
							<span>Correct Reroutes</span>
							<strong>{toNumber(accuracy?.correct_reroute_decisions)}</strong>
						</div>
						<div className="analytics-mini-metric">
							<span>Incorrect Reroutes</span>
							<strong>{toNumber(accuracy?.incorrect_reroute_decisions)}</strong>
						</div>
						<div className="analytics-mini-metric">
							<span>Reroutes / Week</span>
							<strong>{reroutes}</strong>
						</div>
					</div>
				</section>
			</div>

			<div className="analytics-grid analytics-grid--2">
				<section className="analytics-panel">
					<div className="analytics-panel-title">Financial Summary</div>
					<div className="analytics-row">
						<span>Total Value Monitored</span>
						<strong>{currency(overview?.total_value_monitored_usd)}</strong>
					</div>
					<div className="analytics-row">
						<span>Losses Prevented</span>
						<strong className="good">{currency(lossesPrevented)}</strong>
					</div>
					<div className="analytics-row">
						<span>Average Saving per Reroute</span>
						<strong>
							{reroutes > 0 ? currency(Math.round(lossesPrevented / reroutes)) : '$0'}
						</strong>
					</div>
					<div className="analytics-row">
						<span>Weekly Reroutes</span>
						<strong>{reroutes}</strong>
					</div>
				</section>

				<section className="analytics-panel">
					<div className="analytics-panel-title">Operational Summary</div>
					<div className="analytics-row">
						<span>Total Predictions</span>
						<strong>{toNumber(accuracy?.total_predictions_made)}</strong>
					</div>
					<div className="analytics-row">
						<span>Current Critical Risks</span>
						<strong className="warn">{toNumber(overview?.critical_count)}</strong>
					</div>
					<div className="analytics-row">
						<span>Current High Risks</span>
						<strong>{toNumber(overview?.high_risk_count)}</strong>
					</div>
					<div className="analytics-row">
						<span>System On-Time Rate</span>
						<strong className="good">{onTimeRate.toFixed(1)}%</strong>
					</div>
				</section>
			</div>
		</div>
	);
}
