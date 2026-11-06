import { APP_VERSION, threadList, materialList, HW_MAT_LABEL, DEFAULT_STATE, parseCSV, compute, encodeState, decodeState, stdThicknesses, stdName, dec } from './logic.js?v=1.8.0';
import { drawSection, VB_W } from './drawing.js?v=1.8.0';

const $ = id => document.getElementById(id);
const form = $('form');
const LEN_LABEL = { insert: 'Insert length', nut: 'Shank length A', stud: 'Stud length L (from head face)' };

let data = null, sources = {}, state = { ...DEFAULT_STATE }, last = null;

async function loadCSV(name) {
  const r = await fetch(`data/${name}`);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return parseCSV(await r.text());
}

async function init() {
  $('ver').textContent = `v${APP_VERSION}`;
  try {
    const [inserts, nuts, studs, spNuts, fh4Studs, materials, src, stack, studPerf, clinchDrills, threads] = await Promise.all(['hardware_ms21208.csv', 'hardware_m45938_1.csv', 'hardware_m63540_1.csv', 'hardware_pem_sp.csv', 'hardware_pem_fh4.csv', 'materials.csv', 'sources.csv', 'hardware_stud_stack.csv', 'pem_fh_performance.csv', 'clinch_drills.csv', 'threads.csv'].map(loadCSV));
    // Commercial-only PEM rows (no mil PN) join the same pools; auto-select uses them only when no mil part is rated.
    data = { inserts, nuts: [...nuts, ...spNuts], studs: [...studs, ...fh4Studs], materials, stack, studPerf, clinchDrills, threads };
    for (const r of src) sources[r.id] = r;
  } catch (e) {
    $('note').textContent = 'Could not load the spec data files. ' + e.message;
    return;
  }
  // Thread and material choices come from threads.csv and materials.csv (v1.8.0).
  $('material').innerHTML = materialList(data).map(m => `<option value="${m}">${m}</option>`).join('');
  $('threads').innerHTML = threadList(data).map(t => `<label><input type="radio" name="thread" value="${t}"><span>${t}</span></label>`).join('');
  try { state = { ...DEFAULT_STATE, ...decodeState(location.hash) }; } catch { state = { ...DEFAULT_STATE }; }
  writeForm();
  update();
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  window.addEventListener('hashchange', () => { state = { ...DEFAULT_STATE, ...decodeState(location.hash) }; writeForm(); update(false); });
  $('reset').addEventListener('click', () => { state = { ...DEFAULT_STATE }; writeForm(); update(); });
  $('copy').addEventListener('click', () => copy(last?.noteText, 'Note copied'));
  $('copy-prep').addEventListener('click', () => copy(last?.prepText, 'Hole prep copied'));
  $('copy-link').addEventListener('click', () => copy(location.href, 'Link copied'));
  $('dl-svg').addEventListener('click', downloadSVG);
  $('dl-png').addEventListener('click', downloadPNG);
  initThkCombo();
  initQtyCombo();
  new ResizeObserver(updateScale).observe(document.querySelector('.gfx-wrap'));
}

function onInput(e) {
  const t = e.target;
  if (!t.name) return;
  const v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.type === 'radio' && !t.checked) return;
  // Skip no-op events (e.g. the change event fired on blur after typing) so the warning
  // buttons are not re-rendered under the pointer mid-click.
  if (state[t.name] === v) return;
  const prevType = state.type, prevThread = state.thread, prevMat = state.hwmat;
  state[t.name] = v;
  // Length choices depend on type, thread and hardware material, so reset to Auto when those change.
  if (state.type !== prevType || state.thread !== prevThread || state.hwmat !== prevMat) state.len = 'auto';
  update();
}

