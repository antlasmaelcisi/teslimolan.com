import { useEffect, useLayoutEffect, useRef } from 'react';

// Header logo: on hover the ÷ turns (≈225°) into a ×, the seven boxes round "19" run a blue → red → yellow → green wave
// clockwise, the body takes each colour as it leaves the last box, and ends black (light theme) once the green has gone.

type Vec = [number, number];
type Piece = { c: Vec; a: number; L: Vec[]; f: number; s: number };
type Pair = { from: Piece; c1: Vec; turn: number; L1: Vec[]; r0: number; r1: number; p0: number; p1: number };

const CY = 296.5;                         // horizon line of the logo's perspective
const PIVOT: Vec = [190, CY];             // rotation centre (centre of the ×)
const SPIN = 180;                         // extra half turn on top of the ÷→× angle
// perspective = vertical scale that grows with x: k(x) = 1 + s·(x − 190); strong for the ÷ bar, mild for the ×
const S_DIV = (14 / 152) / 21.5, S_CROSS = 0.000485;
const k = (x: number, s: number) => 1 + s * (x - PIVOT[0]);
const toFlat = ([x, y]: Vec, s: number): Vec => [x, CY + (y - CY) / k(x, s)];
const toScreen = ([x, y]: Vec, s: number): Vec => [x, CY + (y - CY) * k(x, s)];
const deg = (r: number) => r * 180 / Math.PI, rad = (d: number) => d * Math.PI / 180;
const lerp = (u: number, v: number, t: number) => u + (v - u) * t;
const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- start (÷): the bar carries the strong perspective; the dots are plain upright ellipses
// (a box rounded by half of each side is exactly its inscribed ellipse)
const box = (hs: number, hp: number): Vec[] => [[hs, hp], [-hs, hp], [-hs, -hp], [hs, -hp]];
const divBar: Piece = { c: [190, CY], a: 0, L: box(76, 21.5), f: 0, s: S_DIV };
const divDot = (cy: number): Piece => ({ c: [202, cy], a: 90, L: box(28.5, 25), f: 0.5, s: 0 });

// ---- end (×): the exact quads of the two arms, in the ×'s own flat plane
const CROSS_D = 'M140.007 209.097L186.591 263.387L235.891 204L266 237.068L215.004 296.5L266 355.932L235.891 389L186.591 329.613L140.007 383.903L114 350.829L159.101 296.5L114 242.171L140.007 209.097Z';
const X: Vec[] = ([[140.007, 209.097], [186.591, 263.387], [235.891, 204], [266, 237.068], [215.004, 296.5], [266, 355.932], [235.891, 389], [186.591, 329.613], [140.007, 383.903], [114, 350.829], [159.101, 296.5], [114, 242.171]] as Vec[]).map(p => toFlat(p, S_CROSS));
const P = (i: number) => X[i - 1], mid = (u: Vec, v: Vec): Vec => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
const M1 = mid(P(3), P(10)), M2 = mid(P(4), P(9));
const armA = [P(1), P(6), P(7), P(12)];
const halfTR = [P(3), P(4), M2, M1], halfBL = [M1, M2, P(9), P(10)];
const centroid = (q: Vec[]): Vec => q.reduce<Vec>((m, p) => [m[0] + p[0] / q.length, m[1] + p[1] / q.length], [0, 0]);
const ang = (u: Vec, v: Vec) => deg(Math.atan2(v[1] - u[1], v[0] - u[0]));
const angA = (ang(P(1), P(6)) + ang(P(12), P(7))) / 2;
const angB = (ang(P(3), P(10)) + ang(P(4), P(9))) / 2;

const local = (q: Vec, c: Vec, a: number): Vec => { const ux = Math.cos(rad(a)), uy = Math.sin(rad(a)), dx = q[0] - c[0], dy = q[1] - c[1]; return [dx * ux + dy * uy, -dx * uy + dy * ux]; };
// an end quad in the end frame, corners ordered like box(): (+,+), (−,+), (−,−), (+,−)
function endLocal(quad: Vec[], c: Vec, a: number): Vec[] {
  const L = quad.map(q => local(q, c, a)), out: Vec[] = [];
  L.forEach(v => { out[v[0] >= 0 ? (v[1] >= 0 ? 0 : 3) : (v[1] >= 0 ? 1 : 2)] = v; });
  return out.filter(Boolean).length === 4 ? out : L;
}
const polar = (c: Vec): Vec => [Math.hypot(c[0] - PIVOT[0], c[1] - PIVOT[1]), deg(Math.atan2(c[1] - PIVOT[1], c[0] - PIVOT[0]))];
const near = (b: number, target: number) => b + 360 * Math.round((target - b) / 360);
function pair(from: Piece, quad: Vec[], axis: number): Pair {
  const turn = near(axis, from.a + 40) + SPIN - from.a;             // clockwise: about 40° plus a half turn
  const c1 = centroid(quad), [r0, p0] = polar(from.c), [r1, p1] = polar(c1);
  return { from, c1, turn, L1: endLocal(quad, c1, from.a + turn), r0, r1, p0, p1: near(p1, p0 + turn) };
}
const BAR = pair(divBar, armA, angA);
const TOP = divDot(CY - 64), BOT = divDot(CY + 64);
const landTop = polar(TOP.c)[1] + (near(angB, 130) + SPIN - 90);
const miss = (q: Vec[]) => Math.abs(near(polar(centroid(q))[1], landTop) - landTop);
const topQuad = miss(halfBL) < miss(halfTR) ? halfBL : halfTR, botQuad = topQuad === halfBL ? halfTR : halfBL;
const DOT1 = pair(TOP, topQuad, angB), DOT2 = pair(BOT, botQuad, angB);

