export default function DemoModeBanner({ usingDummy }) {
	if (!usingDummy) return null;

	return (
		<div className="demo-mode-banner">
			<span>⚡</span>
			<span>Demo Mode — showing sample data. Start the backend to connect live data.</span>
		</div>
	);
}
