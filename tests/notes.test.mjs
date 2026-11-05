// Golden-note tests: node tests/notes.test.mjs
import { readFileSync } from 'node:fs';
import { parseCSV, compute } from '../src/logic.js';
const rd = f => parseCSV(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8'));
const data = { inserts: rd('hardware_ms21208.csv'), nuts: rd('hardware_m45938_1.csv'), studs: rd('hardware_m63540_1.csv'), materials: rd('materials.csv') };
let fail = 0;
function check(name, state, expected, extra) {
  const o = compute(state, data);
  const ok = o.noteText === expected.join('\n') && (!extra || extra(o));
  if (!ok) { fail++; console.log('FAIL', name, '\n' + o.noteText, '\n--- warnings:', o.warnings.map(w => w.text)); } else console.log('ok  ', name);
}
check('PRD insert example (10-32, 6061-T6, .700 blind, plug)', { thk: '0.700', hole: 'blind' },
  ['4X DRILL #7 (.2010) MIN DEPTH .568', 'CSINK .230-.260', 'TAP 10-32 STI', 'MIN FULL-THREAD DEPTH .320', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124695', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant);
check('insert A304 uses steel drill, legacy PN', { material: 'A304 (annealed)', pnmode: 'legacy', qty: '1', side: 'far', thk: '0.700', hole: 'blind' },
  ['DRILL 13/64 (.2031) MIN DEPTH .568', 'CSINK .230-.260', 'TAP 10-32 STI', 'MIN FULL-THREAD DEPTH .320', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS21208F1-15', 'CAGE: 96906', 'FAR SIDE']);
check('insert 8-32 thru .500 -> 3D (H .520 > .5 so 2.5D)', { thread: '8-32', hole: 'thru', thk: '0.500' },
  ['4X DRILL #17 (.1730) THRU', 'CSINK .200-.230', 'TAP 8-32 STI THRU', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS122199', 'CAGE: 80205', 'NEAR SIDE']);
check('nut 10-32 6061 .090 -> CRES 16C', { type: 'nut', thk: '0.090' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.commercial.pn === 'CLSS-032-2' && !o.nonCompliant);
check('nut 10-32 .125 -> 17C, far side', { type: 'nut', thk: '0.125', side: 'far', qty: '2' },
  ['2X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-17C', 'CAGE: 80205', 'FAR SIDE']);
check('nut A304 non-compliant + insert suggestion', { type: 'nut', material: 'A304 (annealed)', thk: '0.125' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-17C', 'CAGE: 80205', 'NEAR SIDE'], o => o.nonCompliant && o.warnings.some(w => w.actions.some(a => a.patch.type === 'insert')));
check('nut aluminum forced in 6061 -> warn', { type: 'nut', hwmat: 'aluminum', thk: '0.090' },
  ['4X THRU .296 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-18A', 'CAGE: 80205', 'NEAR SIDE'], o => o.nonCompliant);
check('stud PRD example 10-32 .625 CRES near flush', { type: 'stud', thk: '0.090', len: '.625' },
  ['4X THRU .189 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-38C', 'CAGE: 80205', 'NEAR SIDE FLUSH'], o => o.commercial.pn === 'FHS-032-10');
check('stud 1/4-20 thin sheet warning', { type: 'stud', thread: '1/4-20', thk: '0.050', side: 'far' },
  ['4X THRU .249 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-44C', 'CAGE: 80205', 'FAR SIDE FLUSH'], o => o.nonCompliant);
check('insert thin sheet: no length fits', { thk: '0.100', hole: 'blind' },
  ['4X DRILL #7 (.2010) MIN DEPTH .472', 'CSINK .230-.260', 'TAP 10-32 STI', 'MIN FULL-THREAD DEPTH .220', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => o.nonCompliant);
check('csink symbol modes', { csk: 'sw', cskAngle: true, qty: '1', thk: '0.700', hole: 'blind' },
  ['DRILL #7 (.2010) MIN DEPTH .568', '<MOD-CSK> .230-.260 X 120\u00b0', 'TAP 10-32 STI', 'MIN FULL-THREAD DEPTH .320', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124695', 'CAGE: 80205', 'NEAR SIDE']);
check('insert .625 blind: drill point rule drops to 1D', { thk: '0.625', hole: 'blind' },
  ['4X DRILL #7 (.2010) MIN DEPTH .472', 'CSINK .230-.260', 'TAP 10-32 STI', 'MIN FULL-THREAD DEPTH .220', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant);
check('insert .625 forced 1.5D warns with bottoming/thru actions', { thk: '0.625', len: '1.5', hole: 'blind' },
  ['4X DRILL #7 (.2010) MIN DEPTH .568', 'CSINK .230-.260', 'TAP 10-32 STI', 'MIN FULL-THREAD DEPTH .320', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124695', 'CAGE: 80205', 'NEAR SIDE'], o => o.nonCompliant && o.warnings[0].actions.length === 3);
check('app default (10-32 insert, 6061-T6, .250 thru)', {},
  ['4X DRILL #7 (.2010) THRU', 'CSINK .230-.260', 'TAP 10-32 STI THRU', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant && o.state.thk === '0.250' && o.state.hole === 'thru');
if (fail) { console.log(fail + ' failed'); process.exit(1); } else console.log('all passed');
