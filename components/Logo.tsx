/** Pixel "P" mark and pixel wordmark, drawn from bitmaps so they stay crisp at any size. */
const MARK = [
  "XXXX..",
  "X..X..",
  "X..X..",
  "XXXX..",
  "X.....",
  "X...XX",
  "....XX",
];

const GLYPHS: Record<string, string[]> = {
  p: ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X...."],
  i: ["..X..", ".....", "..X..", "..X..", "..X..", "..X.."],
  t: ["..X..", ".XXX.", "..X..", "..X..", "..X..", "..XX."],
  o: [".....", ".XXX.", "X...X", "X...X", "X...X", ".XXX."],
};

function rects(rows: string[], ox = 0, oy = 0) {
  const out: JSX.Element[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === "X") out.push(<rect key={`${ox}-${x}-${y}`} x={ox + x} y={oy + y} width="1" height="1" />); }));
  return out;
}

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="-0.5 -0.5 7 8" width={size} height={size} aria-hidden="true" fill="var(--acc)" shapeRendering="crispEdges">
      {rects(MARK)}
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  const word = "pito";
  const cells: JSX.Element[] = [];
  let ox = 0;
  for (const ch of word) { cells.push(...rects(GLYPHS[ch], ox, 0)); ox += 6; }
  return (
    <svg viewBox="-0.5 -0.5 24 7" className={className} aria-label="pito" fill="var(--fg)" shapeRendering="crispEdges">
      {cells}
    </svg>
  );
}
