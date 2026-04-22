import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/auth/LoginPage';
import DriverDashboard from './pages/driver/DriverDashboard';
import RouteChangeAlert from './pages/driver/RouteChangeAlert';
import StatusUpdate from './pages/driver/StatusUpdate';
import AnalyticsPage from './pages/manager/AnalyticsPage';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import PortStatusBoard from './pages/manager/PortStatusBoard';
import ShipmentDetail from './pages/manager/ShipmentDetail';
import ConfirmDelivery from './pages/receiver/ConfirmDelivery';
import ReceiverDashboard from './pages/receiver/ReceiverDashboard';
import TrackShipment from './pages/receiver/TrackShipment';
import CreateShipment from './pages/shipper/CreateShipment';
import ShipperDashboard from './pages/shipper/ShipperDashboard';
import ShipmentTracking from './pages/shipper/ShipmentTracking';

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
					path="shipper"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipperDashboard />
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
					path="shipper/shipments/:id"
					element={
						<RoleGuard allowedRoles={['shipper']}>
							<ShipmentTracking />
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
					path="driver/status"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<StatusUpdate />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/route-change"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<RouteChangeAlert />
						</RoleGuard>
					}
				/>
				<Route
					path="driver/route-change/:id"
					element={
						<RoleGuard allowedRoles={['driver']}>
							<RouteChangeAlert />
						</RoleGuard>
					}
				/>

				<Route
					path="receiver"
					element={
						<RoleGuard allowedRoles={['receiver']}>
							<ReceiverDashboard />
						</RoleGuard>
					}
				/>
				<Route
					path="receiver/shipments/:id"
					element={
						<RoleGuard allowedRoles={['receiver']}>
							<TrackShipment />
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