function writeForm() {
  for (const el of form.elements) {
    if (!el.name || !(el.name in state)) continue;
    if (el.type === 'radio') el.checked = el.value === state[el.name];
    else if (el.type === 'checkbox') el.checked = !!state[el.name];
    else if (el.tagName === 'SELECT' && (el.name === 'len' || el.name === 'hwmat')) continue;
    else if (document.activeElement !== el) el.value = state[el.name];
  }
}

function setVisibility() {
  const t = state.type;
  form.querySelectorAll('[data-for]').forEach(el => {
    const f = el.dataset.for;
    el.hidden = !(f === t || (f === 'clinch' && t !== 'insert') || (f === 'insert-blind' && t === 'insert' && state.hole === 'blind'));
  });
  $('len-label').textContent = LEN_LABEL[t];
}

function fillSelects(o) {
  // hardware material
  const hw = $('hwmat');
  if (state.type !== 'insert') {
    const avail = o.hwmatAvail || [];
    hw.innerHTML = `<option value="auto">Auto (by substrate hardness)</option>` + avail.map(k => `<option value="${k}">${HW_MAT_LABEL[k]}</option>`).join('');
    hw.value = avail.includes(state.hwmat) ? state.hwmat : 'auto';
    $('hwmat-hint').textContent = o.hwmatReason || '';
  }
  // length
  const len = $('len');
  const autoChoice = o.choices.find(c => c.value === o.autoLen);
  const autoLabel = state.type === 'insert' ? 'longest that fits' : state.type === 'nut' ? 'matches thickness' : 'suggested 2T + washer + nut';
  len.innerHTML = `<option value="auto">Auto, ${autoLabel}${autoChoice ? ': ' + autoChoice.label.split('  ')[0] : ' (none fits)'}</option>` +
    o.choices.map(c => `<option value="${c.value}">${c.label}${c.fits || /does not clear/.test(c.label) ? '' : '  · does not fit'}</option>`).join('');
  len.value = o.choices.some(c => c.value === state.len) ? state.len : 'auto';
  $('len-hint').textContent = !o.choices.length ? '' : state.type === 'stud'
    ? `${o.choices.filter(c => c.fits).length} of ${o.choices.length} confirmed lengths clear ${state.thk || '?'} in; ${o.choices.filter(c => c.suggested).length} meet the suggested length.`
    : `${o.choices.filter(c => c.fits).length} of ${o.choices.length} confirmed lengths fit ${state.thk || '?'} in.`;
  const m = data.materials.find(r => r.material === state.material);
  fillThkStd(m, o);
  $('mat-hint').textContent = m ? [m.hardness_HB && `${m.hardness_HB} HB`, /^\d/.test(m.hardness_HRB) && m.hardness_HRB.replace(/^(\d+)\s*(.*)$/, (_, n, r) => `${n} HRB${r ? ' ' + r : ''}`)].filter(Boolean).join(' / ') + ` (${m.hardness_basis})` : '';
}

// Standard stock thicknesses for the selected material: datalist on the input plus a status hint.
function fillThkStd(m, o) {
  const list = stdThicknesses(m);
  const key = m ? m.material : '';
  const ul = $('thk-list');
  if (ul.dataset.mat !== key) {
    ul.dataset.mat = key;
    ul.innerHTML = list.length
      ? list.map((x, i) => `<li role="option" id="thk-opt-${i}" data-thk="${x.value}" aria-selected="false"><span class="v">${esc(dec(x.value))}</span><span class="n">${esc(stdName(x))}</span></li>`).join('')
      : `<li class="empty" aria-disabled="true">No standard thicknesses on file for this material. Type a value.</li>`;
  }
  markThkSelected();
  const h = $('thk-hint'), st = o.thkStd;
  if (!list.length || !st) { h.innerHTML = ''; return; }
  if (st.match) { h.textContent = `Standard ${m.material} stock: ${dec(st.match.value)} (${stdName(st.match)})`; return; }
  const btn = x => `<button type="button" class="snap" data-thk="${x.value}">${esc(dec(x.value) + ' ' + stdName(x))}</button>`;
  h.innerHTML = `Not a standard ${esc(m.material)} stock thickness.${st.below || st.above ? ' Nearest: ' + [st.below, st.above].filter(Boolean).map(btn).join(' ') : ''}`;
  h.querySelectorAll('button.snap').forEach(b => b.addEventListener('click', () => { state.thk = b.dataset.thk; if (state.len !== 'auto') state.len = 'auto'; writeForm(); update(); }));
}

