import { useEffect, useRef } from 'react';

/**
 * Animated logistics network canvas — draws a living, breathing
 * supply-chain map with glowing nodes, particle trails, and flowing
 * route connections.
 */
export default function TrackingGraphic() {
	const containerRef = useRef(null);
	const canvasRef = useRef(null);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!canvas || !container) return;
		const ctx = canvas.getContext('2d');
		let animId;
		let W = 600, H = 260;

		const accent = '#facc15';
		const cyan = '#22d3ee';

		/* ── nodes (normalized 0→1) ──────────────────────────────────── */
		const nodes = [
			{ x: 0.08, y: 0.22, r: 5, label: 'SHA', color: accent },
			{ x: 0.28, y: 0.50, r: 4, label: 'SIN', color: cyan },
			{ x: 0.52, y: 0.20, r: 5, label: 'DXB', color: accent },
			{ x: 0.72, y: 0.58, r: 5, label: 'HAM', color: cyan },
			{ x: 0.92, y: 0.28, r: 5, label: 'RTM', color: accent },
			{ x: 0.42, y: 0.78, r: 4, label: 'CMB', color: cyan },
			{ x: 0.82, y: 0.82, r: 4, label: 'NYC', color: accent },
			{ x: 0.14, y: 0.78, r: 4, label: 'BOM', color: cyan },
		];

		/* ── edges (node index pairs + curve offset) ─────────────────── */
		const edges = [
			[0, 2, -0.12], [2, 4, 0.10], [0, 1, 0.06],
			[1, 3, -0.08], [3, 4, 0.12], [1, 5, 0.06],
			[5, 6, -0.08], [3, 6, 0.05], [7, 5, -0.06],
			[0, 7, 0.08], [2, 3, -0.06],
		];

		/* ── particles ───────────────────────────────────────────────── */
		const particles = [];
		for (let i = 0; i < 16; i++) {
			particles.push({
				edgeIdx: Math.floor(Math.random() * edges.length),
				t: Math.random(),
				speed: 0.002 + Math.random() * 0.003,
				size: 1.5 + Math.random() * 2,
				isGold: Math.random() > 0.4,
				trail: [],
			});
		}

		/* ── node pulse state ────────────────────────────────────────── */
		const pulsePhases = nodes.map(() => Math.random() * Math.PI * 2);

		function resize() {
			const rect = container.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			W = Math.max(rect.width, 200);
			H = Math.max(rect.height, 100);
			canvas.width = W * dpr;
			canvas.height = H * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		resize();

		/* Watch for size changes (handles the slide-in panel case) */
		const ro = new ResizeObserver(() => resize());
		ro.observe(container);

		function bezier(p0, p1, cp, t) {
			const m = 1 - t;
			return { x: m * m * p0.x + 2 * m * t * cp.x + t * t * p1.x, y: m * m * p0.y + 2 * m * t * cp.y + t * t * p1.y };
		}

		function edgePts(idx) {
			const [i0, i1, off] = edges[idx];
			const a = nodes[i0], b = nodes[i1];
			const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
			const dx = b.x - a.x, dy = b.y - a.y;
			return {
				p0: { x: a.x * W, y: a.y * H },
				p1: { x: b.x * W, y: b.y * H },
				cp: { x: (mx - dy * off) * W, y: (my + dx * off) * H },
			};
		}

		let time = 0;

		function draw() {
			time += 0.016;
			ctx.clearRect(0, 0, W, H);

			/* ── subtle grid ─────────────────────────────────────────── */
			ctx.strokeStyle = 'rgba(255,255,255,0.025)';
			ctx.lineWidth = 0.5;
			for (let gx = 0; gx < W; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
			for (let gy = 0; gy < H; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

			/* ── edges ───────────────────────────────────────────────── */
			for (let i = 0; i < edges.length; i++) {
				const { p0, p1, cp } = edgePts(i);
				// soft glow behind
				ctx.strokeStyle = 'rgba(250,204,21,0.05)';
				ctx.lineWidth = 8;
				ctx.setLineDash([]);
				ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y); ctx.stroke();
				// dashed route
				ctx.strokeStyle = 'rgba(250,204,21,0.2)';
				ctx.lineWidth = 1.5;
				ctx.setLineDash([6, 5]);
				ctx.lineDashOffset = -time * 18;
				ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y); ctx.stroke();
				ctx.setLineDash([]);
			}

			/* ── particles ───────────────────────────────────────────── */
			for (const p of particles) {
				p.t += p.speed;
				if (p.t > 1) { p.edgeIdx = Math.floor(Math.random() * edges.length); p.t = 0; p.trail = []; }
				const { p0, p1, cp } = edgePts(p.edgeIdx);
				const pos = bezier(p0, p1, cp, p.t);
				p.trail.push({ x: pos.x, y: pos.y });
				if (p.trail.length > 14) p.trail.shift();

				const col = p.isGold ? accent : cyan;
				// trail
				for (let j = 0; j < p.trail.length; j++) {
					const a = (j / p.trail.length) * 0.45;
					ctx.globalAlpha = a;
					ctx.beginPath();
					ctx.arc(p.trail[j].x, p.trail[j].y, p.size * (j / p.trail.length) * 0.8, 0, Math.PI * 2);
					ctx.fillStyle = col;
					ctx.fill();
				}
				ctx.globalAlpha = 1;
				// glow
				const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, p.size + 5);
				grd.addColorStop(0, col === accent ? 'rgba(250,204,21,0.5)' : 'rgba(34,211,238,0.5)');
				grd.addColorStop(1, 'transparent');
				ctx.beginPath(); ctx.arc(pos.x, pos.y, p.size + 5, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
				// dot
				ctx.beginPath(); ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
			}

			/* ── nodes ───────────────────────────────────────────────── */
			for (let i = 0; i < nodes.length; i++) {
				const n = nodes[i];
				const nx = n.x * W, ny = n.y * H;
				pulsePhases[i] += 0.03;
				const pR = n.r + 10 + Math.sin(pulsePhases[i]) * 4;

				// pulse ring
				ctx.beginPath(); ctx.arc(nx, ny, pR, 0, Math.PI * 2);
				ctx.strokeStyle = n.color === accent ? 'rgba(250,204,21,0.12)' : 'rgba(34,211,238,0.12)';
				ctx.lineWidth = 1.5; ctx.stroke();
				// glow
				const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r + 14);
				g.addColorStop(0, n.color === accent ? 'rgba(250,204,21,0.3)' : 'rgba(34,211,238,0.3)');
				g.addColorStop(1, 'transparent');
				ctx.beginPath(); ctx.arc(nx, ny, n.r + 14, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
				// core
				ctx.beginPath(); ctx.arc(nx, ny, n.r, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill();
				// label
				if (n.label) {
					ctx.font = '600 8px Inter, system-ui, sans-serif';
					ctx.fillStyle = 'rgba(255,255,255,0.6)';
					ctx.textAlign = 'center';
					ctx.fillText(n.label, nx, ny + n.r + 13);
				}
			}

			/* ── watermark ───────────────────────────────────────────── */
			ctx.font = '500 9px monospace';
			ctx.fillStyle = 'rgba(250,204,21,0.35)';
			ctx.textAlign = 'left';
			ctx.fillText('ROUTEGUARD NETWORK · LIVE', 10, H - 8);

			animId = requestAnimationFrame(draw);
		}

		animId = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(animId);
			ro.disconnect();
		};
	}, []);

	return (
		<div ref={containerRef} className="portal-auth__tracking-graphic" aria-hidden style={{ position: 'relative' }}>
			<canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
		</div>
	);
}
