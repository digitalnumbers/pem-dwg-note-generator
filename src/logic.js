// Pure note/validation logic. No DOM access, so it runs in the browser and in Node tests.
// Rule: every value printed in a note comes straight from a CSV row; nothing is computed into the note.

export const APP_VERSION = "1.5.0";
export const THREADS = ['4-40', '8-32', '10-32', '1/4-20'];
export const MATERIALS = ['5052-H32', '6061-T6', 'A304 (annealed)', 'A1008 CS Type B'];

// Basic thread geometry used only to draw the cross-section (never printed in a note).
export const THREAD_GEOM = {
  '4-40': { D: 0.112, tpi: 40 },
  '8-32': { D: 0.164, tpi: 32 },
  '10-32': { D: 0.190, tpi: 32 },
  '1/4-20': { D: 0.250, tpi: 20 },
};

export const HW_MAT_LABEL = { cres: 'CRES', carbon: 'Carbon steel', aluminum: 'Aluminum', pem: 'PEM hardened stainless (commercial only)' };
const HW_KEYS = ['cres', 'carbon', 'aluminum', 'pem'];
// Design rule (v1.2): CRES hardware only. Carbon steel and aluminum rows stay in the CSVs as spec record but are never offered.
export const HW_ALLOWED = ['cres', 'pem'];

// ---------------------------------------------------------------- CSV
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// ---------------------------------------------------------------- formatting
// Drafting symbols for SolidWorks notes (v1.4). Tags are SolidWorks note tags; degree and diameter are literal characters.
export const SYM = { csk: '<HOLE-SINK>', depth: '<HOLE-DEPTH>', dia: '\u00d8', deg: '\u00b0', pm: '\u00b1' };
export const MAX_PLACES = 3;

// Round a decimal string to at most 3 places, half up, using string math so .2055 -> .206 (no float error).
// Values with 3 or fewer places keep their stored digits (.250 stays .250).
export function round3(v, pad = false) {
  let s = typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(6) : String(v)) : String(v).trim();
  const m = s.match(/^(-?)(\d*)\.(\d+)$/);
  if (!m) return s;
  let [, sign, ip, fp] = m;
  if (typeof v === 'number') fp = fp.replace(/0+$/, '');
  if (fp.length > MAX_PLACES) {
    let n = BigInt((ip || '0') + fp.slice(0, MAX_PLACES)) + (fp[MAX_PLACES] >= '5' ? 1n : 0n);
    const t = n.toString().padStart(MAX_PLACES + 1, '0');
    ip = t.slice(0, -MAX_PLACES); fp = t.slice(-MAX_PLACES);
  }
  if (pad) fp = fp.padEnd(MAX_PLACES, '0');
  return `${sign}${ip || '0'}${fp ? '.' + fp : ''}`;
}
// Drafting decimal style: drop the leading zero (0.568 -> .568), at most 3 decimal places.
export function dec(v) {
  const s = round3(v);
  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s;
}
// Safety net: cap every decimal in a display string at 3 places (".0188-.0375" -> ".019-.038").
export function cap3(text) {
  return String(text ?? '').replace(/(^|[^\w.])(\d*\.\d{4,})(?![\d.])/g, (_, pre, n) => pre + dec(n));
}
export function num(v) { return parseFloat(String(v).trim()); }
// "#7 (0.2010)" -> "#7 (\u00d8.201)"
const drillText = s => s.replace(/\(([\d.]+)\)/, (_, v) => `(${SYM.dia}${dec(v)})`);
// "120 +/-5 deg" -> "120\u00b0". The angle tolerance is covered by the drawing title block, so it is not printed.
export function angleText(v) {
  const m = String(v || '').match(/^\s*([\d.]+)\s*(?:(?:\+\/-|\u00b1)\s*([\d.]+))?/);
  if (!m) return String(v || '');
  return `${m[1]}${SYM.deg}`;
}
// Hole size for a clinch-hardware hole, at most 3 places, diameter only (v1.5): the size tolerance is
// covered by the drawing title block, so it is not printed. When the spec nominal has more places
// (.1875 +.003/-.000), the nominal is rounded inward (up from the spec minimum) so it stays inside the spec range.
export function holeSize(dia, tol) {
  const d = String(dia).trim(), t = String(tol || '').trim();
  const places = (d.split('.')[1] || '').length;
  const tm = t.match(/^\+(\d*\.\d+)\s*\/\s*-(\d*\.\d+)$/);
  const q = x => Math.round(num(x) * 10000);
  const f = x => dec(x.toFixed(3));
  const spec = tm ? `${dec(d)} ${t}` : dec(d);
  if (places <= MAX_PLACES || !tm) return { text: `${SYM.dia}${dec(d)}`, nominal: dec(d), adjusted: false, spec };
  const lo = q(d) - q(tm[2]), hi = q(d) + q(tm[1]);
  const lo3 = Math.ceil(lo / 10) / 1000, hi3 = Math.floor(hi / 10) / 1000;
  return { text: `${SYM.dia}${f(lo3)}`, nominal: f(lo3), adjusted: true, limits: `${f(lo3)}-${f(hi3)}`, spec };
}
export function drillDecimal(s) { const m = s.match(/\(([\d.]+)\)/); return m ? num(m[1]) : NaN; }

