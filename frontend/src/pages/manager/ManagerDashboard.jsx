import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import MissionControl from './MissionControl';
import AnalyticsPage from './AnalyticsPage';
import AlertCenter from './AlertCenter';
import CargoTrackMap from '../../components/map/CargoTrackMap';

// No custom tabs — AppShell Sidebar handles all navigation
// This component only switches content based on ?tab= query param

function Placeholder({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, color: 'var(--text-muted, #8A9BB5)', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <h2 style={{ color: 'var(--text-primary, #F0F4FF)', fontSize: 20, fontWeight: 700 }}>{title}</h2>
      <p style={{ fontSize: 14 }}>{desc || 'Coming soon — say "continue" to build this page.'}</p>
    </div>
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';

  const isMap = tab === 'shipments';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMap ? 'calc(100vh - 56px)' : 'auto' }}>
      {tab === 'dashboard'     && <MissionControl user={user} />}
      {tab === 'shipments'     && <div style={{ flex: 1, minHeight: 0 }}><CargoTrackMap /></div>}
      {tab === 'alerts'        && <AlertCenter />}
      {tab === 'requests'      && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          <Placeholder icon="📋" title="Consignment Requests" desc="Review incoming sender requests in Offer Console and submit quotes." />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -80 }}>
            <button type="button" className="btn-primary" onClick={() => navigate('/manager/offers')}>
              Open Offer Console
            </button>
          </div>
        </div>
      )}
      {tab === 'consignments'  && <Placeholder icon="📦" title="Active Consignments" desc="Track all shipments with status filters and detail views." />}
      {tab === 'drivers'       && <Placeholder icon="👤" title="Driver Management" desc="Manage drivers, view applications, accept or reject." />}
      {tab === 'fleet'         && <Placeholder icon="🚢" title="Fleet Management" desc="Add vehicles/vessels and assign available drivers." />}
      {tab === 'analytics'     && <AnalyticsPage embedded />}
    </div>
  );
}
