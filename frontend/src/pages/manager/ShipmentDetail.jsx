import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_ML_PREDICTION, DUMMY_SHIPMENTS } from '../../dummy/shipments';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import RiskGauge from '../../components/risk/RiskGauge';
import FeatureChart from '../../components/risk/FeatureChart';
import TrajectoryGraph from '../../components/risk/TrajectoryGraph';
import RouteCompareTable from '../../components/routes/RouteCompareTable';
import FinancialImpactCard from '../../components/routes/FinancialImpactCard';
import StatusTimeline from '../../components/shipments/StatusTimeline';

export default function ShipmentDetail() {
	const navigate = useNavigate();
	const { id } = useParams();
	const [shipment, setShipment] = useState(null);
	const [prediction, setPrediction] = useState(null);
	const [loading, setLoading] = useState(true);
	const [usingDummy, setUsingDummy] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const [shipmentRes, predictionRes] = await Promise.all([
					api.get(ENDPOINTS.SHIPMENT_DETAIL(id)),
					api.get(ENDPOINTS.ML_PREDICTION(id)),
				]);
				setShipment(shipmentRes.data);
				setPrediction(predictionRes.data);
			} catch {
				setShipment(DUMMY_SHIPMENTS.find((item) => item.shipment_id === id) || DUMMY_SHIPMENTS[0]);
				setPrediction(DUMMY_ML_PREDICTION);
				setUsingDummy(true);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [id]);

	const modelOutputs = prediction?.model_outputs || {};

	const statusUpdates = useMemo(
		() => [
			{ status: 'created', timestamp: '2025-01-15 06:00' },
			{ status: 'picked_up', timestamp: '2025-01-15 12:00' },
			{ status: 'in_transit', timestamp: '2025-01-20 09:15' },
		],
		[]
	);

	const approveReroute = async (route) => {
		try {
			await api.post(ENDPOINTS.APPROVE_REROUTE(shipment.shipment_id), { route_id: route.route_id });
		} catch {
			// local state fallback for demo mode
		}
		setShipment((prev) => ({ ...prev, is_rerouted: true, reroute_count: (prev?.reroute_count || 0) + 1 }));
		toast.success('Reroute approved. Captain notified.');
	};

	if (loading || !shipment) {
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
					<button type="button" className="btn-outline" onClick={() => navigate('/manager')}>
						<ArrowLeft size={14} /> Back
					</button>
					<h1 className="page-title mono" style={{ marginTop: 10 }}>
						{shipment.shipment_id}
					</h1>
					<p className="page-subtitle mono">{shipment.tracking_number}</p>
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<span className={`status-chip ${shipment.status}`}>{shipment.status.replace(/_/g, ' ')}</span>
					<Badge level={shipment.current_risk_level} size="lg" showIcon>
						{shipment.current_risk_level}
					</Badge>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
				<div style={{ display: 'grid', gap: 14 }}>
					<RiskGauge
						score={modelOutputs.xgboost_risk_score || shipment.current_risk_score}
						level={shipment.current_risk_level}
						delayHours={modelOutputs.random_forest_delay_hours || 0}
						rerouteConfidence={modelOutputs.gradient_boost_confidence || 0}
					/>
					<FeatureChart featureImportance={prediction?.feature_importance || {}} />
					<TrajectoryGraph values={modelOutputs.lstm_trajectory || []} />
					<RouteCompareTable
						routes={prediction?.alternate_routes || []}
						currentRiskScore={modelOutputs.xgboost_risk_score || shipment.current_risk_score}
						currentDelayHours={modelOutputs.random_forest_delay_hours || 0}
						onApprove={approveReroute}
					/>
					<FinancialImpactCard financialImpact={prediction?.financial_impact} />
				</div>

				<div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
					<div className="card">
						<h3 className="section-title">Shipment Info</h3>
						<div className="info-list">
							<div className="info-row"><span>Origin</span><strong>{shipment.origin}</strong></div>
							<div className="info-row"><span>Destination</span><strong>{shipment.destination}</strong></div>
							<div className="info-row"><span>Priority</span><strong>{shipment.priority}</strong></div>
							<div className="info-row"><span>Expected Arrival</span><strong>{shipment.expected_arrival}</strong></div>
							<div className="info-row"><span>Rerouted</span><strong>{shipment.is_rerouted ? `Yes x${shipment.reroute_count}` : 'No'}</strong></div>
						</div>
					</div>

					<div className="card">
						<h3 className="section-title">Cargo Details</h3>
						<div className="info-list">
							<div className="info-row"><span>Cargo Type</span><strong>{shipment.cargo_type}</strong></div>
							<div className="info-row"><span>Description</span><strong>{shipment.cargo_description}</strong></div>
							<div className="info-row"><span>Weight</span><strong>{shipment.weight_kg} kg</strong></div>
							<div className="info-row"><span>Declared Value</span><strong>${shipment.declared_value.toLocaleString()}</strong></div>
						</div>
					</div>

					<div className="card">
						<h3 className="section-title">Team Assignments</h3>
						<div className="info-list">
							<div className="info-row"><span>Manager</span><strong>{shipment.assigned_manager}</strong></div>
							<div className="info-row"><span>Vessel</span><strong>{shipment.assigned_vessel}</strong></div>
							<div className="info-row"><span>Shipper</span><strong>{shipment.shipper_name}</strong></div>
							<div className="info-row"><span>Receiver</span><strong>{shipment.receiver_name}</strong></div>
						</div>
					</div>

					<StatusTimeline currentStatus={shipment.status} updates={statusUpdates} />
				</div>
			</div>
		</div>
	);
}