// ---------------------------------------------------------------- thickness combobox
// The arrow always opens the full standard list for the material (unlike a native datalist,
// which filters by what is typed). The input stays free-entry for custom thicknesses.
let thkActive = -1;
const thkOpts = () => [...$('thk-list').querySelectorAll('li[role="option"]')];
function markThkSelected() {
  const T = parseFloat(state.thk);
  thkOpts().forEach(li => {
    const sel = Number.isFinite(T) && Math.abs(parseFloat(li.dataset.thk) - T) <= 0.0005 + 1e-9;
    li.setAttribute('aria-selected', sel ? 'true' : 'false');
  });
}
// v1.7.9: scroll an option within its own list only; never move the page.
function scrollInList(li, center = false) {
  const ul = li.parentElement; if (!ul) return;
  const top = li.offsetTop, h = li.offsetHeight, vh = ul.clientHeight;
  if (center) ul.scrollTop = Math.max(0, top - (vh - h) / 2);
  else if (top < ul.scrollTop) ul.scrollTop = top;
  else if (top + h > ul.scrollTop + vh) ul.scrollTop = top + h - vh;
}
// Run fn, then restore the page scroll position so re-rendering never jumps the page.
function keepScroll(fn) {
  const x = window.scrollX, y = window.scrollY;
  fn();
  window.scrollTo(x, y);
  requestAnimationFrame(() => window.scrollTo(x, y));
}
// v1.7.10: the list handles its own wheel scrolling. A freshly opened dropdown is not yet treated by the
// browser as the scroll target under a still cursor, so the first wheel events used to scroll the page.
function ownWheel(ul) {
  ul.addEventListener('wheel', e => {
    if (e.ctrlKey) return; // pinch-zoom
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? ul.clientHeight : 1;
    ul.scrollTop += e.deltaY * k;
  }, { passive: false });
}
function setThkActive(i) {
  const opts = thkOpts();
  opts.forEach(li => li.classList.remove('active'));
  thkActive = opts.length ? Math.max(0, Math.min(opts.length - 1, i)) : -1;
  const li = opts[thkActive];
  if (li) { li.classList.add('active'); scrollInList(li); $('thk').setAttribute('aria-activedescendant', li.id); }
  else $('thk').removeAttribute('aria-activedescendant');
}
function thkIsOpen() { return !$('thk-list').hidden; }
function openThk() {
  const ul = $('thk-list');
  ul.hidden = false;
  $('thk').setAttribute('aria-expanded', 'true'); $('thk-toggle').setAttribute('aria-expanded', 'true');
  $('thk-combo').classList.add('open');
  // Highlight the current value, else the nearest standard at or above it.
  const opts = thkOpts(), T = parseFloat(state.thk);
  let i = opts.findIndex(li => li.getAttribute('aria-selected') === 'true');
  if (i < 0 && Number.isFinite(T)) { i = opts.findIndex(li => parseFloat(li.dataset.thk) >= T); if (i < 0) i = opts.length - 1; }
  ul.scrollTop = 0;
  setThkActive(i < 0 ? 0 : i);
  if (opts[thkActive]) scrollInList(opts[thkActive], true);
}
function closeThk() {
  $('thk-list').hidden = true;
  $('thk').setAttribute('aria-expanded', 'false'); $('thk-toggle').setAttribute('aria-expanded', 'false');
  $('thk').removeAttribute('aria-activedescendant');
  $('thk-combo').classList.remove('open');
  thkOpts().forEach(li => li.classList.remove('active'));
}
function pickThk(v) {
  state.thk = v; if (state.len !== 'auto') state.len = 'auto';
  $('thk').value = v;
  keepScroll(() => { closeThk(); writeForm(); update(); });
}
function initThkCombo() {
  const inp = $('thk'), btn = $('thk-toggle'), ul = $('thk-list'), box = $('thk-combo');
  btn.addEventListener('mousedown', e => e.preventDefault()); // keep focus in the input
  btn.addEventListener('click', () => { if (thkIsOpen()) closeThk(); else { openThk(); inp.focus({ preventScroll: true }); } });
  ul.addEventListener('mousedown', e => e.preventDefault());
  ownWheel(ul);
  ul.addEventListener('click', e => { const li = e.target.closest('li[role="option"]'); if (li) pickThk(li.dataset.thk); });
  ul.addEventListener('mousemove', e => { const li = e.target.closest('li[role="option"]'); if (li) { const i = thkOpts().indexOf(li); if (i !== thkActive) { thkOpts().forEach(o => o.classList.remove('active')); li.classList.add('active'); thkActive = i; } } });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); // also stops the number input from stepping
      if (!thkIsOpen() || e.altKey) { openThk(); return; }
      setThkActive(thkActive + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && thkIsOpen()) {
      e.preventDefault(); const li = thkOpts()[thkActive]; if (li) pickThk(li.dataset.thk); else closeThk();
    } else if (e.key === 'Escape' && thkIsOpen()) { e.preventDefault(); closeThk(); }
    else if (e.key === 'Tab') closeThk();
  });
  inp.addEventListener('input', () => { if (thkIsOpen()) closeThk(); }); // typing = custom value
  inp.addEventListener('wheel', e => { if (document.activeElement === inp) e.preventDefault(); }, { passive: false });
  inp.addEventListener('blur', () => closeThk());
  document.addEventListener('mousedown', e => { if (thkIsOpen() && !box.contains(e.target)) closeThk(); });
}

