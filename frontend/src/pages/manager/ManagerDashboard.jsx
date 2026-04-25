import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import MissionControl from './MissionControl';
import AnalyticsPage from './AnalyticsPage';
import AlertCenter from './AlertCenter';
import ConsignmentRequests from './ConsignmentRequests';
import ActiveConsignments from './ActiveConsignments';
import DriverManagement from './DriverManagement';
import FleetManagement from './FleetManagement';
import CargoTrackMap from '../../components/map/CargoTrackMap';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';
  const isMap = tab === 'shipments';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMap ? 'calc(100vh - 56px)' : 'auto' }}>
      {tab === 'dashboard'    && <MissionControl user={user} />}
      {tab === 'shipments'    && <div style={{ flex: 1, minHeight: 0 }}><CargoTrackMap /></div>}
      {tab === 'alerts'       && <AlertCenter />}
      {tab === 'requests'     && <ConsignmentRequests />}
      {tab === 'consignments' && <ActiveConsignments />}
      {tab === 'drivers'      && <DriverManagement />}
      {tab === 'fleet'        && <FleetManagement />}
      {tab === 'analytics'    && <AnalyticsPage embedded />}
    </div>
  );
}
