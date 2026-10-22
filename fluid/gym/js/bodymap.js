/* bodymap.js: the muscle box shown under an exercise's photo. Load after bodymap-data.js and exercise-data.js.
 *
 *   FIT_bodyMap(slugOrEntry) -> HTML string, '' when the entry has no `work`
 *   FIT_BODYMAP_CSS          its styles; fl-exercise (exercise.js) puts them in its shadow root, which is where the box is drawn
 *
 * The box: two small figures (ÖN, ARKA) on the left, the muscle list on the right. An entry's
 * work = {main: [{map, tr}], help: [{map, tr}]}; `map` is a key of window.BODYMAP, a list of keys, or null when the
 * map has no region for it (hip flexors, a joint); null items get a hollow dot. `tr` is the Turkish name.
 * Main muscles are dark orange and bold, helpers light orange. 'adductor' (back view) also colours the
 * inner thigh on the front view, which the source data names 'abductors'. The soleus regions
 * ('left-soleus', 'right-soleus') hang below the calves at y 196-220, so the figures use viewBox 0 0 100 220.
 * Stretch and mobility moves (kind static / dynamic) are titled "Esneyen kaslar", the rest "Çalışan kaslar".
 * With js/i18n.js loaded, the muscle names and the labels follow the active language (FIT_tx.muscle, FIT_I18N.t).
 */
(() => {
  const ALSO = { adductor: ['abductors'] };
  const T = (k) => (window.FIT_I18N ? FIT_I18N.t(k) : k);
  const NM = (tr) => (window.FIT_tx ? FIT_tx.muscle(tr) : tr);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const CSS = `
    .bm-box { --bm-m1: #e4572e; --bm-m2: #f4a582; --bm-body: #d5dae0; --bm-gap: var(--fl-bg, #fff); --bm-w: 62px;
      display: flex; gap: 14px; align-items: center; min-width: 0; padding: 10px 12px;
      background: var(--fl-bg, #fff); color: var(--fl-fg, #1d2433);
      border: 1px solid var(--fl-border, #e4e7ec); border-radius: 14px; font-size: 15px; line-height: 1.3; }
    @media (prefers-color-scheme: dark) {
      .bm-box { --bm-m1: #f26b3a; --bm-m2: #f2a98a; --bm-body: #3a414d; }
    }
    @media (max-width: 380px) { .bm-box { --bm-w: 54px; gap: 10px; padding: 10px; } }
    .bm-figs { display: flex; gap: 6px; flex: none; }
    .bm-figs figure { margin: 0; text-align: center; }
    .bm-figs figcaption { font-size: 11px; color: var(--fl-muted, #6b7280); font-weight: 600; letter-spacing: .04em; }
    .bm-figs svg { display: block; width: var(--bm-w); height: auto; }
    .bm-figs polygon { fill: var(--bm-body); stroke: var(--bm-gap); stroke-width: .4; }
    .bm-figs polygon.p1 { fill: var(--bm-m1); }
    .bm-figs polygon.p2 { fill: var(--bm-m2); }
    .bm-txt { min-width: 0; flex: 1; }
    .bm-h { font-size: 12px; font-weight: 650; color: var(--fl-muted, #6b7280); margin: 0 0 4px; }
    .bm-leg { list-style: none; margin: 0; padding: 0; }
    .bm-leg li { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; overflow-wrap: anywhere; }
    .bm-leg i { width: 12px; height: 12px; border-radius: 50%; flex: none; position: relative; top: 1px; }
    .bm-leg i.p1 { background: var(--bm-m1); } .bm-leg i.p2 { background: var(--bm-m2); }
    .bm-leg i.off { background: none; border: 3px solid; } .bm-leg i.off.p1 { border-color: var(--bm-m1); } .bm-leg i.off.p2 { border-color: var(--bm-m2); }
    .bm-leg b { font-weight: 650; }
    .bm-key { color: var(--fl-muted, #6b7280); font-size: 12px; margin: 4px 0 0; }
  `;

  function fill(work) {
    const m = {};
    [['help', 2], ['main', 1]].forEach(([k, c]) => (work[k] || []).forEach((it) => {
      if (!it.map) return;
      [].concat(it.map).forEach((k) => [k].concat(ALSO[k] || []).forEach((r) => { m[r] = c; }));
    }));
    return m;
  }
  function svg(side, m) {
    const d = (window.BODYMAP || {})[side === 'front' ? 'anteriorData' : 'posteriorData'] || [];
    const ps = d.map((r) => r.p.map((pts) => `<polygon${m[r.m] ? ` class="p${m[r.m]}"` : ''} points="${pts}"/>`).join('')).join('');
    return `<svg viewBox="0 0 100 220" aria-hidden="true">${ps}</svg>`;
  }

  function bodyMap(x) {
    const e = typeof x === 'string' ? (window.FIT_EXERCISES || {})[x] : x;
    const w = e && e.work;
    if (!w || !(w.main || []).length) return '';
    const m = fill(w), items = (w.main || []).map((it) => [1, it]).concat((w.help || []).map((it) => [2, it]));
    const off = items.some(([, it]) => !it.map);
    const stretch = e.kind === 'static' || e.kind === 'dynamic';
    const li = items.map(([c, it]) => `<li><i class="p${c}${it.map ? '' : ' off'}"></i>${c === 1 ? `<b>${esc(NM(it.tr))}</b>` : `<span>${esc(NM(it.tr))}</span>`}</li>`).join('');
    return `<div class="bm-box" data-bm="${esc(e.slug || '')}">` +
      `<div class="bm-figs"><figure>${svg('front', m)}<figcaption>${T('bm.front')}</figcaption></figure><figure>${svg('back', m)}<figcaption>${T('bm.back')}</figcaption></figure></div>` +
      `<div class="bm-txt"><p class="bm-h">${T(stretch ? 'bm.str' : 'bm.work')}</p><ul class="bm-leg">${li}</ul>` +
      `<p class="bm-key">${T('bm.key')}${off ? T('bm.off') : ''}</p></div></div>`;
  }

  window.FIT_bodyMap = bodyMap;
  window.FIT_BODYMAP_CSS = CSS;
})();
