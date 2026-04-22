const SIZE_MAP = {
	sm: 16,
	md: 24,
	lg: 40,
};

export default function Spinner({ size = 'md', color = 'var(--accent-primary)' }) {
	const pixelSize = SIZE_MAP[size] || SIZE_MAP.md;
	return (
		<span
			className="spinner"
			style={{
				width: pixelSize,
				height: pixelSize,
				borderWidth: Math.max(2, Math.floor(pixelSize / 8)),
				borderTopColor: color,
			}}
		/>
	);
}
