import {
	Anchor,
	BarChart3,
	Bell,
	CheckCircle,
	FileText,
	LayoutDashboard,
	LogOut,
	MapPin,
	MessageSquare,
	Package,
	PackageCheck,
	PackageSearch,
	PackagePlus,
	Truck,
	Wallet,
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
	PackageSearch,
	MessageSquare,
	Truck,
	CheckCircle,
	PackageCheck,
	FileText,
	Wallet,
	MapPin,
};

const NAV_CONFIG = {
	manager: [
		{ label: 'Mission Control',      icon: 'LayoutDashboard', path: '/manager',                  section: 'OVERVIEW' },
		{ label: 'Communication',        icon: 'MessageSquare',   path: '/manager/communication',    section: null },
		{ label: 'Live Map',             icon: 'Anchor',          path: '/manager?tab=shipments',     section: null },
		{ label: 'Alerts Center',        icon: 'Bell',            path: '/manager?tab=alerts',        section: null, badge: '4' },
		{ label: 'Consignment Requests', icon: 'PackagePlus',     path: '/manager?tab=requests',      section: 'OPERATIONS', badge: '3' },
		{ label: 'Active Consignments',  icon: 'Package',         path: '/manager?tab=consignments',  section: null },
		{ label: 'Driver Management',    icon: 'Truck',           path: '/manager?tab=drivers',       section: 'RESOURCES' },
		{ label: 'Fleet Management',     icon: 'CheckCircle',     path: '/manager?tab=fleet',         section: null },
		{ label: 'Analytics',            icon: 'BarChart3',       path: '/manager?tab=analytics',     section: 'INSIGHTS' },
	],
	shipper: [
		{ label: 'Consignments', icon: 'Package', path: '/shipper' },
		{ label: 'Create Order', icon: 'PackagePlus', path: '/shipper/create' },
		{ label: 'Live Map', icon: 'Anchor', path: '/shipper/live-map' },
		{ label: 'Chat', icon: 'MessageSquare', path: '/shipper/chat' },
		{ label: 'Alerts', icon: 'Bell', path: '/shipper/alerts' },
		{ label: 'Documents', icon: 'FileText', path: '/shipper/documents' },
		{ label: 'Spending', icon: 'Wallet', path: '/shipper/spending' },
		{ label: 'Addresses', icon: 'MapPin', path: '/shipper/addresses' },
	],
	driver: [
		{ label: 'Dashboard', icon: 'LayoutDashboard', path: '/driver' },
		{ label: 'Active Assignment', icon: 'Truck', path: '/driver/assignment' },
		{ label: 'Order Details', icon: 'PackagePlus', path: '/driver/details' },
		{ label: 'Navigation', icon: 'Anchor', path: '/driver/navigation' },
		{ label: 'Update Status', icon: 'CheckCircle', path: '/driver/status-update' },
		{ label: 'Alerts', icon: 'Bell', path: '/driver/alerts' },
		{ label: 'Chat', icon: 'MessageSquare', path: '/driver/chat' },
		{ label: 'Emergency', icon: 'Package', path: '/driver/emergency' },
		{ label: 'Profile', icon: 'MapPin', path: '/driver/profile' },
	],
	receiver: [
		{ label: 'Dashboard', icon: 'PackageCheck', path: '/receiver' },
		{ label: 'Search & Monitor', icon: 'PackageSearch', path: '/receiver/track' },
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
					<div key={item.path}>
						{item.section && (
							<div style={{fontSize:9,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text-muted,#4A5F7A)',padding:'12px 16px 4px',fontFamily:"'Space Grotesk',sans-serif"}}>
								{item.section}
							</div>
						)}
						<NavLink
							to={item.path}
							key={item.path}
							end={item.path === `/${user?.role}`}
							className={({ isActive }) =>
								`sidebar__nav-link${isActive ? ' active' : ''}`
							}
							style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}
						>
							<span style={{display:'flex',alignItems:'center',gap:8}}>
								<Icon size={16} />
								<span>{item.label}</span>
							</span>
							{item.badge && (
								<span style={{background:'rgba(239,68,68,.2)',color:'#EF4444',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:10,minWidth:18,textAlign:'center'}}>
									{item.badge}
								</span>
							)}
						</NavLink>
					</div>
				);
			})}
		</nav>

			<div className="sidebar__footer">
				<div className="sidebar__user">
					<div className="sidebar__avatar">{initials(user?.name)}</div>
					<div style={{flex:1,minWidth:0}}>
						<div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.name || 'RouteGuard User'}</div>
						<Badge level="low" size="sm">{user?.role || 'user'}</Badge>
					</div>
				</div>
				<button type="button" className="btn-outline" onClick={logout} style={{display:'flex',alignItems:'center',gap:8}}>
					<LogOut size={16} />
					Sign Out
				</button>
			</div>
		</aside>
	);
}
