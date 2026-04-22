const STEP_ORDER = [
	{ key: 'created', label: 'Created' },
	{ key: 'picked_up', label: 'Picked Up' },
	{ key: 'in_transit', label: 'In Transit' },
	{ key: 'at_port', label: 'At Port' },
	{ key: 'customs_clearance', label: 'Customs Clearance' },
	{ key: 'delivered', label: 'Delivered' },
];

export default function StatusTimeline({ currentStatus = 'created', updates = [] }) {
	const currentIndex = STEP_ORDER.findIndex((step) => step.key === currentStatus);

	return (
		<div className="card">
			<h3 className="section-title">Status Timeline</h3>
			<div className="timeline">
				{STEP_ORDER.map((step, index) => {
					const isCompleted = currentIndex > index;
					const isCurrent = currentIndex === index;
					const update = updates.find((item) => item.status === step.key);
					return (
						<div
							className={`timeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
							key={step.key}
						>
							<div className="timeline-bullet" />
							<div>
								<div style={{ fontWeight: 600 }}>{step.label}</div>
								<div className="page-subtitle mono">{update?.timestamp || (isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Pending')}</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