function outline(pr: Pair, e: number): string {
  const rr = lerp(pr.r0, pr.r1, e), pa = rad(lerp(pr.p0, pr.p1, e));
  const c: Vec = pr.r0 < 2 && pr.r1 < 2 ? [lerp(pr.from.c[0], pr.c1[0], e), lerp(pr.from.c[1], pr.c1[1], e)] : [PIVOT[0] + rr * Math.cos(pa), PIVOT[1] + rr * Math.sin(pa)];
  const a = pr.from.a + pr.turn * e, ux = Math.cos(rad(a)), uy = Math.sin(rad(a));
  const W = pr.from.L.map((v, i): Vec => { const ls = lerp(v[0], pr.L1[i][0], e), lp = lerp(v[1], pr.L1[i][1], e); return [c[0] + ux * ls - uy * lp, c[1] + uy * ls + ux * lp]; });
  const f = pr.from.f * (1 - smooth(0, 0.75, e)), s = lerp(pr.from.s, S_CROSS, e), pts: Vec[] = [];
  for (let i = 0; i < 4; i++) {
    const Q = W[i], A = W[(i + 3) % 4], B = W[(i + 1) % 4];
    if (f < 1e-4) { pts.push(Q); continue; }
    // elliptic fillet: an affine quarter circle from f along QA to f along QB
    const ax = (A[0] - Q[0]) * f, ay = (A[1] - Q[1]) * f, bx = (B[0] - Q[0]) * f, by = (B[1] - Q[1]) * f;
    const O: Vec = [Q[0] + ax + bx, Q[1] + ay + by];
    for (let j = 0; j <= 12; j++) { const th = Math.PI / 2 * j / 12, cs = Math.cos(th), sn = Math.sin(th); pts.push([O[0] - bx * cs - ax * sn, O[1] - by * cs - ay * sn]); }
  }
  return pts.map(q => toScreen(q, s)).map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
}

// ---- colours (site palette)
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb = (c: number[]) => 'rgb(' + c.map(Math.round).join(',') + ')';
const mixRGB = (a: number[], b: number[], x: number) => a.map((v, i) => v + (b[i] - v) * x);
const WAVE_COLORS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'].map(hex); // blue, red, yellow, green
const WAVE_END = 0.8;                     // the wave runs over the first 80 % of the move
const BOXES = 7;                          // clockwise from the top left
const STEPS = (BOXES - 1) + WAVE_COLORS.length;                      // last box starts at step 6 and turns green at step 10
const atStep = (n: number) => n / STEPS * WAVE_END;
const GREEN_GONE = 0.935, FLIP = 0.025;   // green leaves the boxes around here; each colour flip lasts ±FLIP

const DURATION = 750;