// ---------------------------------------------------------------- quantity combobox
// Same pattern as the thickness combobox: the arrow opens a list of common quantities,
// and the input stays free-entry for any other whole number.
const QTY_OPTIONS = Array.from({ length: 50 }, (_, i) => i + 1);
let qtyActive = -1;
const qtyOpts = () => [...$('qty-list').querySelectorAll('li[role="option"]')];
function markQtySelected() {
  const q = String(state.qty).trim();
  qtyOpts().forEach(li => li.setAttribute('aria-selected', li.dataset.qty === q ? 'true' : 'false'));
}
function setQtyActive(i) {
  const opts = qtyOpts();
  opts.forEach(li => li.classList.remove('active'));
  qtyActive = opts.length ? Math.max(0, Math.min(opts.length - 1, i)) : -1;
  const li = opts[qtyActive];
  if (li) { li.classList.add('active'); scrollInList(li); $('qty').setAttribute('aria-activedescendant', li.id); }
  else $('qty').removeAttribute('aria-activedescendant');
}
function qtyIsOpen() { return !$('qty-list').hidden; }
function openQty() {
  const ul = $('qty-list');
  markQtySelected();
  ul.hidden = false;
  $('qty').setAttribute('aria-expanded', 'true'); $('qty-toggle').setAttribute('aria-expanded', 'true');
  $('qty-combo').classList.add('open');
  const opts = qtyOpts(), q = parseInt(state.qty, 10);
  let i = opts.findIndex(li => li.getAttribute('aria-selected') === 'true');
  if (i < 0 && Number.isFinite(q)) { i = opts.findIndex(li => +li.dataset.qty >= q); if (i < 0) i = opts.length - 1; }
  ul.scrollTop = 0;
  setQtyActive(i < 0 ? 0 : i);
  if (opts[qtyActive]) scrollInList(opts[qtyActive], true);
}
function closeQty() {
  $('qty-list').hidden = true;
  $('qty').setAttribute('aria-expanded', 'false'); $('qty-toggle').setAttribute('aria-expanded', 'false');
  $('qty').removeAttribute('aria-activedescendant');
  $('qty-combo').classList.remove('open');
  qtyOpts().forEach(li => li.classList.remove('active'));
}
function pickQty(v) {
  state.qty = v; $('qty').value = v;
  keepScroll(() => { closeQty(); writeForm(); update(); });
}
function initQtyCombo() {
  const inp = $('qty'), btn = $('qty-toggle'), ul = $('qty-list'), box = $('qty-combo');
  ul.innerHTML = QTY_OPTIONS.map((n, i) => `<li role="option" id="qty-opt-${i}" data-qty="${n}" aria-selected="false"><span class="v">${n}</span></li>`).join('');
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => { if (qtyIsOpen()) closeQty(); else { openQty(); inp.focus({ preventScroll: true }); } });
  ul.addEventListener('mousedown', e => e.preventDefault());
  ownWheel(ul);
  ul.addEventListener('click', e => { const li = e.target.closest('li[role="option"]'); if (li) pickQty(li.dataset.qty); });
  ul.addEventListener('mousemove', e => { const li = e.target.closest('li[role="option"]'); if (li) { const i = qtyOpts().indexOf(li); if (i !== qtyActive) { qtyOpts().forEach(o => o.classList.remove('active')); li.classList.add('active'); qtyActive = i; } } });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!qtyIsOpen() || e.altKey) { openQty(); return; }
      setQtyActive(qtyActive + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && qtyIsOpen()) {
      e.preventDefault(); const li = qtyOpts()[qtyActive]; if (li) pickQty(li.dataset.qty); else closeQty();
    } else if (e.key === 'Escape' && qtyIsOpen()) { e.preventDefault(); closeQty(); }
    else if (e.key === 'Tab') closeQty();
  });
  inp.addEventListener('input', () => { if (qtyIsOpen()) closeQty(); });
  inp.addEventListener('wheel', e => { if (document.activeElement === inp) e.preventDefault(); }, { passive: false });
  inp.addEventListener('blur', () => closeQty());
  document.addEventListener('mousedown', e => { if (qtyIsOpen() && !box.contains(e.target)) closeQty(); });
}

