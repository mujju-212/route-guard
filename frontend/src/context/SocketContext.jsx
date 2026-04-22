import { createContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { SOCKET_URL } from '../config/api';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
	const { token } = useAuth();
	const [socket, setSocket] = useState(null);
	const [riskUpdates, setRiskUpdates] = useState({});
	const [newAlerts, setNewAlerts] = useState([]);

	useEffect(() => {
		if (!token) {
			setSocket(null);
			return;
		}

		const nextSocket = io(SOCKET_URL, { auth: { token }, reconnectionAttempts: 5 });

		nextSocket.on('connect', () => {
			// keep silent in UI, useful for local diagnostics
			console.log('[socket] connected');
		});

		nextSocket.on('disconnect', () => {
			console.log('[socket] disconnected');
		});

		nextSocket.on('risk_update', (payload) => {
			setRiskUpdates((prev) => ({ ...prev, [payload.shipment_id]: payload }));
			if (payload.risk_level === 'critical') {
				toast.error(`CRITICAL: ${payload.shipment_id} - ${payload.message || 'Immediate attention required'}`, {
					duration: 8000,
				});
			} else if (payload.risk_level === 'high') {
				toast(`HIGH RISK: ${payload.shipment_id} - score ${payload.risk_score || '--'}`, {
					duration: 5000,
				});
			}
		});

		nextSocket.on('new_alert', (payload) => {
			setNewAlerts((prev) => [payload, ...prev]);
		});

		nextSocket.on('route_changed', (payload) => {
			toast.success(`Route updated for ${payload.shipment_id}. Check your panel.`, { duration: 6000 });
		});

		setSocket(nextSocket);

		return () => {
			nextSocket.disconnect();
		};
	}, [token]);

	const value = useMemo(
		() => ({
			socket,
			riskUpdates,
			newAlerts,
		}),
		[socket, riskUpdates, newAlerts]
	);

	return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
