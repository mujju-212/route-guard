import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Badge({ level = 'low', size = 'md', showIcon = false, children }) {
	const normalizedLevel = ['low', 'medium', 'high', 'critical'].includes(level) ? level : 'low';
	const normalizedSize = ['sm', 'md', 'lg'].includes(size) ? size : 'md';

	return (
		<span className={`badge badge-${normalizedLevel} badge-${normalizedSize}`}>
			{showIcon && normalizedLevel === 'critical' ? <AlertTriangle size={12} /> : null}
			{showIcon && normalizedLevel === 'low' ? <CheckCircle2 size={12} /> : null}
			{children || normalizedLevel}
		</span>
	);
}
