export default function RiskDot({ level = 'low' }) {
	const normalizedLevel = ['low', 'medium', 'high', 'critical'].includes(level) ? level : 'low';
	return <span className={`risk-dot ${normalizedLevel}`} title={`Risk ${normalizedLevel}`} />;
}
