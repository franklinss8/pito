"use client";
import { useEffect, useRef } from "react";

/** Wireframe thumbnail generated from the token address: the same token always gets the same shape. */
export function MachineArt({ seed, className = "art" }: { seed: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const fg = css("--fg") || "#EDEBE3", acc = css("--acc") || "#C6F24A";
    let h = 2166136261;
    for (const ch of seed.toLowerCase()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const kind = Math.floor(rnd() * 4); // 0 lattice, 1 torus, 2 sphere, 3 column
    const rot = rnd() * 6.28, tilt = 0.35 + rnd() * 0.5;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect(); const W = r.width || 300, H = r.height || 234;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = Math.min(W, H) * 0.36;
    const P = (x: number, y: number, z: number) => {
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const rx = x * cs - z * sn, rz = x * sn + z * cs;
      const ry = y * Math.cos(tilt) - rz * Math.sin(tilt), rz2 = y * Math.sin(tilt) + rz * Math.cos(tilt);
      const d = 1 / (1 + rz2 * 0.25);
      return { X: W / 2 + rx * S * d, Y: H / 2 + ry * S * d, d };
    };
    const pts: [number, number, number][] = [];
    const edges: [number, number][] = [];
    if (kind === 0) {
      const n = 4;
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) pts.push([(x - 1.5) * 0.55, (y - 1.5) * 0.55, (z - 1.5) * 0.55]);
      const idx = (x: number, y: number, z: number) => x * n * n + y * n + z;
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
        if (x < n - 1 && rnd() < 0.7) edges.push([idx(x, y, z), idx(x + 1, y, z)]);
        if (y < n - 1 && rnd() < 0.7) edges.push([idx(x, y, z), idx(x, y + 1, z)]);
        if (z < n - 1 && rnd() < 0.7) edges.push([idx(x, y, z), idx(x, y, z + 1)]);
      }
    } else if (kind === 1) {
      const M = 28, N = 10;
      for (let i = 0; i < M; i++) for (let j = 0; j < N; j++) {
        const a = (i / M) * 6.283, b = (j / N) * 6.283;
        pts.push([(1 + 0.38 * Math.cos(b)) * Math.cos(a), 0.38 * Math.sin(b), (1 + 0.38 * Math.cos(b)) * Math.sin(a)]);
        edges.push([i * N + j, ((i + 1) % M) * N + j], [i * N + j, i * N + ((j + 1) % N)]);
      }
    } else if (kind === 2) {
      const M = 18, N = 12;
      for (let i = 0; i <= M; i++) for (let j = 0; j < N; j++) {
        const a = (i / M) * 3.1416, b = (j / N) * 6.283;
        pts.push([Math.sin(a) * Math.cos(b) * 1.1, Math.cos(a) * 1.1, Math.sin(a) * Math.sin(b) * 1.1]);
        if (i < M) edges.push([i * N + j, (i + 1) * N + j]);
        if (i % 3 === 0) edges.push([i * N + j, i * N + ((j + 1) % N)]);
      }
    } else {
      const L = 7;
      for (let k = 0; k < L; k++) {
        const y = -1.2 + (k / (L - 1)) * 2.4, s = 0.35 + 0.35 * Math.abs(Math.sin(k * 1.3 + rot));
        const b = pts.length;
        pts.push([-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]);
        edges.push([b, b + 1], [b + 1, b + 2], [b + 2, b + 3], [b + 3, b]);
        if (k) edges.push([b, b - 4], [b + 1, b - 3], [b + 2, b - 2], [b + 3, b - 1]);
      }
    }
    const pr = pts.map(([x, y, z]) => P(x, y, z));
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    edges.forEach(([a, b], i) => {
      ctx.strokeStyle = i % 7 === 0 ? acc : fg; ctx.globalAlpha = (i % 7 === 0 ? 0.8 : 0.35) * Math.min(pr[a].d, pr[b].d);
      ctx.beginPath(); ctx.moveTo(pr[a].X, pr[a].Y); ctx.lineTo(pr[b].X, pr[b].Y); ctx.stroke();
    });
    pr.forEach((p, i) => { ctx.globalAlpha = 0.9 * p.d; ctx.fillStyle = i % 9 === 0 ? acc : fg; ctx.fillRect(p.X - 1, p.Y - 1, 2, 2); });
    for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.2 + rnd() * 0.5; ctx.fillStyle = rnd() < 0.15 ? acc : fg; ctx.fillRect(rnd() * W, rnd() * H, 1, 1); }
    ctx.globalAlpha = 1;
  }, [seed]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