export function hwMatKey(materialText) {
  const t = materialText.toUpperCase();
  if (t.startsWith('CRES')) return 'cres';
  if (t.startsWith('CARBON')) return 'carbon';
  if (t.startsWith('ALUMINUM')) return 'aluminum';
  if (t.startsWith('PEM')) return 'pem';
  return '';
}

// ---------------------------------------------------------------- standard stock thicknesses
// materials.csv std_thk_in / std_thk_labels (semicolon lists, ascending). See data/README.md.
export function stdThicknesses(mat) {
  if (!mat || !mat.std_thk_in) return [];
  const v = mat.std_thk_in.split(';'), l = (mat.std_thk_labels || '').split(';');
  // Gauge nominals such as .0598 are carried at 3 places (.060), the same value the note and field use.
  return v.map((x, i) => { const r = round3(x.trim(), true); return { t: num(r), value: r, label: (l[i] || '').trim() }; });
}
// Thickness text: always 3 places (v1.4).
export function fmtThk(t) { return dec(round3(t, true)); }
export function stdName(x) { return /^\./.test(x.label) ? 'std ' + x.label.split(' ').slice(1).join(' ') : x.label; }
const STD_TOL = 0.0005 + 1e-9;
export function stdMatch(mat, T) { return stdThicknesses(mat).find(x => Math.abs(x.t - T) <= STD_TOL) || null; }
// Suggest the smallest (or largest) standard thickness that satisfies ok(t); fall back to the exact value.
export function stdSuggest(mat, ok, exact, largest = false, extra = {}) {
  const list = stdThicknesses(mat).filter(x => ok(x.t));
  const pick = largest ? list[list.length - 1] : list[0];
  if (pick) return { label: `Set thickness to ${dec(pick.value)} (${stdName(pick)})`, patch: { thk: pick.value, ...extra } };
  return { label: `Set thickness to ${dec(exact)} (non-standard)`, patch: { thk: exact, ...extra } };
}

export const DEFAULT_STATE = {
  type: 'insert', material: '6061-T6', thk: '0.250', hole: 'thru', tap: 'plug',
  thread: '10-32', qty: '4', len: 'auto', side: 'near', hwmat: 'auto',
  pnmode: 'current',
};

// ---------------------------------------------------------------- compute
export function compute(state, data) {
  const s = { ...DEFAULT_STATE, ...state };
  const out = { state: s, warnings: [], info: [], prep: [], install: [], row: null, choices: [], geom: null, commercial: null, hwmatChosen: null, hwmatReason: '' };
  const T = num(s.thk);
  const qty = Math.max(1, parseInt(s.qty, 10) || 1);
  const q = qty > 1 ? `${qty}X ` : '';
  const mat = data.materials.find(m => m.material === s.material);
  const sideWord = s.side === 'far' ? 'FAR SIDE' : 'NEAR SIDE';
  const validT = Number.isFinite(T) && T > 0;
  if (!validT) out.warnings.push({ text: 'Enter a material thickness greater than 0 in.', actions: [] });
  if (String(s.qty).trim() === '' || !(parseInt(s.qty, 10) >= 1) || String(parseInt(s.qty, 10)) !== String(s.qty).trim()) {
    out.warnings.push({ text: 'Quantity must be a whole number of 1 or more. Using ' + qty + '.', actions: [{ label: 'Set ' + qty, patch: { qty: String(qty) } }] });
  }

  if (validT) {
    const list = stdThicknesses(mat), match = stdMatch(mat, T);
    out.thkStd = { match, below: match ? null : [...list].reverse().find(x => x.t < T) || null, above: match ? null : list.find(x => x.t > T) || null, count: list.length };
  }
  if (s.type === 'insert') computeInsert(s, data, mat, T, validT, q, sideWord, out);
  else if (s.type === 'nut') computeNut(s, data, mat, T, validT, q, sideWord, out);
  else computeStud(s, data, mat, T, validT, q, sideWord, out);

  out.nonCompliant = out.warnings.length > 0;
  // Max 3 decimal places everywhere the user reads a value (v1.4).
  out.prep = out.prep.map(cap3); out.install = out.install.map(cap3);
  out.info = out.info.map(cap3);
  out.warnings = out.warnings.map(w => ({ ...w, text: cap3(w.text), actions: w.actions.map(a => ({ ...a, label: cap3(a.label) })) }));
  if (out.details) out.details = out.details.map(([k, v]) => [k, cap3(v)]);
  out.choices = out.choices.map(c => ({ ...c, label: cap3(c.label) }));
  if (out.commercial?.basis) out.commercial.basis = cap3(out.commercial.basis);
  out.hwmatReason = cap3(out.hwmatReason);
  out.noteLines = [...out.prep, ...out.install];
  out.noteText = out.noteLines.join('\n');
  // Hole-prep block: hole lines plus the side line so it can be pasted on its own.
  out.prepText = out.prep.length ? [...out.prep, out.install[out.install.length - 1]].join('\n') : '';
  return out;
}

