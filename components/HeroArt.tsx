"use client";
import { useEffect, useRef } from "react";

/**
 * Generative wireframe: an isometric lattice of cubes over a perspective grid,
 * with particle streams and a slow green wave. Pure canvas, no assets.
 */
export function HeroArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    let W = 0, H = 0, raf = 0, t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const cubes: { x: number; y: number; z: number; s: number; r: number }[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < 26; i++) cubes.push({ x: rnd(-2.6, 2.6), y: rnd(-0.2, 1.6), z: rnd(-2.6, 2.6), s: rnd(0.12, 0.42), r: rnd(0, 6.28) });
    cubes.push({ x: 0, y: 0.9, z: 0, s: 1.05, r: 0 }, { x: 0, y: 0.9, z: 0, s: 0.72, r: 0.4 }, { x: 0, y: 0.9, z: 0, s: 0.4, r: 0.8 });
    const parts = Array.from({ length: 420 }, () => ({ x: rnd(-3, 3), y: rnd(-0.3, 2.4), z: rnd(-3, 3), v: rnd(0.002, 0.009) }));

    function resize() {
      const r = c!.getBoundingClientRect();
      W = r.width; H = r.height;
      c!.width = W * dpr; c!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const cx = () => W * (W > 960 ? 0.64 : 0.5), cy = () => H * (W > 960 ? 0.5 : 0.78), sc = () => Math.min(W, 1100) * (W > 960 ? 0.19 : 0.16);

    function proj(x: number, y: number, z: number, rot: number) {
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const rx = x * cs - z * sn, rz = x * sn + z * cs;
      const px = (rx - rz) * 0.866, pz = (rx + rz) * 0.5;
      const depth = 1 / (1 + (pz + 3) * 0.12);
      return { X: cx() + px * sc() * depth * 1.1, Y: cy() + (pz * 0.55 - y) * sc() * depth, d: depth };
    }

    function cube(cx0: number, cy0: number, cz0: number, s: number, rot: number, alpha: number, fg: string, acc: string) {
      const v: { X: number; Y: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const x = cx0 + ((i & 1) ? s : -s), y = cy0 + ((i & 2) ? s : -s), z = cz0 + ((i & 4) ? s : -s);
        v.push(proj(x, y, z, rot));
      }
      const E = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];
      ctx!.lineWidth = 1;
      E.forEach(([a, b], i) => {
        ctx!.strokeStyle = i % 5 === 0 ? acc : fg;
        ctx!.globalAlpha = alpha * (i % 5 === 0 ? 0.9 : 0.55);
        ctx!.beginPath(); ctx!.moveTo(v[a].X, v[a].Y); ctx!.lineTo(v[b].X, v[b].Y); ctx!.stroke();
      });
      ctx!.globalAlpha = alpha;
      ctx!.fillStyle = fg;
      v.forEach((p) => { ctx!.fillRect(p.X - 1, p.Y - 1, 2, 2); });
    }

    function frame() {
      const fg = css("--fg") || "#EDEBE3", acc = css("--acc") || "#C6F24A", line = css("--line") || "#262724";
      ctx!.clearRect(0, 0, W, H);
      const rot = t * 0.12;

      // floor grid
      ctx!.globalAlpha = 0.6; ctx!.strokeStyle = line; ctx!.lineWidth = 1;
      for (let i = -6; i <= 6; i++) {
        const a = proj(i * 0.6, 0, -3.6, rot), b = proj(i * 0.6, 0, 3.6, rot);
        ctx!.beginPath(); ctx!.moveTo(a.X, a.Y); ctx!.lineTo(b.X, b.Y); ctx!.stroke();
        const c2 = proj(-3.6, 0, i * 0.6, rot), d = proj(3.6, 0, i * 0.6, rot);
        ctx!.beginPath(); ctx!.moveTo(c2.X, c2.Y); ctx!.lineTo(d.X, d.Y); ctx!.stroke();
      }

      // green waves
      for (let w = 0; w < 3; w++) {
        ctx!.globalAlpha = 0.35 - w * 0.08; ctx!.strokeStyle = acc; ctx!.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = -3.4 + i * 0.085, z = 1.6 - w * 0.5;
          const y = 0.3 + Math.sin(i * 0.28 + t * 1.6 + w) * 0.28 * Math.sin(i * 0.06 + t * 0.4);
          const p = proj(x, y, z, rot); i ? ctx!.lineTo(p.X, p.Y) : ctx!.moveTo(p.X, p.Y);
        }
        ctx!.stroke();
      }

      // particles
      parts.forEach((p) => {
        if (!reduce) { p.y += p.v; if (p.y > 2.6) p.y = -0.3; }
        const q = proj(p.x, p.y, p.z, rot);
        ctx!.globalAlpha = 0.25 + q.d * 0.5;
        ctx!.fillStyle = Math.random() < 0.08 ? acc : fg;
        ctx!.fillRect(q.X, q.Y, 1.2, 1.2);
      });

      // cubes, far to near
      cubes
        .map((k) => ({ k, d: proj(k.x, k.y, k.z, rot).d }))
        .sort((a, b) => a.d - b.d)
        .forEach(({ k, d }) => cube(k.x, k.y, k.z, k.s, rot + k.r * 0.15, 0.35 + d * 0.6, fg, acc));

      // core beam
      const top = proj(0, 2.6, 0, rot), base = proj(0, 0.9, 0, rot);
      const g = ctx!.createLinearGradient(top.X, top.Y, base.X, base.Y);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, acc);
      ctx!.globalAlpha = 0.5; ctx!.strokeStyle = g; ctx!.lineWidth = 2;
      ctx!.beginPath(); ctx!.moveTo(top.X, top.Y); ctx!.lineTo(base.X, base.Y); ctx!.stroke();
      ctx!.globalAlpha = 1;

      if (!reduce) { t += 0.016; raf = requestAnimationFrame(frame); }
    }
    resize(); frame();
    const ro = new ResizeObserver(() => { resize(); if (reduce) frame(); });
    ro.observe(c);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
