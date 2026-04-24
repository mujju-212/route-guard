import {
	Anchor,
	BarChart3,
	Bell,
	CheckCircle,
	LayoutDashboard,
	LogOut,
	Package,
	PackageCheck,
	PackagePlus,
	Truck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Badge from '../ui/Badge';
import { useAuth } from '../../hooks/useAuth';

const ICON_MAP = {
	LayoutDashboard,
	Anchor,
	BarChart3,
	Bell,
	Package,
	PackagePlus,
	Truck,
	CheckCircle,
	PackageCheck,
};

const NAV_CONFIG = {
	manager: [
		{ label: 'Control Center', icon: 'LayoutDashboard', path: '/manager' },
		{ label: 'Consignments', icon: 'Package', path: '/manager?tab=consignments' },
		{ label: 'Analytics', icon: 'BarChart3', path: '/manager/analytics' },
	],
	shipper: [
		{ label: 'My Shipments', icon: 'Package', path: '/shipper' },
		{ label: 'Send Package', icon: 'PackagePlus', path: '/shipper/create' },
	],
	driver: [
		{ label: 'My Assignment', icon: 'Truck', path: '/driver' },
		{ label: 'Update Status', icon: 'CheckCircle', path: '/driver/status' },
		{ label: 'My Tasks', icon: 'Package', path: '/driver/my-tasks' },
		{ label: 'Pickup Details', icon: 'PackagePlus', path: '/driver/pickup' },
		{ label: 'Navigation', icon: 'Truck', path: '/driver/navigate' },
		{ label: 'Alerts', icon: 'Bell', path: '/driver/alerts' },
	],
	receiver: [
		{ label: 'Incoming', icon: 'PackageCheck', path: '/receiver' },
		{ label: 'Create Order', icon: 'PackagePlus', path: '/receiver/create-order' },
		{ label: 'Track Shipment', icon: 'Truck', path: '/receiver/track' },
		{ label: 'Alerts', icon: 'Bell', path: '/receiver/alerts' },
	],
};

function initials(name = '') {
	const parts = name.split(' ').filter(Boolean);
	if (!parts.length) return 'RG';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Sidebar() {
	const { user, logout } = useAuth();
	const navItems = NAV_CONFIG[user?.role] || [];

	return (
		<aside className="sidebar">
			<div className="sidebar__brand">
				<h1>RouteGuard</h1>
				<p>Dynamic Coordination</p>
			</div>

			<nav className="sidebar__nav">
				{navItems.map((item) => {
					const Icon = ICON_MAP[item.icon];
					return (
						<NavLink
							to={item.path}
							key={item.path}
							end={item.path === `/${user?.role}`}
							className={({ isActive }) =>
								`sidebar__nav-link${isActive ? ' active' : ''}`
							}
						>
							<Icon size={18} />
							<span>{item.label}</span>
						</NavLink>
					);
				})}
			</nav>

			<div className="sidebar__footer">
				<div className="sidebar__user">
					<div className="sidebar__avatar">{initials(user?.name)}</div>
					<div>
						<div>{user?.name || 'RouteGuard User'}</div>
						<Badge level="low" size="sm">
							{user?.role || 'user'}
						</Badge>
					</div>
				</div>
				<button type="button" className="btn-outline" onClick={logout}>
					<LogOut size={16} />
					Logout
				</button>
			</div>
		</aside>
	);
}
