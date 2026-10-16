/**
 * fl-exercise: one exercise as a card. A media area on top with up to three tabs: "Fotoğraf"
 * (start and end photos crossfading, side by side under reduced motion), "Video" (YouTube,
 * embedded only when the tab is opened), "Animasyon" (stick figure: target muscles highlighted,
 * equipment, tempo label, hold-timer ring for stretches and the plank). Then name, dose, rest,
 * effort, muscle legend, "Doğru" / "Kaçın" cues, alternative, and links (YouTube, GIF, Ağırsağlam yazısı).
 * Exercises come from window.FIT_EXERCISES; load ../../components/exercise-data.js first.
 * Photos and videos come from .fluid/sources/media.json, fetched at runtime (and polled until it
 * exists): {"<slug>": {"video": {"id", "start", "embeddable", "source"}, "photos": ["media/<slug>/0.jpg", ...],
 * "photoNote": "caveat under the photos", "gif": "url" | null, "page": "Ağırsağlam article url"}}; photo paths are relative to .fluid/. Default tab: Fotoğraf if photos
 * exist, else Video if media.json has one, else Animasyon. Load ../../lib/youtube.js in the page to embed with
 * fl-youtube (the agent then hears the video position); without it a plain YouTube iframe is used.
 * The animation runs only on the Animasyon tab, pauses offscreen, and starts paused under
 * prefers-reduced-motion.
 *
 * Attributes:
 *   slug     string        key in FIT_EXERCISES, e.g. "goblet-squat" (required unless `data` is set)
 *   compact  boolean attr  figure, name, dose and controls only (for a session player)
 *   size     "s" | "m" | "l"   figure height cap: 150 / 230 (default) / 340 px
 *   index    number        number badge before the name
 *   dose     string        override the registry dose, e.g. "5 / taraf"
 *   rest     string        override the rest text, e.g. "60 sn"
 *   paused   boolean attr  start paused
 *   speed    number        start speed, 0.5 or 1 (default 1)
 *   media    "photo" | "video" | "anim", or a comma list in preference order ("photo,anim")   first tab
 *   data     JSON          an ENTRY object instead of a registry slug (also the `data` property)
 *   session  "sali" | "cuma"   with `step`: show the exercise of that session step for the active
 *   step     string        program block (FIT_currentBlock()); the step's own dose wins over the entry's.
 *                          `step` is the step id in FIT_SESSIONS (the block-1 id, e.g. "one-arm-db-row").
 *                          The card re-renders when the block changes (fit-block / storage events).
 *   block    1 | 2 | 3     pin the block instead of following the active one
 *
 * The host carries data-item="exercise", data-id=<slug> and data-title=<name>.
 * Look: --fl-* properties, plus --fit-accent (badge, buttons) and --fit-m1..3 (muscle colours)
 * from ../../components/fit.css.
 *
 * JS API (for a step-by-step session player):
 *   play(), pause(), toggle(), setSpeed(0.5 | 1), reset(), seek(ms), setTab('photo' | 'video' | 'anim')
 *   .playing, .speed, .tab, .entry (the registry entry), .media (its media.json record), .phase ({index, label, kind})
 * Events: `phase` {index, label, kind} when the movement phase changes;
 *         `cycle` {count} each time one repetition (one loop) completes.
 *
 * Example:
 *   <link rel="stylesheet" href="../../components/fit.css">
 *   <script src="../../components/exercise-data.js"></script>
 *   <script src="../../lib/youtube.js"></script>
 *   <script src="../../components/exercise.js"></script>
 *   <fl-exercise slug="goblet-squat" index="1"></fl-exercise>
 *   <fl-exercise slug="plank" compact size="s" paused></fl-exercise>
 *   <fl-exercise session="sali" step="one-arm-db-row" index="3"></fl-exercise>   (row of the active block)
 */
