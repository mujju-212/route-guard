export default function StatCard({ icon: Icon, value, label, color }) {
	return (
		<div className="stat-card">
			<div className="stat-card__icon">{Icon ? <Icon size={20} /> : null}</div>
			<div>
				<div className="stat-card__value" style={color ? { color } : undefined}>
					{value}
				</div>
				<div className="stat-card__label">{label}</div>
			</div>
		</div>
	);
}