function pnFor(row, s) {
  if (s.pnmode === 'legacy') return { pn: row.legacy_pn || row.note_pn, cage: row.legacy_cage || row.note_cage };
  return { pn: row.note_pn, cage: row.note_cage };
}

function computeInsert(s, data, mat, T, validT, q, sideWord, out) {
  const rows = data.inserts.filter(r => r.thread === s.thread && r.in_app_scope === 'Y')
    .sort((a, b) => num(a.length_dia_mult) - num(b.length_dia_mult));
  if (!rows.length) { out.warnings.push({ text: `No confirmed insert data for ${s.thread}.`, actions: [] }); return; }
  const drillCol = mat && mat.insert_drill_column === 'steel' ? 'drill_steel' : 'drill_aluminum';
  const depthCol = s.tap === 'bottoming' ? 'min_drill_depth_bottoming_tap_FB' : 'min_drill_depth_plug_tap_FP';
  // Blind-hole fit: the 118 deg drill point must stay inside the material. MIN DEPTH is the full-diameter
  // depth (Y14.5), so the point extends (drill/2)/tan(59 deg) past it. Used for selection only, never printed.
  const tip = r => num(r[depthCol]) + drillDecimal(r[drillCol]) / 2 / Math.tan(59 * Math.PI / 180);
  const need = r => s.hole === 'thru' ? num(r.min_flange_thk_thru_hole_csk) : tip(r);
  const fits = r => validT && (s.hole === 'thru' ? T >= need(r) : need(r) < T);
  out.choices = rows.map(r => ({ value: r.length_dia_mult, label: `${num(r.length_dia_mult)}D  (${dec(r.nominal_length_Ln)} in)`, fits: fits(r) }));
  const fitting = rows.filter(fits);
  let row;
  if (s.len === 'auto') {
    row = fitting.length ? fitting[fitting.length - 1] : rows[0];
  } else {
    row = rows.find(r => r.length_dia_mult === s.len) || rows[0];
  }
  out.row = row;
  out.autoLen = fitting.length ? fitting[fitting.length - 1].length_dia_mult : null;

  if (validT && !fitting.length) {
    const r0 = rows[0];
    const req = need(r0);
    const acts = [];
    if (s.hole === 'blind' && T >= num(r0.min_flange_thk_thru_hole_csk)) acts.push({ label: 'Use thru hole', patch: { hole: 'thru', len: 'auto' } });
    const sug = s.hole === 'thru' ? req : Math.ceil((req + 0.0005) * 1000) / 1000;
    acts.push(stdSuggest(mat, t => s.hole === 'thru' ? t >= req : t > req, sug.toFixed(3), false, { len: 'auto' }));
    out.warnings.push({
      text: s.hole === 'thru'
        ? `No insert length fits ${fmtThk(T)} in. The shortest (1D) needs at least ${dec(r0.min_flange_thk_thru_hole_csk)} in for a countersunk thru hole.`
        : `No insert length fits a blind hole in ${fmtThk(T)} in. The shortest (1D) needs MIN DEPTH ${dec(r0[depthCol])} plus the 118\u00b0 drill point, about ${dec(req.toFixed(3))} in, inside the material.`,
      actions: acts,
    });
  } else if (validT && !fits(row)) {
    const best = fitting[fitting.length - 1];
    out.warnings.push({
      text: s.hole === 'thru'
        ? `${num(row.length_dia_mult)}D insert needs ${dec(row.min_flange_thk_thru_hole_csk)} in minimum thickness for a thru hole; material is ${fmtThk(T)} in.`
        : num(row[depthCol]) < T
          ? `${num(row.length_dia_mult)}D insert: at MIN DEPTH ${dec(row[depthCol])} the 118\u00b0 drill point reaches about ${dec(tip(row).toFixed(3))} in and breaks through the ${fmtThk(T)} in material.`
          : `${num(row.length_dia_mult)}D insert MIN DEPTH ${dec(row[depthCol])} in does not fit in ${fmtThk(T)} in.`,
      actions: [
        ...(best ? [{ label: `Use ${num(best.length_dia_mult)}D (longest that fits)`, patch: { len: best.length_dia_mult } }] : []),
        ...(s.hole === 'blind' && s.tap === 'plug' && validT && (num(row.min_drill_depth_bottoming_tap_FB) + tip(row) - num(row[depthCol])) < T ? [{ label: 'Keep length, use bottoming tap', patch: { tap: 'bottoming' } }] : []),
        ...(s.hole === 'blind' && T >= num(row.min_flange_thk_thru_hole_csk) ? [{ label: 'Keep length, make thru hole', patch: { hole: 'thru' } }] : []),
      ],
    });
  }

  const { pn, cage } = pnFor(row, s);
  const drill = drillText(row[drillCol]);
  // ASME Y14.5-2018 4.5.12: a countersink is specified by diameter and included angle. The symbol precedes
  // the dimension with no space. Angle and tolerance come from csink_angle (NASM33537: 120 +/-5 deg).
  const csk = `${SYM.csk}${SYM.dia}${dec(row.csink_dia_min)}-${dec(row.csink_dia_max)} X ${angleText(row.csink_angle)}`;
  if (s.hole === 'blind') {
    out.prep.push(`${q}DRILL ${drill} ${SYM.depth}${dec(row[depthCol])} MIN`, csk, `TAP ${row.tap} ${SYM.depth}${dec(row.min_full_thread_H)} MIN FULL THREAD`);
  } else {
    out.prep.push(`${q}DRILL ${drill} THRU`, csk, `TAP ${row.tap} THRU`);
  }
  out.install.push('INSTALL THREADED INSERT', 'BREAK TANG', `PN: ${pn}`, `CAGE: ${cage}`, sideWord);
  out.commercial = { pn: row.commercial_pem_pn, basis: row.commercial_pem_basis, hidden: true };
  if (s.hole === 'blind' && validT) out.info.push(`MIN DEPTH is to full drill diameter. The 118\u00b0 point reaches about ${dec(tip(row).toFixed(3))} in, leaving about ${dec(Math.max(0, T - tip(row)).toFixed(3))} in of material below the point at minimum depth.`);
  out.info.push(`Drill from the ${drillCol === 'drill_steel' ? 'steel' : 'aluminum'} column for ${s.material}.`);
  const tg = THREAD_GEOM[s.thread];
  out.geom = {
    kind: 'insert', T, hole: s.hole, P: 1 / tg.tpi, D: tg.D, drill: drillDecimal(row[drillCol]), drillLabel: drill,
    depth: num(row[depthCol]), depthLabel: dec(row[depthCol]), H: num(row.min_full_thread_H), HLabel: dec(row.min_full_thread_H),
    Ln: num(row.nominal_length_Ln), LnLabel: dec(row.nominal_length_Ln), cskMin: num(row.csink_dia_min), cskMax: num(row.csink_dia_max),
    cskLabel: `${SYM.dia}${dec(row.csink_dia_min)}-${dec(row.csink_dia_max)} X ${row.csink_angle.match(/^\s*[\d.]+/)?.[0] || '120'}${SYM.deg}`, side: s.side, tpi: tg.tpi,
  };
  out.details = [
    ['Current PN / CAGE', `${row.note_pn} / ${row.note_cage}`],
    ['Legacy PN / CAGE', `${row.legacy_pn} / ${row.legacy_cage}`],
    ['Insert nominal length Ln', `${dec(row.nominal_length_Ln)} (${num(row.length_dia_mult)}D)`],
    ['Tap minor dia (2B)', `${row.tap_minor_dia_min ? dec(row.tap_minor_dia_min) : 'n/a'} to ${dec(row.tap_minor_dia_max_2B)}`],
    ['Countersink', `${SYM.dia}${dec(row.csink_dia_min)}-${dec(row.csink_dia_max)}, ${angleText(row.csink_angle)} included angle (tolerance per title block)`],
    ['Min drill depth, plug / bottoming tap', `${dec(row.min_drill_depth_plug_tap_FP)} / ${dec(row.min_drill_depth_bottoming_tap_FB)}`],
    ['Min full thread H', dec(row.min_full_thread_H)],
    ['Min thickness, thru hole (csk)', dec(row.min_flange_thk_thru_hole_csk)],
    ['Insert set-down with csk', row.insert_setdown_with_csk + ' in'],
    ['Drill, aluminum / steel', `${drillText(row.drill_aluminum)} / ${drillText(row.drill_steel)}`],
  ];
}

