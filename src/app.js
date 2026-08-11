/* =====================================================================
   NYC Reads — ELA Results Explorer
   ---------------------------------------------------------------------
   Every percentage on this page is derived from student counts held in
   D.city / D.boro / D.dist.  Row layout:
       [geoIdx, gradeIdx, yearIdx, catIdx, nTested, meanScale, c1, c2, c3, c4]
   Nothing is read from a published percentage.
   ===================================================================== */

const YEARS   = D.years;                 // [2018,2019,2022,2023,2024,2025,2026]
const GRADES  = D.grades;                // ['3'..'8','All Grades']
const CATS    = D.cats;
const AGI     = GRADES.indexOf('All Grades');
const ALLCAT  = CATS.indexOf('All Students');
const MODERN  = [2023, 2024, 2025, 2026];      // comparable era (current standards)
const BASELINES = [2023, 2024, 2025];
const yIdx = y => YEARS.indexOf(y);

/* ---------- indexes: key -> row ---------- */
function buildIndex(rows){
  const m = new Map();
  for (const r of rows) m.set(r[0]*100000 + r[1]*10000 + r[2]*1000 + r[3], r);
  return m;
}
const IX = { city: buildIndex(D.city), boro: buildIndex(D.boro), dist: buildIndex(D.dist) };
const getRow = (lvl, g, gr, y, c) => IX[lvl].get(g*100000 + gr*10000 + y*1000 + c) || null;

/* ---------- grade bands ---------- */
const BANDS = [
  { k:'all',  label:'All grades (3–8)', grades:null },          // uses the All Grades row
  { k:'35',   label:'Grades 3–5 (elementary)', grades:[0,1,2] },
  { k:'68',   label:'Grades 6–8 (middle)',     grades:[3,4,5] },
  { k:'g3',   label:'Grade 3', grades:[0] },
  { k:'g4',   label:'Grade 4', grades:[1] },
  { k:'g5',   label:'Grade 5', grades:[2] },
  { k:'g6',   label:'Grade 6', grades:[3] },
  { k:'g7',   label:'Grade 7', grades:[4] },
  { k:'g8',   label:'Grade 8', grades:[5] },
];
const band = k => BANDS.find(b => b.k === k);

/* =====================================================================
   CORE AGGREGATOR
   Sums counts over the requested geographies and grades, then derives
   percentages.  Returns null when nothing is available (all suppressed).
   `partial` flags an aggregate assembled from an incomplete grade set.
   ===================================================================== */
function agg(lvl, geos, bandKey, year, cat){
  const b = band(bandKey), yi = yIdx(year);
  if (yi < 0) return null;
  const gradeIdxs = b.grades || [AGI];
  let n=0, c1=0, c2=0, c3=0, c4=0, wMean=0, found=0, want=0, sup=0;
  for (const g of geos) for (const gr of gradeIdxs){
    want++;
    const r = getRow(lvl, g, gr, yi, cat);
    if (!r){ sup++; continue; }
    found++;
    n += r[4]; c1 += r[6]; c2 += r[7]; c3 += r[8]; c4 += r[9];
    wMean += r[5] * r[4];
  }
  if (!found || !n) return null;
  return {
    n, c1, c2, c3, c4,
    l1: c1/n*100, l2: c2/n*100, l3: c3/n*100, l4: c4/n*100,
    prof: (c3+c4)/n*100,
    mean: wMean/n,
    partial: sup > 0, suppressed: sup, cells: want
  };
}
/* metric accessors — `good` is the direction that counts as improvement */
const METRICS = {
  prof: { label:'Proficiency (Level 3–4)', short:'% Level 3–4', get:a=>a.prof, good:+1 },
  l1:   { label:'Level 1 share',                short:'% Level 1',        get:a=>a.l1,   good:-1 },
  l4:   { label:'Level 4 share',                short:'% Level 4',        get:a=>a.l4,   good:+1 },
  mean: { label:'Mean scale score',             short:'Mean scale score', get:a=>a.mean, good:+1 },
};

/* ---------- geography helpers ---------- */
const ALL_DIST = D.districts.map((_,i)=>i);
const ALL_BORO = D.boros.map((_,i)=>i);
const distNum  = i => parseInt(D.districts[i],10);
const distIdx  = n => D.districts.indexOf(String(n).padStart(2,'0'));

/* ---------------------------------------------------------------------
   Vendor and curriculum assignments (NYC Reads professional learning
   provider and adopted curriculum, by district). No personal data is
   carried in the payload.
   --------------------------------------------------------------------- */
const V = D.vendors || { readsRoster:[], solvesRoster:[], ecRoster:[], mcRoster:[], byDistrict:[] };
const vendorOf   = i => V.byDistrict[i] || { r:[], s:null, ec:null, mc:null, sc:'' };
const readsNames = i => vendorOf(i).r.map(k => V.readsRoster[k]);
const solvesName = i => { const s=vendorOf(i).s; return s==null?'':V.solvesRoster[s]; };
const ecName     = i => { const c=vendorOf(i).ec; return c==null?'':V.ecRoster[c]; };
const mcName     = i => { const c=vendorOf(i).mc; return c==null?'':V.mcRoster[c]; };
/* districts using a given reads vendor / curriculum */
const distsWithReads = v => ALL_DIST.filter(i => readsNames(i).includes(v));
const distsWithEC    = c => ALL_DIST.filter(i => ecName(i) === c);

const PHASES = {
  elem1: new Set(D.phase.elem1), elem2: new Set(D.phase.elem2),
  ms1:   new Set(D.phase.ms1),   ms2:   new Set(D.phase.ms2),
};
const phaseElemLabel = n => PHASES.elem1.has(n) ? 'Elem Phase 1' : PHASES.elem2.has(n) ? 'Elem Phase 2' : '—';
const phaseMsLabel   = n => PHASES.ms1.has(n) ? 'MS Phase 1' : PHASES.ms2.has(n) ? 'MS Phase 2' : '—';

/* ---------- formatting ---------- */
const f1 = v => v==null || !isFinite(v) ? '—' : v.toFixed(1);
const f2 = v => v==null || !isFinite(v) ? '—' : v.toFixed(2);
/* percentage-point change. A value that rounds to zero is shown unsigned, so a
   trivially negative number never reads as "−0.0". */
const pp = v => v==null || !isFinite(v) ? '—'
  : Math.abs(v) < 0.05 ? '0.0' : (v>0?'+':'−') + Math.abs(v).toFixed(1);
const num = v => v==null ? '—' : v.toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* diverging colour ramp; `good` = sign that means improvement */
function heat(v, scale, good){
  if (v==null || !isFinite(v)) return 'background:#F3F4F6;color:#9CA3AF';
  const t = Math.max(-1, Math.min(1, (v*good)/scale));         // +1 = best
  if (Math.abs(t) < 0.06) return 'background:#F1F4F7;color:#41505C';
  const a = Math.min(0.88, 0.16 + Math.abs(t)*0.72);
  return t > 0
    ? `background:rgba(15,123,108,${a.toFixed(3)});color:${a>0.5?'#fff':'#0B4F46'}`
    : `background:rgba(179,56,44,${a.toFixed(3)});color:${a>0.5?'#fff':'#7A2018'}`;
}
/* level-shading ramp (single hue, higher = darker) */
function shade(v, lo, hi, hue){
  if (v==null || !isFinite(v)) return 'background:#F3F4F6;color:#9CA3AF';
  const t = Math.max(0, Math.min(1, (v-lo)/(hi-lo)));
  const a = 0.10 + t*0.72;
  return `background:rgba(${hue},${a.toFixed(3)});color:${a>0.5?'#fff':'#243447'}`;
}

const BORO_COLOR = { 'Bronx':'#1C355E', 'Brooklyn':'#0070B9', 'Manhattan':'#00A0DD',
                     'Queens':'#6D345F', 'Staten Island':'#4F748B' };
const LVL_COLOR  = ['#C0483C','#E8A33D','#6FB0C7','#1C355E'];
const CSS = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();

/* =====================================================================
   CHART PLUMBING
   ===================================================================== */
Chart.defaults.font.family = 'Hind, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#41505C';
Chart.defaults.animation.duration = 340;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
/* boxHeight must be set alongside boxWidth: with usePointStyle the marker is
   drawn at boxHeight/2 radius but the label is offset by boxWidth, so leaving
   boxHeight at its default (the font size) makes the dot overlap the text. */
Chart.defaults.plugins.legend.labels.boxWidth = 9;
Chart.defaults.plugins.legend.labels.boxHeight = 9;
Chart.defaults.plugins.legend.labels.padding = 20;
Chart.defaults.maintainAspectRatio = false;

/* ---------------------------------------------------------------------
   NYC Reads phase markers.
   A spring test in year Y sits at the end of school year (Y-1)–Y, so a wave
   that launches in SY 2023–24 first appears in the 2024 results.  The marker
   is drawn on the first tested year of each wave, not on the launch year.
   --------------------------------------------------------------------- */
const WAVES = [
  { k:'elem1', label:'Elementary Phase 1', sy:'SY 2023–24', firstTested:2024, color:'#0070B9' },
  { k:'elem2', label:'Elementary Phase 2', sy:'SY 2024–25', firstTested:2025, color:'#6D345F' },
  { k:'ms1',   label:'Middle school Phase 1', sy:'SY 2025–26', firstTested:2026, color:'#00A0DD' },
];
/* marks for an axis whose categories are MODERN years, optionally offset */
function markSet(waves, slotOf){
  return waves.map((w,i) => ({ at: slotOf(w.firstTested), label:w.label,
                               sub:w.sy, color:w.color, row:i }))
              .filter(m => m.at != null);
}
const MODERN_SLOT = y => { const i = MODERN.indexOf(y); return i < 0 ? null : i; };

/* Chart.js plugin: dashed rule + label at each marker, and a light tint over
   the years before any wave had reached a tested grade. */
