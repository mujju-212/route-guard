/**
 * SocketContext.jsx
 *
 * Uses the backend's native FastAPI WebSocket at /ws/{user_id}
 * (NOT Socket.IO — the backend has no Socket.IO server).
 *
 * Silently no-ops when backend is unreachable (hackathon demo mode).
 */
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { BASE_URL } from '../config/api';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

function getWsUrl(baseUrl, userId) {
	// Convert http://localhost:8000 → ws://localhost:8000/ws/{userId}
	const wsBase = baseUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
	return `${wsBase}/ws/${userId}`;
}

export function SocketProvider({ children }) {
	const { token, user } = useAuth();
	const wsRef = useRef(null);
	const [riskUpdates, setRiskUpdates] = useState({});
	const [newAlerts, setNewAlerts] = useState([]);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		// Need both a token AND a user id to open the connection
		if (!token || !user?.user_id) {
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
			setConnected(false);
			return;
		}

		const url = getWsUrl(BASE_URL, user.user_id);
		let ws;
		let dead = false; // flag so we don't re-open after cleanup

		const connect = () => {
			if (dead) return;
			try {
				ws = new WebSocket(url);
				wsRef.current = ws;
			} catch {
				// WebSocket not available or invalid URL — silently abort
				return;
			}

			ws.onopen = () => {
				setConnected(true);
				console.log('[ws] connected to', url);
			};

			ws.onmessage = (event) => {
				let msg;
				try { msg = JSON.parse(event.data); } catch { return; }

				const { event: evtName, payload = {} } = msg;

				if (evtName === 'risk_update') {
					setRiskUpdates((prev) => ({ ...prev, [msg.shipment_id]: msg.payload }));
					if (payload.risk_level === 'critical') {
						toast.error(`CRITICAL: ${msg.shipment_id} — ${payload.message || 'Immediate attention required'}`, { duration: 8000 });
					} else if (payload.risk_level === 'high') {
						toast(`HIGH RISK: ${msg.shipment_id} — score ${payload.risk_score ?? '—'}`, { duration: 5000 });
					}
				}

				if (evtName === 'new_alert') {
					setNewAlerts((prev) => [payload, ...prev]);
				}

				if (evtName === 'route_changed') {
					toast.success(`Route updated for ${msg.shipment_id}. Check your panel.`, { duration: 6000 });
				}
			};

			ws.onclose = () => {
				setConnected(false);
				wsRef.current = null;
				// Reconnect after 5 s unless component unmounted
				if (!dead) setTimeout(connect, 5000);
			};

			ws.onerror = () => {
				// Silently ignore — onclose will fire next and handle reconnect
			};
		};

		connect();

		return () => {
			dead = true;
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
			setConnected(false);
		};
	}, [token, user?.user_id]);

	const value = useMemo(
		() => ({ connected, riskUpdates, newAlerts }),
		[connected, riskUpdates, newAlerts]
	);

	return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