function pickHwMat(s, mat, family, available) {
  // family: 'm45938' or 'm63540'. Auto preference: mil CRES, then PEM commercial-only (only allowed keys are passed in).
  // A variant with margin wins over one exactly at its limit; a CAUTION variant is used only if nothing is rated.
  const order = HW_KEYS.filter(k => available.includes(k));
  const rule = k => String(mat?.[`${family}_${k}`] || '');
  const ok = k => rule(k).startsWith('OK');
  const caution = k => rule(k).startsWith('CAUTION');
  if (s.hwmat !== 'auto' && available.includes(s.hwmat)) return { key: s.hwmat, auto: false, ok: ok(s.hwmat), caution: caution(s.hwmat) };
  // Any rated mil variant beats a commercial-only one; within each group, margin beats at-limit.
  const mil = order.filter(k => k !== 'pem'), com = order.filter(k => k === 'pem');
  const best = g => g.find(k => ok(k) && !/at limit/i.test(rule(k))) || g.find(ok);
  const first = best(mil) || best(com);
  if (first) return { key: first, auto: true, ok: true };
  const c = order.find(caution);
  if (c) return { key: c, auto: true, ok: false, caution: true };
  return { key: order[0], auto: true, ok: false };
}

function hardnessText(mat) {
  if (!mat) return '';
  // "92 max" / "201 max" -> "92 HRB / 201 HB max"; "70 typ" -> "70 HRB typ"
  const part = (v, unit) => { const m = String(v || '').match(/^(\d+)\s*(.*)$/); return m ? { t: `${m[1]} ${unit}`, q: m[2] } : null; };
  const ps = [part(mat.hardness_HRB, 'HRB'), part(mat.hardness_HB, 'HB')].filter(Boolean);
  const q = [...new Set(ps.map(p => p.q).filter(Boolean))].join(' ');
  return ps.map(p => p.t).join(' / ') + (q ? ' ' + q : '');
}

