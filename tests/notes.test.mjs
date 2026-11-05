// Golden-note tests: node tests/notes.test.mjs
import { readFileSync } from 'node:fs';
import { parseCSV, compute } from '../src/logic.js';
const rd = f => parseCSV(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8'));
const data = { inserts: rd('hardware_ms21208.csv'), nuts: [...rd('hardware_m45938_1.csv'), ...rd('hardware_pem_sp.csv')], studs: [...rd('hardware_m63540_1.csv'), ...rd('hardware_pem_fh4.csv')], materials: rd('materials.csv') };
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
check('nut A304 -> PEM SP commercial-only, caution + insert action', { type: 'nut', material: 'A304 (annealed)', thk: '0.125' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: SP-032-2', 'CAGE: 46384', 'NEAR SIDE'], o => o.commercialOnly && o.commercial.isNotePN && o.nonCompliant && o.warnings.some(w => w.text.includes('90 HRB or less') && w.actions.some(a => a.patch.type === 'insert')));
check('nut A304 4-40 .040 -> SP-440-1 (longest shank that fits)', { type: 'nut', material: 'A304 (annealed)', thread: '4-40', thk: '0.040', qty: '1' },
  ['THRU .166 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: SP-440-1', 'CAGE: 46384', 'NEAR SIDE']);
check('nut A304 1/4-20 .062 far -> SP-0420-1', { type: 'nut', material: 'A304 (annealed)', thread: '1/4-20', thk: '0.062', side: 'far' },
  ['4X THRU .344 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: SP-0420-1', 'CAGE: 46384', 'FAR SIDE']);
check('stud A304 10-32 .060 -> FH4-032-5, compliant at limit', { type: 'stud', material: 'A304 (annealed)', thk: '0.060' },
  ['4X THRU .189 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-032-5', 'CAGE: 46384', 'NEAR SIDE FLUSH'], o => o.commercialOnly && !o.nonCompliant && o.info.some(t => t.includes('at the limit')));
check('stud A304 .250 above FH4 sheet range -> warn', { type: 'stud', material: 'A304 (annealed)' },
  ['4X THRU .189 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-032-5', 'CAGE: 46384', 'NEAR SIDE FLUSH'], o => o.nonCompliant && o.warnings.some(w => w.text.includes('.040-.095')));
check('stud A304 1/4-20 .090 far, L .625 -> FH4-0420-10', { type: 'stud', material: 'A304 (annealed)', thread: '1/4-20', thk: '0.090', side: 'far', len: '.625' },
  ['4X THRU .249 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-0420-10', 'CAGE: 46384', 'FAR SIDE FLUSH'], o => !o.nonCompliant);
check('legacy PN mode keeps PEM CAGE for commercial-only rows', { type: 'stud', material: 'A304 (annealed)', thk: '0.060', pnmode: 'legacy' },
  ['4X THRU .189 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-032-5', 'CAGE: 46384', 'NEAR SIDE FLUSH']);
check('6061 nut auto still picks mil CRES, not PEM', { type: 'nut', thk: '0.090' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => !o.commercialOnly);
check('nut aluminum requested in 6061 -> ignored, CRES used', { type: 'nut', hwmat: 'aluminum', thk: '0.090' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.hwmatChosen === 'cres' && !o.hwmatAvail.includes('aluminum') && !o.hwmatAvail.includes('carbon'));
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
check('A1008 insert uses steel drill column', { material: 'A1008 CS Type B' },
  ['4X DRILL 13/64 (.2031) THRU', 'CSINK .230-.260', 'TAP 10-32 STI THRU', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant);
check('A1008 nut auto -> CRES at limit (carbon not allowed)', { type: 'nut', material: 'A1008 CS Type B', thk: '0.090' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.hwmatChosen === 'cres' && !o.nonCompliant && o.info.some(t => t.includes('at the limit')));
check('A1008 nut carbon requested -> ignored, CRES used', { type: 'nut', material: 'A1008 CS Type B', thk: '0.090', hwmat: 'carbon' },
  ['4X THRU .250 +.003/-.000', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.hwmatChosen === 'cres');
check('A1008 stud auto -> CRES at limit', { type: 'stud', material: 'A1008 CS Type B', thk: '0.090', len: '.625' },
  ['4X THRU .189 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-38C', 'CAGE: 80205', 'NEAR SIDE FLUSH'], o => o.hwmatChosen === 'cres' && !o.nonCompliant);
check('5052 stud and nut never offer carbon or aluminum', { type: 'stud', material: '5052-H32', thk: '0.090', len: '.625' },
  ['4X THRU .189 +.003/-.000', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-38C', 'CAGE: 80205', 'NEAR SIDE FLUSH'], o => o.hwmatAvail.join() === 'cres,pem');
// Standard stock thickness snapping (materials.csv std_thk_in)
function checkSnap(name, state, label, thk, std) {
  const o = compute(state, data);
  const a = o.warnings.flatMap(w => w.actions).find(x => x.patch.thk);
  const ok = a && a.label === label && a.patch.thk === thk && (!std || std(o.thkStd));
  if (!ok) { fail++; console.log('FAIL', name, a, o.thkStd); } else console.log('ok  ', name);
}
checkSnap('insert 6061 .100 thru -> 1/4 plate', { thk: '0.100' }, 'Set thickness to .250 (1/4 plate T651)', '0.250', t => t.match && t.match.value === '0.100');
checkSnap('insert 6061 .100 blind -> 5/8 plate', { thk: '0.100', hole: 'blind' }, 'Set thickness to .625 (5/8 plate T651)', '0.625');
checkSnap('insert A1008 .100 -> non-standard (exceeds cold rolled stock)', { thk: '0.100', material: 'A1008 CS Type B' }, 'Set thickness to .220 (non-standard)', '0.220');
checkSnap('nut 6061 .030 -> .063 sheet', { type: 'nut', thk: '0.030' }, 'Set thickness to .063 (std sheet)', '0.063', t => t.below.value === '0.025' && t.above.value === '0.032');
checkSnap('nut A1008 .020 -> 16 GA', { type: 'nut', thk: '0.020', material: 'A1008 CS Type B' }, 'Set thickness to .0598 (16 GA)', '0.0598');
checkSnap('stud A1008 1/4-20 .050 -> 14 GA', { type: 'stud', thread: '1/4-20', thk: '0.050', material: 'A1008 CS Type B' }, 'Set thickness to .0747 (14 GA)', '0.0747');
checkSnap('FH4 A304 .125 above max -> largest std in range 13 GA', { type: 'stud', material: 'A304 (annealed)', thk: '0.125' }, 'Set thickness to .090 (13 GA)', '0.090');
checkSnap('FH4 A304 .030 below min -> 19 GA', { type: 'stud', material: 'A304 (annealed)', thk: '0.030' }, 'Set thickness to .042 (19 GA)', '0.042', t => t.match.label === '22 GA');
{
  const o = compute({ type: 'nut', material: 'A1008 CS Type B', thk: '0.060' }, data);
  const ok = o.thkStd.match && o.thkStd.match.label === '16 GA';
  if (!ok) { fail++; console.log('FAIL .060 matches 16 GA nominal'); } else console.log('ok   .060 entry matches 16 GA (.0598) within tolerance');
  const d = compute({ material: 'A1008 CS Type B' }, data);
  const ok2 = !d.thkStd.match && d.thkStd.below.value === '0.1345' && !d.thkStd.above;
  if (!ok2) { fail++; console.log('FAIL A1008 .250 flagged non-standard'); } else console.log('ok   A1008 .250 flagged non-standard, nearest 10 GA');
}
if (fail) { console.log(fail + ' failed'); process.exit(1); } else console.log('all passed');
