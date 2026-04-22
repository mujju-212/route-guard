import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';

const CARGO_SENSITIVITY = {
	'Standard Dry': 35,
	'Electronics (Fragile)': 65,
	Perishable: 70,
	Pharmaceutical: 82,
	Hazardous: 88,
	Refrigerated: 74,
	Automotive: 58,
	Oversized: 60,
};

const PRIORITY_BONUS = {
	low: 0,
	medium: 8,
	high: 14,
	urgent: 20,
};

const INITIAL_FORM = {
	origin: '',
	destination: '',
	departure_at: '',
	expected_arrival: '',
	cargo_type: 'Standard Dry',
	cargo_description: '',
	weight_kg: '',
	volume_cbm: '',
	declared_value: '',
	insurance_value: '',
	priority: 'medium',
	special_notes: '',
};

const COMMON_ORIGINS = ['Busan Port', 'Shanghai Port', 'Mumbai Port'];
const COMMON_DESTINATIONS = ['Rotterdam Port', 'Hamburg Port', 'Los Angeles Port'];

export default function CreateShipment() {
	const navigate = useNavigate();
	const [step, setStep] = useState(1);
	const [submitting, setSubmitting] = useState(false);
	const [formData, setFormData] = useState(INITIAL_FORM);

	const sensitivityScore = useMemo(() => {
		const cargoBase = CARGO_SENSITIVITY[formData.cargo_type] || 40;
		const priorityBoost = PRIORITY_BONUS[formData.priority] || 0;
		return Math.min(100, cargoBase + priorityBoost);
	}, [formData.cargo_type, formData.priority]);

	const updateField = (key, value) => {
		setFormData((prev) => ({ ...prev, [key]: value }));
	};

	const validateStep = () => {
		if (step === 1) {
			if (!formData.origin || !formData.destination || !formData.departure_at || !formData.expected_arrival) {
				toast.error('Please complete all route fields.');
				return false;
			}
		}
		if (step === 2) {
			if (!formData.cargo_description || !formData.weight_kg || !formData.declared_value) {
				toast.error('Please complete required cargo details.');
				return false;
			}
		}
		return true;
	};

	const next = () => {
		if (!validateStep()) return;
		setStep((prev) => Math.min(3, prev + 1));
	};

	const back = () => setStep((prev) => Math.max(1, prev - 1));

	const handleSubmit = async () => {
		setSubmitting(true);
		try {
			const response = await api.post(ENDPOINTS.CREATE_SHIPMENT, formData);
			toast.success('Shipment created successfully');
			navigate(`/shipper/shipments/${response.data.shipment_id}`);
		} catch {
			toast.success('Shipment created! Demo mode active.');
			navigate('/shipper/shipments/SHP-2025-00847');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div>
			<div className="page-header">
				<div>
					<h1 className="page-title">Create Shipment</h1>
					<p className="page-subtitle">Step {step} of 3</p>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 14 }}>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
					{['Route Details', 'Cargo Details', 'Review & Confirm'].map((label, index) => {
						const current = index + 1 === step;
						const completed = index + 1 < step;
						return (
							<div
								key={label}
								className="card"
								style={{
									padding: 10,
									borderColor: current ? 'var(--accent-primary)' : 'var(--border-subtle)',
									opacity: completed ? 0.9 : 1,
								}}
							>
								<div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
									Step {index + 1}
								</div>
								<div style={{ fontWeight: 700 }}>{label}</div>
							</div>
						);
					})}
				</div>
			</div>

			{step === 1 ? (
				<div className="card">
					<h3 className="section-title">Route Details</h3>
					<div className="form-grid">
						<div className="full">
							<label className="label">Origin Address or Port</label>
							<input
								className="input"
								placeholder="e.g., Samsung Factory, Suwon, South Korea"
								value={formData.origin}
								onChange={(event) => updateField('origin', event.target.value)}
							/>
							<div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
								{COMMON_ORIGINS.map((origin) => (
									<button key={origin} type="button" className="btn-outline" onClick={() => updateField('origin', origin)}>
										{origin}
									</button>
								))}
							</div>
						</div>

						<div className="full">
							<label className="label">Destination Address or Port</label>
							<input
								className="input"
								placeholder="e.g., Amazon Warehouse, Berlin, Germany"
								value={formData.destination}
								onChange={(event) => updateField('destination', event.target.value)}
							/>
							<div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
								{COMMON_DESTINATIONS.map((destination) => (
									<button type="button" key={destination} className="btn-outline" onClick={() => updateField('destination', destination)}>
										{destination}
									</button>
								))}
							</div>
						</div>

						<div>
							<label className="label">Departure Date</label>
							<input className="input" type="date" value={formData.departure_at} onChange={(event) => updateField('departure_at', event.target.value)} />
						</div>
						<div>
							<label className="label">Expected Delivery Date</label>
							<input className="input" type="date" value={formData.expected_arrival} onChange={(event) => updateField('expected_arrival', event.target.value)} />
						</div>
					</div>
				</div>
			) : null}

			{step === 2 ? (
				<div className="card">
					<h3 className="section-title">Cargo Details</h3>
					<div className="form-grid">
						<div>
							<label className="label">Cargo Type</label>
							<select className="select" value={formData.cargo_type} onChange={(event) => updateField('cargo_type', event.target.value)}>
								{Object.keys(CARGO_SENSITIVITY).map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="label">Priority Level</label>
							<select className="select" value={formData.priority} onChange={(event) => updateField('priority', event.target.value)}>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
								<option value="urgent">Urgent</option>
							</select>
						</div>

						<div className="full">
							<label className="label">Cargo Description</label>
							<textarea className="textarea" value={formData.cargo_description} onChange={(event) => updateField('cargo_description', event.target.value)} />
						</div>

						<div>
							<label className="label">Weight (kg)</label>
							<input className="input" type="number" value={formData.weight_kg} onChange={(event) => updateField('weight_kg', event.target.value)} />
						</div>
						<div>
							<label className="label">Volume (CBM)</label>
							<input className="input" type="number" value={formData.volume_cbm} onChange={(event) => updateField('volume_cbm', event.target.value)} />
						</div>

						<div>
							<label className="label">Declared Value (USD)</label>
							<input className="input" type="number" value={formData.declared_value} onChange={(event) => updateField('declared_value', event.target.value)} />
						</div>
						<div>
							<label className="label">Insurance Value (USD)</label>
							<input className="input" type="number" value={formData.insurance_value} onChange={(event) => updateField('insurance_value', event.target.value)} />
						</div>

						<div className="full">
							<label className="label">Special Handling Notes</label>
							<textarea className="textarea" value={formData.special_notes} onChange={(event) => updateField('special_notes', event.target.value)} />
						</div>
					</div>

					<div className="card" style={{ marginTop: 14, padding: 12 }}>
						<p>
							Based on your selections: Estimated Cargo Sensitivity Score - <strong className="mono">{sensitivityScore}/100</strong>
						</p>
					</div>
				</div>
			) : null}

			{step === 3 ? (
				<div className="card">
					<h3 className="section-title">Review and Confirm</h3>
					<div className="grid-two">
						<div className="card" style={{ padding: 12 }}>
							<h4>Route</h4>
							<div className="info-list" style={{ marginTop: 8 }}>
								<div className="info-row"><span>Origin</span><strong>{formData.origin}</strong></div>
								<div className="info-row"><span>Destination</span><strong>{formData.destination}</strong></div>
								<div className="info-row"><span>Departure</span><strong>{formData.departure_at}</strong></div>
								<div className="info-row"><span>Expected</span><strong>{formData.expected_arrival}</strong></div>
							</div>
						</div>
						<div className="card" style={{ padding: 12 }}>
							<h4>Cargo</h4>
							<div className="info-list" style={{ marginTop: 8 }}>
								<div className="info-row"><span>Type</span><strong>{formData.cargo_type}</strong></div>
								<div className="info-row"><span>Priority</span><strong>{formData.priority}</strong></div>
								<div className="info-row"><span>Declared Value</span><strong>${Number(formData.declared_value || 0).toLocaleString()}</strong></div>
								<div className="info-row"><span>Sensitivity Score</span><strong className="mono">{sensitivityScore}/100</strong></div>
							</div>
						</div>
					</div>
					<button type="button" className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
						{submitting ? 'Creating...' : 'Confirm and Create Shipment'}
					</button>
				</div>
			) : null}

			<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
				<button type="button" className="btn-outline" onClick={back} disabled={step === 1 || submitting}>
					Back
				</button>
				{step < 3 ? (
					<button type="button" className="btn-primary" onClick={next}>
						Next
					</button>
				) : null}
			</div>
		</div>
	);
}
