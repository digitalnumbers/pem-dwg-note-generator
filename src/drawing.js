// To-scale cross-section renderer. Input: compute(...).geom. Output: SVG markup string.
// World units are inches. z = depth from the install face into the substrate (0 = install face).
// Near side: install face on top. Far side: drawing is flipped so the install face is at the bottom.
import { cap3, fmtThk } from './logic.js';

export const VB_W = 760;
let VB_H = 560;
const INK = '#1c1f23', MUTED = '#5c6066', BLUE = '#1d4f8f', PAPER = '#ffffff';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const f3 = v => { const s = v.toFixed(3); return s.startsWith('0.') ? s.slice(1) : s; };
const fT = v => fmtThk(v); // max 3 decimal places (v1.4)
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function drawSection(g, opts = {}) {
  if (!g || !Number.isFinite(g.T) || g.T <= 0) return { svg: emptySvg('Enter a material thickness to draw the section.'), s: 0 };
  const T = g.T;
  // ---------- extents in z and r
  let zMin = 0, zMax = T, rMax;
  if (g.kind === 'insert') {
    const point = g.hole === 'blind' ? g.drill / 2 / Math.tan(59 * Math.PI / 180) : 0;
    zMax = Math.max(T, g.hole === 'blind' ? Math.min(g.depth + point, T * 1.0001) : T);
    rMax = g.cskMax / 2;
  } else if (g.kind === 'nut') {
    zMin = -g.Eh; rMax = g.E / 2;
  } else {
    zMax = Math.max(T, g.L); rMax = g.headD / 2;
  }
  const halfW = Math.max(rMax * (g.kind === 'nut' ? 1.9 : 2.3), 0.15);
  // pixel margins reserved for dimensions
  const mL = 190, mR = 250, mT = 92, mB = 92;
  const MAX_H = 640, MIN_H = 400;
  const s = Math.min((VB_W - mL - mR) / (2 * halfW), (MAX_H - mT - mB) / (zMax - zMin));
  VB_H = Math.max(MIN_H, Math.round((zMax - zMin) * s + mT + mB));
  const cx = mL + halfW * s + ((VB_W - mL - mR) - 2 * halfW * s) / 2;
  const near = g.side !== 'far';
  const yTop = mT + ((VB_H - mT - mB) - (zMax - zMin) * s) / 2;
  const Y = z => near ? yTop + (z - zMin) * s : yTop + (zMax - z) * s;
  const X = r => cx + r * s;
  const out = dirOut => (near ? -1 : 1) * dirOut; // +1 = away from material on the install side
  const parts = [];
  const P = (pts, attrs) => `<polygon points="${pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" ${attrs}/>`;
  const PL = (pts, attrs) => `<polyline points="${pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" ${attrs}/>`;
  const mirror = pts => pts.map(([r, z]) => [-r, z]).reverse();
  const toXY = pts => pts.map(([r, z]) => [X(r), Y(z)]);

  // ---------- defs
  parts.push(`<defs>
    <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#8a8d92" stroke-width="1"/></pattern>
    <pattern id="hatch2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#4d5a6b" stroke-width="0.9"/></pattern>
    <marker id="ar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="${BLUE}"/></marker>
    <clipPath id="sub"><rect x="${X(-halfW)}" y="${Math.min(Y(0), Y(T))}" width="${2 * halfW * s}" height="${T * s}"/></clipPath>
  </defs>`);
  parts.push(`<rect width="${VB_W}" height="${VB_H}" fill="${PAPER}"/>`);

  // ---------- substrate
  const subY = Math.min(Y(0), Y(T));
  parts.push(`<rect x="${X(-halfW)}" y="${subY}" width="${2 * halfW * s}" height="${T * s}" fill="#f1f0ec"/>`);
  parts.push(`<rect x="${X(-halfW)}" y="${subY}" width="${2 * halfW * s}" height="${T * s}" fill="url(#hatch)"/>`);
  // break lines at substrate ends
  for (const sx of [-1, 1]) {
    const x = X(sx * halfW), y0 = subY, y1 = subY + T * s, m = (y0 + y1) / 2;
    parts.push(PL([[x, y0], [x, m - 6], [x + 5 * sx, m - 2], [x - 5 * sx, m + 2], [x, m + 6], [x, y1]], `fill="none" stroke="${INK}" stroke-width="1"`));
  }
  parts.push(`<line x1="${X(-halfW)}" y1="${Y(0)}" x2="${X(halfW)}" y2="${Y(0)}" stroke="${INK}" stroke-width="1.6"/>`);
  parts.push(`<line x1="${X(-halfW)}" y1="${Y(T)}" x2="${X(halfW)}" y2="${Y(T)}" stroke="${INK}" stroke-width="1.6"/>`);

  // ---------- centerline
  const clA = Y(zMin) + out(28), clB = Y(zMax) - out(28);
  parts.push(`<line x1="${cx}" y1="${clA}" x2="${cx}" y2="${clB}" stroke="${MUTED}" stroke-width="0.8" stroke-dasharray="14 3 3 3"/>`);

  const dims = [];
  const R = []; // label rects for collision avoidance (simple)

  // ---------- dimension helpers
  const label = (x, y, text, anchor = 'middle', color = BLUE) => {
    text = cap3(text);
    const w = text.length * 7.3 + 8, h = 16;
    let lx = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x - 4 : x - w + 4;
    const clamp = Math.min(Math.max(lx, 2), VB_W - w - 2) - lx; // keep labels inside the frame
    lx += clamp; x += clamp;
    R.push([lx, y - 11, w, h]);
    return `<rect x="${lx.toFixed(1)}" y="${(y - 11.5).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" fill="${PAPER}" opacity="0.92"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="${MONO}" font-size="12" fill="${color}">${esc(text)}</text>`;
  };
  // vertical dim at screen x between world z1 and z2; extension lines from xFrom
  const dimV = (x, z1, z2, text, xFrom, side = 'right') => {
    const y1 = Y(z1), y2 = Y(z2), ym = (y1 + y2) / 2;
    let d = '';
    if (xFrom !== undefined) for (const y of [y1, y2]) d += `<line x1="${xFrom + (x > xFrom ? 3 : -3)}" y1="${y}" x2="${x + (x > xFrom ? 6 : -6)}" y2="${y}" stroke="${BLUE}" stroke-width="0.7"/>`;
    const small = Math.abs(y2 - y1) < 22;
    if (small) {
      const ya = Math.min(y1, y2), yb = Math.max(y1, y2);
      d += `<line x1="${x}" y1="${ya - 16}" x2="${x}" y2="${ya}" stroke="${BLUE}" stroke-width="0.8" marker-end="url(#ar)"/>`;
      d += `<line x1="${x}" y1="${yb + 16}" x2="${x}" y2="${yb}" stroke="${BLUE}" stroke-width="0.8" marker-end="url(#ar)"/>`;
    } else d += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${BLUE}" stroke-width="0.8" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
    d += side === 'right' ? label(x + 8, ym + 4, text, 'start') : label(x - 8, ym + 4, text, 'end');
    return d;
  };
  // horizontal dim at screen y between radii -r..r; extension lines from yFrom
  const dimH = (y, r, text, yFrom, labelAt = 'right') => {
    const x1 = X(-r), x2 = X(r);
    let d = '';
    if (yFrom !== undefined) for (const x of [x1, x2]) d += `<line x1="${x}" y1="${yFrom + (y > yFrom ? 3 : -3)}" x2="${x}" y2="${y + (y > yFrom ? 6 : -6)}" stroke="${BLUE}" stroke-width="0.7"/>`;
    if (x2 - x1 < 30) {
      d += `<line x1="${x1 - 18}" y1="${y}" x2="${x1}" y2="${y}" stroke="${BLUE}" stroke-width="0.8" marker-end="url(#ar)"/>`;
      d += `<line x1="${x2 + 18}" y1="${y}" x2="${x2}" y2="${y}" stroke="${BLUE}" stroke-width="0.8" marker-end="url(#ar)"/>`;
      d += `<line x1="${x2 + 18}" y1="${y}" x2="${x2 + 30}" y2="${y}" stroke="${BLUE}" stroke-width="0.8"/>`;
    } else d += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${BLUE}" stroke-width="0.8" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
    d += labelAt === 'right' ? label(x2 + 36, y + 4, text, 'start') : label(x1 - 36, y + 4, text, 'end');
    return d;
  };
  const leader = (x0, y0, x1, y1, text) => `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${BLUE}" stroke-width="0.7" marker-start="url(#ar)"/><line x1="${x1}" y1="${y1}" x2="${x1 - 14}" y2="${y1}" stroke="${BLUE}" stroke-width="0.7"/>` + label(x1 - 18, y1 + 4, text, 'end');

  const zig = (r1, r2, zA, zB, P) => { // thread profile points (r,z) alternating radii, pitch P
    const pts = []; let z = zA, i = 0;
    while (z < zB - 1e-9) { pts.push([i % 2 ? r2 : r1, z]); z += P / 2; i++; }
    pts.push([i % 2 ? r2 : r1, zB]);
    return pts;
  };

  const xSubR = X(halfW), xSubL = X(-halfW);
  const installY = Y(0);
  const faceText = near ? 'INSTALL FACE (NEAR SIDE)' : 'INSTALL FACE (FAR SIDE)';

  if (g.kind === 'insert') {
    const P_ = g.P, dR = g.drill / 2, stiR = (g.D + 1.299 * P_) / 2, cskR = (g.cskMin + g.cskMax) / 4;
    const zCsk = Math.max(0, (cskR - dR) / Math.tan(60 * Math.PI / 180));
    const blind = g.hole === 'blind';
    const zDepth = blind ? Math.min(g.depth, T) : T;
    const pointZ = blind ? dR / Math.tan(59 * Math.PI / 180) : 0;
    const zThr = blind ? Math.min(g.H, zDepth) : T;
    // right wall of the cut (r, z) from top
    const wall = [[cskR, 0], [dR, zCsk]];
    zig(dR, stiR, Math.max(zCsk, P_ / 2), zThr, P_).forEach(p => wall.push(p));
    if (blind) { wall.push([dR, zThr], [dR, zDepth]); }
    else wall.push([dR, T]);
    let poly;
    if (blind) poly = [...wall, [0, zDepth + pointZ], ...mirror(wall)];
    else poly = [...wall, ...mirror(wall)];
    parts.push(`<g clip-path="url(#sub)">${P(toXY(poly), `fill="${PAPER}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"`)}</g>`);
    // insert coils (rhombus wire sections) from set-down
    const setdown = 1.0 * P_;
    const rIn = g.D / 2 - 0.541 * P_, mid = (stiR + rIn) / 2;
    const zEnd = Math.min(setdown + g.Ln, blind ? zDepth : T);
    let coils = '';
    for (let zc = setdown + P_ / 2; zc <= zEnd - P_ / 2 + 1e-9; zc += P_) {
      for (const sg of [1, -1]) {
        const pts = [[sg * stiR, zc], [sg * mid, zc - P_ / 2], [sg * rIn, zc], [sg * mid, zc + P_ / 2]];
        coils += P(toXY(pts), `fill="#c9ced6" stroke="#3f4a59" stroke-width="0.7"`);
      }
    }
    parts.push(`<g clip-path="url(#sub)">${coils}</g>`);
    // dims
    dims.push(dimV(xSubL - 34, 0, T, fT(T), xSubL));
    let dx = xSubR + 24;
    if (blind) { dims.push(dimV(dx, 0, zDepth, `MIN DEPTH ${g.depthLabel}`, X(dR))); dx += 104; }
    if (blind) { dims.push(dimV(dx, 0, zThr, `H ${g.HLabel}`, X(stiR))); dx += 70; }
    dims.push(dimV(X(stiR) + 14, setdown, setdown + g.Ln, `Ln ${g.LnLabel}`));
    const yOut = installY + out(46);
    dims.push(dimH(yOut, cskR, `CSK ${g.cskLabel}`, installY, 'right'));
    const yBot = Y(T) - out(40);
    dims.push(dimH(yBot, dR, `DRILL ${g.drillLabel}`, Y(blind ? zDepth : T), 'left'));
    const zP = Math.min(zThr, setdown + g.Ln) * 0.55;
    dims.push(leader(X(-stiR), Y(zP), X(-cskR) - 40, installY + out(46), `${f3(P_)} P (${g.tpi} TPI)`));
    if (blind && g.depth + pointZ > T + 1e-6) dims.push(label(cx, Y(T) - out(20) + 4, 'DRILL POINT BREAKS THROUGH', 'middle', '#8f4211'));
  } else if (g.kind === 'nut') {
    const P_ = g.P, rMin = g.D / 2 - 0.541 * P_, rMaj = g.D / 2;
    const hR = g.hole / 2;
    parts.push(P(toXY([[hR, 0], [hR, T], [-hR, T], [-hR, 0]]), `fill="${PAPER}" stroke="${INK}" stroke-width="1"`));
    // nut halves (section)
    for (const sg of [1, -1]) {
      const pts = [[sg * rMin, -g.Eh], [sg * g.E / 2, -g.Eh], [sg * g.E / 2, 0], [sg * g.C / 2, 0], [sg * g.C / 2, g.A], [sg * rMin, g.A]];
      parts.push(P(toXY(pts), `fill="#dfe3e9" stroke="none"`));
      parts.push(P(toXY(pts), `fill="url(#hatch2)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"`));
      parts.push(PL(toXY(zig(sg * rMin, sg * rMaj, -g.Eh, g.A, P_)), `fill="none" stroke="${INK}" stroke-width="0.7"`));
    }
    dims.push(dimV(xSubL - 34, 0, T, fT(T), xSubL));
    const dx = xSubR + 24;
    dims.push(dimV(dx, -g.Eh, 0, `HEAD ${g.EhLabel}`, X(g.E / 2)));
    dims.push(dimV(dx + 110, 0, g.A, `A ${String(g.ALabel).replace(/^0\./, '.')}`, X(g.C / 2)));
    dims.push(dimH(Y(-g.Eh) + out(36), g.E / 2, `E ${g.ELabel}`, Y(-g.Eh), 'right'));
    dims.push(dimH(Y(T) - out(40), hR, `HOLE ${g.holeLabel}`, Y(T), 'left'));
    dims.push(leader(X(-(rMin + rMaj) / 2), Y(-g.Eh * 0.4), X(-g.E / 2) - 40, Y(-g.Eh) + out(36), `${f3(P_)} P (${g.tpi} TPI)`));
  } else {
    // Head thickness is not given by the spec (flush head, sheet >= min_sheet_thk); drawn schematic at half the min sheet.
    const P_ = g.P, rMaj = g.D / 2, rMin = g.D / 2 - 0.541 * P_, hR = g.hole / 2, H = Math.min(g.minSheet * 0.5, T * 0.6);
    const zS = Math.min(g.S, g.L);
    parts.push(P(toXY([[hR, H], [hR, T], [-hR, T], [-hR, H]]), `fill="${PAPER}" stroke="${INK}" stroke-width="1"`));
    // stud in elevation
    const body = [[g.headD / 2, 0], [g.headD / 2, H], [rMaj, H], [rMaj, g.L - 0.6 * P_], [rMaj - 0.6 * P_, g.L]];
    const studPoly = [...body, ...mirror(body)];
    parts.push(P(toXY(studPoly), `fill="#dfe3e9" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"`));
    // thread crest lines (illustrative) start at S max; minor-dia hidden lines
    let thr = '';
    for (let z = zS + P_ / 2; z < g.L - 0.6 * P_; z += P_) thr += `<line x1="${X(-rMaj)}" y1="${Y(z - P_ / 4)}" x2="${X(rMaj)}" y2="${Y(z + P_ / 4)}" stroke="#6b7480" stroke-width="0.6"/>`;
    parts.push(thr);
    parts.push(`<line x1="${X(-rMin)}" y1="${Y(zS)}" x2="${X(-rMin)}" y2="${Y(g.L)}" stroke="#6b7480" stroke-width="0.6" stroke-dasharray="4 3"/><line x1="${X(rMin)}" y1="${Y(zS)}" x2="${X(rMin)}" y2="${Y(g.L)}" stroke="#6b7480" stroke-width="0.6" stroke-dasharray="4 3"/>`);
    dims.push(dimV(xSubL - 34, 0, T, fT(T), xSubL));
    const dx = xSubR + 24;
    dims.push(dimV(dx, 0, g.L, `L ${g.LLabel}`, X(rMaj)));
    if (g.L > T) dims.push(dimV(dx + 96, T, g.L, `PROTRUDES ${f3(g.L - T)}`, X(rMaj)));
    dims.push(dimV(X(g.headD / 2) + 16, 0, zS, `S ${g.SLabel} MAX`, X(rMaj)));
    dims.push(dimH(installY + out(40), g.headD / 2, `HEAD ${g.headDLabel}`, installY, 'right'));
    dims.push(leader(X(-hR), Y((H + T) / 2), X(-halfW) - 46, Y(T) - out(-1) * 0 + (near ? 30 : -30), `HOLE ${g.holeLabel}`));
    const zP = T + (g.L - T) * 0.5;
    if (g.L > T + 2 * P_) dims.push(leader(X(-rMaj), Y(zP), X(-rMaj) - 70, Y(zP) + (near ? 18 : -18), `${f3(P_)} P (${g.tpi} TPI)`));
  }

  // install face marker: small triangle on the face plus a legend line
  const ty = installY, tx = xSubL + 8, tdir = out(1);
  parts.push(`<path d="M${tx},${ty} l-6,${10 * tdir} h12 z" fill="${MUTED}"/>`);
  parts.push(`<text x="14" y="${VB_H - 14}" font-family="${MONO}" font-size="11" fill="${MUTED}" letter-spacing=".04em">${near ? '&#9660;' : '&#9650;'} ${faceText}, ${near ? 'TOP OF VIEW' : 'BOTTOM OF VIEW'}</text>`);
  parts.push(...dims);
  return { svg: wrap(parts.join('\n'), opts.title || 'Cross section'), s, h: VB_H };
}

function wrap(inner, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W}" height="${VB_H}" role="img"><title>${esc(title)}</title>${inner}</svg>`;
}
function emptySvg(msg) {
  VB_H = 400;
  return wrap(`<rect width="${VB_W}" height="${VB_H}" fill="${PAPER}"/><text x="${VB_W / 2}" y="${VB_H / 2}" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${MUTED}">${esc(msg)}</text>`, 'Cross section');
}