// Short hardware name for messages: mil variants by material, PEM commercial rows by type.
function hwName(key, fam) {
  if (key === 'pem') return fam === 'nut' ? 'PEM SP' : 'PEM FH4';
  return HW_MAT_LABEL[key];
}

function hardnessWarning(s, mat, family, pick, rowLimit, out) {
  const fam = family === 'm45938' ? 'nut' : 'stud';
  const rule = String(mat?.[`${family}_${pick.key}`] || '');
  if (pick.ok) {
    if (/at limit/i.test(rule)) {
      const isMax = /^ASTM \S+ maximum/.test(mat?.hardness_basis || '');
      out.info.push(`${hwName(pick.key, fam)} ${fam}s are rated for sheet up to ${rowLimit} HRB; ${s.material} is ${hardnessText(mat)}${isMax ? ' (spec maximum), so it is within the rating at the limit' : ', a typical value rather than a spec maximum, at the limit'}. Confirm the actual sheet hardness.`);
    }
    return;
  }
  const anyOk = HW_ALLOWED.some(k => String(mat?.[`${family}_${k}`] || '').startsWith('OK'));
  const acts = [];
  if (anyOk && !pick.auto) acts.push({ label: 'Auto-select hardware material', patch: { hwmat: 'auto' } });
  if (!anyOk) acts.push({ label: 'Use threaded insert instead', patch: { type: 'insert', len: 'auto', hwmat: 'auto' } });
  if (pick.caution) {
    out.warnings.push({
      text: `${hwName(pick.key, fam)} ${fam}s are rated for stainless sheet up to ${rowLimit} HRB. ${s.material} can be up to ${hardnessText(mat).replace(/ max$/, '')} per its spec. Confirm the sheet is ${rowLimit} HRB or less (for example on the material cert), or use a helical insert.`,
      actions: acts,
    });
    return;
  }
  out.warnings.push({
    text: `${hwName(pick.key, fam)} ${fam}s are rated for sheet up to ${rowLimit} HRB. ${s.material} is ${hardnessText(mat)}${/^ASTM \S+ maximum/.test(mat?.hardness_basis || '') ? ' (spec maximum)' : ''}.` +
      (anyOk ? '' : ` No ${fam} variant suits ${s.material}; a helical insert is recommended.`),
    actions: acts,
  });
}

function commercialOnlyInfo(row, fam, out) {
  if (row.commercial_only !== 'Y') return;
  out.commercialOnly = true;
  out.info.unshift(`Commercial-only part: no military PN exists for PEM ${row.note_pn.split('-')[0]} ${fam}s (PEM MIL cross reference). The note uses the PEM PN and PEM CAGE ${row.note_cage}.`);
  out.info.push('Sheet must be annealed. Punch the hole and do not deburr it. Keep away from bends and cold-worked areas (PEM Dos and Don\'ts).');
}

