import { BellOff } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import AlertCard, { getAlertRank } from './AlertCard';

function sortAlerts(alerts) {
	return [...alerts].sort((a, b) => {
		const severityDiff = getAlertRank(b) - getAlertRank(a);
		if (severityDiff !== 0) return severityDiff;
		return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
	});
}

export default function AlertPanel({ alerts = [], onResolve, onMarkAllRead }) {
	const sorted = sortAlerts(alerts);

	return (
		<div className="card" style={{ height: '100%' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
				<div>
					<h3 className="section-title" style={{ margin: 0 }}>
						Active Alerts
					</h3>
					<p className="page-subtitle">{sorted.length} unresolved</p>
				</div>
				<button type="button" className="btn-outline" onClick={onMarkAllRead}>
					Mark all read
				</button>
			</div>

			<div className="alert-panel">
				{sorted.length ? (
					sorted.map((alert) => <AlertCard key={alert.alert_id} alert={alert} onResolve={onResolve} />)
				) : (
					<EmptyState
						icon={BellOff}
						title="No active alerts"
						description="All shipments are currently nominal."
					/>
				)}
			</div>
		</div>
	);
}
