import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';

const SEVERITY_ORDER = {
	critical: 4,
	high: 3,
	warning: 2,
	info: 1,
};

const SEVERITY_COLORS = {
	critical: 'var(--risk-critical)',
	high: 'var(--risk-high)',
	warning: 'var(--risk-medium)',
	info: 'var(--accent-primary)',
};

export function getAlertRank(alert) {
	return SEVERITY_ORDER[alert?.severity] || 0;
}

export default function AlertCard({ alert, onResolve }) {
	const navigate = useNavigate();
	const color = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
	const ago = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });

	return (
		<div
			className={`alert-card${alert.is_read ? '' : ' unread'}`}
			style={{ borderLeft: `4px solid ${color}` }}
		>
			<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
				<div>
					<div className="mono" style={{ fontWeight: 700 }}>
						{alert.shipment_id}
					</div>
					<div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
						{alert.tracking_number}
					</div>
				</div>
				<span className="timestamp" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
					{ago}
				</span>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color }}>
				{alert.severity === 'critical' ? <AlertTriangle size={14} /> : <Bell size={14} />}
				<span style={{ fontSize: 12, textTransform: 'capitalize' }}>{alert.alert_type.replace(/_/g, ' ')}</span>
			</div>

			<p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 10 }}>
				{alert.message.length > 170 ? `${alert.message.slice(0, 170)}...` : alert.message}
			</p>

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
				<Badge level={alert.severity === 'warning' ? 'medium' : alert.severity} size="sm">
					Risk {alert.risk_score_at_alert}
				</Badge>
				<div style={{ display: 'flex', gap: 6 }}>
					<button
						type="button"
						className="btn-outline"
						onClick={() => navigate(`/manager/shipments/${alert.shipment_id}`)}
					>
						View Details
					</button>
					<button type="button" className="btn-success" onClick={() => onResolve?.(alert.alert_id)}>
						<CheckCircle2 size={14} />
						Resolve
					</button>
				</div>
			</div>
		</div>
	);
}
