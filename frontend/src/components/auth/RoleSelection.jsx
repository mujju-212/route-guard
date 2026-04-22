import { ArrowRight } from 'lucide-react';

export default function RoleSelection({ roles, roleOrder, onSelect }) {
	return (
		<div className="portal-auth__role-screen" id="roleScreen">
			<div className="portal-auth__ambient-glow" />
			<div className="portal-auth__hero-text">
				<h1>Global View</h1>
				<p>Select your operational sector to access the command portal.</p>
			</div>

			<div className="portal-auth__role-grid">
				{roleOrder.map((roleKey) => {
					const role = roles[roleKey];
					const Icon = role.Icon;
					return (
						<button
							type="button"
							key={role.key}
							className="portal-auth__role-card"
							onClick={() => onSelect(role.key)}
						>
							<div className="portal-auth__card-header">
								<div className="portal-auth__role-icon">
									<Icon size={24} />
								</div>
								<div className="portal-auth__card-arrow">
									<ArrowRight size={20} />
								</div>
							</div>
							<h3>{role.cardTitle}</h3>
							<p>{role.cardDescription}</p>
						</button>
					);
				})}
			</div>
		</div>
	);
}
