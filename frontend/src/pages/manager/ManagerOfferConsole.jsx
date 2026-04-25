import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, Users } from 'lucide-react';

import toast from 'react-hot-toast';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { ENDPOINTS } from '../../config/endpoints';
import { api } from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

function formatDateTime(value) {
	if (!value) return 'N/A';
	try {
		return new Date(value).toLocaleString();
	} catch {
		return String(value);
	}
}

function toIsoOrNull(value) {
	if (!value) return null;
	try {
		return new Date(value).toISOString();
	} catch {
		return null;
	}
}

export default function ManagerOfferConsole() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [submittingOffer, setSubmittingOffer] = useState(false);
	const [submittingMessage, setSubmittingMessage] = useState(false);
	const [requests, setRequests] = useState([]);
	const [selectedRequestId, setSelectedRequestId] = useState('');
	const [offers, setOffers] = useState([]);
	const [messages, setMessages] = useState([]);
	const [offerForm, setOfferForm] = useState({
		offered_amount_usd: '',
		currency: 'USD',
		estimated_pickup_at: '',
		estimated_delivery_at: '',
		valid_until: '',
		notes: '',
	});
	const [messageBody, setMessageBody] = useState('');
	const [counterAmount, setCounterAmount] = useState('');

	const selectedRequest = useMemo(
		() => requests.find((item) => item.request_id === selectedRequestId) || null,
		[requests, selectedRequestId]
	);

	const loadRequests = async () => {
		const response = await api.get(ENDPOINTS.QUOTE_REQUESTS);
		const rows = Array.isArray(response.data) ? response.data : [];
		setRequests(rows);
		if (!selectedRequestId && rows.length > 0) setSelectedRequestId(rows[0].request_id);
		if (selectedRequestId && !rows.some((row) => row.request_id === selectedRequestId)) {
			setSelectedRequestId(rows[0]?.request_id || '');
		}
	};

	const loadThread = async (requestId) => {
		if (!requestId) {
			setOffers([]);
			setMessages([]);
			return;
		}
		const [offersRes, messagesRes] = await Promise.all([
			api.get(ENDPOINTS.QUOTE_OFFERS(requestId)),
			api.get(ENDPOINTS.QUOTE_MESSAGES(requestId)),
		]);
		setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
		setMessages(Array.isArray(messagesRes.data) ? messagesRes.data : []);
	};

	useEffect(() => {
		const run = async () => {
			setLoading(true);
			try {
				await loadRequests();
			} catch {
				toast.error('Unable to load quote requests.');
			} finally {
				setLoading(false);
			}
		};
		run();
	}, []);

	useEffect(() => {
		const run = async () => {
			if (!selectedRequestId) return;
			try {
				await loadThread(selectedRequestId);
			} catch {
				toast.error('Unable to load thread for this request.');
			}
		};
		run();
	}, [selectedRequestId]);

	const handleCreateOffer = async () => {
		if (!selectedRequestId) return;
		if (!offerForm.offered_amount_usd) {
			toast.error('Offer amount is required.');
			return;
		}
		setSubmittingOffer(true);
		try {
			await api.post(ENDPOINTS.QUOTE_OFFERS(selectedRequestId), {
				offered_amount_usd: Number(offerForm.offered_amount_usd),
				currency: offerForm.currency || 'USD',
				estimated_pickup_at: toIsoOrNull(offerForm.estimated_pickup_at),
				estimated_delivery_at: toIsoOrNull(offerForm.estimated_delivery_at),
				valid_until: toIsoOrNull(offerForm.valid_until),
				notes: offerForm.notes.trim() || null,
			});
			setOfferForm({
				offered_amount_usd: '',
				currency: offerForm.currency || 'USD',
				estimated_pickup_at: '',
				estimated_delivery_at: '',
				valid_until: '',
				notes: '',
			});
			await Promise.all([loadThread(selectedRequestId), loadRequests()]);
			toast.success('Offer submitted.');
		} catch (err) {
			toast.error(err?.response?.data?.detail || 'Unable to submit offer.');
		} finally {
			setSubmittingOffer(false);
		}
	};

	const handleSendMessage = async () => {
		if (!selectedRequestId) return;
		if (!messageBody.trim() && !counterAmount) {
			toast.error('Enter message or counter amount.');
			return;
		}
		setSubmittingMessage(true);
		try {
			await api.post(ENDPOINTS.QUOTE_MESSAGES(selectedRequestId), {
				message_type: counterAmount ? 'counter' : 'text',
				body: messageBody.trim() || null,
				counter_amount_usd: counterAmount ? Number(counterAmount) : null,
			});
			setMessageBody('');
			setCounterAmount('');
			await Promise.all([loadThread(selectedRequestId), loadRequests()]);
			toast.success('Message sent.');
		} catch (err) {
			toast.error(err?.response?.data?.detail || 'Unable to send message.');
		} finally {
			setSubmittingMessage(false);
		}
	};

	if (loading) {
		return (
			<div className="card" style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<div>
			<div className="page-header">
				<div>
					<h1 className="page-title">Manager Offer Console</h1>
					<p className="page-subtitle">Review sender requests, send offers, and negotiate with sender in one workspace.</p>
				</div>
			</div>

			{requests.length === 0 ? (
				<EmptyState
					icon={Users}
					title="No matching quote requests"
					description="When senders broadcast matching routes, they will appear here for your company."
				/>

			) : (
				<div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
					<div className="card">
						<label className="label">Incoming Quote Request</label>
						<select className="select" value={selectedRequestId} onChange={(event) => setSelectedRequestId(event.target.value)}>
							{requests.map((item) => (
								<option key={item.request_id} value={item.request_id}>
									{item.request_id.slice(0, 8)}... ({String(item.status).toUpperCase()})
								</option>
							))}
						</select>
						{selectedRequest ? (
							<div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
								<div>Pickup: {selectedRequest.pickup_address || 'N/A'}</div>
								<div>Dropoff: {selectedRequest.dropoff_address || 'N/A'}</div>
								<div>Weight: {selectedRequest.weight_kg || 'N/A'} kg</div>
								<div>Status: {String(selectedRequest.status).toUpperCase()}</div>
							</div>
						) : null}
					</div>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
						<div className="card">
							<h2 className="section-title">Offers</h2>
							<div className="grid-two" style={{ marginBottom: 10 }}>
								<div>
									<label className="label">Offer Amount (USD)</label>
									<input
										className="input"
										type="number"
										min="0"
										step="0.01"
										value={offerForm.offered_amount_usd}
										onChange={(event) => setOfferForm((prev) => ({ ...prev, offered_amount_usd: event.target.value }))}
										placeholder="Required"
									/>
								</div>
								<div>
									<label className="label">Currency</label>
									<input
										className="input"
										type="text"
										value={offerForm.currency}
										onChange={(event) => setOfferForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
										placeholder="USD"
									/>
								</div>
							</div>
							<div className="grid-two" style={{ marginBottom: 10 }}>
								<div>
									<label className="label">Estimated Pickup</label>
									<input
										className="input"
										type="datetime-local"
										value={offerForm.estimated_pickup_at}
										onChange={(event) => setOfferForm((prev) => ({ ...prev, estimated_pickup_at: event.target.value }))}
									/>
								</div>
								<div>
									<label className="label">Estimated Delivery</label>
									<input
										className="input"
										type="datetime-local"
										value={offerForm.estimated_delivery_at}
										onChange={(event) => setOfferForm((prev) => ({ ...prev, estimated_delivery_at: event.target.value }))}
									/>
								</div>
							</div>
							<div style={{ marginBottom: 10 }}>
								<label className="label">Offer Valid Until</label>
								<input
									className="input"
									type="datetime-local"
									value={offerForm.valid_until}
									onChange={(event) => setOfferForm((prev) => ({ ...prev, valid_until: event.target.value }))}
								/>
							</div>
							<div style={{ marginBottom: 10 }}>
								<label className="label">Offer Notes</label>
								<textarea
									className="textarea"
									rows={3}
									value={offerForm.notes}
									onChange={(event) => setOfferForm((prev) => ({ ...prev, notes: event.target.value }))}
									placeholder="Transit assumptions, included services, terms..."
								/>
							</div>
							<button type="button" className="btn-primary" disabled={submittingOffer || !selectedRequestId} onClick={handleCreateOffer}>
								{submittingOffer ? 'Submitting...' : 'Submit Offer'}
							</button>

							<div style={{ marginTop: 14, maxHeight: 220, overflow: 'auto', display: 'grid', gap: 8 }}>
								{offers.length === 0 ? (
									<p className="page-subtitle">No offers yet.</p>
								) : (
									offers.map((offer) => {
										const mine = String(offer.provider_user_id) === String(user?.user_id);
										return (
											<div key={offer.offer_id} className="card" style={{ padding: 10, borderLeft: mine ? '3px solid var(--accent)' : '1px solid var(--border-default)' }}>
												<div style={{ fontWeight: 700, marginBottom: 4 }}>
													${offer.offered_amount_usd} {offer.currency} {mine ? '(Your offer)' : ''}
												</div>
												<div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
													Pickup {formatDateTime(offer.estimated_pickup_at)} | Delivery {formatDateTime(offer.estimated_delivery_at)}
												</div>
												<div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
													Status: {String(offer.status || '').toUpperCase()}
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>

						<div className="card">
							<h2 className="section-title">Sender Negotiation Chat</h2>
							<div style={{ maxHeight: 330, overflow: 'auto', marginBottom: 10 }}>
								{messages.length === 0 ? (
									<EmptyState icon={MessageSquare} title="No messages yet" description="Start negotiation with the sender from here." />
								) : (
									<div style={{ display: 'grid', gap: 8 }}>
										{messages.map((msg) => {
											const mine = String(msg.sender_user_id) === String(user?.user_id);
											return (
												<div key={msg.message_id} className="card" style={{ padding: 10, borderLeft: mine ? '3px solid var(--accent)' : '1px solid var(--border-default)' }}>
													<div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
														{mine ? 'You' : 'Sender'} | {msg.message_type} | {formatDateTime(msg.created_at)}
													</div>
													<div style={{ fontSize: 13, marginBottom: 4 }}>{msg.body || 'No text body'}</div>
													{msg.counter_amount_usd != null ? (
														<div style={{ fontSize: 12, fontWeight: 600 }}>Counter: ${msg.counter_amount_usd}</div>
													) : null}
												</div>
											);
										})}
									</div>
								)}
							</div>

							<div className="grid-two">
								<div>
									<label className="label">Message</label>
									<textarea
										className="textarea"
										rows={3}
										value={messageBody}
										onChange={(event) => setMessageBody(event.target.value)}
										placeholder="Send message to sender..."
									/>
								</div>
								<div>
									<label className="label">Counter Amount (USD)</label>
									<input
										className="input"
										type="number"
										min="0"
										step="0.01"
										value={counterAmount}
										onChange={(event) => setCounterAmount(event.target.value)}
										placeholder="Optional"
									/>
								</div>
							</div>
							<div style={{ marginTop: 10 }}>
								<button type="button" className="btn-primary" disabled={submittingMessage || !selectedRequestId} onClick={handleSendMessage}>
									<Send size={14} />
									{submittingMessage ? 'Sending...' : 'Send Message'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
