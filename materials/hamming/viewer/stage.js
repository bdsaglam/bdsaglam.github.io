// The Fluid stage: pure functions the board uses to turn roles into geometry and a flow's time
// anchors into the active beat and the cues due. No DOM; node loads this file for the tests.
//
// Layout. Every view has a role: focus (most of the screen), aside (a column beside the focus),
// mini (a small live thumbnail), or hidden. A view without a role is hidden. Given the screen
// size, layout() works in screen pixels, then converts to board coordinates:
//
//   1. Minis take a strip along the bottom, height 17% of the screen (80 to 170 px). Each tile
//      keeps its view's aspect (clamped to 0.75..2); tiles shrink together when they do not fit,
//      and the row is centered. With no focus and no aside, minis are laid out as asides.
//   2. The rest is the main area. With a focus and asides on a landscape screen, the asides get
//      a column on the right, at least 28% of the width (240 to 480 px); the focus never grows
//      wider than 1.5 times its own aspect allows, and the width it leaves goes to the column
//      (up to half the screen). The composition is centered. On a portrait screen the asides
//      take a row under the focus instead (30% of the height).
//   3. Several focus views split the focus area into equal columns (rows when portrait).
//      Asides split their column in proportion to their natural height at the column width.
//      With no focus, asides fill the main area as a grid that suits their aspects.
//   4. Inside its cell a view keeps an aspect within 1.5 times its own (taken from the view's
//      meta w/h, default 480x360), centered in the cell.
//   5. The board zoom is the scale at which the first focus view (else the largest view) shows
//      at its meta size, clamped to 0.5..1.25. Board rects are screen rects divided by the zoom,
//      so a view gets more room to lay out on a big screen. Minis keep their meta size on the
//      board and are drawn scaled down (`s`), so they read as thumbnails, not reflowed pages.
//
// The camera for the whole stage is {x: 0, y: 0, zoom}; cameraOn() fits one view.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FluidStage = api;
})(typeof self !== 'undefined' ? self : this, () => {
  const ROLES = ['focus', 'aside', 'mini', 'hidden'];
  const DEFAULT = { w: 480, h: 360 };
  const PAD = 16, GAP = 16, K = 1.5;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const hintOf = (v) => {
    const w = Number(v?.w) > 0 ? Number(v.w) : DEFAULT.w, h = Number(v?.h) > 0 ? Number(v.h) : DEFAULT.h;
    return { w, h, a: w / h };
  };

  // The largest rect inside `cell` whose aspect is within K of `a`, centered.
  function fitCell(cell, a) {
    const lo = a / K, hi = a * K, ar = cell.w / cell.h;
    let w = cell.w, h = cell.h;
    if (ar > hi) w = h * hi;
    else if (ar < lo) h = w / lo;
    return { x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w, h };
  }

  // Split `area` among items along one axis, in proportion to weights.
  function split(area, weights, vertical) {
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    const room = (vertical ? area.h : area.w) - GAP * (weights.length - 1);
    let at = vertical ? area.y : area.x;
    return weights.map((w) => {
      const len = (room * w) / total;
      const cell = vertical ? { x: area.x, y: at, w: area.w, h: len } : { x: at, y: area.y, w: len, h: area.h };
      at += len + GAP;
      return cell;
    });
  }

  // A grid for n items in `area`: the column count whose cells best match the items' mean aspect.
  function grid(area, items) {
    const n = items.length;
    const mean = items.reduce((s, it) => s + it.hint.a, 0) / n;
    let best = 1, score = Infinity;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = (area.w - GAP * (cols - 1)) / cols, ch = (area.h - GAP * (rows - 1)) / rows;
      const s = Math.abs(Math.log(cw / ch / mean)) + (rows * cols - n) * 0.15;
      if (s < score) { score = s; best = cols; }
    }
    const cols = best, rows = Math.ceil(n / cols);
    const rowCells = split(area, Array(rows).fill(1), true);
    const cells = [];
    rowCells.forEach((row, r) => {
      const inRow = Math.min(cols, n - r * cols);
      const w = (area.w - GAP * (cols - 1)) / cols;
      const width = w * inRow + GAP * (inRow - 1);
      const x0 = area.x + (area.w - width) / 2;  // center a short last row
      for (let c = 0; c < inRow; c++) cells.push({ x: x0 + c * (w + GAP), y: row.y, w, h: row.h });
    });
    return cells;
  }

  /**
   * layout({views: [{id, role, w, h}], width, height}) -> {zoom, rects: {id: {x, y, w, h, s} | null}}
   * Board rects; null means hidden. `s` is the card's scale (1 except for minis).
   */
  function layout({ views, width, height }) {
    const W = Math.max(200, width), H = Math.max(160, height);
    const items = views.map((v) => ({ id: v.id, role: ROLES.includes(v.role) ? v.role : 'hidden', hint: hintOf(v) }));
    let focus = items.filter((v) => v.role === 'focus');
    let aside = items.filter((v) => v.role === 'aside');
    let mini = items.filter((v) => v.role === 'mini');
    if (!focus.length && !aside.length) { aside = mini; mini = []; }

    const screen = {};
    const area = { x: PAD, y: PAD, w: W - 2 * PAD, h: H - 2 * PAD };
    if (mini.length) {
      const hm = Math.round(clamp(area.h * 0.17, 80, 170));
      const widths = mini.map((m) => hm * clamp(m.hint.a, 0.75, 2));
      const need = widths.reduce((s, w) => s + w, 0) + GAP * (mini.length - 1);
      const k = Math.min(1, area.w / need);
      let x = area.x + (area.w - need * k) / 2;
      const y = area.y + area.h - hm;
      mini.forEach((m, i) => {
        screen[m.id] = fitCell({ x, y: y + (hm - hm * k) / 2, w: widths[i] * k, h: hm * k }, m.hint.a);
        x += widths[i] * k + GAP * k;
      });
      area.h -= hm + GAP;
    }

    const landscape = area.w >= area.h * 1.1;
    if (focus.length && aside.length) {
      let focusArea, asideArea;
      if (landscape) {
        const minAside = clamp(area.w * 0.28, 240, 480);
        const fa = focus.reduce((s, f) => s + f.hint.a, 0);
        const fw = Math.min(area.w - minAside - GAP, area.h * fa * K);
        const aw = Math.min(area.w - fw - GAP, area.w * 0.5);
        const x0 = area.x + (area.w - (fw + GAP + aw)) / 2;
        focusArea = { x: x0, y: area.y, w: fw, h: area.h };
        asideArea = { x: x0 + fw + GAP, y: area.y, w: aw, h: area.h };
      } else {
        const ah = clamp(area.h * 0.3, 140, 360);
        focusArea = { x: area.x, y: area.y, w: area.w, h: area.h - ah - GAP };
        asideArea = { x: area.x, y: area.y + area.h - ah, w: area.w, h: ah };
      }
      split(focusArea, focus.map(() => 1), !landscape).forEach((c, i) => { screen[focus[i].id] = fitCell(c, focus[i].hint.a); });
      const weights = landscape ? aside.map((a) => 1 / a.hint.a) : aside.map((a) => a.hint.a);
      split(asideArea, weights, landscape).forEach((c, i) => { screen[aside[i].id] = fitCell(c, aside[i].hint.a); });
    } else if (focus.length) {
      split(area, focus.map(() => 1), !landscape).forEach((c, i) => { screen[focus[i].id] = fitCell(c, focus[i].hint.a); });
    } else if (aside.length) {
      grid(area, aside).forEach((c, i) => { screen[aside[i].id] = fitCell(c, aside[i].hint.a); });
    }

    // The zoom at which the lead view shows at its meta size.
    const placed = items.filter((v) => screen[v.id] && v.role !== 'mini');
    const lead = focus[0] && screen[focus[0].id] ? focus[0]
      : placed.sort((a, b) => screen[b.id].w * screen[b.id].h - screen[a.id].w * screen[a.id].h)[0];
    const zoom = lead ? clamp(Math.min(screen[lead.id].w / lead.hint.w, screen[lead.id].h / lead.hint.h), 0.5, 1.25) : 1;

    const rects = {};
    const r = (n) => Math.round(n);
    for (const v of items) {
      const s = screen[v.id];
      if (!s) { rects[v.id] = null; continue; }
      if (v.role === 'mini' && mini.includes(v)) {
        const scale = Math.min(s.w / v.hint.w, s.h / v.hint.h) / zoom;
        rects[v.id] = { x: r(s.x / zoom), y: r(s.y / zoom), w: r(v.hint.w), h: r(v.hint.h), s: Math.round(scale * 1000) / 1000 };
      } else {
        rects[v.id] = { x: r(s.x / zoom), y: r(s.y / zoom), w: r(s.w / zoom), h: r(s.h / zoom), s: 1 };
      }
    }
    return { zoom, rects };
  }

  // A camera {x, y, zoom} that fits one board rect into a width x height screen.
  function cameraOn(rect, width, height, pad = 24) {
    const w = rect.w * (rect.s || 1), h = rect.h * (rect.s || 1);
    const zoom = clamp(Math.min((width - 2 * pad) / w, (height - 2 * pad) / h), 0.1, 2);
    return { x: (width - w * zoom) / 2 - rect.x * zoom, y: (height - h * zoom) / 2 - rect.y * zoom, zoom };
  }

  // ---- flow timing ----------------------------------------------------------------------

  // "02:10", "1:02:10", "130", or 130 -> seconds; null when unreadable.
  function seconds(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v !== 'string' || !/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(v.trim())) return null;
    return v.trim().split(':').reduce((s, p) => s * 60 + Number(p), 0);
  }

  // Beats anchored on `clock`, with start and end in seconds. A beat without an end lasts until
  // the next anchored beat starts.
  function spans(beats, clock) {
    const out = [];
    for (const b of beats || []) {
      const a = b?.anchor?.[clock];
      const pair = Array.isArray(a) ? a : a == null ? null : [a];
      const start = pair ? seconds(pair[0]) : null;
      if (start == null) continue;
      out.push({ beat: b, start, end: pair.length > 1 ? seconds(pair[1]) : null });
    }
    const sorted = [...out].sort((x, y) => x.start - y.start);
    sorted.forEach((s, i) => { if (s.end == null) s.end = i + 1 < sorted.length ? sorted[i + 1].start : Infinity; });
    return out;
  }

  // The beat whose span holds t on this clock (the last one in file order when spans overlap), or null.
  function activeBeat(beats, clock, t) {
    let found = null;
    for (const s of spans(beats, clock)) if (s.start <= t && t < s.end) found = s.beat;
    return found;
  }

  // For each view, the latest time cue on this clock at or before t: {view: {key, msg}}.
  // A cue's clock is its own `clock`, else its beat's first anchor clock, else "video".
  // The message is the cue without at, view and clock.
  function cuesAt(beats, clock, t) {
    const due = {};
    for (const b of beats || []) {
      const beatClock = Object.keys(b?.anchor || {})[0] || 'video';
      for (const c of b?.cues || []) {
        if (!c || typeof c.view !== 'string' || (c.clock || beatClock) !== clock) continue;
        const at = seconds(c.at);
        if (at == null || at > t) continue;
        if (!due[c.view] || at >= due[c.view].at) {
          const { at: _a, view: _v, clock: _c, ...msg } = c;
          due[c.view] = { at, key: `${b.id}@${at}`, msg };
        }
      }
    }
    return due;
  }

  return { ROLES, layout, cameraOn, seconds, activeBeat, cuesAt };
});
