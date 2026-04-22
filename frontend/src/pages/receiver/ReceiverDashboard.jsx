import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import ShipmentCard from '../../components/shipments/ShipmentCard';
import ShipmentTable from '../../components/shipments/ShipmentTable';

function isIncoming(shipment) {
	return shipment.status !== 'delivered';
}

export default function ReceiverDashboard() {
	const navigate = useNavigate();
	const [shipments, setShipments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [riskFilter, setRiskFilter] = useState('all');

	useEffect(() => {
		const fetchShipments = async () => {
			setLoading(true);
			setError('');
			try {
				const response = await api.get(ENDPOINTS.MY_SHIPMENTS);
				setShipments(response.data || []);
			} catch {
				setShipments([]);
				setError('Unable to load shipments.');
			} finally {
				setLoading(false);
			}
		};

		fetchShipments();
	}, []);

	const incoming = useMemo(() => shipments.filter((item) => isIncoming(item)), [shipments]);
	const delivered = useMemo(() => shipments.filter((item) => item.status === 'delivered'), [shipments]);

	const filteredIncoming = useMemo(() => {
		return incoming.filter((item) => {
			const term = search.toLowerCase();
			const matchesSearch =
				item.shipment_id.toLowerCase().includes(term) ||
				item.tracking_number.toLowerCase().includes(term) ||
				item.origin.toLowerCase().includes(term);
			const matchesRisk = riskFilter === 'all' ? true : item.current_risk_level === riskFilter;
			return matchesSearch && matchesRisk;
		});
	}, [incoming, search, riskFilter]);

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div>
			{error ? (
				<div className="card" style={{ marginBottom: 14 }}>
					<strong>{error}</strong>
					<div className="page-subtitle">Check the backend connection and try again.</div>
				</div>
			) : null}

			<div className="page-header">
				<div>
					<h1 className="page-title">Incoming Shipments</h1>
					<p className="page-subtitle">Monitor arrivals and confirm final delivery</p>
				</div>
			</div>

			<div className="grid-three" style={{ marginBottom: 14 }}>
				<StatCard icon={PackageCheck} value={incoming.length} label="In Transit to You" />
				<StatCard icon={ShieldCheck} value={incoming.filter((item) => item.current_risk_level === 'low').length} label="Low-Risk Incoming" color="var(--risk-low)" />
				<StatCard icon={PackageCheck} value={delivered.length} label="Delivered This Cycle" />
			</div>

			<div className="card" style={{ marginBottom: 14 }}>
				<div className="grid-three">
					<div>
						<label className="label">Search</label>
						<div style={{ position: 'relative' }}>
							<Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
							<input
								className="input"
								style={{ paddingLeft: 32 }}
								placeholder="Shipment ID, tracking, origin"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
						</div>
					</div>

					<div>
						<label className="label">Risk Filter</label>
						<select className="select" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
							<option value="all">All</option>
							<option value="critical">Critical</option>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>
					</div>

					<div>
						<label className="label">Quick Action</label>
						<button
							type="button"
							className="btn-outline"
							onClick={() => {
								if (delivered[0]?.shipment_id) {
									navigate(`/receiver/shipments/${delivered[0].shipment_id}/confirm`);
								}
							}}
							disabled={!delivered.length}
						>
							Confirm Latest Delivery
						</button>
					</div>
				</div>
			</div>

			{filteredIncoming.length ? (
				<>
					<ShipmentTable
						shipments={filteredIncoming}
						onTrack={(id) => navigate(`/receiver/shipments/${id}`)}
						hideScore
					/>
					<div className="grid-two" style={{ marginTop: 14 }}>
						{filteredIncoming.map((shipment) => (
							<ShipmentCard
								key={shipment.shipment_id}
								shipment={shipment}
								onTrack={(id) => navigate(`/receiver/shipments/${id}`)}
								actionLabel="Track Arrival"
							/>
						))}
					</div>
				</>
			) : (
				<EmptyState
					icon={PackageCheck}
					title="No incoming shipments"
					description="You currently have no active inbound deliveries."
				/>
			)}
		</div>
	);
}
