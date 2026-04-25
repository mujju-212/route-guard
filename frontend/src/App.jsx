import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/auth/LoginPage';
import DriverDashboard from './pages/driver/DriverDashboard';
import AnalyticsPage from './pages/manager/AnalyticsPage';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerOfferConsole from './pages/manager/ManagerOfferConsole';
import PortStatusBoard from './pages/manager/PortStatusBoard';
import ShipmentDetail from './pages/manager/ShipmentDetail';
import ConfirmDelivery from './pages/receiver/ConfirmDelivery';
import ReceiverDashboard from './pages/receiver/ReceiverDashboard';
import ReceiverOrderDetail from './pages/receiver/ReceiverOrderDetail';
import CreateShipment from './pages/shipper/CreateShipment';
import ShipperAlerts from './pages/shipper/ShipperAlerts';
import ShipperAddresses from './pages/shipper/ShipperAddresses';
import ShipperChat from './pages/shipper/ShipperChat';
import ShipperDocuments from './pages/shipper/ShipperDocuments';
import ShipperLiveMap from './pages/shipper/ShipperLiveMap';
import ShipperOrders from './pages/shipper/ShipperOrders';
import ShipperSpending from './pages/shipper/ShipperSpending';
import OrderDetail from './pages/shipper/OrderDetail';

const ROLE_HOME = {
	manager: '/manager',
	shipper: '/shipper',
	driver: '/driver',
	receiver: '/receiver',
};

function normalizeRole(role) {
	return String(role || '').trim().toLowerCase();
}

function roleHome(role) {
	return ROLE_HOME[normalizeRole(role)] || '/login';
}

function PublicOnly({ children }) {
	const { token, user } = useAuth();
	if (token && user) {
		return <Navigate to={roleHome(user.role)} replace />;
	}
	return children;
}

function ProtectedLayout() {
	const { token, user } = useAuth();
	if (!token || !user) {
		return <Navigate to="/login" replace />;
	}
	return <AppShell />;
}

function RoleGuard({ allowedRoles, children }) {
	const { user } = useAuth();
	if (!user) {
		return <Navigate to="/login" replace />;
	}
	if (!allowedRoles.includes(normalizeRole(user.role))) {
		return <Navigate to={roleHome(user.role)} replace />;
	}
	return children;
}

function RootRedirect() {
	const { token, user } = useAuth();
	if (token && user) {
		return <Navigate to={roleHome(user.role)} replace />;
	}
	return <Navigate to="/login" replace />;
}

export default function App() {
	return (
		<Routes>
			<Route
				path="/login"
				element={
					<PublicOnly>
						<LoginPage />
					</PublicOnly>
				}
			/>

			<Route path="/" element={<ProtectedLayout />}>
				<Route index element={<RootRedirect />} />

				<Route
					path="manager"
					element={
						<RoleGuard allowedRoles={['manager']}>
							<ManagerDashboard />
						</RoleGuard>
					}
				/>
				<Route
					path="manager/ports"
					element={
						<RoleGuard allowedRoles={['manager']}>
							<PortStatusBoard />
						</RoleGuard>
					}
				/>
				<Route
					path="manager/analytics"
					element={
						<RoleGuard allowedRoles={['manager']}>
							<AnalyticsPage />
						</RoleGuard>
					}
				/>
				<Route
					path="manager/shipments/:id"
					element={
						<RoleGuard allowedRoles={['manager']}>
							<ShipmentDetail />
						</RoleGuard>
					}
				/>
				<Route
					path="manager/offers"
					element={
						<RoleGuard allowedRoles={['manager']}>
							<ManagerOfferConsole />
						</RoleGuard>
					}
				/>

				<Route
					path="shipper"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperOrders />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/orders"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperOrders />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/create"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<CreateShipment />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/chat"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperChat />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/live-map"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperLiveMap />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/alerts"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperAlerts />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/documents"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperDocuments />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/spending"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperSpending />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/addresses"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperAddresses />
						</RoleGuard>
					}
				/>
				<Route
					path="shipper/shipments/:id"
					element={
						<RoleGuard allowedRoles={['shipper']}>
						<OrderDetail />
						</RoleGuard>
					}
				/>

				<Route
					path="driver"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/assignment"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="assignment" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/details"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="details" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/navigation"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="navigation" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/status-update"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="status-update" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/alerts"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="alerts" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/chat"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="chat" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/emergency"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="emergency" />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/profile"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<DriverDashboard initialTab="profile" />
						</RoleGuard>
					}
				/>
				<Route path="driver/status" element={<Navigate to="/driver/status-update" replace />} />
				<Route path="driver/my-tasks" element={<Navigate to="/driver" replace />} />
				<Route path="driver/pickup" element={<Navigate to="/driver/details" replace />} />
				<Route path="driver/navigate" element={<Navigate to="/driver/navigation" replace />} />
				<Route path="driver/route-change" element={<Navigate to="/driver/navigation" replace />} />
				<Route path="driver/route-change/:id" element={<Navigate to="/driver/navigation" replace />} />

				<Route
					path="receiver"
					element={
						<RoleGuard allowedRoles={['receiver']}>
							<ReceiverDashboard />
						</RoleGuard>
					}
				/>
			<Route
				path="receiver/track"
				element={
					<RoleGuard allowedRoles={['receiver']}>
						<ReceiverDashboard initialTab="track" />
					</RoleGuard>
				}
			/>
			<Route path="receiver/create-order" element={<Navigate to="/receiver/track" replace />} />
			<Route path="receiver/search-monitor" element={<Navigate to="/receiver/track" replace />} />
			<Route
				path="receiver/alerts"
				element={
					<RoleGuard allowedRoles={['receiver']}>
						<ReceiverDashboard initialTab="alerts" />
					</RoleGuard>
				}
			/>
			<Route
					path="receiver/shipments/:id"
					element={
						<RoleGuard allowedRoles={['receiver']}>
							<ReceiverOrderDetail />
						</RoleGuard>
					}
				/>
				<Route
					path="receiver/shipments/:id/confirm"
					element={
						<RoleGuard allowedRoles={['receiver']}>
							<ConfirmDelivery />
						</RoleGuard>
					}
				/>
			</Route>

			<Route path="*" element={<RootRedirect />} />
		</Routes>
	);
}

