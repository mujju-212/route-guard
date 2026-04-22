import { Bell, Settings, Sun, Moon, MessageSquare } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Badge from '../ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';

const PATH_TITLES = [
	{ test: (pathname) => pathname === '/manager', title: 'Manager Control Center' },
	{ test: (pathname) => pathname.includes('/manager/ports'), title: 'Global Port Status' },
	{ test: (pathname) => pathname.includes('/manager/analytics'), title: 'Analytics' },
	{ test: (pathname) => pathname.includes('/manager/shipments/'), title: 'Shipment Detail' },
	{ test: (pathname) => pathname === '/shipper', title: 'My Shipments' },
	{ test: (pathname) => pathname.includes('/shipper/create'), title: 'Create Shipment' },
	{ test: (pathname) => pathname.includes('/shipper/shipments/'), title: 'Track Shipment' },
	{ test: (pathname) => pathname === '/driver', title: 'My Assignment' },
	{ test: (pathname) => pathname === '/driver/my-tasks', title: 'My Tasks' },
	{ test: (pathname) => pathname === '/driver/pickup', title: 'Pickup Details' },
	{ test: (pathname) => pathname === '/driver/navigate', title: 'Navigation' },
	{ test: (pathname) => pathname === '/driver/alerts', title: 'Alerts' },
	{ test: (pathname) => pathname.includes('/driver/status'), title: 'Status Update' },
	{ test: (pathname) => pathname.includes('/driver/route-change'), title: 'Route Change Alert' },
	{ test: (pathname) => pathname === '/receiver', title: 'Incoming Shipments' },
	{ test: (pathname) => pathname === '/receiver/create-order', title: 'Create Order' },
	{ test: (pathname) => pathname === '/receiver/track', title: 'Track Shipment' },
	{ test: (pathname) => pathname === '/receiver/alerts', title: 'Alerts' },
	{ test: (pathname) => pathname.includes('/receiver/shipments/') && pathname.includes('/confirm'), title: 'Confirm Delivery' },
	{ test: (pathname) => pathname.includes('/receiver/shipments/'), title: 'Track Shipment' },
];

function getTitle(pathname) {
	const entry = PATH_TITLES.find((item) => item.test(pathname));
	return entry?.title || 'RouteGuard';
}

// Chat Modal Component
const ChatModal = ({ isOpen, onClose, userName, role }) => {
	const [messages, setMessages] = useState([
		{ id: 1, sender: 'Sarah Chen (Manager)', text: 'How is the delivery progressing?', time: '2:30 PM' },
		{ id: 2, sender: userName, text: 'On schedule, ETA in 2 hours', time: '2:32 PM' },
		{ id: 3, sender: 'Sarah Chen (Manager)', text: 'Traffic alert on NH-48, can you take bypass?', time: '2:45 PM' },
	]);
	const [newMessage, setNewMessage] = useState('');

	const handleSend = () => {
		if (newMessage.trim()) {
			setMessages([
				...messages,
				{ id: messages.length + 1, sender: userName, text: newMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
			]);
			setNewMessage('');
		}
	};

	if (!isOpen) return null;

	return (
		<div style={{
			position: 'fixed',
			inset: 0,
			background: 'rgba(0,0,0,0.5)',
			display: 'flex',
			alignItems: 'flex-end',
			justifyContent: 'flex-end',
			zIndex: 1000,
		}}>
			<div style={{
				background: 'var(--bg-surface)',
				width: '360px',
				height: '500px',
				borderRadius: '12px 12px 0 0',
				display: 'flex',
				flexDirection: 'column',
				borderTop: '2px solid #00D4B4',
			}}>
				<div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Direct Communication</h3>
					<button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '20px' }}>×</button>
				</div>
				<div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
					{messages.map((msg) => (
						<div key={msg.id} style={{ display: 'flex', flexDirection: msg.sender === userName ? 'row-reverse' : 'row', gap: '8px' }}>
							<div style={{
								background: msg.sender === userName ? '#00D4B4' : 'var(--bg-elevated)',
								color: msg.sender === userName ? '#000' : 'var(--text-primary)',
								padding: '8px 12px',
								borderRadius: '8px',
								maxWidth: '250px',
								wordWrap: 'break-word',
								fontSize: '13px',
							}}>
								{msg.text}
								<div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>{msg.time}</div>
							</div>
						</div>
					))}
				</div>
				<div style={{ padding: '12px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '8px' }}>
					<input
						type="text"
						placeholder="Type message..."
						value={newMessage}
						onChange={(e) => setNewMessage(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && handleSend()}
						style={{
							flex: 1,
							background: 'var(--bg-base)',
							border: '1px solid var(--border-default)',
							borderRadius: '6px',
							padding: '8px',
							color: 'var(--text-primary)',
							fontSize: '13px',
						}}
					/>
					<button
						onClick={handleSend}
						style={{
							background: '#00D4B4',
							border: 'none',
							borderRadius: '6px',
							padding: '8px 12px',
							cursor: 'pointer',
							color: '#000',
							fontWeight: 600,
							fontSize: '12px',
						}}
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
};

export default function Topbar() {
	const location = useLocation();
	const { user } = useAuth();
	const { newAlerts } = useSocket();
	const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
	const [chatOpen, setChatOpen] = useState(false);

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}, [theme]);

	const toggleTheme = () => {
		setTheme(prev => prev === 'dark' ? 'light' : 'dark');
	};

	return (
		<>
			<header className="topbar">
				<h2 className="topbar__title">{getTitle(location.pathname)}</h2>
				<div className="topbar__live">
					<span className="topbar__dot" />
					LIVE MONITORING
				</div>
				<div className="topbar__right">
					<button type="button" className="topbar__icon-btn" aria-label="Alerts">
						<Bell size={16} />
						{newAlerts.length > 0 ? <span className="topbar__badge">{newAlerts.length}</span> : null}
					</button>
					{(user?.role === 'manager' || user?.role === 'driver') && (
						<button
							type="button"
							className="topbar__icon-btn"
							aria-label="Chat"
							onClick={() => setChatOpen(true)}
							title="Direct Communication"
						>
							<MessageSquare size={16} />
						</button>
					)}
					<button
						type="button"
						className="topbar__icon-btn"
						onClick={toggleTheme}
						title="Toggle Dark/Light Mode"
					>
						{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
					</button>
					<div>
						<div style={{ fontSize: 13 }}>{user?.name || 'Operator'}</div>
						<Badge level="medium" size="sm">
							{user?.role || 'user'}
						</Badge>
					</div>
					<button type="button" className="topbar__icon-btn" aria-label="Settings">
						<Settings size={16} />
					</button>
				</div>
			</header>
			<ChatModal isOpen={chatOpen} onClose={() => setChatOpen(false)} userName={user?.name} role={user?.role} />
		</>
	);
}
