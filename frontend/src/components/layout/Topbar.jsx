import { Bell, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
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
	{ test: (pathname) => pathname.includes('/driver/status'), title: 'Status Update' },
	{ test: (pathname) => pathname.includes('/driver/route-change'), title: 'Route Change Alert' },
	{ test: (pathname) => pathname === '/receiver', title: 'Incoming Shipments' },
	{ test: (pathname) => pathname.includes('/receiver/shipments/') && pathname.includes('/confirm'), title: 'Confirm Delivery' },
	{ test: (pathname) => pathname.includes('/receiver/shipments/'), title: 'Track Shipment' },
];

function getTitle(pathname) {
	const entry = PATH_TITLES.find((item) => item.test(pathname));
	return entry?.title || 'RouteGuard';
}

export default function Topbar() {
	const location = useLocation();
	const { user } = useAuth();
	const { newAlerts } = useSocket();

	return (
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
	);
}
