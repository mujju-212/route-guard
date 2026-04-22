export default function TrackingGraphic() {
	return (
		<div className="portal-auth__tracking-graphic" aria-hidden>
			<svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid slice">
				<defs>
					<pattern id="portal-auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
						<path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--portal-card-border)" strokeWidth="1" />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#portal-auth-grid)" />

				<path d="M -50 80 Q 150 20 350 100 T 650 70" className="portal-auth__tg-path-bg" />
				<path d="M -50 80 Q 150 20 350 100 T 650 70" className="portal-auth__tg-path" />
				<path d="M -50 180 Q 250 240 450 160 T 650 180" className="portal-auth__tg-path-bg" />
				<path d="M -50 180 Q 250 240 450 160 T 650 180" className="portal-auth__tg-path" />

				<circle cx="150" cy="56" r="6" className="portal-auth__tg-node" />
				<circle cx="150" cy="56" r="18" className="portal-auth__tg-pulse">
					<animate attributeName="r" values="6;24" dur="2s" repeatCount="indefinite" />
					<animate attributeName="opacity" values="0.4;0" dur="2s" repeatCount="indefinite" />
				</circle>

				<circle cx="350" cy="100" r="6" className="portal-auth__tg-node" />
				<circle cx="350" cy="100" r="18" className="portal-auth__tg-pulse">
					<animate attributeName="r" values="6;24" dur="2.5s" repeatCount="indefinite" />
					<animate attributeName="opacity" values="0.4;0" dur="2.5s" repeatCount="indefinite" />
				</circle>

				<circle cx="250" cy="210" r="6" className="portal-auth__tg-node" />
				<circle cx="250" cy="210" r="18" className="portal-auth__tg-pulse">
					<animate attributeName="r" values="6;24" dur="3s" repeatCount="indefinite" />
					<animate attributeName="opacity" values="0.4;0" dur="3s" repeatCount="indefinite" />
				</circle>

				<circle cx="450" cy="160" r="6" className="portal-auth__tg-node" />
				<circle cx="450" cy="160" r="18" className="portal-auth__tg-pulse">
					<animate attributeName="r" values="6;24" dur="2.2s" repeatCount="indefinite" />
					<animate attributeName="opacity" values="0.4;0" dur="2.2s" repeatCount="indefinite" />
				</circle>

				<g className="portal-auth__tg-vehicle">
					<svg x="-20" y="-20" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M1 3h15v13H1z" />
						<path d="M16 8h4l3 3v5h-7V8z" />
						<circle cx="5.5" cy="18.5" r="2.5" />
						<circle cx="18.5" cy="18.5" r="2.5" />
					</svg>
					<animateMotion dur="12s" repeatCount="indefinite" path="M -50 80 Q 150 20 350 100 T 650 70" />
				</g>

				<g className="portal-auth__tg-vehicle">
					<svg x="-24" y="-24" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M2 20h20" />
						<path d="M5 16h14l-1.4-6H6.4L5 16z" />
						<path d="M8 10V4h8v6" />
						<path d="M12 4v6" />
					</svg>
					<animateMotion dur="18s" repeatCount="indefinite" path="M -50 180 Q 250 240 450 160 T 650 180" />
				</g>
			</svg>
		</div>
	);
}