(() => {
  const R = Math.PI / 180;
  const f = (n) => (+n).toFixed(1);
  const pt = (p, a, l) => [p[0] + Math.cos(a * R) * l, p[1] + Math.sin(a * R) * l];
  const ease = (u) => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); };
  const mod = (a, n) => ((a % n) + n) % n;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const RM = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACT = { con: 1, ecc: 0.7, hold: 0.4, move: 0.85, in: 0.6, static: 1, out: 0.6, iso: 1 };
  const RIR_TIP = 'RIR: Reps in Reserve — setin sonunda yedekte kalan tekrar sayısı';

  /* ---------- pose maths ---------- */
  function ik(A, T, l1, l2, s) {
    const dx = T[0] - A[0], dy = T[1] - A[1], d = Math.hypot(dx, dy) || 1e-6;
    const dd = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.1), l1 + l2 - 0.01);
    const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d, uy = dy / d;
    return [[A[0] + ux * a - uy * h * s, A[1] + uy * a + ux * h * s], [A[0] + ux * dd, A[1] + uy * dd]];
  }
  const COPY = [['th', 'th2'], ['sh', 'sh2'], ['ua', 'ua2'], ['fa', 'fa2'], ['us', 'us2'], ['fs', 'fs2'], ['ft', 'ft2'], ['hb', 'hb2'], ['fb', 'fb2']];
  function full(p) {
    const o = Object.assign({ lt: -90, th: 90, sh: 90, ua: 90, fa: 90, us: 1, fs: 1, ft: 0, hb: 1, fb: 1, gd: 1 }, p);
    if (p.to != null) { if (p.lt == null) o.lt = p.to; if (p.ut == null) o.ut = p.to; }
    if (o.ut == null) o.ut = o.lt;
    if (o.hd == null) o.hd = o.ut;
    for (const [a, b] of COPY) if (o[b] == null) o[b] = o[a];
    return o;
  }
  function mix(a, b, u) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[k], y = b[k];
      o[k] = typeof x === 'number' && typeof y === 'number' ? x + (y - x) * u : x == null ? y : y == null ? x : u < 0.5 ? x : y;
    }
    return o;
  }
  function spline(keys, s) {
    const n = keys.length - 1, u = Math.min(Math.max(s, 0), n);
    const i = Math.min(Math.floor(u), n - 1), t = u - i;
    const p0 = keys[Math.max(i - 1, 0)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(i + 2, n)];
    const o = Object.assign({}, p1);
    for (const k in p1) {
      const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
      if (![a, b, c, d].every((v) => typeof v === 'number')) continue;
      const t2 = t * t, t3 = t2 * t;
      const v = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      o[k] = Math.min(Math.max(v, Math.min(b, c)), Math.max(b, c));
    }
    return o;
  }
  function target(p, pre, sfx, J, def) {
    const ax = p[pre + 'x' + sfx], ay = p[pre + 'y' + sfx], dx = p[pre + 'dx' + sfx], dy = p[pre + 'dy' + sfx];
    if (ax == null && ay == null && dx == null && dy == null) return null;
    const b = J[p[pre + 'j' + sfx] || def] || J[def];
    return [ax != null ? ax : b[0] + (dx || 0), ay != null ? ay : b[1] + (dy || 0)];
  }
  function solve(p, A, G) {
    const L = G.L, J = {};
    J.hip = [0, 0]; J.mid = pt(J.hip, p.lt, L.lt); J.sho = pt(J.mid, p.ut, L.ut); J.head = pt(J.sho, p.hd, L.hd);
    const an = A.anchor || { j: 'hip', x: 160, y: 100 };
    const shift = (dx, dy) => { for (const k in J) J[k] = [J[k][0] + dx, J[k][1] + dy]; };
    let placed = false;
    const ax = p.ax || 0, ay = p.ay || 0; // per-pose anchor offset (a pull-up moves the whole body)
    if (['hip', 'mid', 'sho', 'head'].includes(an.j) && !an.ground) { shift(an.x + ax - J[an.j][0], an.y + ay - J[an.j][1]); placed = true; }
    const leg = (s) => {
      const T = target(p, 'f', s, J, 'hip');
      if (T) { const r = ik(J.hip, T, L.th, L.sh, p['fb' + s]); J['knee' + s] = r[0]; J['ankle' + s] = r[1]; }
      else { J['knee' + s] = pt(J.hip, p['th' + s], L.th); J['ankle' + s] = pt(J['knee' + s], p['sh' + s], L.sh); }
      J['toe' + s] = pt(J['ankle' + s], p['ft' + s], L.ft);
    };
    if (A.kneel2) {
      leg('');
      const gy = Math.max(J.knee[1], J.ankle[1]), dy = gy - J.hip[1];
      J.knee2 = [J.hip[0] - Math.sqrt(Math.max(0, L.th * L.th - dy * dy)), gy];
      J.ankle2 = pt(J.knee2, p.sh2, L.sh); J.toe2 = pt(J.ankle2, p.ft2, L.ft);
    } else { leg('2'); leg(''); }
    if (!placed) {
      const a = J[an.j] || J.hip;
      let dy;
      if (an.ground) {
        let m = -1e9;
        for (const k of ['knee', 'ankle', 'knee2', 'ankle2']) m = Math.max(m, J[k][1]);
        if (!A.noFoot) m = Math.max(m, J.toe[1], J.toe2[1]);
        dy = G.FLOOR - 3 - m;
      } else dy = an.y + ay - a[1];
      shift(an.x + ax - a[0], dy);
    }
    for (const s of ['2', '']) {
      const T = target(p, 'h', s, J, 'sho'), l1 = L.ua * p['us' + s], l2 = L.fa * p['fs' + s];
      if (T) { const r = ik(J.sho, T, l1, l2, p['hb' + s]); J['elb' + s] = r[0]; J['hand' + s] = r[1]; }
      else { J['elb' + s] = pt(J.sho, p['ua' + s], l1); J['hand' + s] = pt(J['elb' + s], p['fa' + s], l2); }
    }
    return J;
  }
  // compile an entry's animation once: full keys, phase sequence, cycle length
  function compile(e) {
    if (e._c) return e._c;
    const A = e.anim;
    const c = { A };
    if (!A) return (e._c = c);
    if (A.fn) { c.cycle = A.period || 4000; c.seq = [{ l: '', k: 'move', t0: 0, d: c.cycle, from: 0, to: 0 }]; }
    else {
      c.keys = A.keys.map(full);
      let s = 0, t = 0;
      c.seq = (A.phases || [['', 1000, null, 'hold']]).map((ph) => {
        const to = ph[2] == null ? s : ph[2];
        const o = { l: ph[0] || '', d: ph[1], from: s, to, k: ph[3] || (ph[2] == null ? 'hold' : 'move'), t0: t };
        s = to; t += ph[1]; return o;
      });
      c.cycle = t;
    }
    return (e._c = c);
  }
  function stateAt(c, t) {
    t = mod(t, c.cycle);
    let i = c.seq.findIndex((s) => t < s.t0 + s.d);
    if (i < 0) i = c.seq.length - 1;
    const sg = c.seq[i], u = Math.min(1, (t - sg.t0) / sg.d);
    let pose;
    if (c.A.fn) pose = full(Object.assign({}, c.A.base, c.A.fn(t)));
    else {
      const s = sg.from + (sg.to - sg.from) * (sg.k === 'hold' || sg.to === sg.from ? 0 : ease(u));
      if (c.A.interp === 'spline') pose = spline(c.keys, s);
      else { const n = c.keys.length - 1, j = Math.min(Math.floor(s), Math.max(n - 1, 0)); pose = n < 1 ? c.keys[0] : mix(c.keys[j], c.keys[j + 1], s - j); }
    }
    return { pose, i, sg, u, t };
  }
  function arrowPath(x, y, a, len = 20) {
    const tip = pt([x, y], a, len), h1 = pt(tip, a + 150, 6), h2 = pt(tip, a - 150, 6);
    return `M${f(x)} ${f(y)}L${f(tip[0])} ${f(tip[1])}M${f(h1[0])} ${f(h1[1])}L${f(tip[0])} ${f(tip[1])}L${f(h2[0])} ${f(h2[1])}`;
  }
  const poly = (pts, cls) => `<polyline class="${cls}" points="${pts.map((q) => f(q[0]) + ',' + f(q[1])).join(' ')}"/>`;
  const lerpP = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

  /* ---------- media.json, shared by every card ---------- */
  const MEDIA_URL = '../../canvas/sources/media.json';
  const Media = { data: null, started: false, els: new Set() };
  function loadMedia() {
    fetch(MEDIA_URL, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j && typeof j === 'object') { Media.data = j.exercises || j; for (const el of Media.els) el._onMedia(); }
      else setTimeout(loadMedia, 15000);
    }).catch(() => setTimeout(loadMedia, 15000));
  }
  const fileUrl = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : '../../canvas/' + p.replace(/^\.fluid\//, ''));
  const ytId = (s) => (String(s || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(String(s || '')) ? s : '');
  const TABS = [['photo', 'Fotoğraf'], ['video', 'Video'], ['anim', 'Animasyon']];

  /* ---------- one shared animation loop ---------- */
  const active = new Set();
  let raf = 0, last = 0;
  function loop(now) {
    const dt = Math.min(64, now - last); last = now;
    for (const el of active) el._tick(dt);
    raf = active.size ? requestAnimationFrame(loop) : 0;
  }
  function wake() { if (active.size && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  const CSS = `
    :host {
      --_font: var(--fl-font, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
      --_fg: var(--fl-fg, #1d2433); --_muted: var(--fl-muted, #6b7280); --_bg: var(--fl-bg, #ffffff);
      --_surface: var(--fl-surface, #f5f7fa); --_border: var(--fl-border, #e4e7ec);
      --_good: var(--fl-good, #15803d); --_bad: var(--fl-bad, #dc2626);
      --_acc: var(--fit-accent, var(--fl-accent, #4f6bed));
      --_m1: var(--fit-m1, #e5484d); --_m2: var(--fit-m2, #f59e0b); --_m3: var(--fit-m3, #8b5cf6);
      --_radius: var(--fl-radius, 10px); --_gap: var(--fl-gap, 12px);
      display: block; min-width: 0; font-family: var(--_font); color: var(--_fg); font-size: 13px; line-height: 1.4;
    }
    * { box-sizing: border-box; }
    .card { height: 100%; background: var(--_surface); border: 1px solid var(--_border); border-radius: var(--_radius);
      padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .top { display: flex; gap: 10px; align-items: center; min-width: 0; }
    .num { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--_acc); color: #fff;
      display: grid; place-items: center; font-weight: 700; font-size: 12px; }
    .tt { min-width: 0; flex: 1; }
    h3 { margin: 0; font-size: 15px; font-weight: 650; overflow-wrap: anywhere; }
    .sub { font-size: 12px; color: var(--_muted); }
    .fig { position: relative; border: 1px solid var(--_border); border-radius: 8px; background: var(--_bg); overflow: hidden; }
    .fig svg { display: block; width: 100%; height: auto; max-height: var(--_figmax, 230px); margin: 0 auto; }
    :host([size="s"]) { --_figmax: 150px; } :host([size="l"]) { --_figmax: 340px; }
    .phase { position: absolute; left: 8px; top: 6px; font-size: 11px; padding: 2px 8px; border-radius: 10px;
      background: var(--_surface); border: 1px solid var(--_border); }
    .phase[hidden] { display: none; }
    .nofig { padding: 18px; text-align: center; color: var(--_muted); font-size: 12px; }
    .ctrl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    button { font: inherit; font-size: 12px; color: var(--_fg); background: var(--_bg); border: 1px solid var(--_border);
      border-radius: 6px; padding: 4px 10px; cursor: pointer; text-decoration: none; line-height: 1.3; }
    button:hover { border-color: var(--_acc); }
    .seg { display: inline-flex; }
    .seg button { border-radius: 0; }
    .seg button:first-child { border-radius: 6px 0 0 6px; }
    .seg button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
    .seg button[aria-pressed="true"] { background: var(--_acc); border-color: var(--_acc); color: #fff; }
    button:focus-visible, a:focus-visible { outline: 2px solid var(--_acc); outline-offset: 2px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { font-size: 12px; border: 1px solid var(--_border); border-radius: 12px; padding: 2px 9px; background: var(--_bg); }
    .chip.dose { font-weight: 650; border-color: var(--_acc); }
    .chip.blk { color: var(--_muted); border-style: dashed; }
    .effort { font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
    .effort b { font-weight: 650; }
    .rirtag { font-size: 11px; color: var(--_muted); border: 1px dashed var(--_border); border-radius: 9px; padding: 0 7px; cursor: help; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--_muted); }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .legend .dash { width: 16px; height: 0; border-top: 2px dashed var(--_muted); border-radius: 0; }
    ul.cues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
    ul.cues li { display: flex; gap: 8px; align-items: baseline; }
    .tag { flex: none; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 9px; color: #fff; }
    .tag.ok { background: var(--_good); } .tag.no { background: var(--_bad); }
    .alt, .note, .vnote { margin: 0; font-size: 12px; color: var(--_muted); overflow-wrap: anywhere; }
    .alt b { color: var(--_fg); font-weight: 600; }
    .compact .top h3 { font-size: 14px; }
    .media { display: flex; flex-direction: column; gap: 6px; }
    .tabs { display: flex; gap: 4px; }
    .tabs button { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; }
    .tabs button[aria-selected="true"] { background: var(--_acc); border-color: var(--_acc); color: #fff; }
    .pane[hidden] { display: none; }
    .ph { position: relative; aspect-ratio: 16 / 10; max-height: var(--_figmax, 230px); width: 100%; border: 1px solid var(--_border);
      border-radius: 8px; background: var(--_bg); overflow: hidden; }
    .ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .ph.two img:nth-child(2) { animation: xfade 3s infinite; }
    @keyframes xfade { 0%, 40% { opacity: 0; } 50%, 90% { opacity: 1; } 100% { opacity: 0; } }
    .ph .cap { position: absolute; left: 8px; bottom: 6px; font-size: 11px; padding: 1px 8px; border-radius: 10px; background: var(--_surface); border: 1px solid var(--_border); }
    .ph.two .cap::after { content: 'Başlangıç ↔ Bitiş'; }
    @media (prefers-reduced-motion: reduce) {
      .ph.two { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; aspect-ratio: 16 / 6; }
      .ph.two img { position: static; animation: none !important; opacity: 1 !important; }
      .ph.two .cap { display: none; }
    }
    .vid { position: relative; aspect-ratio: 16 / 9; width: 100%; border-radius: 8px; overflow: hidden; background: #000; }
    .vid > * { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .vmsg { padding: 18px; text-align: center; color: var(--_muted); font-size: 12px; border: 1px dashed var(--_border); border-radius: 8px; }
    .pnote { margin: 4px 0 0; font-size: 11.5px; color: var(--_muted); }
    .links { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .links a { font-size: 12px; color: var(--_fg); text-decoration: none; border: 1px solid var(--_border); border-radius: 6px; padding: 3px 9px; background: var(--_bg); }
    .links a:hover { border-color: var(--_acc); }
    .links a.yt { font-weight: 600; }
    .src { font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; background: #d62f2f; color: #fff; margin-left: 4px; }
    .src.other { background: var(--_muted); }
    /* figure */
    .floor { stroke: var(--_border); stroke-width: 2; }
    .bone { fill: none; stroke: var(--_fg); stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; }
    .torso { stroke-width: 5; }
    .far { fill: none; stroke: var(--_muted); stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; opacity: .5; }
    .head { fill: var(--_bg); stroke: var(--_fg); stroke-width: 3; }
    .handdot { fill: var(--_fg); }
    .mus { fill: none; stroke-linecap: round; }
    .guide { stroke: var(--_muted); stroke-width: 1.5; stroke-dasharray: 4 4; }
    .arrow { fill: none; stroke: var(--_good); stroke-width: 2.8; stroke-linecap: round; stroke-linejoin: round; }
    .eq { fill: none; stroke: var(--_muted); stroke-width: 3; stroke-linecap: round; }
    .eqt { fill: none; stroke: var(--_muted); stroke-width: 1.4; stroke-linecap: round; opacity: .7; }
    .eqo { fill: none; stroke: var(--_muted); stroke-width: 1.2; opacity: .7; }
    .eqf { fill: var(--_border); stroke: var(--_muted); stroke-width: 1; }
    .leg { stroke: var(--_border); stroke-width: 5; stroke-linecap: round; }
    .pad { stroke: var(--_border); stroke-width: 10; stroke-linecap: round; }
    .platec { fill: var(--_muted); fill-opacity: .18; stroke: var(--_muted); stroke-width: 2; }
    .plate { fill: var(--_muted); fill-opacity: .75; stroke: var(--_fg); stroke-opacity: .35; }
    .db { fill: var(--_surface); stroke: var(--_fg); stroke-width: 2.5; }
    .dbx { fill: var(--_fg); }
    .dbl, .grip { stroke: var(--_fg); stroke-width: 3.5; stroke-linecap: round; }
    .cable { stroke: var(--_muted); stroke-width: 1.6; }
    .rope { stroke: var(--_fg); stroke-width: 3.2; stroke-dasharray: 2 1.6; stroke-linecap: round; }
    .pulley { fill: var(--_bg); stroke: var(--_muted); stroke-width: 2; }
    .handle { fill: var(--_muted); stroke: var(--_fg); stroke-width: 1.4; }
    .path { fill: none; stroke: var(--_muted); stroke-width: 1.5; stroke-dasharray: 3 4; opacity: .5; }
    .stick { fill: var(--_fg); stroke: var(--_bg); stroke-width: 1.5; }
    .rtrack { fill: var(--_bg); stroke: var(--_border); stroke-width: 5; }
    .rprog { fill: none; stroke: var(--_acc); stroke-width: 5; stroke-linecap: round; }
    .rsec { fill: var(--_fg); font: 700 16px var(--_font); text-anchor: middle; }
    .rlab { fill: var(--_muted); font: 10px var(--_font); text-anchor: middle; }
  `;

  class FlExercise extends HTMLElement {
    static observedAttributes = ['slug', 'data', 'compact', 'dose', 'rest', 'index', 'session', 'step', 'block'];
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._t = 0; this._clock = 0; this._speed = 1; this._playing = false; this._vis = true;
      this._act = 0.4; this._arr = 0; this._cycles = 0; this._phaseIdx = -1; this._data = null; this._tab = null; this._userTab = false;
      this._io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { this._vis = es[0].isIntersecting; this._sync(); }) : null;
    }
    connectedCallback() {
      if (Object.hasOwn(this, 'data')) { const v = this.data; delete this.data; this.data = v; }
      const sp = parseFloat(this.getAttribute('speed'));
      if (sp > 0) this._speed = sp;
      this._playing = !RM() && !this.hasAttribute('paused');
      this._io && this._io.observe(this);
      Media.els.add(this);
      if (!Media.started) { Media.started = true; loadMedia(); }
      if (!this._offBlock && window.FIT_onBlockChange) this._offBlock = window.FIT_onBlockChange(() => { if (this.hasAttribute('step')) this.render(); });
      this.render();
    }
    disconnectedCallback() {
      this._io && this._io.disconnect(); active.delete(this); Media.els.delete(this);
      if (this._offBlock) { this._offBlock(); this._offBlock = null; }
    }
    // the session step this card stands for, resolved for the active (or pinned) block
    _step() {
      const key = this.getAttribute('session'), id = this.getAttribute('step');
      const list = key && id && window.FIT_SESSIONS && window.FIT_SESSIONS[key];
      const base = list && list.find((s) => s.id === id);
      return base && window.FIT_step ? window.FIT_step(base, this.getAttribute('block')) : null;
    }
    _onMedia() { if (this._e && Media.data && Media.data[this._e.slug || this.getAttribute('slug')]) this.render(); }
    get media() { return (Media.data && this._e && Media.data[this._e.slug || this.getAttribute('slug')]) || null; }
    get tab() { return this._tab; }
    setTab(t) { this._userTab = true; this._showTab(t); }
    _showTab(t) {
      const root = this.shadowRoot;
      if (!root.querySelector(`.pane[data-tab="${t}"]`)) return;
      this._tab = t;
      root.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      root.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.tab !== t; });
      if (t === 'video') this._loadVideo();
      if (t === 'anim') this._draw();
      this._sync();
    }
    _loadVideo() {
      const box = this.shadowRoot.querySelector('.pane[data-tab="video"]');
      if (!box || box.dataset.loaded) return;
      box.dataset.loaded = '1';
      const v = this._vid;
      if (v.embeddable === false) { box.innerHTML = `<div class="vmsg">Bu video gömülemiyor; aşağıdaki "YouTube'da aç" bağlantısını kullan.</div>`; return; }
      if (customElements.get('fl-youtube')) box.innerHTML = `<div class="vid"><fl-youtube video="${esc(v.id)}" start="${v.start || 0}"></fl-youtube></div>`;
      else box.innerHTML = `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}?start=${v.start || 0}&rel=0" title="${esc(this._e.name)} videosu" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
    }
    attributeChangedCallback(name, _o, v) {
      if (name === 'data') { try { this._data = v ? JSON.parse(v) : null; } catch { this._data = null; } }
      if (this.isConnected) this.render();
    }
    get data() { return this._data; }
    set data(v) { this._data = v; if (this.isConnected) this.render(); }
    get entry() { return this._e || null; }
    get playing() { return this._playing; }
    get speed() { return this._speed; }
    get phase() { const s = this._c && this._c.seq[this._phaseIdx]; return s ? { index: this._phaseIdx, label: s.l, kind: s.k } : null; }
    play() { this._playing = true; this._sync(); }
    pause() { this._playing = false; this._sync(); }
    toggle() { this._playing ? this.pause() : this.play(); }
    setSpeed(v) { this._speed = +v || 1; this._sync(); }
    seek(ms) { this._t = Math.max(0, +ms || 0); this._draw(); }
    reset() { this._t = 0; this._clock = 0; this._cycles = 0; this._draw(); }

    _sync() {
      const root = this.shadowRoot;
      const pb = root.querySelector('.play');
      if (pb) { pb.textContent = this._playing ? '❚❚ Duraklat' : '▶ Oynat'; pb.setAttribute('aria-pressed', String(this._playing)); }
      root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === this._speed)));
      if (this._playing && this._vis && this.isConnected && this._c && this._c.A && this._tab === 'anim') active.add(this); else active.delete(this);
      wake();
    }

    render() {
      const G = window.FIT_GEOM, REG = window.FIT_EXERCISES;
      const st = this._step();
      if (st && this._slug !== st.slug) { this._userTab = false; this._t = 0; }
      const slug = (st && st.slug) || this.getAttribute('slug') || (this._data && this._data.slug) || '';
      this._slug = slug;
      const e = (st ? null : this._data) || (REG && REG[slug]);
      const root = this.shadowRoot;
      if (!G || !REG) { root.innerHTML = `<style>${CSS}</style><div class="card nofig">fl-exercise: ../../components/exercise-data.js yüklenmedi</div>`; return; }
      if (!e) { root.innerHTML = `<style>${CSS}</style><div class="card nofig">fl-exercise: "${esc(slug)}" bulunamadı</div>`; return; }
      this._e = e; this._G = G; this._c = compile(e);
      this.setAttribute('data-item', 'exercise'); this.setAttribute('data-id', e.slug || slug); this.setAttribute('data-title', e.name);
      const compact = this.hasAttribute('compact');
      const dose = this.getAttribute('dose') || (st && st.dose) || e.dose, rest = this.getAttribute('rest') ?? e.rest;
      const blk = st && st.variants && (window.FIT_BLOCKS || []).find((b) => b.n === st.block);
      const idx = this.getAttribute('index');
      const A = e.anim, M = this.media || {};
      // video: media.json first, the registry link second
      const rv = e.video || null, mv = M.video || null;
      const vid = mv && mv.id ? { id: mv.id, start: mv.start || 0, embeddable: mv.embeddable, source: mv.source || (rv && rv.source), title: mv.title || (rv && rv.title), channel: mv.channel || (rv && rv.channel) }
        : rv && ytId(rv.url) ? { id: ytId(rv.url), start: rv.start || 0, source: rv.source, title: rv.title, channel: rv.channel, url: rv.url } : null;
      this._vid = vid;
      const photos = (M.photos || []).slice(0, 2).map(fileUrl);
      const tabs = TABS.filter(([k]) => (k === 'photo' ? photos.length : k === 'video' ? vid : A));
      // media: one tab name or a comma list in order of preference, e.g. "photo,anim"
      const want = (this.getAttribute('media') || '').split(',').map((x) => x.trim()).find((w) => tabs.some(([k]) => k === w));
      const first = this._userTab && tabs.some(([k]) => k === this._tab) ? this._tab
        : want ? want
          : photos.length ? 'photo' : mv && mv.id ? 'video' : A ? 'anim' : vid ? 'video' : null;
      const isAg = vid && vid.source === 'agirsaglam';
      const ytUrl = vid ? `https://www.youtube.com/watch?v=${vid.id}${vid.start ? `&t=${vid.start}s` : ''}` : '';
      const page = M.page || M.site || M.pageUrl;
      const links = vid || M.gif || page ? `<div class="links">
          ${vid ? `<a class="yt" href="${esc(ytUrl)}" target="_blank" rel="noopener" title="${esc((vid.title || '') + (vid.channel ? ' · ' + vid.channel : ''))}">▶ YouTube'da aç<span class="src ${isAg ? '' : 'other'}">${isAg ? 'Ağırsağlam' : esc(vid.channel || 'Video')}</span></a>` : ''}
          ${M.gif ? `<a href="${esc(fileUrl(M.gif))}" target="_blank" rel="noopener">GIF</a>` : ''}
          ${page ? `<a href="${esc(page)}" target="_blank" rel="noopener">Ağırsağlam yazısı</a>` : ''}</div>` : '';
      const figPane = A ? `<div class="pane" data-tab="anim">
          <div class="fig"><svg viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="${esc(e.name)} hareket animasyonu">
            <line class="floor" x1="8" y1="${G.FLOOR}" x2="${G.W - 8}" y2="${G.FLOOR}"/><g${A.zoom ? ` transform="translate(${G.W / 2} ${G.FLOOR}) scale(${A.zoom}) translate(${-G.W / 2} ${-G.FLOOR})"` : ''}><g class="st"></g><g class="dyn"></g></g></svg>
            <span class="phase" hidden></span></div>
          <div class="ctrl"><button class="play" type="button"></button>
            <span class="seg" role="group" aria-label="Hız"><button type="button" data-s="0.5">0.5x</button><button type="button" data-s="1">1x</button></span></div></div>` : '';
      const photoPane = photos.length ? `<div class="pane" data-tab="photo"><div class="ph ${photos.length > 1 ? 'two' : ''}">
          ${photos.map((u, i) => `<img src="${esc(u)}" alt="${esc(e.name)} ${i ? 'bitiş' : 'başlangıç'} pozisyonu" loading="lazy">`).join('')}<span class="cap"></span></div>${M.photoNote ? `<p class="pnote">${esc(M.photoNote)}</p>` : ''}</div>` : '';
      const videoPane = vid ? `<div class="pane" data-tab="video"></div>` : '';
      const media = tabs.length ? `<div class="media">
          ${tabs.length > 1 ? `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}">${l}</button>`).join('')}</div>` : ''}
          ${photoPane}${videoPane}${figPane}</div>` : `<div class="fig nofig">Görsel yok.</div>`;
      const legend = (e.legend || []).length || (A && A.guide) ? `<div class="legend"><span style="color:var(--_fg)">Hedef kaslar:</span>${(e.legend || []).map((l) => `<span><i style="background:var(--_m${l[0]})"></i>${esc(l[1])}</span>`).join('')}${A && A.guide && A.guide.label ? `<span><i class="dash"></i>${esc(A.guide.label)}</span>` : ''}</div>` : '';
      const cues = (e.cues || []).length || e.avoid ? `<ul class="cues">${(e.cues || []).map((c) => `<li><span class="tag ok">Doğru</span><span>${esc(c)}</span></li>`).join('')}${e.avoid ? `<li><span class="tag no">Kaçın</span><span>${esc(e.avoid)}</span></li>` : ''}</ul>` : '';
      const effort = e.rir ? `<div class="effort"><b>Efor</b><span>${esc(e.rir)}</span>${e.rirTag ? `<span class="rirtag" title="${esc(RIR_TIP)}">${esc(e.rirTag)}</span>` : ''}</div>` : '';
      active.delete(this);
      root.innerHTML = `<style>${CSS}</style><article class="card${compact ? ' compact' : ''}">
        <div class="top">${idx ? `<span class="num">${esc(idx)}</span>` : ''}<div class="tt"><h3>${esc(e.name)}</h3>${e.sub ? `<div class="sub">${esc(e.sub)}</div>` : ''}</div>
          ${compact && dose ? `<span class="chip dose">${esc(dose)}</span>` : ''}</div>
        ${media}${links}
        ${compact ? '' : `
          <div class="chips">${dose ? `<span class="chip dose">${esc(dose)}</span>` : ''}${rest ? `<span class="chip">Dinlenme ${esc(rest)}</span>` : ''}${blk ? `<span class="chip blk" title="Bu hareket bloğa göre değişir">${esc(blk.name)} · hf ${esc(blk.weeks)}</span>` : ''}</div>
          ${effort}${legend}${cues}
          ${e.alt ? `<p class="alt"><b>Alternatif:</b> ${esc(e.alt)}</p>` : ''}
          ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
          ${vid && rv && rv.note && !(mv && mv.id && mv.id !== ytId(rv.url)) ? `<p class="vnote">Video: ${esc(rv.note)}</p>` : ''}`}
      </article>`;
      root.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
      this._dyn = null;
      if (A) {
        this._dyn = root.querySelector('.dyn'); this._phEl = root.querySelector('.phase');
        root.querySelector('.play').addEventListener('click', () => this.toggle());
        root.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => this.setSpeed(+b.dataset.s)));
        // equipment context from the first frame
        const J0 = solve(stateAt(this._c, 0).pose, A, G);
        this._ctx = A.equip && A.equip.init ? A.equip.init(J0) : {};
        root.querySelector('.st').innerHTML = A.equip && A.equip.stat ? A.equip.stat(this._ctx) : '';
        if (!this._playing && !this._t) this._t = A.still || 0;
        this._phaseIdx = -1;
        this._draw();
      }
      if (first) this._showTab(first); else this._sync();
    }

    _tick(dt) {
      const c = this._c, d = dt * this._speed, before = Math.floor(this._t / c.cycle);
      this._t += d; this._clock += d;
      const after = Math.floor(this._t / c.cycle);
      if (after > before) { this._cycles++; this.dispatchEvent(new CustomEvent('cycle', { detail: { count: this._cycles } })); }
      this._draw(dt);
    }

    _draw(dt) {
      const c = this._c, A = c && c.A, G = this._G;
      if (!A || !this._dyn) return;
      const st = stateAt(c, this._t);
      let pose = st.pose, b = 0;
      if (A.breath) { b = (Math.sin(this._clock / 4000 * 2 * Math.PI) + 1) / 2; pose = Object.assign({}, pose, { lt: pose.lt + (b - 0.5) * 1.4, ut: pose.ut + (b - 0.5) * 1.4 }); }
      const J = solve(pose, A, G);
      // muscle activity and arrow fade follow the phase kind, smoothed
      const tgt = A.breath ? 0.75 + 0.25 * b : ACT[st.sg.k] ?? 0.6;
      const k = dt ? 1 - Math.exp(-dt / 140) : 1;
      this._act += (tgt - this._act) * k;
      this._arr += ((st.sg.k === 'con' ? 1 : 0) - this._arr) * k;
      const ms = this._t, eq = A.equip || {}, ctx = this._ctx;
      let s = '';
      if (eq.back) s += eq.back(J, ctx, ms);
      const far = A.far || '';
      if (far === 'leg' || far === 'both') s += poly(A.noFoot ? [J.hip, J.knee2, J.ankle2] : [J.hip, J.knee2, J.ankle2, J.toe2], 'far');
      if (far === 'arm' || far === 'both') s += poly([J.sho, J.elb2, J.hand2], 'far');
      for (const m of A.muscles || []) {
        const P = J[m.a], Q = J[m.b], off = m.off || [0, 0];
        if (!P || !Q) continue;
        const p = lerpP(P, Q, m.f0 ?? 0), q = lerpP(P, Q, m.f1 ?? 1);
        s += `<line class="mus" x1="${f(p[0] + off[0])}" y1="${f(p[1] + off[1])}" x2="${f(q[0] + off[0])}" y2="${f(q[1] + off[1])}" stroke="var(--_m${m.c || 1})" stroke-width="${f(m.w * (m.breath ? 1 + 0.15 * b : 1))}" stroke-opacity="${(0.22 + 0.7 * this._act).toFixed(2)}"/>`;
      }
      s += poly(A.noFoot ? [J.hip, J.knee, J.ankle] : [J.hip, J.knee, J.ankle, J.toe], 'bone');
      s += poly([J.hip, J.mid, J.sho], 'bone torso');
      s += poly([J.sho, J.head], 'bone');
      s += `<circle class="head" cx="${f(J.head[0])}" cy="${f(J.head[1])}" r="${G.L.head}"/>`;
      s += poly([J.sho, J.elb, J.hand], 'bone');
      if (A.hand !== false) s += `<circle class="handdot" cx="${f(J.hand[0])}" cy="${f(J.hand[1])}" r="3"/>`;
      if (eq.front) s += eq.front(J, ctx, ms);
      if (A.guide) {
        const g = A.guide, P = J[g.a], Q = J[g.b], dx = Q[0] - P[0], dy = Q[1] - P[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, ex = g.ext || [14, 22];
        s += `<line class="guide" x1="${f(P[0] - ux * ex[0])}" y1="${f(P[1] - uy * ex[0])}" x2="${f(Q[0] + ux * ex[1])}" y2="${f(Q[1] + uy * ex[1])}" opacity="${(0.9 * (pose.gd ?? 1)).toFixed(2)}"/>`;
      }
      if (eq.arrows && this._arr > 0.02) s += `<path class="arrow" d="${eq.arrows(J, ctx).map((a) => arrowPath(a[0], a[1], a[2])).join('')}" opacity="${(this._arr * 0.9).toFixed(2)}"/>`;
      if (A.ring) s += this._ring(A.ring, st);
      this._dyn.innerHTML = s;
      if (st.i !== this._phaseIdx) {
        this._phaseIdx = st.i;
        this._phEl.textContent = st.sg.l; this._phEl.hidden = !st.sg.l;
        this.dispatchEvent(new CustomEvent('phase', { detail: this.phase }));
      }
    }

    _ring(r, st) {
      const cx = this._G.W - 30, cy = 32, rad = 20, C = 2 * Math.PI * rad;
      let frac, num, lab;
      if (r.mode === 'up') { const sec = (this._clock / 1000) % r.sec; frac = sec / r.sec; num = Math.floor(sec); lab = `/ ${r.sec} sn`; }
      else {
        const hs = this._c.seq.find((q) => q.k === 'static') || st.sg, t = mod(st.t, this._c.cycle);
        const el = Math.min(Math.max(t - hs.t0, 0), hs.d);
        frac = el / hs.d; num = t < hs.t0 ? r.sec : Math.max(0, Math.ceil((hs.d - el) / 1000)); lab = 'sn';
      }
      return `<circle class="rtrack" cx="${cx}" cy="${cy}" r="${rad}"/><circle class="rprog" cx="${cx}" cy="${cy}" r="${rad}" transform="rotate(-90 ${cx} ${cy})" stroke-dasharray="${f(C * frac)} ${f(C)}"/>` +
        `<text class="rsec" x="${cx}" y="${cy + 5}">${num}</text><text class="rlab" x="${cx}" y="${cy + rad + 13}">${lab}</text>`;
    }
  }
  FlExercise.solve = solve; // for tests and other views
  if (!customElements.get('fl-exercise')) customElements.define('fl-exercise', FlExercise);
})();