export default function AnimatedLogo({ isDark, active, className }: { isDark: boolean; active: boolean; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const state = useRef({ t: 0, target: 0, last: 0, raf: 0 });

  const body = isDark ? '#ffffff' : '#1F7144';      // the logo's own colour in each theme
  const paper = isDark ? '#1c1c1e' : '#ffffff';     // page colour behind the white parts
  const final = isDark ? '#ffffff' : '#000000';     // where the body ends on hover

  const draw = useRef<(t: number) => void>(() => {});
  draw.current = (t: number) => {
    const svg = svgRef.current; if (!svg) return;
    const q = (sel: string) => svg.querySelector(sel) as SVGElement;
    const e = ease(t);
    q('[data-p="bar"]').setAttribute('points', outline(BAR, e));
    q('[data-p="dot1"]').setAttribute('points', outline(DOT1, e));
    q('[data-p="dot2"]').setAttribute('points', outline(DOT2, e));
    q('[data-g="divide"]').setAttribute('opacity', e <= 0 ? '1' : '0');
    q('[data-g="cross"]').setAttribute('opacity', e >= 1 ? '1' : '0');
    q('[data-g="morph"]').setAttribute('opacity', e <= 0 || e >= 1 ? '0' : '1');

    const BODY = hex(body), FINAL = hex(final), wave = [BODY, ...WAVE_COLORS];
    const step = Math.min(t / WAVE_END, 1) * STEPS, boxEnd = smooth(GREEN_GONE - FLIP, GREEN_GONE + FLIP, t);
    for (let i = 0; i < BOXES; i++) {
      const ph = Math.min(Math.max(step - i, 0), wave.length - 1), j = Math.min(Math.floor(ph), wave.length - 2);
      const c = mixRGB(wave[j], wave[j + 1], smooth(0, 1, ph - j));
      q(`[data-box="${i}"]`).setAttribute('fill', rgb(mixRGB(c, FINAL, boxEnd)));
    }
    // the body takes each colour the moment it leaves the last box, and the final colour when the green leaves
    let col = BODY;
    for (const [at, to] of [[atStep(8), WAVE_COLORS[0]], [atStep(9), WAVE_COLORS[1]], [atStep(10), WAVE_COLORS[2]], [GREEN_GONE, FINAL]] as [number, number[]][])
      col = mixRGB(col, to, smooth(at - FLIP, at + FLIP, t));
    const fill = rgb(col);
    svg.querySelectorAll('[data-body]').forEach(n => n.setAttribute('fill', fill));
  };

  useLayoutEffect(() => { draw.current(state.current.t); }, [isDark]);

  useEffect(() => {
    const st = state.current;
    st.target = active ? 1 : 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { st.t = st.target; draw.current(st.t); return; }
    const tick = (now: number) => {
      const dt = st.last ? Math.min(now - st.last, 40) : 16; st.last = now;
      st.t = st.target > st.t ? Math.min(st.target, st.t + dt / DURATION) : Math.max(st.target, st.t - dt / DURATION);
      draw.current(st.t);
      if (st.t !== st.target) st.raf = requestAnimationFrame(tick); else { st.raf = 0; st.last = 0; }
    };
    if (!st.raf) st.raf = requestAnimationFrame(tick);
  }, [active]);

  useEffect(() => () => { cancelAnimationFrame(state.current.raf); }, []);

  return (
    <svg ref={svgRef} className={className} viewBox="0 0 632 592" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="361" y="78" width="247" height="437" fill={paper} />
      <path data-body d="M0 59L361 2C361 232.019 361 360.981 361 591L0 534V59Z" fill={body} />
      <rect data-body x="342" y="515" width="285" height="19" rx="9.5" fill={body} />
      <rect data-body x="342" y="59" width="285" height="19" rx="9.5" fill={body} />
      <path data-box="0" d="M361 116H456V173H361V116Z" fill={body} />
      <rect data-box="1" x="475" y="116" width="95" height="57" fill={body} />
      <rect data-box="2" x="475" y="192" width="95" height="57" fill={body} />
      <rect data-box="3" x="475" y="268" width="95" height="57" fill={body} />
      <rect data-box="4" x="475" y="344" width="95" height="57" fill={body} />
      <rect data-box="5" x="475" y="420" width="95" height="57" fill={body} />
      <rect data-box="6" x="361" y="420" width="95" height="57" fill={body} />
      <path data-body d="M608 68.5C608 63.2533 612.253 59 617.5 59C622.747 59 627 63.2533 627 68.5V524.5C627 529.747 622.747 534 617.5 534C612.253 534 608 529.747 608 524.5V68.5Z" fill={body} />
      <rect x="266" y="173" width="190" height="247" fill={paper} />
      <g data-g="divide" fill={paper}>
        <ellipse cx="202" cy="360.5" rx="25" ry="28.5" />
        <ellipse cx="202" cy="232.5" rx="25" ry="28.5" />
        <path d="M114 282L266 268V325L114 311V282Z" />
      </g>
      <g data-g="morph" fill={paper} opacity="0">
        <polygon data-p="bar" /><polygon data-p="dot1" /><polygon data-p="dot2" />
      </g>
      <path data-g="cross" opacity="0" fill={paper} d={CROSS_D} />
      <path data-body d="M329.234 192V401H289.223V226.505H266V192H329.234Z" fill={body} />
      <path data-body d="M386.33 192H420.466C444.155 192 456 204.049 456 228.148V364.524C456 388.841 444.155 401 420.466 401H388.009C364.32 401 352.475 388.841 352.475 364.524V337.577H391.367V358.28C391.367 363.757 393.885 366.495 398.921 366.495H409.554C414.403 366.495 416.828 363.757 416.828 358.28V318.517H386.33C362.641 318.517 350.796 306.468 350.796 282.369V228.148C350.796 204.049 362.641 192 386.33 192ZM397.522 286.313H416.828V234.72C416.828 229.243 414.403 226.505 409.554 226.505H397.522C392.486 226.505 389.968 229.243 389.968 234.72V278.097C389.968 281.165 390.527 283.355 391.647 284.67C392.766 285.765 394.724 286.313 397.522 286.313Z" fill={body} />
    </svg>
  );
}
