import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Route } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import FinancialImpactCard from '../../components/routes/FinancialImpactCard';
import RouteCompareTable from '../../components/routes/RouteCompareTable';

export default function RouteChangeAlert() {
	const navigate = useNavigate();
	const { id } = useParams();
	const [shipment, setShipment] = useState(null);
	const [prediction, setPrediction] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			setError('');
			try {
				let target = id;
				if (!target) {
					const assignmentRes = await api.get(ENDPOINTS.MY_ASSIGNMENT);
					const payload = assignmentRes?.data;
					const assignment = Array.isArray(payload)
						? payload[0]
						: payload?.shipment || payload?.assignment || payload;
					target = assignment?.shipment_id;
				}
				if (!target) throw new Error('No route change target');
				const [shipmentRes, predictionRes] = await Promise.all([
					api.get(ENDPOINTS.SHIPMENT_DETAIL(target)),
					api.get(ENDPOINTS.ML_PREDICTION(target)),
				]);
				setShipment(shipmentRes.data);
				setPrediction(predictionRes.data);
			} catch {
				setShipment(null);
				setPrediction(null);
				setError('Unable to load route change details.');
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [id]);

	const modelOutputs = prediction?.model_outputs || {};
	const recommendedRoute = useMemo(
		() => prediction?.alternate_routes?.find((item) => item.recommended) || prediction?.alternate_routes?.[0],
		[prediction?.alternate_routes]
	);

	const approveRoute = async (route) => {
		if (!shipment?.shipment_id) return;
		try {
			await api.post(ENDPOINTS.APPROVE_REROUTE(shipment.shipment_id), { route_id: route.route_id });
		} catch {
			toast.error('Unable to approve route right now.');
			return;
		}
		toast.success('Route update acknowledged and sent to operations.');
		navigate('/driver');
	};

	const keepCurrentRoute = () => {
		toast('Current route retained. Continue monitoring status updates.');
		navigate('/driver');
	};

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	if (!shipment || !prediction) {
		return (
			<div className="card">
				<h2 className="section-title">No route-change alert found</h2>
				<p className="page-subtitle" style={{ marginBottom: 12 }}>{error || 'No active reroute request is available right now.'}</p>
				<button type="button" className="btn-primary" onClick={() => navigate('/driver')}>
					Back to Dashboard
				</button>
			</div>
		);
	}

	const currentRisk = modelOutputs.xgboost_risk_score || shipment.current_risk_score;
	const currentDelay = modelOutputs.random_forest_delay_hours || 0;

	return (
		<div>
			<div className="page-header">
				<div>
					<button type="button" className="btn-outline" onClick={() => navigate('/driver')}>
						<ArrowLeft size={14} /> Back
					</button>
					<h1 className="page-title" style={{ marginTop: 10 }}>Route Change Alert</h1>
					<p className="page-subtitle mono">{shipment.shipment_id} | {shipment.tracking_number}</p>
				</div>
				<Badge level={shipment.current_risk_level} size="lg" showIcon>
					{shipment.current_risk_level}
				</Badge>
			</div>

			<div className="card" style={{ marginBottom: 14, borderColor: 'var(--risk-high)', background: 'rgba(249,115,22,0.08)' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
					<div>
						<strong>Risk score is elevated at {currentRisk}.</strong>
						<div className="page-subtitle" style={{ marginTop: 4 }}>
							Predicted delay on current route: {currentDelay}h
						</div>
					</div>
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<button
							type="button"
							className="btn-primary"
							onClick={() => recommendedRoute && approveRoute(recommendedRoute)}
							disabled={!recommendedRoute}
						>
							<Route size={16} />
							Approve Recommended Route
						</button>
						<button type="button" className="btn-outline" onClick={keepCurrentRoute}>
							Keep Current Route
						</button>
					</div>
				</div>
			</div>

			<RouteCompareTable
				routes={prediction.alternate_routes || []}
				currentRiskScore={currentRisk}
				currentDelayHours={currentDelay}
				onApprove={approveRoute}
			/>

			<div style={{ marginTop: 14 }}>
				<FinancialImpactCard financialImpact={prediction.financial_impact} />
			</div>
		</div>
	);
}