function update(pushHash = true) {
  setVisibility();
  const o = compute(state, data);
  last = o;
  fillSelects(o);
  // note
  const note = $('note');
  note.textContent = o.noteText;
  note.classList.toggle('bad', o.nonCompliant);
  $('flag').hidden = !o.nonCompliant;
  $('conly').hidden = !o.commercialOnly;
  // commercial reference (grayed, PN selectable for copy-paste, never copied into the note)
  const c = $('commercial');
  if (!o.commercial || o.commercial.hidden) c.innerHTML = '';
  else if (o.commercial.isNotePN) c.innerHTML = `<span class="ref-k">Commercial PN (PEM)</span><span class="ref-v">${esc(o.commercial.pn)}</span>` +
    `<span class="basis">${esc(o.commercial.basis || '')}</span>`;
  else c.innerHTML = `<span class="ref-k">Commercial reference (${esc(o.commercial.brand || 'PEM')})</span><span class="ref-v">${o.commercial.pn ? esc(o.commercial.pn) : `No ${esc(o.commercial.brand || 'PEM')} equivalent`}</span>` +
    `<span class="basis">${o.commercial.pn ? 'Dimensional equivalent, reference only. Not part of the note; verify before substituting. ' : ''}${esc(o.commercial.basis || '')}</span>`;
  c.title = o.commercial?.basis || '';
  // warnings
  $('warnings').innerHTML = o.warnings.map((w, i) => `<div class="warn" role="alert"><strong>${w.level === 'caution' ? 'Caution' : 'Check'}</strong>${esc(w.text)}${w.actions.length ? `<div class="acts">${w.actions.map((a, j) => `<button type="button" data-w="${i}" data-a="${j}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`).join('');
  $('warnings').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    Object.assign(state, o.warnings[b.dataset.w].actions[b.dataset.a].patch);
    writeForm(); update();
  }));
  $('info').innerHTML = o.info.map(t => `<li>${esc(t)}</li>`).join('');
  $('details').innerHTML = (o.details || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  // sources for the row
  const matSrc = (data.materials.find(m => m.material === state.material)?.sources || '').match(/S-[A-Z0-9-]+/g) || [];
  // Material hardness sources, minus the other hardware family's spec.
  const skip = o.commercialOnly ? ['S-45938', 'S-63540'] : { insert: ['S-45938', 'S-63540', 'S-PEMSS'], nut: ['S-63540', 'S-PEMSS'], stud: ['S-45938', 'S-PEMSS'] }[state.type];
  const stackSrc = state.type === 'stud' ? ((data.stack.find(r => r.thread === state.thread)?.sources || '').match(/S-[A-Z0-9-]+/g) || []) : [];
  const drillSrc = state.type !== 'insert' && o.row ? ['S-DRILL'] : [];
  const ids = [...new Set([...((o.row?.sources || '').match(/S-[A-Z0-9-]+/g) || []), ...stackSrc, ...drillSrc, ...matSrc.filter(id => !skip.includes(id)), o.commercialOnly ? 'S-PEMCAGE' : { insert: 'S-CAGE-INS', nut: 'S-CAGE-NUT', stud: 'S-CAGE-STUD' }[state.type]])];
  $('sources').innerHTML = ids.map(id => sources[id] ? `<li><a href="${esc(sources[id].url)}" target="_blank" rel="noopener">${esc(sources[id].document)}</a></li>` : '').join('') +
    (o.row?.verification ? `<li class="ver">Verification: ${esc(o.row.verification)}</li>` : '');
  // graphic
  const title = `${state.type} ${state.thread} in ${state.material}, ${state.thk} in, ${state.side} side`;
  const { svg, s } = drawSection(o.geom, { title });
  const g = $('gfx');
  g.outerHTML = svg.replace('<svg ', '<svg id="gfx" ');
  $('gfx').dataset.s = s;
  updateScale();
  if (pushHash) {
    const h = encodeState(state);
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch { /* sandboxed preview */ }
  }
}