function computeNut(s, data, mat, T, validT, q, sideWord, out) {
  const all = data.nuts.filter(r => r.thread === s.thread && r.in_app_scope === 'Y');
  if (!all.length) { out.warnings.push({ text: `No confirmed nut data for ${s.thread}.`, actions: [] }); return; }
  const avail = [...new Set(all.map(r => hwMatKey(r.material)))].filter(k => HW_ALLOWED.includes(k));
  const pick = pickHwMat(s, mat, 'm45938', avail);
  out.hwmatChosen = pick.key; out.hwmatAvail = avail;
  const rows = all.filter(r => hwMatKey(r.material) === pick.key).sort((a, b) => num(a.shank_length_A) - num(b.shank_length_A));
  const inRange = r => validT && T >= num(r.sheet_thk_min) && (r.sheet_thk_max === '' || T <= num(r.sheet_thk_max));
  out.choices = rows.map(r => ({ value: r.shank_length_A, label: `A ${dec(r.shank_length_A)}  (sheet ${r.sheet_thk_min}-${r.sheet_thk_max || 'up'})`, fits: inRange(r) }));
  const match = rows.filter(inRange).pop(); // longest shank that fits the sheet
  let row = s.len === 'auto' ? (match || rows[0]) : (rows.find(r => r.shank_length_A === s.len) || match || rows[0]);
  if (s.len === 'auto' && !match && validT) row = T < num(rows[0].sheet_thk_min) ? rows[0] : rows[rows.length - 1];
  out.row = row; out.autoLen = match ? match.shank_length_A : null;
  out.hwmatReason = pick.ok
    ? `${pick.auto ? 'Auto: ' : ''}${pick.key === 'pem' ? hwName('pem', 'nut') + ', commercial only' : HW_MAT_LABEL[pick.key]} (rated to ${row.max_sheet_hardness_HRB} HRB; ${s.material} ${hardnessText(mat)})`
    : pick.caution
      ? `${pick.auto ? 'Auto: ' : ''}${pick.key === 'pem' ? hwName('pem', 'nut') + ', commercial only' : HW_MAT_LABEL[pick.key]} (rated to ${row.max_sheet_hardness_HRB} HRB; ${s.material} ${hardnessText(mat)}): confirm sheet hardness`
      : `${HW_MAT_LABEL[pick.key]} not rated for ${s.material}`;
  hardnessWarning(s, mat, 'm45938', pick, row.max_sheet_hardness_HRB, out);

  if (validT && !match) {
    const minT = num(rows[0].sheet_thk_min);
    if (T < minT) out.warnings.push({ text: `${fmtThk(T)} in is below the minimum sheet thickness (${rows[0].sheet_thk_min}) for ${hwName(pick.key, 'nut')} ${s.thread} nuts.`, actions: [stdSuggest(mat, t => rows.some(r => t >= num(r.sheet_thk_min) && (r.sheet_thk_max === '' || t <= num(r.sheet_thk_max))), '0' + rows[0].sheet_thk_min, false, { len: 'auto' })] });
  } else if (validT && !inRange(row)) {
    out.warnings.push({ text: `Shank A ${dec(row.shank_length_A)} is for sheet ${row.sheet_thk_min}-${row.sheet_thk_max || 'up'}; material is ${fmtThk(T)} in.`, actions: [{ label: `Use A ${dec(match.shank_length_A)} (matches thickness)`, patch: { len: match.shank_length_A } }] });
  }
  const { pn, cage } = pnFor(row, s);
  const hs = holeSize(row.hole_dia_in_sheet, row.hole_tol);
  out.prep.push(`${q}${hs.text} THRU`);
  if (hs.adjusted) out.info.push(`Spec hole ${hs.spec} has 4 places; the nominal is rounded inward to ${hs.nominal} so it stays inside the spec range (${hs.limits}).`);
  out.info.push(`Hole size tolerance is per the drawing title block. Spec hole: ${hs.spec}.`);
  out.install.push('INSTALL SELF-CLINCHING NUT', `PN: ${pn}`, `CAGE: ${cage}`, sideWord);
  out.commercial = { pn: row.commercial_pem_pn, basis: row.commercial_pem_basis, hidden: false, isNotePN: row.commercial_only === 'Y' };
  const edge = row.min_edge_dist_spec || '';
  const edgeSrc = row.commercial_only === 'Y' ? 'PEM' : 'spec';
  out.info.push(edge ? `Minimum hole center to sheet edge: ${edge} (${edgeSrc}).` : `Minimum edge distance is illegible in the spec scan${row.min_edge_dist_vendor_ref ? `; PEM reference value ${row.min_edge_dist_vendor_ref} (not from spec)` : ''}.`);
  out.info.push('Install the mating screw from the shank (pilot) side of the nut.');
  commercialOnlyInfo(row, 'nut', out);
  const tg = THREAD_GEOM[s.thread];
  out.geom = {
    kind: 'nut', T, side: s.side, P: 1 / tg.tpi, D: tg.D, tpi: tg.tpi,
    hole: num(row.hole_dia_in_sheet), holeLabel: hs.text.split(' ')[0], C: num(row.body_dia_C), E: num(row.head_dia_E), Eh: num(row.head_thk_T),
    A: num(row.shank_length_A), ALabel: row.shank_length_A, ELabel: row.head_dia_E, EhLabel: row.head_thk_T,
  };
  out.details = [
    ['PN / CAGE (current)', `${row.note_pn} / ${row.note_cage}`],
    ['Legacy CAGE', row.legacy_cage || 'none (commercial-only part)'],
    ['Nut material', row.material],
    ['Max sheet hardness', `${row.max_sheet_hardness_HRB} HRB`],
    ['Sheet thickness range', row.commercial_only === 'Y' ? `${row.sheet_thk_min} min (PEM recommended)` : `${row.sheet_thk_min}-${row.sheet_thk_max || 'up'}`],
    ['Hole in sheet', `${hs.text} THRU (spec ${hs.spec}; tolerance per title block)`],
    ['Shank A / body C', `${dec(row.shank_length_A)} / ${dec(row.body_dia_C)}`],
    ['Head E / T', `${row.head_dia_E} / ${row.head_thk_T}`],
    ['Min edge distance', edge || (row.min_edge_dist_vendor_ref ? `illegible in spec (PEM ref ${row.min_edge_dist_vendor_ref})` : 'illegible in spec')],
    row.commercial_only === 'Y'
      ? ['Install force / push-out / torque-out (PEM avg, 304 SS)', `${row.approx_install_force_lb} lb / ${row.pushout_avg_lb} lb / ${row.torqueout_avg_inlb} in-lb`]
      : ['Install force (approx) / push-out / torque-out', `${row.approx_install_force_lb} lb / ${row.pushout_min_lb} lb / ${row.torqueout_min_inlb} in-lb`],
  ];
}

