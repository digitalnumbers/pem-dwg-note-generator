// Golden-note tests: node tests/notes.test.mjs
import { readFileSync } from 'node:fs';
import { parseCSV, compute } from '../src/logic.js';
const rd = f => parseCSV(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8'));
const data = { inserts: rd('hardware_ms21208.csv'), nuts: [...rd('hardware_m45938_1.csv'), ...rd('hardware_pem_sp.csv')], studs: [...rd('hardware_m63540_1.csv'), ...rd('hardware_pem_fh4.csv')], materials: rd('materials.csv'), stack: rd('hardware_stud_stack.csv'), studPerf: rd('pem_fh_performance.csv'), clinchDrills: rd('clinch_drills.csv') };
let fail = 0;
function check(name, state, expected, extra) {
  const o = compute(state, data);
  const ok = o.noteText === expected.join('\n') && (!extra || extra(o));
  if (!ok) { fail++; console.log('FAIL', name, '\n' + o.noteText, '\n--- warnings:', o.warnings.map(w => w.text)); } else console.log('ok  ', name);
}
check('PRD insert example (10-32, 6061-T6, .700 blind, plug)', { thk: '0.700', hole: 'blind' },
  ['4X DRILL #7 (\u00d8.201) <HOLE-DEPTH>.568 MIN', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI <HOLE-DEPTH>.320 MIN FULL THREAD', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124695', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant);
check('insert A304 uses steel drill, legacy PN', { material: 'A304 (annealed)', pnmode: 'legacy', qty: '1', side: 'far', thk: '0.700', hole: 'blind' },
  ['DRILL 13/64 (\u00d8.203) <HOLE-DEPTH>.568 MIN', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI <HOLE-DEPTH>.320 MIN FULL THREAD', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS21208F1-15', 'CAGE: 96906', 'FAR SIDE']);
check('insert 8-32 thru .500 -> 3D (H .520 > .5 so 2.5D)', { thread: '8-32', hole: 'thru', thk: '0.500' },
  ['4X DRILL #17 (\u00d8.173) THRU', '<HOLE-SINK>\u00d8.200-.230 X 120\u00b0', 'TAP 8-32 STI THRU', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS122199', 'CAGE: 80205', 'NEAR SIDE']);
check('nut 10-32 6061 .090 -> CRES 16C', { type: 'nut', thk: '0.090' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.commercial.pn === 'CLSS-032-2' && !o.nonCompliant);
check('nut 10-32 .125 -> 17C, far side', { type: 'nut', thk: '0.125', side: 'far', qty: '2' },
  ['2X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-17C', 'CAGE: 80205', 'FAR SIDE']);
check('nut A304 -> PEM SP commercial-only, caution + insert action', { type: 'nut', material: 'A304 (annealed)', thk: '0.125' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: SP-032-2', 'CAGE: 46384', 'NEAR SIDE'], o => o.commercialOnly && o.commercial.isNotePN && o.nonCompliant && o.warnings.some(w => w.text.includes('90 HRB or less') && w.actions.some(a => a.patch.type === 'insert')));
check('nut A304 4-40 .040 -> SP-440-1 (longest shank that fits)', { type: 'nut', material: 'A304 (annealed)', thread: '4-40', thk: '0.040', qty: '1' },
  ['DRILL #19 (\u00d8.166) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: SP-440-1', 'CAGE: 46384', 'NEAR SIDE']);
check('nut A304 1/4-20 .062 far -> SP-0420-1', { type: 'nut', material: 'A304 (annealed)', thread: '1/4-20', thk: '0.062', side: 'far' },
  ['4X DRILL 11/32 (\u00d8.344) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: SP-0420-1', 'CAGE: 46384', 'FAR SIDE']);
check('stud A304 10-32 .060 -> FH4-032-8 (auto clears 2T + NAS1149 + MS21044), compliant at limit', { type: 'stud', material: 'A304 (annealed)', thk: '0.060' },
  ['4X DRILL #12 (\u00d8.189) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-032-8', 'CAGE: 46384', 'NEAR SIDE FLUSH'], o => o.commercialOnly && !o.nonCompliant && o.info.some(t => t.includes('at the limit')));
check('stud A304 .250 above FH4 sheet range -> warn, auto L clears .850', { type: 'stud', material: 'A304 (annealed)' },
  ['4X DRILL #12 (\u00d8.189) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-032-14', 'CAGE: 46384', 'NEAR SIDE FLUSH'], o => o.nonCompliant && o.warnings.some(w => w.text.includes('.040-.095')));
check('stud A304 1/4-20 .090 far, L .625 -> FH4-0420-10', { type: 'stud', material: 'A304 (annealed)', thread: '1/4-20', thk: '0.090', side: 'far', len: '.625' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-0420-10', 'CAGE: 46384', 'FAR SIDE FLUSH'], o => !o.nonCompliant);
check('legacy PN mode keeps PEM CAGE for commercial-only rows', { type: 'stud', material: 'A304 (annealed)', thk: '0.060', pnmode: 'legacy' },
  ['4X DRILL #12 (\u00d8.189) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: FH4-032-8', 'CAGE: 46384', 'NEAR SIDE FLUSH']);
check('6061 nut auto still picks mil CRES, not PEM', { type: 'nut', thk: '0.090' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => !o.commercialOnly);
check('nut aluminum requested in 6061 -> ignored, CRES used', { type: 'nut', hwmat: 'aluminum', thk: '0.090' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.hwmatChosen === 'cres' && !o.hwmatAvail.includes('aluminum') && !o.hwmatAvail.includes('carbon'));
check('stud PRD example 10-32 .625 CRES near flush', { type: 'stud', thk: '0.090', len: '.625' },
  ['4X DRILL #12 (\u00d8.189) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-38C', 'CAGE: 80205', 'NEAR SIDE FLUSH'], o => o.commercial.pn === 'FHS-032-10');
check('stud 1/4-20 thin sheet warning', { type: 'stud', thread: '1/4-20', thk: '0.050', side: 'far' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-45C', 'CAGE: 80205', 'FAR SIDE FLUSH'], o => o.nonCompliant);
check('insert thin sheet: no length fits', { thk: '0.100', hole: 'blind' },
  ['4X DRILL #7 (\u00d8.201) <HOLE-DEPTH>.472 MIN', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI <HOLE-DEPTH>.220 MIN FULL THREAD', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => o.nonCompliant);
check('countersink angle always included (ASME Y14.5 4.5.12), legacy csk params ignored', { csk: 'sw', cskAngle: 'false', qty: '1', thk: '0.700', hole: 'blind' },
  ['DRILL #7 (\u00d8.201) <HOLE-DEPTH>.568 MIN', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI <HOLE-DEPTH>.320 MIN FULL THREAD', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124695', 'CAGE: 80205', 'NEAR SIDE']);
check('insert .625 blind: drill point rule drops to 1D', { thk: '0.625', hole: 'blind' },
  ['4X DRILL #7 (\u00d8.201) <HOLE-DEPTH>.472 MIN', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI <HOLE-DEPTH>.220 MIN FULL THREAD', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant);
check('insert .625 forced 1.5D warns with bottoming/thru actions', { thk: '0.625', len: '1.5', hole: 'blind' },
  ['4X DRILL #7 (\u00d8.201) <HOLE-DEPTH>.568 MIN', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI <HOLE-DEPTH>.320 MIN FULL THREAD', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124695', 'CAGE: 80205', 'NEAR SIDE'], o => o.nonCompliant && o.warnings[0].actions.length === 3);
check('app default (10-32 insert, 6061-T6, .250 thru)', {},
  ['4X DRILL #7 (\u00d8.201) THRU', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI THRU', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant && o.state.thk === '0.250' && o.state.hole === 'thru');
check('A1008 insert uses steel drill column', { material: 'A1008 CS Type B' },
  ['4X DRILL 13/64 (\u00d8.203) THRU', '<HOLE-SINK>\u00d8.230-.260 X 120\u00b0', 'TAP 10-32 STI THRU', 'INSTALL THREADED INSERT', 'BREAK TANG', 'PN: MS124655', 'CAGE: 80205', 'NEAR SIDE'], o => !o.nonCompliant);
check('A1008 nut auto -> CRES at limit (carbon not allowed)', { type: 'nut', material: 'A1008 CS Type B', thk: '0.090' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.hwmatChosen === 'cres' && !o.nonCompliant && o.info.some(t => t.includes('at the limit')));
check('A1008 nut carbon requested -> ignored, CRES used', { type: 'nut', material: 'A1008 CS Type B', thk: '0.090', hwmat: 'carbon' },
  ['4X DRILL 1/4 (\u00d8.250) THRU', 'INSTALL SELF-CLINCHING NUT', 'PN: M45938/1-16C', 'CAGE: 80205', 'NEAR SIDE'], o => o.hwmatChosen === 'cres');
check('A1008 stud auto -> CRES at limit', { type: 'stud', material: 'A1008 CS Type B', thk: '0.090', len: '.625' },
  ['4X DRILL #12 (\u00d8.189) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-38C', 'CAGE: 80205', 'NEAR SIDE FLUSH'], o => o.hwmatChosen === 'cres' && !o.nonCompliant);
check('5052 stud and nut never offer carbon or aluminum', { type: 'stud', material: '5052-H32', thk: '0.090', len: '.625' },
  ['4X DRILL #12 (\u00d8.189) THRU', 'INSTALL SELF-CLINCHING STUD', 'PN: M63540/1-38C', 'CAGE: 80205', 'NEAR SIDE FLUSH'], o => o.hwmatAvail.join() === 'cres,pem');
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
checkSnap('nut A1008 .020 -> 16 GA', { type: 'nut', thk: '0.020', material: 'A1008 CS Type B' }, 'Set thickness to .060 (16 GA)', '0.060');
checkSnap('stud A1008 1/4-20 .050 -> 14 GA', { type: 'stud', thread: '1/4-20', thk: '0.050', material: 'A1008 CS Type B' }, 'Set thickness to .075 (14 GA)', '0.075');
checkSnap('FH4 A304 .125 above max -> largest std in range 13 GA', { type: 'stud', material: 'A304 (annealed)', thk: '0.125' }, 'Set thickness to .090 (13 GA)', '0.090');
checkSnap('FH4 A304 .030 below min -> 19 GA', { type: 'stud', material: 'A304 (annealed)', thk: '0.030' }, 'Set thickness to .042 (19 GA)', '0.042', t => t.match.label === '22 GA');
{
  const o = compute({ type: 'nut', material: 'A1008 CS Type B', thk: '0.060' }, data);
  const ok = o.thkStd.match && o.thkStd.match.label === '16 GA';
  if (!ok) { fail++; console.log('FAIL .060 matches 16 GA nominal'); } else console.log('ok   .060 entry matches 16 GA (.0598) within tolerance');
  const d = compute({ material: 'A1008 CS Type B' }, data);
  const ok2 = !d.thkStd.match && d.thkStd.below.value === '0.135' && !d.thkStd.above;
  if (!ok2) { fail++; console.log('FAIL A1008 .250 flagged non-standard'); } else console.log('ok   A1008 .250 flagged non-standard, nearest 10 GA');
}

// v1.4: max 3 decimal places and symbol tags
import { round3, dec, cap3, holeSize, fmtThk } from '../src/logic.js';
{
  const cases = [[round3('0.2055'), '0.206'], [round3('0.2010'), '0.201'], [round3('0.1345'), '0.135'], [round3('0.0598'), '0.060'], [round3('0.250'), '0.250'], [dec('0.1875'), '.188'], [round3(0.99951), '1.000'],
    [cap3('0.0188-0.0375 in'), '.019-.038 in'], [cap3('M45938/1-16C 1.5D 6.7mm'), 'M45938/1-16C 1.5D 6.7mm'], [fmtThk(0.0598), '.060'], [fmtThk(0.25), '.250'],
    [holeSize('.1875', '+.003/-.000').text, '\u00d8.188'], [holeSize('.250', '+.003/-.000').text, '\u00d8.250']];
  for (const [got, want] of cases) { if (got !== want) { fail++; console.log('FAIL 3-place format', got, '!=', want); } }
  console.log('ok   3-place formatting helpers');
  // No value anywhere in any in-scope note, info, warning or details has more than 3 decimal places.
  let worst = null;
  for (const type of ['insert', 'nut', 'stud']) for (const material of ['5052-H32', '6061-T6', 'A304 (annealed)', 'A1008 CS Type B'])
    for (const thread of ['4-40', '8-32', '10-32', '1/4-20']) for (const thk of ['0.020', '0.0598', '0.090', '0.1345', '0.250', '0.700']) for (const hole of ['thru', 'blind']) {
      const o = compute({ type, material, thread, thk, hole }, data);
      const txt = [o.noteText, ...o.info, ...o.warnings.map(w => w.text + ' ' + w.actions.map(a => a.label).join(' ')), ...(o.details || []).flat()].join('\n');
      const m = txt.match(/\d*\.\d{4,}/);
      if (m) worst = worst || `${type} ${material} ${thread} ${thk} ${hole}: ${m[0]}`;
      if (type === 'insert' && !o.noteText.includes('X 120\u00b0')) worst = worst || `${type} ${thread}: missing csk angle`;
    }
  if (worst) { fail++; console.log('FAIL max 3 places / csk angle:', worst); } else console.log('ok   every note, info, warning and detail is at most 3 places; every insert note has the csk angle');
}
if (fail) { console.log(fail + ' failed'); process.exit(1); } else console.log('all passed');

// v1.5 stud auto length: shortest L >= 2T + NAS1149 washer max + lock nut max
{ const o = compute({ type: 'stud', thk: '0.090' }, data); const ok = o.row.length_L === '.625' && Math.abs(o.studStack.reqL - .530) < 1e-9;
  if (!ok) { fail++; console.log('FAIL stud auto length 10-32 .090 -> L .625 (req .530)', o.row.length_L); } else console.log('ok   stud auto length 10-32 .090 -> L .625 (req .530)'); }
{ const o = compute({ type: 'stud', thk: '0.090', len: '.375' }, data); const ok = o.nonCompliant && o.warnings.some(w => w.text.includes('short of the required clearance') && w.actions.some(a => a.patch.len === '.625'));
  if (!ok) { fail++; console.log('FAIL manual short stud warns'); } else console.log('ok   manual short stud warns with shortest-that-clears action'); }
{ const perf = st => compute(st, data).details.find(d => d[0].startsWith('Push-out / torque-out / pull-thru'));
  const a = perf({ type: 'stud', material: '6061-T6', thread: '10-32', thk: '0.090' }), b = perf({ type: 'stud', material: 'A1008 CS Type B', thread: '1/4-20', thk: '0.090' }), c = perf({ type: 'stud', material: 'A304 (annealed)', thread: '10-32', thk: '0.060' });
  const ok = a && a[0].includes('FHS') && a[0].includes('Aluminum') && a[1] === '270 lb / 30 in-lb / 1220 lb' && b && b[0].includes('Steel') && b[1] === '575 lb / 100 in-lb / 2550 lb' && c && c[1] === '800 lb / 95 in-lb / 2250 lb';
  if (!ok) { fail++; console.log('FAIL stud PEM performance row', a, b, c); } else console.log('ok   stud spec values show PEM push-out / torque-out / pull-thru'); }
if (fail) process.exitCode = 1;