function updateScale() {
  const g = $('gfx');
  const s = +g.dataset.s;
  if (!s) { $('scale').textContent = ''; return; }
  const px = g.getBoundingClientRect().width / VB_W; // screen px per viewBox unit
  const ratio = (s * px) / 96;
  $('scale').textContent = `SCALE ${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)}:1 at 96 PPI`;
}

async function copy(text, msg) {
  if (!text) return;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  const t = $('toast');
  t.textContent = ok ? msg : 'Copy blocked by the browser. Select the note text and copy manually.';
  clearTimeout(copy.tm); copy.tm = setTimeout(() => (t.textContent = ''), 2200);
}

function fileBase() { return `${last?.row?.note_pn || 'section'}_${state.side}`.replace(/[^\w.-]+/g, '_'); }
function svgString() { return new XMLSerializer().serializeToString($('gfx')); }
function save(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function downloadSVG() {
  const url = URL.createObjectURL(new Blob([svgString()], { type: 'image/svg+xml' }));
  save(url, fileBase() + '.svg'); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadPNG() {
  try {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = VB_W * 2; c.height = (+$('gfx').getAttribute('height') || 560) * 2;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      try { save(c.toDataURL('image/png'), fileBase() + '.png'); } catch { downloadSVG(); }
    };
    img.onerror = () => downloadSVG();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString());
  } catch { downloadSVG(); }
}

function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

init();