function computeStud(s, data, mat, T, validT, q, sideWord, out) {
  const all = data.studs.filter(r => r.thread === s.thread && r.in_app_scope === 'Y');
  if (!all.length) { out.warnings.push({ text: `No confirmed stud data for ${s.thread}.`, actions: [] }); return; }
  const avail = [...new Set(all.map(r => hwMatKey(r.material)))].filter(k => HW_ALLOWED.includes(k));
  const pick = pickHwMat(s, mat, 'm63540', avail);
  out.hwmatChosen = pick.key; out.hwmatAvail = avail;
  const rows = all.filter(r => hwMatKey(r.material) === pick.key).sort((a, b) => num(a.length_L) - num(b.length_L));
  // Auto length rule (v1.5): L (from the flush head face) must clear 2X the sheet thickness (sheet plus a mating
  // part of the same thickness) + the mil-spec flat washer + the mil-spec self-locking nut for that thread.
  // Washer and nut use their spec maximum thickness/height from hardware_stud_stack.csv.
  const stk = (data.stack || []).find(r => r.thread === s.thread) || null;
  const stackAdd = stk ? num(stk.washer_thk_max) + num(stk.nut_height_max) : 0;
  const reqL = validT ? 2 * T + stackAdd : NaN;
  out.studStack = stk ? { washer: stk.washer_pn, washerMax: stk.washer_thk_max, nut: stk.nut_pn, nutMax: stk.nut_height_max, reqL } : null;
  const protrudes = r => validT && num(r.length_L) > T;
  const clears = r => validT && (stk ? num(r.length_L) >= reqL - 1e-9 : protrudes(r));
  out.choices = rows.map(r => ({ value: r.length_L, label: `L ${r.length_L}${validT && stk ? `  (${num(r.length_L) >= reqL - 1e-9 ? 'clears by' : 'short by'} ${dec(Math.abs(num(r.length_L) - reqL).toFixed(3))})` : validT ? `  (protrudes ${dec((num(r.length_L) - T).toFixed(3))})` : ''}`, fits: clears(r) }));
  const firstFit = rows.find(clears);
  let row = s.len === 'auto' ? (firstFit || rows[rows.length - 1]) : (rows.find(r => r.length_L === s.len) || firstFit || rows[0]);
  out.row = row; out.autoLen = firstFit ? firstFit.length_L : null;
  out.hwmatReason = pick.ok
    ? `${pick.auto ? 'Auto: ' : ''}${pick.key === 'pem' ? hwName('pem', 'stud') + ', commercial only' : HW_MAT_LABEL[pick.key]} (rated to ${row.max_sheet_hardness_HRB} HRB; ${s.material} ${hardnessText(mat)})`
    : pick.caution
      ? `${pick.auto ? 'Auto: ' : ''}${pick.key === 'pem' ? hwName('pem', 'stud') + ', commercial only' : HW_MAT_LABEL[pick.key]} (rated to ${row.max_sheet_hardness_HRB} HRB; ${s.material} ${hardnessText(mat)}): confirm sheet hardness`
      : `${HW_MAT_LABEL[pick.key]} not rated for ${s.material}`;
  hardnessWarning(s, mat, 'm63540', pick, row.max_sheet_hardness_HRB, out);
  if (validT && T < num(row.min_sheet_thk)) {
    out.warnings.push({ text: `${fmtThk(T)} in is below the minimum sheet thickness (${row.min_sheet_thk}) for ${s.thread} studs.`, actions: [stdSuggest(mat, t => t >= num(row.min_sheet_thk) && (!row.sheet_thk_max || t <= num(row.sheet_thk_max)), '0' + row.min_sheet_thk)] });
  }
  if (validT && row.sheet_thk_max && T > num(row.sheet_thk_max)) {
    out.warnings.push({ text: `${fmtThk(T)} in is above the PEM sheet thickness range (${row.min_sheet_thk}-${row.sheet_thk_max}) for ${s.thread} FH4 studs; PEM notes performance may be reduced in thicker sheets.`, actions: [stdSuggest(mat, t => t >= num(row.min_sheet_thk) && t <= num(row.sheet_thk_max), '0' + row.sheet_thk_max, true)] });
  }
  if (validT && !protrudes(row)) {
    out.warnings.push({ text: `Stud length L ${row.length_L} does not protrude past ${fmtThk(T)} in sheet (L is measured from the flush head face).`,
      actions: firstFit ? [{ label: `Use L ${firstFit.length_L}`, patch: { len: firstFit.length_L } }] : [] });
  } else if (validT && stk && !clears(row)) {
    const stackTxt = `2 X ${fmtThk(T)} sheet + ${stk.washer_pn} washer ${dec(stk.washer_thk_max)} max + ${stk.nut_pn} nut ${dec(stk.nut_height_max)} max = ${dec(reqL.toFixed(3))} in`;
    out.warnings.push({ text: firstFit
        ? `Stud length L ${row.length_L} is short of the required clearance: ${stackTxt}.`
        : `No confirmed ${hwName(pick.key, 'stud')} ${s.thread} stud length clears ${stackTxt}. Longest available is L ${rows[rows.length - 1].length_L}.`,
      actions: firstFit && s.len !== 'auto' ? [{ label: `Use L ${firstFit.length_L} (shortest that clears)`, patch: { len: firstFit.length_L } }] : firstFit ? [] : [{ label: 'Use threaded insert instead', patch: { type: 'insert', len: 'auto', hwmat: 'auto' } }] });
  }
  const { pn, cage } = pnFor(row, s);
  const hs = holeSize(row.hole_dia_in_sheet, row.hole_tol);
  out.prep.push(`${q}${hs.text} THRU`);
  if (hs.adjusted) out.info.push(`Spec hole ${hs.spec} has 4 places; the nominal is rounded inward to ${hs.nominal} so it stays inside the spec range (${hs.limits}).`);
  out.info.push(`Hole size tolerance is per the drawing title block. Spec hole: ${hs.spec}.`);
  out.install.push('INSTALL SELF-CLINCHING STUD', `PN: ${pn}`, `CAGE: ${cage}`, `${sideWord} FLUSH`);
  out.commercial = { pn: row.commercial_pem_pn, basis: row.commercial_pem_basis, hidden: false, isNotePN: row.commercial_only === 'Y' };
  const edge = row.min_edge_dist_spec || '';
  const edgeSrc = row.commercial_only === 'Y' ? 'PEM' : 'spec';
  out.info.push(edge ? `Minimum hole center to sheet edge: ${edge} (${edgeSrc}).` : `Minimum edge distance is not legible in the spec${row.min_edge_dist_vendor_ref ? `; PEM reference value ${row.min_edge_dist_vendor_ref} (not from spec)` : ''}.`);
  if (stk && validT) out.info.push(`Auto length clears 2 X sheet (${fmtThk(T)} + ${fmtThk(T)} mating part) + ${stk.washer_pn} washer (${dec(stk.washer_thk_max)} max) + ${stk.nut_pn} lock nut (${dec(stk.nut_height_max)} max) = ${dec(reqL.toFixed(3))} in. L ${row.length_L} ${num(row.length_L) >= reqL - 1e-9 ? 'clears by ' + dec((num(row.length_L) - reqL).toFixed(3)) : 'is short by ' + dec((reqL - num(row.length_L)).toFixed(3))} in.`);
  out.info.push(row.commercial_only === 'Y' ? `Recommended mating nut tightening torque: ${row.nut_tightening_torque_max_inlb} in-lb (PEM).` : `Mating nut tightening torque: ${row.nut_tightening_torque_max_inlb} in-lb max.`);
  if (row.commercial_only === 'Y') {
    out.info.push('Install with the PEM special anvil with a raised ring. FH4 is 400-series stainless: magnetic, and not for appreciable corrosive exposure or service above 300\u00b0F (PEM).');
    if (row.max_hole_in_attached_parts) out.info.push(`Max clearance hole in attached parts: ${row.max_hole_in_attached_parts}.`);
  }
  commercialOnlyInfo(row, 'stud', out);
  const tg = THREAD_GEOM[s.thread];
  out.geom = {
    kind: 'stud', T, side: s.side, P: 1 / tg.tpi, D: tg.D, tpi: tg.tpi,
    hole: num(row.hole_dia_in_sheet), holeLabel: hs.text.split(' ')[0], headD: num(row.head_dia), S: num(row.unthreaded_S_max), SLabel: row.unthreaded_S_max, minSheet: num(row.min_sheet_thk),
    headDLabel: row.head_dia, L: num(row.length_L), LLabel: row.length_L,
  };
  out.details = [
    ['PN / CAGE (current)', `${row.note_pn} / ${row.note_cage}`],
    ['Legacy CAGE', row.legacy_cage || 'none (commercial-only part)'],
    ['Stud material', row.material],
    ['Max sheet hardness', `${row.max_sheet_hardness_HRB} HRB`],
    ['Length L', `${row.length_L} ${row.length_tol} (${row.length_datum})`],
    ['Sheet thickness', row.sheet_thk_max ? `${row.min_sheet_thk}-${row.sheet_thk_max} (PEM)` : `${row.min_sheet_thk} min`],
    ['Hole in sheet', `${hs.text} THRU (spec ${hs.spec}; tolerance per title block)`],
    ['Head dia H', `${row.head_dia} ${row.head_dia_tol}`],
    ['Unthreaded length S (max, from head face)', row.unthreaded_S_max],
    ['Min edge distance', edge || `not legible in spec (PEM ref ${row.min_edge_dist_vendor_ref})`],
    ['Protrusion past far face', validT ? dec((num(row.length_L) - T).toFixed(3)) : 'n/a'],
    ...(stk ? [
      ['Mating washer (length basis)', `${stk.washer_pn}, ${dec(stk.washer_thk_nom)} ${stk.washer_thk_tol} (${dec(stk.washer_thk_max)} max)`],
      ['Mating lock nut (length basis)', `${stk.nut_pn}, height ${dec(stk.nut_height_min)}-${dec(stk.nut_height_max)}`],
      ['Required L (2T + washer + nut)', validT ? dec(reqL.toFixed(3)) : 'n/a'],
    ] : []),
  ];
}

// ---------------------------------------------------------------- URL state
const KEYS = Object.keys(DEFAULT_STATE);
export function encodeState(s) {
  const p = new URLSearchParams();
  for (const k of KEYS) if (String(s[k]) !== String(DEFAULT_STATE[k])) p.set(k, String(s[k]));
  return p.toString();
}
export function decodeState(str) {
  const p = new URLSearchParams(str.replace(/^#/, ''));
  const s = {};
  for (const k of KEYS) if (p.has(k)) s[k] = p.get(k);
  return s;
}
