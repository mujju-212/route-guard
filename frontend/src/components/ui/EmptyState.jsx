export default function EmptyState({ icon: Icon, title, description, action }) {
	return (
		<div className="empty-state">
			{Icon ? <Icon size={42} /> : null}
			<h3>{title}</h3>
			<p>{description}</p>
			{action || null}
		</div>
	);
}