function markerPlugin(getMarks){
  return {
    id: 'phasemarks',
    beforeDatasetsDraw(c){
      const marks = getMarks(); if (!marks || !marks.length) return;
      const {ctx, chartArea:a, scales:{x}} = c;
      const first = Math.min(...marks.map(m=>m.at));
      const edge = x.getPixelForValue(first) - (x.getPixelForValue(1)-x.getPixelForValue(0))/2;
      if (edge > a.left){
        ctx.save();
        ctx.fillStyle = 'rgba(120,134,148,.055)';
        ctx.fillRect(a.left, a.top, edge-a.left, a.bottom-a.top);
        ctx.fillStyle = '#8A96A3'; ctx.font = '600 10px Hind'; ctx.textAlign = 'center';
        if (edge-a.left > 74) ctx.fillText('before NYC Reads', (a.left+edge)/2, a.bottom-7);
        ctx.restore();
      }
    },
    afterDatasetsDraw(c){
      const marks = getMarks(); if (!marks || !marks.length) return;
      const {ctx, chartArea:a, scales:{x}} = c;
      ctx.save();
      for (const m of marks){
        const px = x.getPixelForValue(m.at);
        if (!isFinite(px) || px < a.left-1 || px > a.right+1) continue;
        ctx.strokeStyle = m.color; ctx.globalAlpha = .75; ctx.lineWidth = 1.5;
        ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.moveTo(px, a.top+4); ctx.lineTo(px, a.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        /* label pill, stacked so overlapping markers stay readable */
        ctx.font = '700 9.5px Hind';
        const t = m.label, w = ctx.measureText(t).width + 12, h = 15;
        let lx = px - w/2;
        lx = Math.max(a.left+2, Math.min(a.right-w-2, lx));
        const ly = a.top + 4 + m.row*(h+3);
        ctx.fillStyle = m.color;
        ctx.beginPath(); ctx.roundRect(lx, ly, w, h, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, lx + w/2, ly + h/2 + .5);
      }
      ctx.restore();
    }
  };
}
/* per-page marker toggle */
const MARKS = { ov:true, bo:true, ph:true, sg:true, ve:true };
const markHTML = waves => waves.map(w =>
  `<span><i class="dot" style="background:${w.color}"></i>${w.label} &middot; launched ${w.sy}, first tested ${w.firstTested}</span>`).join('');

const CHARTS = {};
function draw(id, cfg){
  const cv = document.getElementById(id);
  if (!cv) return;
  if (CHARTS[id]) CHARTS[id].destroy();
  cfg.options = cfg.options || {};
  cfg.options.responsive = true;
  cfg.options.maintainAspectRatio = false;
  CHARTS[id] = new Chart(cv.getContext('2d'), cfg);
}
const gridX = { grid:{display:false}, ticks:{autoSkip:false} };
const gridY = (title, extra={}) => Object.assign({
  grid:{color:'#EDF1F5'}, border:{display:false},
  title:{display:!!title, text:title, font:{size:11,weight:'600'}, color:'#7B858B'}
}, extra);
const ppTip = suffix => ({ callbacks:{ label: c => `${c.dataset.label}: ${f1(c.parsed.y)}${suffix}` } });

/* PNG export — repaint on white so the download is not transparent */
function exportPNG(id){
  const c = CHARTS[id]; if (!c) return;
  const src = c.canvas, out = document.createElement('canvas');
  const s = 2;
  out.width = src.width * s / (window.devicePixelRatio||1);
  out.height = src.height * s / (window.devicePixelRatio||1);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,out.width,out.height);
  ctx.drawImage(src, 0, 0, out.width, out.height);
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = `nyc-reads-${id}.png`;
  a.click();
}
function exportCSV(name, rows){
  const body = rows.map(r => r.map(v => {
    const s = v==null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿'+body], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nyc-reads-${name}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

/* =====================================================================
   SELECT HELPERS
   ===================================================================== */
function fill(el, items, value){
  el.innerHTML = items.map(i => `<option value="${esc(i.v)}">${esc(i.t)}</option>`).join('');
  if (value != null) el.value = value;
}
function fillBands(el, v='all'){ fill(el, BANDS.map(b=>({v:b.k,t:b.label})), v); }
function fillBaselines(el, v=2024){
  fill(el, BASELINES.map(y=>({v:y, t:`${y} → 2026`})), v);
}
function fillDims(el, v='all'){ fill(el, D.dims.map(d=>({v:d.k,t:d.label})), v); }
/* category select follows the chosen dimension */
function fillCats(dimEl, catEl){
  const dim = D.dims.find(d => d.k === dimEl.value) || D.dims[0];
  fill(catEl, dim.cats.map(c=>({v:c, t:CATS[c]})));
  catEl.style.display = dim.cats.length > 1 ? '' : 'none';
}
function fillMetrics(el, keys, v){ fill(el, keys.map(k=>({v:k,t:METRICS[k].label})), v); }

const on = (el, fn) => el.addEventListener('change', fn);
const $ = id => document.getElementById(id);

/* ---------------------------------------------------------------------
   Suppression coverage.
   NYSED suppresses groups of five or fewer tested students AND, where a
   suppressed group could otherwise be recovered by subtraction, the next
   smallest group as well.  That second rule blanks out some very large
   cells — citywide Female for all grades in 2025, for example, covering
   149,821 tested students.  Any view touching such a cell has to say so,
   or a reader will take a gap in a line for a real movement.
   Returns an HTML warning, or '' when the view is complete.
   --------------------------------------------------------------------- */
function coverageNote(lvl, geos, bandKey, cats, where){
  const missing = [];
  for (const c of cats){
    const yrs = MODERN.filter(y => !agg(lvl, geos, bandKey, y, c));
    if (yrs.length) missing.push({ cat: CATS[c], yrs });
  }
  if (!missing.length) return '';
  const bits = missing.map(m => `<b>${esc(m.cat)}</b> in ${m.yrs.join(', ')}`);
  return `<div class="note warn"><b>Part of this view is suppressed in the source files.</b> `
    + `No result is published for ${bits.join('; ')}${where?` (${esc(where)}, ${esc(band(bandKey).label.toLowerCase())})`:''}. `
    + `Lines break at those years rather than joining across them, and the affected cells read <span class="sup">s</span>. `
    + `Suppression is not always a sign of a small group: where one category is too small to publish, NYSED also withholds the next smallest so it cannot be recovered by subtraction, which can remove a very large category from a single year.</div>`;
}

/* ---------------------------------------------------------------------
   Multi-select filter control.
   Renders as a button that opens a checkbox list. Selecting nothing means
   "no restriction on this field". Within one control the selected values are
   combined with OR; separate controls are combined with AND, so adding a
   second control always narrows the set.
   --------------------------------------------------------------------- */
const MS_STATE = {};                       // id -> Set of selected values
function multiSelect(id, label, items, onChange, allText){
  MS_STATE[id] = MS_STATE[id] || new Set();
  const host = $(id);
  if (!host) return;
  const sel = MS_STATE[id];
  const render = () => {
    const n = sel.size;
    const summary = n === 0 ? (allText || `All ${label.toLowerCase()}`)
      : n === 1 ? [...sel].map(v => (items.find(i=>i.v===v)||{}).t || v)[0]
      : `${n} selected`;
    host.querySelector('.ms-btn').innerHTML =
      `<span class="ms-sum${n?' on':''}">${esc(summary)}</span>`
      + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>`;
    host.querySelectorAll('.ms-opt input').forEach(cb => { cb.checked = sel.has(cb.value); });
    host.querySelector('.ms-clear').style.display = n ? '' : 'none';
  };
  host.classList.add('ms');
  host.innerHTML =
    `<button class="ms-btn" type="button" aria-haspopup="listbox"></button>`
  + `<div class="ms-pop" hidden>
       <div class="ms-hd">${esc(label)}<button class="ms-clear" type="button">Clear</button></div>
       <div class="ms-list">`
  + items.map(i => `<label class="ms-opt"><input type="checkbox" value="${esc(i.v)}">`
      + `<span>${esc(i.t)}</span>${i.n!=null?`<em>${i.n}</em>`:''}</label>`).join('')
  + `   </div></div>`;
  const pop = host.querySelector('.ms-pop');
  host.querySelector('.ms-btn').onclick = e => {
    e.stopPropagation();
    document.querySelectorAll('.ms-pop').forEach(p => { if (p!==pop) p.hidden = true; });
    pop.hidden = !pop.hidden;
  };
  pop.onclick = e => e.stopPropagation();
  host.querySelector('.ms-clear').onclick = () => { sel.clear(); render(); onChange(); };
  host.querySelectorAll('.ms-opt input').forEach(cb => {
    cb.onchange = () => { cb.checked ? sel.add(cb.value) : sel.delete(cb.value); render(); onChange(); };
  });
  render();
}
document.addEventListener('click', () =>
  document.querySelectorAll('.ms-pop').forEach(p => p.hidden = true));
const msSel = id => MS_STATE[id] || new Set();
/* a control with nothing ticked does not restrict anything */
const msPass = (id, values) => { const s = msSel(id);
  if (!s.size) return true;
  return (Array.isArray(values) ? values : [values]).some(v => s.has(v)); };

/* human labels for filter values shown in the active-filter bar */
const PHASE_LABEL = { elem1:'Elementary Phase 1', elem2:'Elementary Phase 2',
                      ms1:'Middle school Phase 1', ms2:'Middle school Phase 2' };
function activeBar(hostId, prefix, total, totalLabel){
  const nameOf = { boro:'Borough', phase:'Phase', reads:'PL provider', curr:'Curriculum' };
  const bits = [];
  for (const k of Object.keys(nameOf)){
    const sel = msSel(`${prefix}-ms-${k}`);
    if (!sel.size) continue;
    const vals = [...sel].map(v => k === 'phase' ? (PHASE_LABEL[v] || v) : v);
    bits.push(`<span class="abit"><b>${nameOf[k]}</b> ${esc(vals.join(', '))}</span>`);
  }
  $(hostId).innerHTML = bits.length
    ? `<div class="activebar"><span class="activelbl">Filtered to</span>`
      + bits.join('<span class="sep">and</span>')
      + `<span class="activecount">${totalLabel}</span></div>`
    : '';
}

/* group label used in subtitles */
function groupLabel(dimEl, catEl){
  const dim = D.dims.find(d => d.k === dimEl.value);
  return dim.cats.length > 1 ? CATS[+catEl.value] : 'all students';
}

/* ---------------------------------------------------------------------
   Slope (dumbbell) chart.
   One row per group: a connector from the baseline value to the 2026 value,
   a hollow dot at the baseline and a filled dot at 2026, coloured by whether
   the movement is an improvement. Shows level and change in one read, which
   a bar of changes alone cannot do: a group can move a long way and still sit
   far below everyone else.
   --------------------------------------------------------------------- */
function slopeChart(id, rows, opts){
  const { baseYear, unit, good, valueFmt = f1 } = opts;
  /* height follows the number of rows, so four groups do not float in a
     panel sized for eleven */
  const wrap = document.getElementById('wrap-' + id);
  if (wrap) wrap.style.height = Math.max(200, rows.length * 46 + 96) + 'px';
  const dots = {
    id: 'dumbbell',
    afterDatasetsDraw(c){
      const { ctx, scales:{x, y} } = c;
      ctx.save();
      rows.forEach((r, i) => {
        const yy = y.getPixelForValue(i);
        const x0 = x.getPixelForValue(r.from), x1 = x.getPixelForValue(r.to);
        const improving = (r.to - r.from) * good > 0;
        const col = improving ? '#0F7B6C' : '#C0483C';
        /* baseline: hollow */
        ctx.beginPath(); ctx.arc(x0, yy, 5.5, 0, 7); ctx.fillStyle = '#fff';
        ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#94A3B8'; ctx.stroke();
        /* 2026: filled */
        ctx.beginPath(); ctx.arc(x1, yy, 6, 0, 7); ctx.fillStyle = col; ctx.fill();
        /* change, printed past the leading dot */
        ctx.font = '700 11px Hind'; ctx.fillStyle = col;
        ctx.textBaseline = 'middle';
        const d = r.to - r.from;
        const txt = `${pp(d)}${unit}`;
        if (x1 >= x0){ ctx.textAlign = 'left'; ctx.fillText(txt, x1 + 11, yy); }
        else { ctx.textAlign = 'right'; ctx.fillText(txt, x1 - 11, yy); }
      });
      ctx.restore();
    }
  };
  draw(id, {
    type: 'bar',
    data: { labels: rows.map(r => r.label), datasets: [{
      label: 'change',
      data: rows.map(r => [r.from, r.to]),
      backgroundColor: rows.map(r => (r.to - r.from) * good > 0 ? '#0F7B6C55' : '#C0483C55'),
      borderWidth: 0, barThickness: 4, borderSkipped: false,
    }]},
    options: {
      indexAxis: 'y',
      layout: { padding: { right: 58 } },
      scales: {
        x: gridY(`${opts.axisLabel} — hollow dot ${baseYear}, filled dot 2026`),
        y: { grid: { display:false }, ticks: { font:{ size:11.5 }, autoSkip:false } },
      },
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: {
          title: c => rows[c[0].dataIndex].label,
          label: c => { const r = rows[c.dataIndex];
            return [`${baseYear}: ${valueFmt(r.from)}`, `2026: ${valueFmt(r.to)}`,
                    `Change: ${pp(r.to - r.from)}${unit}`, r.sub].filter(Boolean); } } },
      },
    },
    plugins: [dots],
  });
}

/* =====================================================================
   PAGE 1 — CITYWIDE OVERVIEW
   ===================================================================== */
const OV = {};
function initOV(){
  fillBaselines($('ov-base')); fillBands($('ov-grade')); fillDims($('ov-dim'));
  fillCats($('ov-dim'), $('ov-cat'));
  fill($('ov-zyear'), MODERN.map(y=>({v:y,t:String(y)})), 2026);
  on($('ov-dim'), () => { fillCats($('ov-dim'), $('ov-cat')); renderOV(); });
  ['ov-base','ov-grade','ov-cat','ov-zyear'].forEach(id => on($(id), renderOV));
}
function ovSeries(){
  const bk = $('ov-grade').value, cat = +$('ov-cat').value;
  return MODERN.map(y => ({ y, a: agg('city', [0], bk, y, cat) }));
}
function renderOV(){
  const base = +$('ov-base').value, bk = $('ov-grade').value, cat = +$('ov-cat').value;
  const S = ovSeries();
  const cur = S.find(s=>s.y===2026).a, bse = S.find(s=>s.y===base).a;
  const gl = groupLabel($('ov-dim'), $('ov-cat'));
  const bl = band(bk).label.toLowerCase();

  /* ---- KPIs ---- */
  const dProf = cur && bse ? cur.prof - bse.prof : null;
  const dL1   = cur && bse ? cur.l1   - bse.l1   : null;
  const ggAll = ggCount(bk, cat, base);
  $('ov-kpi').innerHTML = [
    kpi('2026 proficiency', cur?f1(cur.prof):'—','%', null, 'Level 3–4 share', 'n'),
    kpi(`Change vs ${base}`, dProf==null?'—':pp(dProf),'pp', dProf==null?null:dProf>0, 'Percentage points', dProf==null?'n':dProf>0?'g':'b'),
    kpi('2026 Level 1', cur?f1(cur.l1):'—','%', null, 'Lowest performance level', 'n'),
    kpi(`Change vs ${base}`, dL1==null?'—':pp(dL1),'pp', dL1==null?null:dL1<0, 'Fewer Level 1s is better', dL1==null?'n':dL1<0?'g':'b'),
    kpi('Students tested', cur?num(cur.n):'—','', null, `2026, ${bl}`, 'n'),
    kpi('Districts improving on both', `${ggAll.gg}`, `/${ggAll.total}`, null, `Fewer Level 1s and higher proficiency vs ${base}`, ggAll.gg > ggAll.total/2 ? 'g':'n'),
  ].join('');

  /* ---- insight ---- */
  const y25 = S.find(s=>s.y===2025).a, y23 = S.find(s=>s.y===2023).a, y24 = S.find(s=>s.y===2024).a;
  let txt = '';
  if (cur && bse){
    const dirP = dProf > 0.05 ? 'higher' : dProf < -0.05 ? 'lower' : 'level with';
    const dirL = dL1 < -0.05 ? 'lower' : dL1 > 0.05 ? 'higher' : 'level with';
    txt = `Across ${bl}, ${gl === 'all students' ? 'all students' : gl.toLowerCase()} citywide, proficiency in 2026 stands at <b>${f1(cur.prof)}%</b>, ${Math.abs(dProf)<0.05?'':`<b>${pp(dProf)}pp</b> `}${dirP} than ${base}. The Level&nbsp;1 share is <b>${f1(cur.l1)}%</b>, ${Math.abs(dL1)<0.05?'':`<b>${pp(dL1)}pp</b> `}${dirL} than ${base}.`;
    if (y25 && y23 && y24){
      const peak = y25.prof - Math.max(y23.prof, y24.prof);
      if (peak > 2) txt += ` 2025 sits well above both neighbouring years (proficiency ${f1(y25.prof)}%, against ${f1(y24.prof)}% in 2024 and ${f1(cur.prof)}% in 2026), so a change measured from 2025 will read very differently from one measured from 2023 or 2024.`;
    }
    txt += ` ${ggAll.gg} of ${ggAll.total} districts moved the right way on both measures over the same window.`;
  } else txt = 'No data available for this combination — the group is suppressed in the source files at this level of detail.';
  $('ov-insight').innerHTML = txt;
  $('ov-supp').innerHTML = coverageNote('city', [0], bk, [cat], 'citywide');

  /* ---- trend ---- */
  const ovMarks = () => MARKS.ov ? markSet(WAVES, MODERN_SLOT) : [];
  draw('ov-trend', {
    type:'line',
    data:{ labels: MODERN.map(String), datasets:[
      { label:'Proficient (Level 3–4)', data:S.map(s=>s.a?s.a.prof:null), borderColor:'#0070B9', backgroundColor:'#0070B9',
        tension:.25, borderWidth:3, pointRadius:5, pointHoverRadius:7 },
      { label:'Level 1', data:S.map(s=>s.a?s.a.l1:null), borderColor:'#C0483C', backgroundColor:'#C0483C',
        tension:.25, borderWidth:3, pointRadius:5, pointHoverRadius:7 },
    ]},
    options:{ scales:{ x:gridX, y:gridY('% of students tested',{beginAtZero:true,suggestedMax:70}) },
      plugins:{ tooltip:ppTip('%'), legend:{position:'bottom'} } },
    plugins:[markerPlugin(ovMarks)]
  });
  $('ov-trend-marks').innerHTML = MARKS.ov ? markHTML(WAVES) : '';

  /* ---- distribution by year ---- */
  draw('ov-dist', {
    type:'bar',
    data:{ labels: MODERN.map(String), datasets: [0,1,2,3].map(i => ({
      label:`Level ${i+1}`, backgroundColor:LVL_COLOR[i], borderWidth:0,
      data: S.map(s => s.a ? [s.a.l1,s.a.l2,s.a.l3,s.a.l4][i] : null)
    }))},
    options:{ scales:{ x:Object.assign({stacked:true},gridX), y:gridY('% of students tested',{stacked:true,max:100}) },
      plugins:{ legend:{display:false}, tooltip:ppTip('%') } }
  });

  /* ---- diverging by grade ---- */
  const zy = +$('ov-zyear').value;
  const gs = ['g3','g4','g5','g6','g7','g8'].map(k => agg('city',[0],k,zy,cat));
  draw('ov-zero', {
    type:'bar',
    data:{ labels: ['Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8'], datasets:[
      { label:'Level 1', backgroundColor:LVL_COLOR[0], data: gs.map(a=>a?-a.l1:null), borderWidth:0 },
      { label:'Level 2', backgroundColor:LVL_COLOR[1], data: gs.map(a=>a?-a.l2:null), borderWidth:0 },
      { label:'Level 3', backgroundColor:LVL_COLOR[2], data: gs.map(a=>a? a.l3:null), borderWidth:0 },
      { label:'Level 4', backgroundColor:LVL_COLOR[3], data: gs.map(a=>a? a.l4:null), borderWidth:0 },
    ]},
    options:{ scales:{ x:Object.assign({stacked:true},gridX),
        y:gridY('← below proficient   ·   proficient →',{stacked:true,min:-70,max:70,
          ticks:{callback:v=>Math.abs(v)+'%'}}) },
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${f1(Math.abs(c.parsed.y))}%`}} } }
  });

  /* ---- grade movement vs baseline ---- */
  const gk = ['g3','g4','g5','g6','g7','g8'];
  const dP = gk.map(k => { const a=agg('city',[0],k,2026,cat), b=agg('city',[0],k,base,cat); return a&&b?a.prof-b.prof:null; });
  const dL = gk.map(k => { const a=agg('city',[0],k,2026,cat), b=agg('city',[0],k,base,cat); return a&&b?a.l1-b.l1:null; });
  $('ov-grades').closest('.cd').querySelector('[data-png]').textContent = 'PNG';
  draw('ov-grades', {
    type:'bar',
    data:{ labels:['Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8'], datasets:[
      { label:'Change in proficiency', data:dP, backgroundColor:'#0070B9', borderWidth:0 },
      { label:'Change in Level 1 share', data:dL, backgroundColor:'#C0483C', borderWidth:0 },
    ]},
    options:{ scales:{ x:gridX, y:gridY(`percentage points vs ${base}`,{grid:{color:c=>c.tick.value===0?'#9AA6B2':'#EDF1F5'}}) },
      plugins:{ legend:{position:'bottom'}, tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${pp(c.parsed.y)}pp`}} } }
  });

  /* ---- the last pre-standards year against the comparable era ----
     Only 2022 is carried back. 2018 and 2019 add nothing here and their own
     two-point stub invited exactly the cross-era comparison the break exists
     to prevent. The empty slot is the standards change. */
  const longLabels = ['2022','','2023','2024','2025','2026'];
  const slotFor = { 2022:0, 2023:2, 2024:3, 2025:4, 2026:5 };
  const mk = getter => { const a = new Array(6).fill(null);
    for (const y of YEARS){ if (!(y in slotFor)) continue;
      const v = agg('city',[0],bk,y,cat); if (v) a[slotFor[y]] = getter(v); } return a; };
  draw('ov-long', {
    type:'line',
    data:{ labels: longLabels, datasets:[
      { label:'Proficient (Level 3–4)', data: mk(a=>a.prof), borderColor:'#0070B9', backgroundColor:'#0070B9',
        borderWidth:3, tension:.2, pointRadius:4, spanGaps:false },
      { label:'Level 1', data: mk(a=>a.l1), borderColor:'#C0483C', backgroundColor:'#C0483C',
        borderWidth:3, tension:.2, pointRadius:4, spanGaps:false },
    ]},
    options:{ scales:{ x:Object.assign({},gridX,{ticks:{autoSkip:false,callback:(v,i)=>longLabels[i]||''}}),
        y:gridY('% of students tested',{beginAtZero:true,suggestedMax:70}) },
      plugins:{ legend:{position:'bottom'},
        tooltip:{callbacks:{ title:c=>longLabels[c[0].dataIndex]||'', label:c=>`${c.dataset.label}: ${f1(c.parsed.y)}%` }} } },
    plugins:[markerPlugin(() => MARKS.ov ? markSet(WAVES, y => slotFor[y] ?? null) : [])]
  });
}
function kpi(label, value, unit, up, sub, cls){
  return `<div class="kc ${cls||''}"><div class="kl">${esc(label)}</div>
    <div class="kv">${value}<small>${unit||''}</small></div>
    <div class="kx">${esc(sub||'')}</div></div>`;
}
/* how many districts improved on both measures */
function ggCount(bk, cat, base){
  let gg=0, total=0;
  for (const i of ALL_DIST){
    const a = agg('dist',[i],bk,2026,cat), b = agg('dist',[i],bk,base,cat);
    if (!a || !b) continue;
    total++;
    if (a.l1 < b.l1 && a.prof > b.prof) gg++;
  }
  return { gg, total };
}
function csvOV(){
  const bk=$('ov-grade').value, cat=+$('ov-cat').value;
  const rows=[['NYC Reads ELA Explorer — citywide'],
    ['Grades',band(bk).label],['Student group',CATS[cat]],['Generated',BUILD],[],
    ['Year','Students tested','% Level 1','% Level 2','% Level 3','% Level 4','% Level 3+4','Mean scale score','Comparable to 2023+']];
  for (const y of YEARS){ const a=agg('city',[0],bk,y,cat);
    rows.push([y, a?a.n:'', a?f2(a.l1):'', a?f2(a.l2):'', a?f2(a.l3):'', a?f2(a.l4):'', a?f2(a.prof):'', a?f1(a.mean):'', y>=2023?'yes':'no (previous standards)']); }
  return rows;
}

/* =====================================================================
   PAGE 2 — DISTRICT EXPLORER
   ===================================================================== */
const DI = { sort:'dprof', dir:1 };
function initDI(){
  fillBaselines($('di-base')); fillBands($('di-grade')); fillDims($('di-dim'));
  fillCats($('di-dim'), $('di-cat'));
  fillMetrics($('di-metric'), ['prof','l1','l4','mean'], 'prof');
  const count = fn => v => ALL_DIST.filter(i => fn(i, v)).length;
  multiSelect('di-ms-boro', 'Boroughs',
    D.boros.map(b => ({ v:b, t:b, n: ALL_DIST.filter(i=>D.districtBoro[i]===b).length })), renderDI, 'All boroughs');
  multiSelect('di-ms-phase', 'NYC Reads phase', [
    { v:'elem1', t:'Elementary Phase 1 · SY 2023–24', n:D.phase.elem1.length },
    { v:'elem2', t:'Elementary Phase 2 · SY 2024–25', n:D.phase.elem2.length },
    { v:'ms1',   t:'Middle school Phase 1 · SY 2025–26', n:D.phase.ms1.length },
    { v:'ms2',   t:'Middle school Phase 2 · SY 2026–27', n:D.phase.ms2.length },
  ], renderDI, 'All phases');
  multiSelect('di-ms-reads', 'Reads PL provider',
    V.readsRoster.map(v => ({ v, t:v, n: distsWithReads(v).length })), renderDI, 'All providers');
  multiSelect('di-ms-curr', 'Elementary curriculum',
    V.ecRoster.map(c => ({ v:c, t:c, n: distsWithEC(c).length })), renderDI, 'All curricula');
  on($('di-dim'), () => { fillCats($('di-dim'), $('di-cat')); renderDI(); });
  ['di-base','di-grade','di-cat','di-metric'].forEach(id => on($(id), renderDI));
  $('di-reset').onclick = () => {
    ['di-ms-boro','di-ms-phase','di-ms-reads','di-ms-curr'].forEach(k => msSel(k).clear());
    initDI(); renderDI();
  };
}
function diRows(){
  const base=+$('di-base').value, bk=$('di-grade').value, cat=+$('di-cat').value;
  const out=[];
  for (const i of ALL_DIST){
    const n = distNum(i), b = D.districtBoro[i];
    /* every control must pass: the filters narrow together, not separately */
    if (!msPass('di-ms-boro', b)) continue;
    const phases = ['elem1','elem2','ms1','ms2'].filter(k => PHASES[k].has(n));
    if (!msPass('di-ms-phase', phases)) continue;
    if (!msPass('di-ms-reads', readsNames(i))) continue;
    if (!msPass('di-ms-curr', ecName(i))) continue;
    const cur = agg('dist',[i],bk,2026,cat), bse = agg('dist',[i],bk,base,cat);
    out.push({
      i, n, boro:b, label:`District ${D.districts[i]}`,
      elem: phaseElemLabel(n), ms: phaseMsLabel(n),
      reads: readsNames(i), solves: solvesName(i), ec: ecName(i), mc: mcName(i),
      cur, bse,
      dprof: cur&&bse ? cur.prof-bse.prof : null,
      dl1:   cur&&bse ? cur.l1  -bse.l1   : null,
    });
  }
  return out;
}
/* The signal Liz asked for: a district is "green" when it moved the right way
   on BOTH measures — fewer Level 1s and higher proficiency — and "flagged"
   when it moved the wrong way on both. Anything else is mixed. */
function signal(r){
  if (r.dprof==null || r.dl1==null) return { t:'—', c:'#9CA3AF', rank:-1, k:'na' };
  if (r.dl1<0 && r.dprof>0) return { t:'Improved on both', c:'#0F7B6C', rank:3, k:'green' };
  if (r.dl1<0 || r.dprof>0) return { t:'Mixed',            c:'#6FB0C7', rank:2, k:'mixed' };
  return { t:'Worse on both', c:'#C0483C', rank:1, k:'flag' };
}
function renderDI(){
  const base=+$('di-base').value, rows=diRows(), mk=$('di-metric').value, M=METRICS[mk];
  const bl = band($('di-grade').value).label.toLowerCase();
  const gl = groupLabel($('di-dim'), $('di-cat'));

  const valid = rows.filter(r=>r.dprof!=null);
  const nUpP = valid.filter(r=>r.dprof>0).length;
  const nDnL = valid.filter(r=>r.dl1<0).length;
  const nGG  = valid.filter(r=>r.dl1<0 && r.dprof>0).length;
  const best = valid.slice().sort((a,b)=>b.dprof-a.dprof)[0];

  $('di-kpi').innerHTML = [
    kpi('Districts shown', String(rows.length), '', null, `${bl}, ${gl.toLowerCase()}`, 'n'),
    kpi('Proficiency up', `${nUpP}`, `/${valid.length}`, null, `vs ${base}`, nUpP>valid.length/2?'g':'b'),
    kpi('Level 1 share down', `${nDnL}`, `/${valid.length}`, null, `vs ${base}`, nDnL>valid.length/2?'g':'b'),
    kpi('Improved on both', `${nGG}`, `/${valid.length}`, null, best?`Largest proficiency gain: District ${D.districts[best.i]} (${pp(best.dprof)}pp)`:'', nGG>valid.length/2?'g':'n'),
  ].join('');

  activeBar('di-active', 'di', 32, `${rows.length} of 32 districts`);

  $('di-insight').innerHTML = valid.length
    ? `Measured from <b>${base}</b> to <b>2026</b> on ${bl}, ${gl.toLowerCase()}: <b>${nDnL}</b> of ${valid.length} districts reduced their Level&nbsp;1 share and <b>${nUpP}</b> raised proficiency; <b>${nGG}</b> did both. `
      + (valid.length>3 ? `The largest reductions in Level&nbsp;1 are in ${valid.slice().sort((a,b)=>a.dl1-b.dl1).slice(0,4).map(r=>`District&nbsp;${D.districts[r.i]} (${pp(r.dl1)}pp)`).join(', ')}.` : '')
    : 'No districts have data for this combination — the group is suppressed at district level.';

  $('di-tblsub').innerHTML = `2026 levels and change from ${base}, ${bl}, ${esc(gl.toLowerCase())}. Click a column heading to sort. Cells shaded within the column; green is the direction of improvement.`;

  /* named lists, so the two groups that matter can be read at a glance */
  const byMove = (a,b) => (b.dprof - a.dprof);
  const green = valid.filter(r=>signal(r).k==='green').sort(byMove);
  const flag  = valid.filter(r=>signal(r).k==='flag').sort((a,b)=>a.dprof-b.dprof);
  const mixed = valid.filter(r=>signal(r).k==='mixed');
  const chips = (rows, col) => rows.length
    ? rows.map(r=>`<span class="dchip" style="border-color:${col}44;background:${col}0F">`
        + `<b style="color:${col}">D${D.districts[r.i]}</b> `
        + `<span class="dchip-n">${pp(r.dprof)} / ${pp(r.dl1)}</span>`
        + `<span class="dchip-p">${r.elem==='Elem Phase 1'?'P1':r.elem==='Elem Phase 2'?'P2':'—'}${r.ms!=='—'?' · MS1':''}</span></span>`).join('')
    : '<span class="muted">None on this selection.</span>';
  $('di-flags').innerHTML = `
    <div class="flagbox">
      <div class="flaghd"><span class="dot" style="background:#0F7B6C"></span>
        Improved on both <b>(${green.length})</b>
        <span class="muted">fewer Level 1s and higher proficiency vs ${base}</span></div>
      <div class="chiprow">${chips(green,'#0F7B6C')}</div>
    </div>
    <div class="flagbox">
      <div class="flaghd"><span class="dot" style="background:#C0483C"></span>
        Worse on both <b>(${flag.length})</b>
        <span class="muted">more Level 1s and lower proficiency vs ${base}</span></div>
      <div class="chiprow">${chips(flag,'#C0483C')}</div>
    </div>
    <div class="flagnote">Each chip shows the district, then its change in proficiency and in the Level&nbsp;1 share in percentage points, then its NYC Reads wave (P1 or P2 elementary, MS1 if it also began the middle-school rollout). ${mixed.length} district${mixed.length===1?'':'s'} moved the right way on one measure only and ${mixed.length===1?'is':'are'} not listed here.</div>`;

  /* ---- scatter ---- */
  const pts = valid.map(r=>({ x:r.dl1, y:r.dprof, r:Math.max(4,Math.min(15,Math.sqrt(r.cur.n)/12)), d:r }));
  const quadrant = {
    id:'quadrant',
    beforeDatasetsDraw(c){
      const {ctx, chartArea:a, scales:{x,y}} = c;
      const x0 = x.getPixelForValue(0), y0 = y.getPixelForValue(0);
      ctx.save();
      ctx.fillStyle = 'rgba(15,123,108,.06)';
      ctx.fillRect(a.left, a.top, Math.max(0,x0-a.left), Math.max(0,y0-a.top));
      ctx.strokeStyle = '#9AA6B2'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x0,a.top); ctx.lineTo(x0,a.bottom);
      ctx.moveTo(a.left,y0); ctx.lineTo(a.right,y0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#0F7B6C'; ctx.font = '600 11px Hind';
      ctx.fillText('fewer Level 1s + higher proficiency', a.left+8, a.top+16);
      ctx.restore();
    }
  };
  draw('di-scatter', {
    type:'bubble',
    data:{ datasets: D.boros.map(b => ({
      label:b, backgroundColor:BORO_COLOR[b]+'CC', borderColor:BORO_COLOR[b], borderWidth:1,
      data: pts.filter(p=>p.d.boro===b)
    })).filter(ds=>ds.data.length) },
    options:{
      scales:{ x:gridY(`change in Level 1 share vs ${base} (pp)`,{grid:{color:'#EDF1F5'}}),
               y:gridY(`change in proficiency vs ${base} (pp)`) },
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{ label:c=>{ const d=c.raw.d;
          return [`District ${D.districts[d.i]} · ${d.boro}`,
                  `Proficiency ${pp(d.dprof)}pp (now ${f1(d.cur.prof)}%)`,
                  `Level 1 ${pp(d.dl1)}pp (now ${f1(d.cur.l1)}%)`,
                  `${num(d.cur.n)} tested in 2026`]; }}} },
    },
    plugins:[quadrant]
  });
  $('di-scatter-lg').innerHTML = D.boros.map(b=>`<span><i class="dot" style="background:${BORO_COLOR[b]}"></i>${b}</span>`).join('')
    + '<span class="muted">Bubble size reflects students tested in 2026.</span>';

  /* ---- ranked bars ---- */
  const rk = rows.filter(r=>r.cur&&r.bse).map(r=>({ ...r, v: M.get(r.cur)-M.get(r.bse) }))
                 .sort((a,b)=> (b.v-a.v)*M.good );
  draw('di-rank', {
    type:'bar',
    data:{ labels: rk.map(r=>'D'+D.districts[r.i]), datasets:[{
      label:`Change in ${M.short}`, data: rk.map(r=>r.v), borderWidth:0,
      backgroundColor: rk.map(r => (r.v*M.good) > 0 ? '#0F7B6C' : '#C0483C') }]},
    options:{ indexAxis:'y',
      scales:{ x:gridY(`change vs ${base}${mk==='mean'?' (points)':' (pp)'}`),
               y:{grid:{display:false},ticks:{font:{size:10.5},autoSkip:false}} },
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{ title:c=>`District ${D.districts[rk[c[0].dataIndex].i]}`,
          label:c=>{ const r=rk[c.dataIndex];
            return [`${M.short}: ${f1(M.get(r.bse))} → ${f1(M.get(r.cur))}`,
                    `Change: ${pp(r.v)}${mk==='mean'?'':'pp'}`,
                    `${r.boro} · ${r.elem}${r.ms!=='—'?' · '+r.ms:''}`]; }}} } }
  });

  /* ---- table ---- */
  renderDITable(rows, base);
}
const DI_COLS = [
  {k:'label', t:'District',    sort:r=>r.n,           kind:'name'},
  {k:'boro',  t:'Borough',     sort:r=>r.boro,        kind:'text'},
  {k:'elem',  t:'Elem phase',  sort:r=>r.elem,        kind:'text'},
  {k:'ms',    t:'MS phase',    sort:r=>r.ms,          kind:'text'},
  {k:'reads', t:'Reads PL provider', sort:r=>r.reads.join(', '), kind:'list'},
  {k:'ec',    t:'Elem curriculum',   sort:r=>r.ec,      kind:'text'},
  {k:'n',     t:'Tested 2026', sort:r=>r.cur?r.cur.n:-1,        kind:'num'},
  {k:'prof',  t:'% L3–4 2026', sort:r=>r.cur?r.cur.prof:-1, kind:'lvl', hue:'0,112,185', lo:20, hi:80},
  {k:'dprof', t:'Δ L3–4',  sort:r=>r.dprof==null?-99:r.dprof, kind:'heat', good:+1, scale:8},
  {k:'l1',    t:'% L1 2026',   sort:r=>r.cur?r.cur.l1:-1,       kind:'lvl', hue:'192,72,60', lo:5, hi:45},
  {k:'dl1',   t:'Δ L1',   sort:r=>r.dl1==null?99:r.dl1,    kind:'heat', good:-1, scale:8},
  {k:'l4',    t:'% L4 2026',   sort:r=>r.cur?r.cur.l4:-1,       kind:'lvl', hue:'28,53,94', lo:2, hi:45},
  {k:'mean',  t:'Mean score',  sort:r=>r.cur?r.cur.mean:-1,     kind:'mean'},
  {k:'sig',   t:'Signal',      sort:r=>signal(r).rank,          kind:'sig'},
];
function renderDITable(rows, base){
  const col = DI_COLS.find(c=>c.k===DI.sort) || DI_COLS[6];
  const sorted = rows.slice().sort((a,b)=>{
    const x=col.sort(a), y=col.sort(b);
    if (typeof x === 'string') return DI.dir * x.localeCompare(y);
    return DI.dir * (y-x);
  });
  const head = DI_COLS.map(c =>
    `<th data-sort="${c.k}">${c.t}${DI.sort===c.k?` <span class="ar">${DI.dir>0?'▼':'▲'}</span>`:''}</th>`).join('');
  const body = sorted.map(r => {
    const s = signal(r);
    const cell = c => {
      switch(c.kind){
        case 'name': return `<td class="nm">District ${D.districts[r.i]}</td>`;
        case 'text': return `<td>${esc(r[c.k]) || '<span class="muted">—</span>'}</td>`;
        case 'list': return `<td style="white-space:normal;min-width:150px">${r.reads.length?r.reads.map(esc).join('<br>'):'<span class="muted">—</span>'}</td>`;
        case 'num':  return `<td>${r.cur?num(r.cur.n):'<span class="sup">s</span>'}</td>`;
        case 'lvl':  { const v = r.cur ? (c.k==='prof'?r.cur.prof:c.k==='l1'?r.cur.l1:r.cur.l4) : null;
                       return `<td><span class="cell" style="${shade(v,c.lo,c.hi,c.hue)}">${v==null?'s':f1(v)}</span></td>`; }
        case 'heat': { const v = r[c.k];
                       return `<td><span class="cell" style="${heat(v,c.scale,c.good)}">${v==null?'s':pp(v)}</span></td>`; }
        case 'mean': return `<td>${r.cur?f1(r.cur.mean):'<span class="sup">s</span>'}</td>`;
        case 'sig':  return `<td><span class="tag" style="background:${s.c}">${s.t}</span></td>`;
      }
    };
    return `<tr>${DI_COLS.map(cell).join('')}</tr>`;
  }).join('');
  const t = $('di-table');
  t.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  t.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    if (DI.sort === k) DI.dir *= -1; else { DI.sort = k; DI.dir = 1; }
    renderDI();
  });
}
function csvDI(){
  const base=+$('di-base').value, rows=diRows();
  const out=[['NYC Reads ELA Explorer — districts'],
    ['Grades',band($('di-grade').value).label],['Student group',CATS[+$('di-cat').value]],
    ['Baseline',base],['Generated',BUILD],[],
    ['District','Borough','Elementary phase','Middle school phase','Reads PL provider','Elementary curriculum','MS curriculum','Solves PL provider','Tested 2026',
     '% Level 1 2026','% Level 2 2026','% Level 3 2026','% Level 4 2026','% Level 3+4 2026','Mean scale score 2026',
     `Tested ${base}`,`% Level 1 ${base}`,`% Level 3+4 ${base}`,
     'Change in % Level 1 (pp)','Change in % Level 3+4 (pp)','Signal']];
  for (const r of rows.sort((a,b)=>a.n-b.n)){
    out.push([`District ${D.districts[r.i]}`, r.boro, r.elem, r.ms,
      r.reads.join('; '), r.ec, r.mc, r.solves,
      r.cur?r.cur.n:'s', r.cur?f2(r.cur.l1):'s', r.cur?f2(r.cur.l2):'s', r.cur?f2(r.cur.l3):'s',
      r.cur?f2(r.cur.l4):'s', r.cur?f2(r.cur.prof):'s', r.cur?f1(r.cur.mean):'s',
      r.bse?r.bse.n:'s', r.bse?f2(r.bse.l1):'s', r.bse?f2(r.bse.prof):'s',
      r.dl1==null?'':r.dl1.toFixed(2), r.dprof==null?'':r.dprof.toFixed(2), signal(r).t]);
  }
  return out;
}

/* =====================================================================
   PAGE 3 — BOROUGHS
   ===================================================================== */
function initBO(){
  fillBaselines($('bo-base')); fillBands($('bo-grade')); fillDims($('bo-dim'));
  fillCats($('bo-dim'), $('bo-cat'));
  fillMetrics($('bo-metric'), ['prof','l1','l4','mean'], 'prof');
  multiSelect('bo-ms-boro', 'Boroughs',
    D.boros.map(b => ({ v:b, t:b, n: ALL_DIST.filter(i=>D.districtBoro[i]===b).length })), renderBO, 'All boroughs');
  multiSelect('bo-ms-phase', 'NYC Reads phase', [
    { v:'elem1', t:'Elementary Phase 1 · SY 2023–24', n:D.phase.elem1.length },
    { v:'elem2', t:'Elementary Phase 2 · SY 2024–25', n:D.phase.elem2.length },
    { v:'ms1',   t:'Middle school Phase 1 · SY 2025–26', n:D.phase.ms1.length },
    { v:'ms2',   t:'Middle school Phase 2 · SY 2026–27', n:D.phase.ms2.length },
  ], renderBO, 'All phases');
  multiSelect('bo-ms-reads', 'Reads PL provider',
    V.readsRoster.map(v => ({ v, t:v, n: distsWithReads(v).length })), renderBO, 'All providers');
  multiSelect('bo-ms-curr', 'Elementary curriculum',
    V.ecRoster.map(c => ({ v:c, t:c, n: distsWithEC(c).length })), renderBO, 'All curricula');
  on($('bo-dim'), () => { fillCats($('bo-dim'), $('bo-cat')); renderBO(); });
  ['bo-base','bo-grade','bo-cat','bo-metric'].forEach(id => on($(id), renderBO));
  $('bo-reset').onclick = () => {
    ['bo-ms-boro','bo-ms-phase','bo-ms-reads','bo-ms-curr'].forEach(k => msSel(k).clear());
    initBO(); renderBO();
  };
}
/* boroughs shown on this page: the borough control alone drives the borough
   charts, since the phase / provider / curriculum controls are district-level */
function boShown(){
  return ALL_BORO.filter(i => msPass('bo-ms-boro', D.boros[i]));
}
/* districts shown in the district-level chart on this page: every control applies */
function boDistricts(){
  return ALL_DIST.filter(i => {
    const n = distNum(i);
    if (!msPass('bo-ms-boro', D.districtBoro[i])) return false;
    const phases = ['elem1','elem2','ms1','ms2'].filter(k => PHASES[k].has(n));
    if (!msPass('bo-ms-phase', phases)) return false;
    if (!msPass('bo-ms-reads', readsNames(i))) return false;
    if (!msPass('bo-ms-curr', ecName(i))) return false;
    return true;
  });
}
function renderBO(){
  const base=+$('bo-base').value, bk=$('bo-grade').value, cat=+$('bo-cat').value;
  const mk=$('bo-metric').value, M=METRICS[mk];
  const bl = band(bk).label.toLowerCase(), gl = groupLabel($('bo-dim'),$('bo-cat'));

  $('bo-trendsub').textContent = `${M.label}, ${band(bk).label.toLowerCase()}, ${gl.toLowerCase()}, 2023 to 2026.`;
  $('bo-dsub').innerHTML = `${M.label} in 2026 for all 32 community school districts, ordered ${M.good>0?'highest to lowest':'lowest to highest'}. Bars are coloured by borough. District values come from the district file and will not sum to the borough bars above.`;

  const shown = boShown();
  const dshown = boDistricts();
  activeBar('bo-active', 'bo', 5, `${shown.length} of 5 boroughs · ${dshown.length} of 32 districts`);

  const series = shown.map(i => ({ i, name:D.boros[i],
    vals: MODERN.map(y => { const a = agg('boro',[i],bk,y,cat); return a ? M.get(a) : null; }),
    cur: agg('boro',[i],bk,2026,cat), bse: agg('boro',[i],bk,base,cat) }));

  const moved = series.filter(s=>s.cur&&s.bse).map(s=>({ ...s, d: M.get(s.cur)-M.get(s.bse) }));
  const bestB = moved.slice().sort((a,b)=>(b.d-a.d)*M.good)[0];
  $('bo-insight').innerHTML = moved.length
    ? `On ${bl}, ${gl.toLowerCase()}, ${M.label.toLowerCase()} in 2026 ranges from <b>${f1(Math.min(...moved.map(s=>M.get(s.cur))))}</b> to <b>${f1(Math.max(...moved.map(s=>M.get(s.cur))))}</b> across the five boroughs. `
      + `Measured from ${base}, ${bestB.name} moved furthest in the direction of improvement (${pp(bestB.d)}${mk==='mean'?'':'pp'}). `
      + moved.slice().sort((a,b)=>(b.d-a.d)*M.good).map(s=>`${s.name} ${pp(s.d)}`).join(', ') + '.'
    : 'No borough data for this combination.';

  draw('bo-trend', {
    type:'line',
    data:{ labels:MODERN.map(String), datasets: series.map(s=>({
      label:s.name, data:s.vals, borderColor:BORO_COLOR[s.name], backgroundColor:BORO_COLOR[s.name],
      borderWidth:2.6, tension:.25, pointRadius:4, pointHoverRadius:6 })) },
    options:{ scales:{ x:gridX, y:gridY(M.short) },
      plugins:{ legend:{position:'bottom'}, tooltip:ppTip(mk==='mean'?'':'%') } },
    plugins:[markerPlugin(() => MARKS.bo ? markSet(WAVES, MODERN_SLOT) : [])]
  });
  $('bo-trend-marks').innerHTML = MARKS.bo ? markHTML(WAVES) : '';

  const d26 = shown.map(i => agg('boro',[i],bk,2026,cat));
  draw('bo-dist', {
    type:'bar',
    data:{ labels:shown.map(i=>D.boros[i]), datasets:[0,1,2,3].map(i=>({
      label:`Level ${i+1}`, backgroundColor:LVL_COLOR[i], borderWidth:0,
      data:d26.map(a=>a?[a.l1,a.l2,a.l3,a.l4][i]:null) })) },
    options:{ scales:{ x:Object.assign({stacked:true},gridX,{ticks:{font:{size:10.5}}}),
        y:gridY('% of students tested',{stacked:true,max:100}) },
      plugins:{ legend:{display:false}, tooltip:ppTip('%') } }
  });

  /* districts coloured by borough */
  const dd = dshown.map(i => ({ i, boro:D.districtBoro[i], a: agg('dist',[i],bk,2026,cat) }))
                   .filter(d=>d.a).sort((a,b)=>(M.get(b.a)-M.get(a.a))*M.good);
  draw('bo-dbar', {
    type:'bar',
    data:{ labels: dd.map(d=>'D'+D.districts[d.i]), datasets:[{
      label:M.short, data: dd.map(d=>M.get(d.a)), borderWidth:0,
      backgroundColor: dd.map(d=>BORO_COLOR[d.boro]) }]},
    options:{ scales:{ x:Object.assign({},gridX,{ticks:{font:{size:10},autoSkip:false}}), y:gridY(M.short) },
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{ title:c=>`District ${D.districts[dd[c[0].dataIndex].i]} · ${dd[c[0].dataIndex].boro}`,
          label:c=>{ const a=dd[c.dataIndex].a;
            return [`${M.short}: ${f1(M.get(a))}`, `${num(a.n)} tested`, `Level 1 ${f1(a.l1)}% · Level 3–4 ${f1(a.prof)}%`]; }}} } }
  });
  $('bo-dbar-lg').innerHTML = [...new Set(dd.map(d=>d.boro))]
    .map(b=>`<span><i class="dot" style="background:${BORO_COLOR[b]}"></i>${b}</span>`).join('');

  /* borough x grade table */
  const gk = ['g3','g4','g5','g6','g7','g8'];
  const head = `<thead><tr><th class="nos">Borough</th><th class="nos">Measure</th>`
    + gk.map((k,i)=>`<th class="nos">Grade ${i+3}</th>`).join('')
    + `<th class="nos">All grades</th></tr></thead>`;
  const body = shown.map(i=>{
    const pr = gk.concat(['all']).map(k=>{ const a=agg('boro',[i],k,2026,cat); return a?a.prof:null; });
    const l1 = gk.concat(['all']).map(k=>{ const a=agg('boro',[i],k,2026,cat); return a?a.l1:null; });
    return `<tr><td class="nm" rowspan="2">${D.boros[i]}</td><td class="muted">% Level 3–4</td>`
      + pr.map(v=>`<td><span class="cell" style="${shade(v,20,80,'0,112,185')}">${v==null?'s':f1(v)}</span></td>`).join('') + '</tr>'
      + `<tr><td class="muted">% Level 1</td>`
      + l1.map(v=>`<td><span class="cell" style="${shade(v,5,45,'192,72,60')}">${v==null?'s':f1(v)}</span></td>`).join('') + '</tr>';
  }).join('');
  $('bo-table').innerHTML = head + `<tbody>${body}</tbody>`;
}
function csvBO(){
  const base=+$('bo-base').value, bk=$('bo-grade').value, cat=+$('bo-cat').value;
  const out=[['NYC Reads ELA Explorer — boroughs'],
    ['Grades',band(bk).label],['Student group',CATS[cat]],['Baseline',base],['Generated',BUILD],[],
    ['Borough','Year','Students tested','% Level 1','% Level 2','% Level 3','% Level 4','% Level 3+4','Mean scale score']];
  for (const i of boShown()) for (const y of MODERN){
    const a=agg('boro',[i],bk,y,cat);
    out.push([D.boros[i], y, a?a.n:'s', a?f2(a.l1):'s', a?f2(a.l2):'s', a?f2(a.l3):'s', a?f2(a.l4):'s', a?f2(a.prof):'s', a?f1(a.mean):'s']);
  }
  return out;
}

/* =====================================================================
   PAGE 4 — NYC READS PHASES
   ===================================================================== */
/* exposure at the time of each spring test, in completed school years */
const EXPOSURE = [
  { g:'Elementary Phase 1', band:'Grades 3–5', launch:'SY 2023–24', e:{2023:0,2024:1,2025:2,2026:3} },
  { g:'Elementary Phase 2', band:'Grades 3–5', launch:'SY 2024–25', e:{2023:0,2024:0,2025:1,2026:2} },
  { g:'Middle school Phase 1', band:'Grades 6–8', launch:'SY 2025–26', e:{2023:0,2024:0,2025:0,2026:1} },
  { g:'Middle school Phase 2', band:'Grades 6–8', launch:'SY 2026–27', e:{2023:0,2024:0,2025:0,2026:0} },
];
function initPH(){
  fillDims($('ph-dim')); fillCats($('ph-dim'), $('ph-cat'));
  fillMetrics($('ph-metric'), ['prof','l1','l4','mean'], 'prof');
  on($('ph-dim'), () => { fillCats($('ph-dim'), $('ph-cat')); renderPH(); });
  ['ph-cat','ph-metric'].forEach(id => on($(id), renderPH));

  /* timeline */
  const chips = arr => arr.slice().sort((a,b)=>a-b).map(n=>`<span class="chip">D${String(n).padStart(2,'0')}</span>`).join('');
  $('ph-timeline').innerHTML = [
    ['Phase 1 Elementary', 'SY 2023–24', D.phase.elem1, 'K–5 curriculum — reaches tested grades 3–5'],
    ['Phase 2 Elementary', 'SY 2024–25', D.phase.elem2, 'K–5 curriculum — reaches tested grades 3–5'],
    ['Phase 1 Middle school', 'SY 2025–26', D.phase.ms1, 'Grades 6–8 curriculum'],
    ['Phase 2 Middle school', 'SY 2026–27', D.phase.ms2, 'Grades 6–8 — begins after the 2026 test'],
  ].map(([t,sy,ds,note]) =>
    `<div style="margin-bottom:14px"><div style="font-weight:700;font-size:13.5px;color:var(--navy)">${t}
      <span class="muted" style="font-weight:500"> · launched ${sy} · ${ds.length} districts in the district file</span></div>
      <div class="muted" style="font-size:11.5px;margin-bottom:5px">${note}</div>${chips(ds)}</div>`).join('')
    + `<div class="muted" style="font-size:11.5px;margin-top:6px">District&nbsp;75 is listed by NYCPS in the Phase&nbsp;1 Elementary, Phase&nbsp;2 Elementary and Phase&nbsp;2 Middle School cohorts. It is not reported in the district file, so it cannot appear above. The Phase&nbsp;1 High School cohort is defined by high-school networks rather than community school districts and falls outside grades 3–8 entirely.</div>`;

  /* exposure table */
  $('ph-exposure').innerHTML =
    `<thead><tr><th class="nos">Group</th><th class="nos">Tested grades reached</th><th class="nos">Launch</th>`
    + MODERN.map(y=>`<th class="nos">${y} test</th>`).join('') + `</tr></thead><tbody>`
    + EXPOSURE.map(r=>`<tr><td class="nm">${r.g}</td><td>${r.band}</td><td>${r.launch}</td>`
        + MODERN.map(y=>{ const v=r.e[y];
            return `<td><span class="cell" style="${shade(v,0,3,'0,112,185')}">${v} yr${v===1?'':'s'}</span></td>`; }).join('')
        + `</tr>`).join('')
    + `</tbody>`;
}
function phaseAgg(dnums, bandKey, year, cat){
  return agg('dist', dnums.map(distIdx).filter(i=>i>=0), bandKey, year, cat);
}
function renderPH(){
  const cat=+$('ph-cat').value, mk=$('ph-metric').value, M=METRICS[mk];
  const gl = groupLabel($('ph-dim'),$('ph-cat'));
  const G = {
    e1: { name:'Elementary Phase 1', ds:D.phase.elem1, band:'35', color:'#0070B9' },
    e2: { name:'Elementary Phase 2', ds:D.phase.elem2, band:'35', color:'#6D345F' },
    m1: { name:'Middle school Phase 1', ds:D.phase.ms1, band:'68', color:'#0070B9' },
    m0: { name:'Not yet in middle school rollout', ds:ALL_DIST.map(distNum).filter(n=>!PHASES.ms1.has(n)), band:'68', color:'#4F748B' },
    p1: { name:'Elementary Phase 1 districts', ds:D.phase.elem1, band:'68', color:'#0070B9' },
    p2: { name:'Elementary Phase 2 districts', ds:D.phase.elem2, band:'68', color:'#6D345F' },
  };
  const ser = g => MODERN.map(y => { const a = phaseAgg(g.ds, g.band, y, cat); return a ? M.get(a) : null; });
  const lineOpts = (title) => ({ scales:{ x:gridX, y:gridY(title) },
    plugins:{ legend:{position:'bottom'}, tooltip:ppTip(mk==='mean'?'':'%') } });
  const mkLine = (id, gs, title, waves) => {
    draw(id, {
      type:'line',
      data:{ labels:MODERN.map(String), datasets: gs.map(g=>({
        label:`${g.name} (${g.ds.filter(n=>distIdx(n)>=0).length} districts)`, data:ser(g),
        borderColor:g.color, backgroundColor:g.color, borderWidth:3, tension:.25, pointRadius:5 })) },
      options: lineOpts(title),
      plugins:[markerPlugin(() => MARKS.ph ? markSet(waves, MODERN_SLOT).map((m,i)=>({...m,row:i})) : [])]
    });
    const el = $(id+'-marks'); if (el) el.innerHTML = MARKS.ph ? markHTML(waves) : '';
  };
  const W = k => WAVES.filter(w=>k.includes(w.k));
  /* only the waves that reach the grades on each chart */
  mkLine('ph-elem', [G.e1,G.e2], `${M.short}, grades 3–5`, W(['elem1','elem2']));
  mkLine('ph-ms',   [G.m1,G.m0], `${M.short}, grades 6–8`, W(['ms1']));
  mkLine('ph-placebo', [G.p1,G.p2], `${M.short}, grades 6–8`, W(['ms1']));

  /* contrast table */
  const rowsFor = (gs, label) => {
    const cells = gs.map(g => {
      const o = {};
      for (const y of MODERN) o[y] = phaseAgg(g.ds, g.band, y, cat);
      return { g, o, d23: o[2026]&&o[2023] ? M.get(o[2026])-M.get(o[2023]) : null,
                    d24: o[2026]&&o[2024] ? M.get(o[2026])-M.get(o[2024]) : null };
    });
    const diff23 = cells[0].d23!=null && cells[1].d23!=null ? cells[0].d23-cells[1].d23 : null;
    const diff24 = cells[0].d24!=null && cells[1].d24!=null ? cells[0].d24-cells[1].d24 : null;
    return { label, cells, diff23, diff24 };
  };
  const blocks = [
    rowsFor([G.e1,G.e2], 'Elementary rollout · tested grades 3–5'),
    rowsFor([G.m1,G.m0], 'Middle-school rollout · tested grades 6–8'),
    rowsFor([G.p1,G.p2], 'Check: elementary groups measured on grades 6–8'),
  ];
  const head = `<thead><tr><th class="nos">Group</th><th class="nos">Districts</th><th class="nos">Tested 2026</th>`
    + MODERN.map(y=>`<th class="nos">${y}</th>`).join('')
    + `<th class="nos">Δ 2023→2026</th><th class="nos">Δ 2024→2026</th></tr></thead>`;
  const body = blocks.map(b => {
    const sub = `<tr><td colspan="${3+MODERN.length+2}" style="background:#F3F6F8;font-weight:700;color:var(--navy);text-align:left;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase">${b.label}</td></tr>`;
    const rs = b.cells.map(c =>
      `<tr><td class="nm">${c.g.name}</td><td>${c.g.ds.filter(n=>distIdx(n)>=0).length}</td>
        <td>${c.o[2026]?num(c.o[2026].n):'s'}</td>`
      + MODERN.map(y=>`<td>${c.o[y]?f1(M.get(c.o[y])):'s'}</td>`).join('')
      + `<td><span class="cell" style="${heat(c.d23,8,M.good)}">${c.d23==null?'s':pp(c.d23)}</span></td>`
      + `<td><span class="cell" style="${heat(c.d24,8,M.good)}">${c.d24==null?'s':pp(c.d24)}</span></td></tr>`).join('');
    const dr = `<tr><td class="nm muted" style="font-style:italic">Difference between the two groups</td>
      <td colspan="${1+MODERN.length+1}"></td>
      <td><span class="cell" style="${heat(b.diff23,4,M.good)}">${b.diff23==null?'s':pp(b.diff23)}</span></td>
      <td><span class="cell" style="${heat(b.diff24,4,M.good)}">${b.diff24==null?'s':pp(b.diff24)}</span></td></tr>`;
    return sub + rs + dr;
  }).join('');
  $('ph-table').innerHTML = head + `<tbody>${body}</tbody>`;

  /* insight — written from the numbers, with the placebo contrast alongside */
  const eb = blocks[0], mb = blocks[1], pb = blocks[2];
  const unit = mk==='mean' ? ' points' : 'pp';
  let t = `On ${M.label.toLowerCase()} for ${gl.toLowerCase()}: between 2023 and 2026, Elementary Phase&nbsp;1 districts moved <b>${pp(eb.cells[0].d23)}${unit}</b> on tested grades 3–5 and Phase&nbsp;2 districts moved <b>${pp(eb.cells[1].d23)}${unit}</b> — a difference of <b>${pp(eb.diff23)}${unit}</b>, `;
  t += Math.abs(eb.diff23) < 1
    ? `which is small enough that the two waves are essentially tracking each other despite a year's difference in exposure.`
    : `with the ${(eb.diff23*M.good)>0?'earlier':'later'} wave ahead.`;
  t += ` The same two groups measured on grades 6–8, which the elementary curriculum does not reach, differ by <b>${pp(pb.diff23)}${unit}</b> over the same years`;
  t += Math.abs(Math.abs(pb.diff23) - Math.abs(eb.diff23)) < 1
    ? `, about the same size — so the elementary contrast is not distinguishable from a general difference between these two sets of districts.`
    : `, a different size, so the elementary contrast is not simply a property of these districts.`;
  t += ` On grades 6–8, the eight districts that began the middle-school rollout in 2025–26 moved <b>${pp(mb.cells[0].d23)}${unit}</b> since 2023 against <b>${pp(mb.cells[1].d23)}${unit}</b> for the rest, a gap of <b>${pp(mb.diff23)}${unit}</b> after a single year of implementation.`;
  $('ph-insight').innerHTML = t;
}
function csvPH(){
  const cat=+$('ph-cat').value;
  const groups = [
    ['Elementary Phase 1','35',D.phase.elem1],
    ['Elementary Phase 2','35',D.phase.elem2],
    ['Middle school Phase 1','68',D.phase.ms1],
    ['Not yet in middle school rollout','68',ALL_DIST.map(distNum).filter(n=>!PHASES.ms1.has(n))],
    ['Elementary Phase 1 districts (grades 6-8 check)','68',D.phase.elem1],
    ['Elementary Phase 2 districts (grades 6-8 check)','68',D.phase.elem2],
  ];
  const out=[['NYC Reads ELA Explorer — phase groups'],
    ['Student group',CATS[cat]],['Generated',BUILD],
    ['Note','Group aggregates are sums of student counts across districts; District 75 is not in the district file'],[],
    ['Group','Tested grades','Districts','Year','Students tested','% Level 1','% Level 3+4','Mean scale score']];
  for (const [name,bk,ds] of groups) for (const y of MODERN){
    const a = phaseAgg(ds,bk,y,cat);
    out.push([name, bk==='35'?'3-5':'6-8', ds.filter(n=>distIdx(n)>=0).length, y,
      a?a.n:'s', a?f2(a.l1):'s', a?f2(a.prof):'s', a?f1(a.mean):'s']);
  }
  return out;
}

/* =====================================================================
   PAGE 5 — SUBGROUPS AND GAPS
   ===================================================================== */
const GAP_PAIRS = [
  ['White','Black'], ['White','Hispanic'],
  ['Not Econ Disadv','Econ Disadv'],
  ['Not SWD','SWD'], ['Never ELL','Current ELL'],
];
function initSG(){
  fill($('sg-level'), [{v:'city',t:'Citywide'},{v:'boro',t:'Borough'},{v:'dist',t:'District'}], 'city');
  fillBands($('sg-grade'));
  fill($('sg-dim'), D.dims.filter(d=>d.k!=='all').map(d=>({v:d.k,t:d.label})), 'eth');
  fillMetrics($('sg-metric'), ['prof','l1','l4','mean'], 'prof');
  syncSGGeo();
  on($('sg-level'), () => { syncSGGeo(); renderSG(); });
  ['sg-geo','sg-grade','sg-dim','sg-metric'].forEach(id => on($(id), renderSG));
}
function syncSGGeo(){
  const lvl=$('sg-level').value, el=$('sg-geo');
  if (lvl==='city'){ fill(el,[{v:0,t:'All of New York City'}]); el.disabled=true; }
  else if (lvl==='boro'){ fill(el, D.boros.map((b,i)=>({v:i,t:b}))); el.disabled=false; }
  else { fill(el, D.districts.map((d,i)=>({v:i,t:`District ${d} · ${D.districtBoro[i]}`}))); el.disabled=false; }
}
function renderSG(){
  const lvl=$('sg-level').value, geo=+$('sg-geo').value, bk=$('sg-grade').value;
  const dim=D.dims.find(d=>d.k===$('sg-dim').value), mk=$('sg-metric').value, M=METRICS[mk];
  const where = lvl==='city' ? 'New York City' : lvl==='boro' ? D.boros[geo] : `District ${D.districts[geo]}`;
  $('sg-trendsub').textContent = `${M.label} by ${dim.label.toLowerCase()}, ${where}, ${band(bk).label.toLowerCase()}, 2023 to 2026.`;

  const PAL = ['#1C355E','#0070B9','#00A0DD','#6D345F','#4F748B','#6FB0C7','#C0483C'];
  const series = dim.cats.map((c,i) => ({
    c, name:CATS[c], color:PAL[i%PAL.length],
    vals: MODERN.map(y => { const a=agg(lvl,[geo],bk,y,c); return a?M.get(a):null; }),
    cur: agg(lvl,[geo],bk,2026,c), b23: agg(lvl,[geo],bk,2023,c), b24: agg(lvl,[geo],bk,2024,c),
  }));
  draw('sg-trend', {
    type:'line',
    data:{ labels:MODERN.map(String), datasets: series.map(s=>({
      label:s.name, data:s.vals, borderColor:s.color, backgroundColor:s.color,
      /* never bridge a suppressed year: a joined line would read as data */
      borderWidth:2.6, tension:.25, pointRadius:4, spanGaps:false })) },
    options:{ scales:{ x:gridX, y:gridY(M.short) },
      plugins:{ legend:{position:'bottom'}, tooltip:ppTip(mk==='mean'?'':'%') } },
    plugins:[markerPlugin(() => MARKS.sg ? markSet(WAVES, MODERN_SLOT) : [])]
  });
  $('sg-trend-marks').innerHTML = MARKS.sg ? markHTML(WAVES) : '';
  $('sg-supp').innerHTML = coverageNote(lvl, [geo], bk, dim.cats, where);

  $('sg-table').innerHTML =
    `<thead><tr><th class="nos">Group</th><th class="nos">Tested</th><th class="nos">% L1</th>
      <th class="nos">% L3–4</th><th class="nos">Δ vs 2023</th><th class="nos">Δ vs 2024</th></tr></thead><tbody>`
    + series.map(s=>{
        const d23 = s.cur&&s.b23 ? M.get(s.cur)-M.get(s.b23) : null;
        const d24 = s.cur&&s.b24 ? M.get(s.cur)-M.get(s.b24) : null;
        return `<tr><td class="nm">${esc(s.name)}</td>
          <td>${s.cur?num(s.cur.n):'<span class="sup">s</span>'}</td>
          <td>${s.cur?f1(s.cur.l1):'<span class="sup">s</span>'}</td>
          <td>${s.cur?f1(s.cur.prof):'<span class="sup">s</span>'}</td>
          <td><span class="cell" style="${heat(d23,8,M.good)}">${d23==null?'s':pp(d23)}</span></td>
          <td><span class="cell" style="${heat(d24,8,M.good)}">${d24==null?'s':pp(d24)}</span></td></tr>`;
      }).join('') + '</tbody>';

  /* citywide paired gaps (always citywide, all grades — stated on the card) */
  const gapSeries = GAP_PAIRS.map(([a,b],i) => ({
    name:`${a} − ${b}`, color:PAL[i%PAL.length],
    vals: MODERN.map(y => {
      const A=agg('city',[0],'all',y,CATS.indexOf(a)), B=agg('city',[0],'all',y,CATS.indexOf(b));
      return A&&B ? A.prof-B.prof : null; })
  }));
  draw('sg-gap', {
    type:'line',
    data:{ labels:MODERN.map(String), datasets: gapSeries.map(g=>({
      label:g.name, data:g.vals, borderColor:g.color, backgroundColor:g.color,
      borderWidth:2.6, tension:.25, pointRadius:4 })) },
    options:{ scales:{ x:gridX, y:gridY('gap in % Level 3–4 (pp)',{beginAtZero:true}) },
      plugins:{ legend:{position:'bottom'}, tooltip:ppTip('pp') } }
  });
  $('sg-gaptable').innerHTML =
    `<thead><tr><th class="nos">Gap in proficiency</th>` + MODERN.map(y=>`<th class="nos">${y}</th>`).join('')
    + `<th class="nos">Δ 2023→2026</th></tr></thead><tbody>`
    + gapSeries.map(g=>{
        const d = g.vals[3]!=null && g.vals[0]!=null ? g.vals[3]-g.vals[0] : null;
        return `<tr><td class="nm">${esc(g.name)}</td>`
          + g.vals.map(v=>`<td>${v==null?'s':f1(v)}</td>`).join('')
          + `<td><span class="cell" style="${heat(d,6,-1)}">${d==null?'s':pp(d)}</span></td></tr>`; }).join('')
    + `</tbody>`;
  const narrowed = gapSeries.filter(g=>g.vals[3]!=null&&g.vals[0]!=null&&g.vals[3]<g.vals[0]);
  const widened  = gapSeries.filter(g=>g.vals[3]!=null&&g.vals[0]!=null&&g.vals[3]>g.vals[0]);
  $('sg-insight').innerHTML = `Citywide across all grades, ${narrowed.length} of the ${gapSeries.length} paired proficiency gaps narrowed between 2023 and 2026 and ${widened.length} widened. `
    + (narrowed.length ? `Narrowed: ${narrowed.map(g=>`${g.name} (${pp(g.vals[3]-g.vals[0])}pp, now ${f1(g.vals[3])}pp)`).join('; ')}. ` : '')
    + (widened.length  ? `Widened: ${widened.map(g=>`${g.name} (${pp(g.vals[3]-g.vals[0])}pp, now ${f1(g.vals[3])}pp)`).join('; ')}.` : '');
}
function csvSG(){
  const lvl=$('sg-level').value, geo=+$('sg-geo').value, bk=$('sg-grade').value;
  const where = lvl==='city' ? 'New York City' : lvl==='boro' ? D.boros[geo] : `District ${D.districts[geo]}`;
  const out=[['NYC Reads ELA Explorer — student groups'],
    ['Where',where],['Grades',band(bk).label],['Generated',BUILD],[],
    ['Student group','Year','Students tested','% Level 1','% Level 2','% Level 3','% Level 4','% Level 3+4','Mean scale score']];
  for (const dim of D.dims) for (const c of dim.cats) for (const y of MODERN){
    const a=agg(lvl,[geo],bk,y,c);
    out.push([CATS[c], y, a?a.n:'s', a?f2(a.l1):'s', a?f2(a.l2):'s', a?f2(a.l3):'s', a?f2(a.l4):'s', a?f2(a.prof):'s', a?f1(a.mean):'s']);
  }
  return out;
}

/* =====================================================================
   PAGE 6 — TEST FORMAT
   ===================================================================== */
/* Grade -> first year administered by computer, per the NOTES tab:
   "Starting in 2024, NYSED transitioned from a paper-based test to a
    computer-based test for grades 5 and 8; this was expanded to grades
    4 and 6 in 2025."  Grades 3 and 7 are not named. */
const CBT_YEAR = { 3:null, 4:2025, 5:2024, 6:2025, 7:null, 8:2024 };
const TF_GROUPS = [
  { k:'y24', name:'Moved to computer in 2024', grades:[5,8], color:'#0070B9' },
  { k:'y25', name:'Moved to computer in 2025', grades:[4,6], color:'#6D345F' },
  { k:'pap', name:'Not named in the transition', grades:[3,7], color:'#4F748B' },
];
function initTF(){
  fillMetrics($('tf-metric'), ['prof','l1','l4','mean'], 'prof');
  on($('tf-metric'), renderTF);
  $('tf-key').innerHTML =
    `<thead><tr><th class="nos">Grade</th><th class="nos">First computer-based year</th><th class="nos">Group used on this page</th></tr></thead><tbody>`
    + [3,4,5,6,7,8].map(g=>{
        const y = CBT_YEAR[g];
        const grp = TF_GROUPS.find(t=>t.grades.includes(g));
        return `<tr><td class="nm">Grade ${g}</td><td>${y ?? '<span class="muted">not stated in the source notes</span>'}</td><td>${grp.name}</td></tr>`;
      }).join('') + '</tbody>';
}
function tfAgg(grades, y, mkey){
  const keys = grades.map(g=>'g'+g);
  let n=0,c1=0,c2=0,c3=0,c4=0,wm=0;
  for (const k of keys){ const a=agg('city',[0],k,y,ALLCAT); if(!a) return null;
    n+=a.n; c1+=a.c1; c2+=a.c2; c3+=a.c3; c4+=a.c4; wm+=a.mean*a.n; }
  return { n, l1:c1/n*100, l2:c2/n*100, l3:c3/n*100, l4:c4/n*100, prof:(c3+c4)/n*100, mean:wm/n };
}
function renderTF(){
  const mk=$('tf-metric').value, M=METRICS[mk];
  $('tf-sub1').textContent = `${M.label}, citywide, all students. Grades are grouped by the year in which the source notes record their transition to computer. Each line is dashed while those grades were administered on paper and solid once they were administered on computer.`;

  const ser = TF_GROUPS.map(g=>({ ...g,
    vals: MODERN.map(y=>{ const a=tfAgg(g.grades,y,mk); return a?M.get(a):null; }) }));

  /* The administration mode is carried by the line itself rather than by
     annotations over the plot: hollow points and a dashed line while the
     grades were on paper, filled points and a solid line once they moved to
     computer. The year the switch happened is where the points change. */
  const onComputer = (g, yi) => { const cy = CBT_YEAR[g.grades[0]];
    return cy != null && MODERN[yi] >= cy; };
  draw('tf-trend', {
    type:'line',
    data:{ labels:MODERN.map(String), datasets: ser.map(g=>({
      label:`Grades ${g.grades.join(' and ')}`, data:g.vals,
      borderColor:g.color, backgroundColor:'#fff',
      borderWidth:3, tension:.25,
      pointRadius:6, pointHoverRadius:8, pointBorderWidth:2.5,
      pointBorderColor:g.color,
      /* filled once on computer, hollow while on paper */
      pointBackgroundColor: MODERN.map((_,i)=> onComputer(g,i) ? g.color : '#fff'),
      segment:{ borderDash: c =>
        (onComputer(g, c.p0DataIndex) && onComputer(g, c.p1DataIndex)) ? undefined : [6,5] },
    })) },
    options:{ scales:{ x:gridX, y:gridY(M.short) },
      plugins:{ legend:{position:'bottom'},
        tooltip:{ callbacks:{ label: c => {
          const g = ser[c.datasetIndex];
          return `Grades ${g.grades.join(' and ')}: ${f1(c.parsed.y)}${mk==='mean'?'':'%'}`
               + ` · ${onComputer(g,c.dataIndex) ? 'computer' : 'paper'}`; } } } } }
  });
  $('tf-trend-marks').innerHTML =
    `<span><svg width="34" height="12"><line x1="0" y1="6" x2="34" y2="6" stroke="#4F748B" stroke-width="2.5" stroke-dasharray="6,5"/><circle cx="17" cy="6" r="4.5" fill="#fff" stroke="#4F748B" stroke-width="2.5"/></svg>Paper-based that year</span>`
  + `<span><svg width="34" height="12"><line x1="0" y1="6" x2="34" y2="6" stroke="#0070B9" stroke-width="2.5"/><circle cx="17" cy="6" r="4.5" fill="#0070B9" stroke="#0070B9" stroke-width="2.5"/></svg>Computer-based that year</span>`
  + `<span class="muted">Grades 3 and 7 are not named in the source notes as having transitioned, so they stay hollow throughout.</span>`;
  draw('tf-delta', {
    type:'bar',
    data:{ labels:['2024','2025','2026'], datasets: ser.map(g=>({
      label:`Grades ${g.grades.join(' and ')}`, backgroundColor:g.color, borderWidth:0,
      data:[1,2,3].map(i=> g.vals[i]!=null && g.vals[0]!=null ? g.vals[i]-g.vals[0] : null) })) },
    options:{ scales:{ x:gridX, y:gridY(`change from 2023${mk==='mean'?' (points)':' (pp)'}`,
        {grid:{color:c=>c.tick.value===0?'#9AA6B2':'#EDF1F5'}}) },
      plugins:{ legend:{position:'bottom'},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${pp(c.parsed.y)}${mk==='mean'?'':'pp'}`}} } }
  });

  const g24=ser[0], g25=ser[1], gp=ser[2];
  const d24 = g24.vals[1]-g24.vals[0], dp24 = gp.vals[1]-gp.vals[0];
  const unit = mk==='mean' ? ' points' : 'pp';
  $('tf-insight').innerHTML =
    `In <b>2024</b>, the first year grades&nbsp;5 and&nbsp;8 were tested on computer, those two grades moved <b>${pp(d24)}${unit}</b> on ${M.label.toLowerCase()} against 2023, while grades&nbsp;3 and&nbsp;7, which the notes do not list as transitioning, moved <b>${pp(dp24)}${unit}</b> — a difference of <b>${pp(d24-dp24)}${unit}</b> in the same year. `
    + `By <b>2026</b> the three groups stand at ${ser.map(g=>`${f1(g.vals[3])} (grades ${g.grades.join(' and ')})`).join(', ')}. `
    + `This is a timing coincidence worth knowing about when reading year-on-year changes by grade; it is not evidence that the format caused the movement.`;

  /* per-grade table */
  const head = `<thead><tr><th class="nos">Grade</th><th class="nos">Computer from</th>`
    + MODERN.map(y=>`<th class="nos">${y}</th>`).join('') + `<th class="nos">Δ 2023→2026</th></tr></thead>`;
  const body = [3,4,5,6,7,8].map(g=>{
    const vs = MODERN.map(y=>{ const a=agg('city',[0],'g'+g,y,ALLCAT); return a?M.get(a):null; });
    const d = vs[3]!=null&&vs[0]!=null ? vs[3]-vs[0] : null;
    return `<tr><td class="nm">Grade ${g}</td><td>${CBT_YEAR[g] ?? '<span class="muted">—</span>'}</td>`
      + vs.map((v,i)=>`<td${CBT_YEAR[g]===MODERN[i]?' style="box-shadow:inset 0 -3px 0 #0070B9"':''}>${v==null?'s':f1(v)}</td>`).join('')
      + `<td><span class="cell" style="${heat(d,8,M.good)}">${d==null?'s':pp(d)}</span></td></tr>`;
  }).join('');
  $('tf-table').innerHTML = head + `<tbody>${body}</tbody>`;
}
function csvTF(){
  const out=[['NYC Reads ELA Explorer — test format groups'],
    ['Scope','Citywide, all students'],['Generated',BUILD],
    ['Grouping source','NOTES tab: computer-based from 2024 for grades 5 and 8; from 2025 for grades 4 and 6'],[],
    ['Group','Grades','Year','Students tested','% Level 1','% Level 3+4','Mean scale score']];
  for (const g of TF_GROUPS) for (const y of MODERN){
    const a=tfAgg(g.grades,y);
    out.push([g.name, g.grades.join(' & '), y, a?a.n:'s', a?f2(a.l1):'s', a?f2(a.prof):'s', a?f1(a.mean):'s']);
  }
  out.push([]);
  out.push(['Grade','Computer from','Year','Students tested','% Level 1','% Level 3+4','Mean scale score']);
  for (const g of [3,4,5,6,7,8]) for (const y of MODERN){
    const a=agg('city',[0],'g'+g,y,ALLCAT);
    out.push([`Grade ${g}`, CBT_YEAR[g] ?? 'not stated', y, a?a.n:'s', a?f2(a.l1):'s', a?f2(a.prof):'s', a?f1(a.mean):'s']);
  }
  return out;
}

/* =====================================================================
   PAGE — PROFESSIONAL LEARNING PROVIDERS AND CURRICULUM
   Groups districts by the NYC Reads PL provider they work with and by the
   elementary curriculum they adopted, and shows ELA results for each group.
   Group aggregates sum student counts across the districts in the group.
   ===================================================================== */
function initVE(){
  fillBaselines($('ve-base')); fillDims($('ve-dim')); fillCats($('ve-dim'), $('ve-cat'));
  fillMetrics($('ve-metric'), ['prof','l1','l4','mean'], 'prof');
  fill($('ve-group'), [
    { v:'reads', t:'Reads PL provider' },
    { v:'ec',    t:'Elementary curriculum' },
  ], 'reads');
  fill($('ve-band'), [
    { v:'35',  t:'Grades 3–5 (reached by the K–5 curriculum)' },
    { v:'all', t:'All grades (3–8)' },
    { v:'68',  t:'Grades 6–8' },
  ], '35');
  /* the single-district groups are noise; default to groups of 3 or more */
  fill($('ve-min'), [
    { v:'1', t:'Include every group' },
    { v:'2', t:'2 or more districts' },
    { v:'3', t:'3 or more districts' },
    { v:'5', t:'5 or more districts' },
  ], '3');
  buildVEPicker();
  on($('ve-dim'), () => { fillCats($('ve-dim'), $('ve-cat')); renderVE(); });
  on($('ve-group'), () => { msSel('ve-ms-groups').clear(); buildVEPicker(); renderVE(); });
  ['ve-base','ve-cat','ve-metric','ve-band','ve-min'].forEach(id => on($(id), renderVE));
  $('ve-reset').onclick = () => { msSel('ve-ms-groups').clear(); $('ve-min').value='3'; buildVEPicker(); renderVE(); };

  const row = (name, ds) =>
    `<tr><td class="nm">${esc(name)}</td><td>${ds.length}</td>
      <td style="white-space:normal">${ds.length
        ? ds.map(i=>`<span class="chip">D${D.districts[i]}</span>`).join('')
        : '<span class="muted">No district in the ELA files</span>'}</td></tr>`;
  $('ve-roster').innerHTML =
    `<thead><tr><th class="nos">NYC Reads PL provider</th><th class="nos">Districts</th><th class="nos">Which</th></tr></thead><tbody>`
    + V.readsRoster.map(v => row(v, distsWithReads(v))).join('') + `</tbody>`;
  $('ve-roster2').innerHTML =
    `<thead><tr><th class="nos">Elementary curriculum</th><th class="nos">Districts</th><th class="nos">Which</th></tr></thead><tbody>`
    + V.ecRoster.map(c => row(c, distsWithEC(c))).join('') + `</tbody>`;
}
/* every group, before any filtering */
function veAllGroups(){
  return $('ve-group').value === 'reads'
    ? V.readsRoster.map(v => ({ name:v, ds:distsWithReads(v) })).filter(g=>g.ds.length)
    : V.ecRoster.map(c => ({ name:c, ds:distsWithEC(c) })).filter(g=>g.ds.length);
}
function buildVEPicker(){
  multiSelect('ve-ms-groups', 'Groups',
    veAllGroups().map(g => ({ v:g.name, t:g.name, n:g.ds.length })), renderVE, 'All groups');
}
/* the groups actually shown: size threshold, then the explicit picker */
function veGroups(){
  const min = +$('ve-min').value;
  return veAllGroups().filter(g => g.ds.length >= min && msPass('ve-ms-groups', g.name));
}
function renderVE(){
  const base=+$('ve-base').value, cat=+$('ve-cat').value, mk=$('ve-metric').value;
  const M=METRICS[mk], bk=$('ve-band').value;
  const groups = veGroups(), all = veAllGroups();
  const kindLabel = $('ve-group').value === 'reads' ? 'PL provider' : 'curriculum';
  const unit = mk==='mean' ? '' : 'pp';

  const rows = groups.map(g => {
    const cur = agg('dist', g.ds, bk, 2026, cat);
    const bse = agg('dist', g.ds, bk, base, cat);
    return { ...g, cur, bse, d: cur && bse ? M.get(cur)-M.get(bse) : null };
  }).filter(r => r.cur && r.bse);
  const ranked = rows.slice().sort((a,b)=>(M.get(b.cur)-M.get(a.cur))*M.good);

  $('ve-sub').textContent = `${M.label}, ${band(bk).label.toLowerCase()}, ${groupLabel($('ve-dim'),$('ve-cat')).toLowerCase()}.`;

  /* hidden-group notice, so nothing is silently dropped */
  const hidden = all.filter(g => !groups.some(x => x.name === g.name));
  $('ve-hidden').innerHTML = hidden.length
    ? `<div class="note neut" style="margin-bottom:18px"><b>${hidden.length} group${hidden.length===1?'':'s'} not shown:</b> `
      + hidden.map(g=>`${esc(g.name)} (${g.ds.length})`).join(', ')
      + `. ${(+$('ve-min').value)>1 ? `Groups below the ${$('ve-min').value}-district threshold rest on too few districts to read as a trend. ` : ''}`
      + `They remain in the table below and in the CSV.</div>`
    : '';

  slopeChart('ve-slope', ranked.map(r => ({
    label: `${r.name} (${r.ds.length})`,
    from: M.get(r.bse), to: M.get(r.cur),
    sub: `${r.ds.length} district${r.ds.length===1?'':'s'} · ${num(r.cur.n)} tested in 2026`,
  })), { baseYear: base, unit, good: M.good, axisLabel: M.short });

  const PAL=['#1C355E','#0070B9','#00A0DD','#6D345F','#4F748B','#6FB0C7','#C0483C','#E8A33D',
             '#0F7B6C','#8A5A44','#7C6BAD'];
  draw('ve-trend', {
    type:'line',
    data:{ labels:MODERN.map(String), datasets: ranked.map((r,i)=>({
      label:`${r.name} (${r.ds.length})`, borderColor:PAL[i%PAL.length], backgroundColor:PAL[i%PAL.length],
      data: MODERN.map(y=>{ const a=agg('dist',r.ds,bk,y,cat); return a?M.get(a):null; }),
      borderWidth:2.6, tension:.25, pointRadius:4 })) },
    options:{ scales:{ x:gridX, y:gridY(M.short) },
      plugins:{ legend:{position:'bottom'}, tooltip:ppTip(mk==='mean'?'':'%') } },
    plugins:[markerPlugin(() => MARKS.ve ? markSet(WAVES, MODERN_SLOT) : [])]
  });
  $('ve-trend-marks').innerHTML = MARKS.ve ? markHTML(WAVES) : '';

  /* the table always carries every group, filtered or not */
  const full = all.map(g => {
    const cur = agg('dist', g.ds, bk, 2026, cat), bse = agg('dist', g.ds, bk, base, cat);
    return { ...g, cur, bse, d: cur && bse ? M.get(cur)-M.get(bse) : null, shown: groups.some(x=>x.name===g.name) };
  }).filter(r=>r.cur).sort((a,b)=>(M.get(b.cur)-M.get(a.cur))*M.good);
  const head = `<thead><tr><th class="nos">${$('ve-group').value==='reads'?'PL provider':'Curriculum'}</th>
    <th class="nos">Districts</th><th class="nos">Tested 2026</th>`
    + MODERN.map(y=>`<th class="nos">${y}</th>`).join('')
    + `<th class="nos">Δ ${base}→2026</th></tr></thead>`;
  $('ve-table').innerHTML = head + '<tbody>' + full.map(r =>
    `<tr${r.shown?'':' style="opacity:.5"'}><td class="nm">${esc(r.name)}${r.shown?'':' <span class="muted" style="font-weight:500">(not charted)</span>'}</td>`
    + `<td>${r.ds.length}</td><td>${num(r.cur.n)}</td>`
    + MODERN.map(y=>{ const a=agg('dist',r.ds,bk,y,cat); return `<td>${a?f1(M.get(a)):'s'}</td>`; }).join('')
    + `<td><span class="cell" style="${heat(r.d,6,M.good)}">${r.d==null?'s':pp(r.d)}</span></td></tr>`).join('')
    + '</tbody>';

  /* insight, and an explicit warning when 2025 is the baseline */
  const anomaly = base === 2025
    ? ` <b>Note the baseline.</b> 2025 sits well above 2024 and 2026 everywhere in the city, so measuring from 2025 makes almost every group look negative. That is a property of the baseline year, not of these groups — compare against 2023 or 2024 as well before reading anything into it.`
    : '';
  $('ve-insight').innerHTML = ranked.length
    ? `Grouping the 32 districts by ${kindLabel}, on ${band(bk).label.toLowerCase()}: `
      + `in 2026 the ${ranked.length} charted groups run from <b>${f1(M.get(ranked[ranked.length-1].cur))}</b> to <b>${f1(M.get(ranked[0].cur))}</b>, `
      + `and their change from ${base} runs from <b>${pp(Math.min(...ranked.map(r=>r.d)))}</b> to <b>${pp(Math.max(...ranked.map(r=>r.d)))}${unit}</b>. `
      + `Groups differ far more in where they started than in how they moved, which is what you would expect when districts were not assigned to ${kindLabel}s for comparison.`
      + anomaly
    : 'No group passes the current filters.';
  $('ve-overlap').innerHTML = $('ve-group').value === 'reads' && ALL_DIST.some(i => readsNames(i).length > 1)
    ? `<div class="note warn" style="margin-bottom:18px"><b>Districts can appear in more than one provider group.</b> Several districts work with two Reads providers, so the provider groups overlap and do not partition the city. A district with two providers is counted in both, and the group totals therefore sum to more than the citywide total.</div>`
    : '';
}
function csvVE(){
  const base=+$('ve-base').value, cat=+$('ve-cat').value, bk=$('ve-band').value;
  const kind = $('ve-group').value==='reads' ? 'Reads PL provider' : 'Elementary curriculum';
  const out=[['NYC Reads ELA Explorer — providers and curriculum'],
    ['Grouped by',kind],['Grades',band(bk).label],['Student group',CATS[cat]],
    ['Baseline',base],['Generated',BUILD],
    ['Note','Group aggregates sum student counts across districts. Districts with two Reads providers appear in both groups.'],[],
    [kind,'Districts','Which districts','Year','Students tested','% Level 1','% Level 3+4','Mean scale score']];
  for (const g of veGroups()) for (const y of MODERN){
    const a=agg('dist',g.ds,bk,y,cat);
    out.push([g.name, g.ds.length, g.ds.map(i=>'D'+D.districts[i]).join(' '), y,
      a?a.n:'s', a?f2(a.l1):'s', a?f2(a.prof):'s', a?f1(a.mean):'s']);
  }
  return out;
}

/* =====================================================================
   NAVIGATION + WIRING
   ===================================================================== */
const RENDER = { ov:renderOV, di:renderDI, bo:renderBO, ph:renderPH, ve:renderVE, sg:renderSG, tf:renderTF };
const CSVFN  = { ov:csvOV, di:csvDI, bo:csvBO, ph:csvPH, ve:csvVE, sg:csvSG, tf:csvTF };
const drawn = new Set();

function show(p){
  document.querySelectorAll('.ni').forEach(n => n.classList.toggle('ac', n.dataset.p===p));
  document.querySelectorAll('.pg').forEach(s => s.classList.toggle('ac', s.id===`pg-${p}`));
  if (!drawn.has(p)){ RENDER[p](); drawn.add(p); }
  window.scrollTo({top:0});
  history.replaceState(null,'','#'+p);
}
document.querySelectorAll('.ni').forEach(n => n.onclick = () => show(n.dataset.p));
document.addEventListener('click', e => {
  const png = e.target.closest('[data-png]');
  if (png){ exportPNG(png.dataset.png); return; }
  const csv = e.target.closest('[data-csv]');
  if (csv){ const k = csv.dataset.csv; exportCSV(k, CSVFN[k]()); }
});

/* re-render the visible page whenever its filters change (handled per page),
   but make sure a page that was never opened renders on first view */
['ov','di','bo','ph','ve','sg','tf'].forEach(p => {
  document.querySelectorAll(`#pg-${p} select`).forEach(s => s.addEventListener('change', () => { drawn.add(p); }));
});

/* marker toggles */
Object.keys(MARKS).forEach(p => {
  const el = $(p+'-marks-t');
  if (!el) return;
  el.addEventListener('change', () => { MARKS[p] = el.checked; RENDER[p](); });
});

initOV(); initDI(); initBO(); initPH(); initVE(); initSG(); initTF();
renderOV(); drawn.add('ov');

$('buildstamp').textContent = `Built ${BUILD}.`;
$('foot').innerHTML = `<b>NYC Reads &mdash; ELA Results Explorer.</b> Built for the Center for Public Research and Leadership from the NYCPS public ELA results files for grades 3&ndash;8 (citywide, borough and district), dated 3&nbsp;August&nbsp;2026, together with the NYCPS NYC Reads launch timeline. `
  + `Percentages are computed from student counts rather than copied from the published percentage columns; grade bands and district groups are aggregated by summing counts. `
  + `Changes are differences in percentage points and are never taken across the 2023 standards change. `
  + `Mathematics, Science, charter schools and school-level results are out of scope, and no professional-learning provider or curriculum field was available. `
  + `NYSED re-aligned the ELA test to new standards in 2023, so 2022 and earlier are shown for reference only and are never differenced against later years. `
  + `The citywide, borough and district files are compiled on different rules and do not sum to one another, so each level is read only from its own file. `
  + `Suppressed groups are omitted rather than treated as zero. Build ${BUILD}.`;

const hash = location.hash.replace('#','');
if (RENDER[hash]) show(hash);
