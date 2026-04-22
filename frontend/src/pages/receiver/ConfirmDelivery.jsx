import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import { DUMMY_SHIPMENTS } from '../../dummy/shipments';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../../components/ui/Badge';
import DemoModeBanner from '../../components/ui/DemoModeBanner';
import Spinner from '../../components/ui/Spinner';

function nowInputValue() {
	return new Date().toISOString().slice(0, 16);
}

export default function ConfirmDelivery() {
	const navigate = useNavigate();
	const { id } = useParams();
	const { user } = useAuth();
	const [shipment, setShipment] = useState(null);
	const [loading, setLoading] = useState(true);
	const [usingDummy, setUsingDummy] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [form, setForm] = useState({
		receiver_name: user?.name || '',
		received_at: nowInputValue(),
		condition: 'good',
		packages_intact: true,
		notes: '',
		signature: user?.name || '',
		confirmAccuracy: false,
	});

	useEffect(() => {
		const fetchShipment = async () => {
			setLoading(true);
			try {
				const response = await api.get(ENDPOINTS.SHIPMENT_DETAIL(id));
				setShipment(response.data);
			} catch {
				setShipment(DUMMY_SHIPMENTS.find((item) => item.shipment_id === id) || DUMMY_SHIPMENTS[0]);
				setUsingDummy(true);
			} finally {
				setLoading(false);
			}
		};

		fetchShipment();
	}, [id]);

	const updateField = (key, value) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const isDelivered = shipment?.status === 'delivered';

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (!shipment?.shipment_id) return;

		if (!form.confirmAccuracy) {
			toast.error('Please confirm the declaration before submitting.');
			return;
		}

		setSubmitting(true);
		const payload = {
			receiver_name: form.receiver_name,
			received_at: new Date(form.received_at).toISOString(),
			condition: form.condition,
			packages_intact: form.packages_intact,
			notes: form.notes || null,
			signature: form.signature,
		};

		try {
			await api.post(ENDPOINTS.CONFIRM_DELIVERY(shipment.shipment_id), payload);
		} catch {
			// Demo mode local confirmation.
		}

		setSubmitting(false);
		toast.success('Delivery confirmation recorded.');
		navigate('/receiver');
	};

	if (loading || !shipment) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div>
			<DemoModeBanner usingDummy={usingDummy} />

			<div className="page-header">
				<div>
					<h1 className="page-title">Confirm Delivery</h1>
					<p className="page-subtitle mono">
						{shipment.shipment_id} | {shipment.tracking_number}
					</p>
				</div>
				<Badge level={shipment.current_risk_level}>{shipment.current_risk_level}</Badge>
			</div>

			{!isDelivered ? (
				<div className="card" style={{ marginBottom: 14, borderColor: 'var(--warning)', background: 'rgba(234,179,8,0.08)' }}>
					<strong>Heads up:</strong> Shipment status is <span className="mono">{shipment.status}</span>. You can prefill the form now, but final confirmation should be submitted when cargo is delivered.
				</div>
			) : null}

			<div className="grid-two" style={{ alignItems: 'start' }}>
				<div className="card">
					<h3 className="section-title">Shipment Summary</h3>
					<div className="info-list">
						<div className="info-row"><span>Origin</span><strong>{shipment.origin}</strong></div>
						<div className="info-row"><span>Destination</span><strong>{shipment.destination}</strong></div>
						<div className="info-row"><span>Cargo</span><strong>{shipment.cargo_description}</strong></div>
						<div className="info-row"><span>Weight</span><strong className="mono">{shipment.weight_kg} kg</strong></div>
						<div className="info-row"><span>Declared Value</span><strong>${shipment.declared_value.toLocaleString()}</strong></div>
						<div className="info-row"><span>Current Status</span><strong>{shipment.status.replace(/_/g, ' ')}</strong></div>
					</div>
				</div>

				<form className="card" onSubmit={handleSubmit}>
					<h3 className="section-title">Delivery Verification Form</h3>
					<div className="form-grid">
						<div className="full">
							<label className="label">Receiver Name</label>
							<input
								className="input"
								value={form.receiver_name}
								onChange={(event) => updateField('receiver_name', event.target.value)}
								required
							/>
						</div>

						<div>
							<label className="label">Received At</label>
							<input
								className="input"
								type="datetime-local"
								value={form.received_at}
								onChange={(event) => updateField('received_at', event.target.value)}
								required
							/>
						</div>

						<div>
							<label className="label">Cargo Condition</label>
							<select className="select" value={form.condition} onChange={(event) => updateField('condition', event.target.value)}>
								<option value="good">Good</option>
								<option value="minor_damage">Minor Damage</option>
								<option value="damaged">Damaged</option>
								<option value="incomplete">Incomplete</option>
							</select>
						</div>

						<div className="full" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input
								type="checkbox"
								checked={form.packages_intact}
								onChange={(event) => updateField('packages_intact', event.target.checked)}
							/>
							<label className="label" style={{ margin: 0 }}>
								All packages and seals are intact
							</label>
						</div>

						<div className="full">
							<label className="label">Receiver Notes</label>
							<textarea
								className="textarea"
								rows={4}
								placeholder="Condition notes, mismatch details, handling remarks"
								value={form.notes}
								onChange={(event) => updateField('notes', event.target.value)}
							/>
						</div>

						<div className="full">
							<label className="label">Digital Signature (typed name)</label>
							<input
								className="input"
								value={form.signature}
								onChange={(event) => updateField('signature', event.target.value)}
								required
							/>
						</div>

						<div className="full" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input
								type="checkbox"
								checked={form.confirmAccuracy}
								onChange={(event) => updateField('confirmAccuracy', event.target.checked)}
							/>
							<label className="label" style={{ margin: 0 }}>
								I confirm that the above details are accurate.
							</label>
						</div>
					</div>

					<div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
						<button type="button" className="btn-outline" onClick={() => navigate(`/receiver/shipments/${shipment.shipment_id}`)}>
							Back
						</button>
						<button type="submit" className="btn-primary" disabled={submitting}>
							{submitting ? 'Submitting...' : 'Submit Confirmation'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
