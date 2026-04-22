import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../config/api';
import { ENDPOINTS } from '../../config/endpoints';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import StatusTimeline from '../../components/shipments/StatusTimeline';

const STATUS_OPTIONS = [
	{ value: 'picked_up', label: 'Picked Up' },
	{ value: 'in_transit', label: 'In Transit' },
	{ value: 'at_port', label: 'At Port' },
	{ value: 'customs_clearance', label: 'Customs Clearance' },
	{ value: 'delivered', label: 'Delivered' },
];

function initialTimeline(shipment) {
	if (!shipment) return [];
	const date = new Date(shipment.departure_at || Date.now());
	return [
		{ status: 'created', timestamp: date.toLocaleString() },
		{ status: 'picked_up', timestamp: new Date(date.getTime() + 6 * 3600000).toLocaleString() },
		{ status: 'in_transit', timestamp: new Date(date.getTime() + 72 * 3600000).toLocaleString() },
	].filter(Boolean);
}

export default function StatusUpdate() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const shipmentId = searchParams.get('shipmentId');
	const [shipment, setShipment] = useState(null);
	const [timelineUpdates, setTimelineUpdates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [form, setForm] = useState({
		status: 'in_transit',
		latitude: '',
		longitude: '',
		notes: '',
		reportIncident: false,
	});

	useEffect(() => {
		const fetchAssignment = async () => {
			setLoading(true);
			setError('');
			try {
				if (shipmentId) {
					const detail = await api.get(ENDPOINTS.SHIPMENT_DETAIL(shipmentId));
					setShipment(detail.data);
					setForm((prev) => ({ ...prev, status: detail.data?.status || prev.status }));
					setTimelineUpdates(initialTimeline(detail.data));
					return;
				}

				const assignmentRes = await api.get(ENDPOINTS.MY_ASSIGNMENT);
				const payload = assignmentRes.data;
				const assignment = Array.isArray(payload) ? payload[0] : payload?.shipment || payload?.assignment || payload;
				if (!assignment?.shipment_id) throw new Error('No assignment found');
				setShipment(assignment);
				setForm((prev) => ({ ...prev, status: assignment.status || prev.status }));
				setTimelineUpdates(initialTimeline(assignment));
			} catch {
				setShipment(null);
				setTimelineUpdates([]);
				setError('Unable to load driver assignment.');
			} finally {
				setLoading(false);
			}
		};

		fetchAssignment();
	}, [shipmentId]);

	const canSubmit = useMemo(() => !!shipment?.shipment_id && !!form.status, [shipment?.shipment_id, form.status]);

	const updateField = (key, value) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (!shipment?.shipment_id) return;

		setSaving(true);
		const payload = {
			status: form.status,
			location_lat: form.latitude ? Number(form.latitude) : undefined,
			location_lng: form.longitude ? Number(form.longitude) : undefined,
			note: form.notes || undefined,
		};

		try {
			await api.put(ENDPOINTS.UPDATE_STATUS(shipment.shipment_id), payload);
			if (form.reportIncident && form.notes.trim()) {
				await api.post(ENDPOINTS.REPORT_INCIDENT(shipment.shipment_id), { note: form.notes.trim() });
			}
		} catch {
			setSaving(false);
			toast.error('Unable to submit status update.');
			return;
		}

		setTimelineUpdates((prev) => [
			...prev.filter((item) => item.status !== form.status),
			{ status: form.status, timestamp: new Date().toLocaleString() },
		]);
		setShipment((prev) => ({ ...prev, status: form.status }));
		setSaving(false);
		toast.success('Status update submitted successfully.');
		navigate('/driver');
	};

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	if (!shipment) {
		return (
			<div className="card">
				<h2 className="section-title">No shipment selected</h2>
				<p className="page-subtitle" style={{ marginBottom: 12 }}>{error || 'Open this page from your assignment dashboard.'}</p>
				<button type="button" className="btn-primary" onClick={() => navigate('/driver')}>
					Back to Dashboard
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="page-header">
				<div>
					<h1 className="page-title">Status Update</h1>
					<p className="page-subtitle mono">
						{shipment.shipment_id} | {shipment.tracking_number}
					</p>
				</div>
				<Badge level={shipment.current_risk_level}>{shipment.current_risk_level}</Badge>
			</div>

			<div className="grid-two" style={{ alignItems: 'start' }}>
				<form className="card" onSubmit={handleSubmit}>
					<h3 className="section-title">Report Progress</h3>

					<div className="form-grid">
						<div className="full">
							<label className="label">New Status</label>
							<select className="select" value={form.status} onChange={(event) => updateField('status', event.target.value)}>
								{STATUS_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="label">Latitude (optional)</label>
							<input
								className="input"
								type="number"
								step="any"
								placeholder="e.g., 24.78"
								value={form.latitude}
								onChange={(event) => updateField('latitude', event.target.value)}
							/>
						</div>

						<div>
							<label className="label">Longitude (optional)</label>
							<input
								className="input"
								type="number"
								step="any"
								placeholder="e.g., 121.44"
								value={form.longitude}
								onChange={(event) => updateField('longitude', event.target.value)}
							/>
						</div>

						<div className="full">
							<label className="label">Notes</label>
							<textarea
								className="textarea"
								rows={4}
								placeholder="Traffic, weather, loading, unloading, or any operational detail"
								value={form.notes}
								onChange={(event) => updateField('notes', event.target.value)}
							/>
						</div>

						<div className="full" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input
								type="checkbox"
								checked={form.reportIncident}
								onChange={(event) => updateField('reportIncident', event.target.checked)}
							/>
							<label className="label" style={{ margin: 0 }}>
								Also report this as an incident
							</label>
						</div>
					</div>

					<div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
						<button type="button" className="btn-outline" onClick={() => navigate('/driver')}>
							Cancel
						</button>
						<button type="submit" className="btn-primary" disabled={!canSubmit || saving}>
							{saving ? 'Submitting...' : 'Submit Status'}
						</button>
					</div>
				</form>

				<StatusTimeline currentStatus={shipment.status} updates={timelineUpdates} />
			</div>
		</div>
	);
}
