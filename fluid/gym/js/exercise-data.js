/**
 * exercise-data.js: the workout registry. Not an element; load it before exercise.js,
 * session-timeline.js and block-picker.js. It defines these globals:
 *
 *   FIT_GEOM          the one skeleton and coordinate system every figure uses
 *   FIT_SVG           helpers that draw equipment (benches, cables, walls, dumbbells)
 *   FIT_EXERCISES     {<slug>: ENTRY}   every exercise, drawn by <fl-exercise slug="...">
 *   FIT_SESSIONS      {sali: [STEP...], cuma: [STEP...], sabah: [...], aksam: [...]}   session order and minute estimates
 *   FIT_SESSION_META  {sali: {label, title, accent, note}, ...}; the daily routines (sabah, aksam) carry
 *                     routine: true and min, and use one-item list steps (phase 'mob'), one move per step
 *   FIT_BLOCKS        [{n: 1, weeks: '1-4', name: 'Blok 1', from: 1, to: 4}, ...]   the 12-week plan
 *   FIT_currentBlock() active block 1..3; FIT_blockInfo() {block, source, week, start}
 *   FIT_setBlock(n | null), FIT_setStart('YYYY-MM-DD' | null), FIT_onBlockChange(fn) -> off()
 *   FIT_step(step, block?), FIT_sessionSteps(key, block?)   steps resolved for a block
 *   exMin(warm, sets, workSec, restSec, switchMin)          minute estimate of one exercise step
 *
 * ── Coordinate system ──────────────────────────────────────────────────────────────────
 * SVG viewBox 0 0 320 200, y down, floor line at FIT_GEOM.FLOOR (184). The figure faces right.
 * Angles are SVG degrees: 0 = right (forward), 90 = down, -90 = up, 180 = left (back).
 * Segment lengths (FIT_GEOM.L): thigh 44, shin 43, torso 25 + 25 (lower + upper), neck to
 * head centre 18 (head r 9), upper arm 29, forearm 31, foot 14.
 * Joints a pose produces: hip mid sho head knee ankle toe elb hand, and the far side
 * knee2 ankle2 toe2 elb2 hand2.
 *
 * ── Adding an exercise: one ENTRY ──────────────────────────────────────────────────────
 *   'my-slug': {
 *     name: 'Goblet Squat', sub: 'optional subtitle',
 *     kind: 'lift' | 'dynamic' | 'static' | 'cardio' | 'hold',
 *     dose: '3 × 8–10', rest: '2–2,5 dk', restSec: [120, 150],      (rest optional)
 *     rir: '2 tekrar kala bırak' (plain effort line), rirTag: 'RIR 2 · RPE 8' (small tag)
 *     equipment: ['dambıl'],
 *     legend: [[1, 'Kuadriseps'], [2, 'Kalça']],      animation colour 1..3 + muscle name (not shown in the app)
 *     work: {main: [MUSCLE], help: [MUSCLE]}          body map box (js/bodymap.js): main = prime movers, help = synergists and
 *             stabilisers; for stretches main = the stretched muscles. MUSCLE = {map, tr}: map is a BODYMAP key, a list of
 *             keys, or null (no region on the map: hip flexors, rotator cuff); tr the Turkish name. MU has common ones.
 *     joints: [JT...], tissue: [TS...]               stretch and mobility moves (kind static / dynamic) only, shown under the
 *             muscle list: the joints the move takes through range, with the direction, and the non-muscle connective
 *             tissue that is loaded (tendon, fascia, joint capsule; never a ligament). Turkish strings; JT and TS have them.
 *     cues: ['...'], avoid: '...', alt: 'alternative', note: 'muted footnote',
 *     video: {url, title, channel, source: 'agirsaglam'|'fallback'|'user', note}  (added from YT below)
 *     anim: ANIM
 *   }
 *
 *   ANIM = {
 *     anchor: {j: 'ankle', x: 150, y: FLOOR - 3}   pin a joint at (x, y) for the whole motion, or
 *             {j: 'hip', x: 130, ground: true}     pin x only; the lowest leg point sits on the floor
 *     keys: [POSE, POSE, ...],                     key poses; key 0 is the start
 *     interp: 'linear' (default) | 'spline'        spline = Catmull-Rom through all keys
 *     phases: [[label, ms, toKey|null, kind], ...] one rep; toKey = key index to move to with
 *             ease-in-out (null = hold). kind: con | ecc | hold | move | in | static | out | iso
 *             (sets muscle highlight strength; arrows show during con).
 *     fn: (ms) => POSE, period: ms, base: POSE      procedural instead of keys/phases
 *     still: ms                                     frame shown when paused or reduced motion
 *     muscles: [{a: 'knee', b: 'hip', w: 14, c: 1, f0, f1, off: [dx, dy], breath}]
 *             a stroke from joint a to b (a == b gives a dot of diameter w), colour c
 *     guide: {a: 'hip', b: 'head', label: 'düz omurga', ext: [14, 22]}   dashed alignment line
 *     ring: {sec: 30, mode: 'down'}  countdown over the 'static' phase; {sec: 45, mode: 'up'} counter
 *     far: 'leg' | 'arm' | 'both'   draw the far limbs (muted); noFoot: true; hand: false (no hand dot)
 *     kneel2: true                  far knee placed on the floor behind the hip (half-kneeling)
 *     breath: true                  slow breathing sway (plank)
 *     zoom: 0.82                    shrink the drawing about the floor centre (arms overhead)
 *     equip: {init(J0) -> ctx, stat(ctx), back(J, ctx, ms), front(J, ctx, ms), arrows(J, ctx)}
 *             SVG strings built with FIT_SVG; J = joint positions this frame
 *   }
 *
 *   POSE = any of (missing values take defaults: standing straight, arms down)
 *     lt, ut       lower / upper torso angle (or `to` for both); hd head angle (default ut)
 *     th, sh, ft   near thigh, shin, foot angle;  th2, sh2, ft2 far side (default = near)
 *     ua, fa       near upper arm, forearm;       ua2, fa2 far side (default = near)
 *     us, fs       upper arm / forearm length scale (foreshortening), us2, fs2
 *     hand target (two-bone IK instead of ua/fa): hx, hy absolute, or hdx, hdy relative to joint
 *       hj (default 'sho'); hb = elbow bend side (1 | -1). Far hand: hx2 hy2 hdx2 hdy2 hj2 hb2.
 *       Targets are never copied to the far side; give them explicitly.
 *     foot target (IK for the leg, only with a torso anchor): fx fy fdx fdy fj fb, and ...2
 *     gd           guide line opacity 0..1 (default 1)
 *     ax, ay       shift the anchor for this pose (moves the whole body: pull-up, split squat);
 *                  give them in every key
 *
 * Minimal example (a squat): keys [{}, {th: -10, sh: 115, lt: -48, ut: -40, ua: 10, fa: 2}],
 * phases [['İn · 2 sn', 2000, 1, 'ecc'], ['Kalk · 1 sn', 1000, 0, 'con']],
 * anchor {j: 'ankle', x: 160, y: FLOOR - 3}.
 *
 * ── STEP (FIT_SESSIONS) ────────────────────────────────────────────────────────────────
 *   {id, name, phase: 'warm'|'main'|'cool', type: 'cardio'|'list'|'exercise',
 *    min (planned minutes), lo, hi (range; default min), detail (one line),
 *    slug (exercise steps), sets, reps, holdSec: [30, 45], warmupSets, workSec, restSec: [lo, hi],
 *    items: [{slug, name?, dose, holdSec?, perSide?, optional?, tip?}] (list steps; perSide: the timer runs
 *    holdSec once per side; tip: a short hint shown with the dose), video (optional),
 *    perSide (each set is done on both sides), dose (card text when it differs from the entry),
 *    variants: {2: VARIANT, 3: VARIANT}}   (phase 'mob' = a daily routine move)
 *   The step itself is the block-1 choice. VARIANT is a slug ('seated-cable-row': same sets, reps,
 *   rest and minutes) or an object of fields that replace the step's for that block, e.g.
 *   {slug: 'db-split-squat', reps: '8–12 / bacak', perSide: true, workSec: 80, min, hi, detail}.
 *   A block without an entry uses the step as written. FIT_step(step, b) returns a copy with the
 *   variant applied, `slot` = the step's own id, `id` = the variant's slug, `block` = b.
 *
 * ── Blocks ─────────────────────────────────────────────────────────────────────────────
 *   FIT_currentBlock() reads, in order: ?block=N in the page URL, localStorage 'fit-block' (a manual
 *   pick), localStorage 'fit-start' (start date; 4 weeks per block, block 3 after week 12), else 1.
 *   With no 'fit-start', the first Tuesday on or after the first session in
 *   the log (localStorage 'fit-log' in the PWA build) becomes the start. Changes fire a window 'fit-block' event in
 *   the view and a 'storage' event in the other views; FIT_onBlockChange listens to both.
 *
 * Videos come from .fluid/sources/youtube-links.json, copied into YT below; update both together.
 *
 * ── Language ───────────────────────────────────────────────────────────────────────────
 * Every text here is Turkish and stays the source. English lives in one place, js/i18n.js (FIT_EN): per slug for an
 * entry's name, sub, cues, avoid, alt, note and video note; per session and step id for step names and details; a
 * phrase table for doses, rests, reps, effort lines, tips and animation labels; muscle names keyed by `tr`. Views read
 * through FIT_tx (FIT_tx.ex, FIT_tx.steps, FIT_tx.meta), which falls back to Turkish. Add the English there when you
 * add an entry or a step; FIT_tx.missing() and the test suite report what is missing.
 */
(() => {
  const FLOOR = 184, K = 1.6;
  const L = { th: 44, sh: 43, lt: 25, ut: 25, hd: 18, head: 9, ua: 29, fa: 31, ft: 14 };
  window.FIT_GEOM = { W: 320, H: 200, FLOOR, L };
  const R = Math.PI / 180;
  const f = (n) => (+n).toFixed(1);
  const V = (a, l = 1) => [Math.cos(a * R) * l, Math.sin(a * R) * l];

  /* ---------- equipment helpers ---------- */
  const S = {
    line: (a, b, cls = 'eq', style = '') => `<line class="${cls}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"${style ? ` style="${style}"` : ''}/>`,
    rect: (x, y, w, h, cls = 'eqf', rx = 2) => `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}"/>`,
    circle: (c, r, cls = 'eq', style = '') => `<circle class="${cls}" cx="${f(c[0])}" cy="${f(c[1])}" r="${r}"${style ? ` style="${style}"` : ''}/>`,
    plate: (x, y, w, h) => S.rect(x, y, w, h, 'plate', 1.5),
    dbEnd: (p) => S.circle(p, 8.5, 'db') + S.circle(p, 3, 'dbx'),
    dbVert: (p) => S.rect(p[0] - 10, p[1] - 6, 20, 7, 'db') + S.rect(p[0] - 10, p[1] + 11, 20, 7, 'db') + S.line([p[0], p[1] + 1], [p[0], p[1] + 11], 'dbl'),
    wall: (x, y1, y2) => { let s = S.rect(x, y1, 12, y2 - y1, 'eqf', 0); for (let y = y1 + 12; y < y2; y += 18) s += S.line([x, y], [x + 12, y - 12], 'eqt'); return s + S.line([x, y1], [x, y2], 'eq'); },
    cableStack: (px, py, postX, topY) =>
      S.line([px, topY], [postX, topY]) + S.line([postX, topY], [postX, FLOOR]) + S.line([px, topY], [px, py], 'eqt') +
      S.rect(postX + 4, 60, 16, FLOOR - 62, 'eqo') +
      [78, 96, 114, 132, 150, 168].map((y) => S.line([postX + 4, y], [postX + 20, y], 'eqt')).join('') +
      S.circle([px, py], 6.5, 'pulley') + S.circle([px, py], 1.8, 'dbx'),
  };
  window.FIT_SVG = S;

  /* ---------- muscle helpers ---------- */
  const SEG = { nleg: [['hip', 'knee', 12], ['knee', 'ankle', 11]], fleg: [['hip', 'knee2', 12], ['knee2', 'ankle2', 11]],
    back: [['hip', 'mid', 14], ['mid', 'sho', 14]], arm: [['sho', 'elb', 11], ['elb', 'hand', 10]] };
  const HL = (groups, c = 1) => groups.flatMap((g) => (g === 'leg' ? ['nleg', 'fleg'] : [g]))
    .flatMap((g) => SEG[g].map(([a, b, w]) => ({ a, b, w, c })));

  /* ---------- conversion of the warm-up figures (original 220×160 drawing, ground y 140) ----------
     Their angles were measured from straight down (limbs) or straight up (torso, head); W() turns a
     resolved key into a POSE. Positions scale by K around x 110. */
  const mx = (x) => 160 + (x - 110) * K;
  const WDEF = { t1: 0, h: 0, ul: 0, ll: 0, ua: 0, fa: 0 };
  const PAIRS = ['ul', 'll', 'ua', 'fa', 'hr', 'ha', 'hh', 'hdx', 'wx', 'wh'];
  function WR(base, key) {
    const p = Object.assign({}, WDEF, base, key);
    if (p.t2 === undefined) p.t2 = p.t1;
    for (const k of PAIRS) if (p[k + '2'] === undefined && p[k] !== undefined) p[k + '2'] = p[k];
    return p;
  }
  function W(p, over, es = 1, es2 = es) {
    const q = { lt: p.t1 - 90, ut: p.t2 - 90, hd: p.h - 90, th: 90 - p.ul, sh: 90 - p.ll, th2: 90 - p.ul2, sh2: 90 - p.ll2,
      ua: 90 - p.ua, fa: 90 - p.fa, ua2: 90 - p.ua2, fa2: 90 - p.fa2, hb: es, hb2: es2 };
    for (const s of ['', '2']) {
      if (p['hr' + s] != null) { const a = p['ha' + s] * R; q['hdx' + s] = Math.sin(a) * p['hr' + s] * K; q['hdy' + s] = Math.cos(a) * p['hr' + s] * K; }
      else if (p['hh' + s] != null) { q['hdx' + s] = p['hdx' + s] * K; q['hy' + s] = FLOOR - 3 - p['hh' + s] * K; }
      else if (p['wx' + s] != null) { q['hx' + s] = mx(p['wx' + s]); q['hy' + s] = FLOOR - p['wh' + s] * K; }
    }
    return Object.assign(q, over || {});
  }
  // timed key list [[sec, key], ...] -> {keys, phases}
  function WT(base, list, over, es, es2) {
    const keys = list.map((k) => W(WR(base, k[1]), over, es, es2));
    const phases = [];
    for (let i = 0; i < list.length - 1; i++) {
      const same = JSON.stringify(list[i][1]) === JSON.stringify(list[i + 1][1]);
      phases.push(['', Math.round((list[i + 1][0] - list[i][0]) * 1000), i + 1, same ? 'hold' : 'move']);
    }
    return { keys, phases };
  }
  // 30-second static stretch: ease in 2.5 s, hold 30 s, ease out 2.5 s
  const STATIC = { phases: [['Gir', 2500, 1, 'in'], ['Tut', 30000, null, 'static'], ['Bırak', 2500, 0, 'out']], still: 17000, ring: { sec: 30, mode: 'down' } };
  // day B tempo: up 1 s, short pause, down 2 s, rest
  const TEMPO_B = (up, down, n) => [[up + ' · 1 sn', 1000, n - 1, 'con'], ['Kısa duraklama', 300, null, 'hold'], [down + ' · 2 sn', 2000, 0, 'ecc'], ['Hazırlan', 500, null, 'hold']];
  // leg curl roller: on the back of the calf, a little above the ankle (perpendicular to the shin)
  const calfPad = (J) => {
    const dx = J.ankle[0] - J.knee[0], dy = J.ankle[1] - J.knee[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
    return [J.ankle[0] - 5 * u[0] - 8 * u[1], J.ankle[1] - 5 * u[1] + 8 * u[0]];
  };
  const KB = (k) => ({ th: k[0], sh: k[1], lt: k[2], ut: k[2], hd: k[3], ua: k[4], fa: k[5], us: k[6] ?? 1, fs: k[7] ?? 1, ft: 25 });

  // Effort: plain Turkish first (rir), abbreviation second (rirTag, shown as a tag with a tooltip).
  const RIR_MAIN = { rir: 'Form bozulmadan 2 tekrar kala bırak', rirTag: 'RIR 2 · RPE 8' };
  const RIR_ACC = { rir: '1-2 tekrar kala bırak', rirTag: 'RIR 1-2' };
  const RIR_MACH = { rir: '1-2 tekrar kala bırak; son sette 0-1 tekrar kalabilir', rirTag: 'RIR 1-2 · son set 0-1' };

  // Muscles a move works (or stretches), for the body map (js/bodymap.js): {map: BODYMAP key, a list of keys, or null, tr: Turkish name}
  const MU = {
    quad: { map: 'quadriceps', tr: 'Ön bacak (kuadriseps)' },
    glute: { map: 'gluteal', tr: 'Kalça (gluteus)' },
    ham: { map: 'hamstring', tr: 'Arka bacak (hamstring)' },
    add: { map: 'adductor', tr: 'İç bacak (adduktor)' },
    abs: { map: 'abs', tr: 'Karın' },
    obl: { map: 'obliques', tr: 'Yan karın (oblik)' },
    lowBack: { map: 'lower-back', tr: 'Bel (erektörler)' },
    lat: { map: 'upper-back', tr: 'Sırt (latissimus)' },
    midBack: { map: 'trapezius', tr: 'Orta sırt (trapez, romboid)' },
    rearDelt: { map: 'back-deltoids', tr: 'Arka omuz' },
    frontDelt: { map: 'front-deltoids', tr: 'Ön omuz' },
    chest: { map: 'chest', tr: 'Göğüs' },
    tri: { map: 'triceps', tr: 'Arka kol (triceps)' },
    bi: { map: 'biceps', tr: 'Pazu (biceps)' },
    grip: { map: 'forearm', tr: 'Ön kol (tutuş)' },
    hipFlex: { map: null, tr: 'Kalça fleksörü (iliopsoas)' },
    cuff: { map: null, tr: 'Rotator manşet' },
  };
  // joints taken through range (direction in plain words / the term) and connective tissue, for kind static / dynamic
  const JT = {
    hipExt: 'Kalça (öne açılma / ekstansiyon)',
    hipFlex: 'Kalça (bükülme / fleksiyon)',
    hipSwing: 'Kalça (öne-arkaya / fleksiyon, ekstansiyon)',
    hipAbd: 'Kalça (yana açılma / abdüksiyon)',
    hipER: 'Kalça (dışa dönme / dış rotasyon)',
    kneeFlex: 'Diz (bükülme / fleksiyon)',
    kneeExt: 'Diz (düzleşme / ekstansiyon)',
    ankleDF: 'Ayak bileği (bükülme / dorsifleksiyon)',
    tspineRot: 'Göğüs omurgası (dönme / rotasyon)',
    spineFE: 'Omurga (yuvarlama ve kavis / fleksiyon, ekstansiyon)',
    spineSide: 'Omurga (yana eğilme / lateral fleksiyon)',
    neck: 'Boyun (yana eğilme ve dönme)',
    shoCirc: 'Omuz (dairesel / sirkümdüksiyon)',
    shoUp: 'Omuz (baş üstüne kaldırma / fleksiyon)',
    shoPass: 'Omuz (baş üstünden arkaya / fleksiyon, ekstansiyon)',
    shoOpen: 'Omuz (arkaya açılma / yatay abdüksiyon, dış rotasyon)',
  };
  const TS = {
    achilles: 'Aşil tendonu',
    hamTendon: 'Hamstring tendonları',
    hipCapsule: 'Kalça eklem kapsülü (ön)',
    tlf: 'Torakolomber fasya',
  };

  const EX = {
    /* ================= Gün A ================= */
    'goblet-squat': {
      name: 'Goblet Squat', sub: 'Dambıl göğüste çömelme', kind: 'lift', dose: '3 × 8–12', rest: '2–3 dk', restSec: [120, 180], ...RIR_MAIN,
      alt: 'Leg press.',
      equipment: ['dambıl'],
      legend: [[1, 'Kuadriseps'], [2, 'Kalça (gluteus)'], [3, 'Core']],
      work: { main: [MU.quad, MU.glute], help: [MU.add, MU.abs, MU.lowBack] },
      cues: ['Dambılı göğse yapıştır, dirsekler aşağıda', 'Kalçayı geri ve aşağı it; uyluklar en az yere paralel', 'Topuklar yerde, dizler ayak ucu yönünde, gövde dik'],
      avoid: 'Dizlerin içe çökmesi, topukların kalkması',
      anim: {
        anchor: { j: 'ankle', x: 150, y: FLOOR - 3 }, hand: false,
        keys: [{ th: 88, sh: 92, to: -87, ua: 86, fa: -62 }, { th: -3, sh: 123, to: -62, hd: -70, ua: 82, fa: -55 }],
        phases: [['İniş · 2 sn', 2000, 1, 'ecc'], ['Altta bekle', 300, null, 'hold'], ['Kalk · 1 sn', 1000, 0, 'con'], ['Üstte bekle', 500, null, 'hold']],
        still: 2020,
        muscles: [{ a: 'knee', b: 'hip', w: 15, c: 1 }, { a: 'hip', b: 'hip', off: [-6, 1], w: 22, c: 2 }, { a: 'hip', b: 'sho', f0: 0.1, f1: 0.55, off: [6, 0], w: 9, c: 3 }],
        equip: { front: (J) => S.dbVert(J.hand) },
      },
    },
    'db-bench-press': {
      name: 'Dambıl Bench Press', sub: 'Düz bench', kind: 'lift', dose: '3 × 8–12', rest: '2–3 dk', restSec: [120, 180], ...RIR_ACC,
      alt: 'Barbell bench press veya şınav.',
      equipment: ['dambıl', 'düz bench'],
      legend: [[1, 'Göğüs'], [2, 'Ön omuz'], [3, 'Triceps']],
      work: { main: [MU.chest], help: [MU.frontDelt, MU.tri] },
      cues: ['Dambılları göğüs hizasına indir; dirsekler gövdeden ~45° (yandan görünümde kısa görünür)', 'Kürek kemiklerini geri ve aşağı sıkıp benche yapıştır', 'Ayaklar yerde; dambılları omuzların üstüne it'],
      avoid: 'Dirsekleri 90° yana açmak, belin aşırı kemerlenmesi',
      anim: {
        anchor: { j: 'hip', x: 190, y: 137 }, hand: false,
        keys: [{ th: 125.5, sh: 5, to: -180, ua: -90, fa: -90, ft: 35 }, { th: 125.5, sh: 5, to: -180, ua: 75, fa: -85, us: 0.55, ft: 35 }],
        phases: [['İniş · 2 sn', 2000, 1, 'ecc'], ['Altta bekle', 300, null, 'hold'], ['İt · 1 sn', 1000, 0, 'con'], ['Üstte bekle', 500, null, 'hold']],
        still: 2020,
        muscles: [{ a: 'sho', b: 'hip', f0: 0.2, f1: 0.2, off: [0, -6], w: 24, c: 1 }, { a: 'sho', b: 'sho', off: [0, -3], w: 15, c: 2 }, { a: 'sho', b: 'elb', w: 11, c: 3 }],
        equip: {
          stat: () => S.rect(100, 142, 105, 9, 'eqf', 4) + S.line([118, 151], [118, FLOOR], 'leg') + S.line([192, 151], [192, FLOOR], 'leg'),
          front: (J) => S.dbEnd(J.hand),
        },
      },
    },
    'one-arm-db-row': {
      name: 'Tek Kol Dambıl Row', sub: 'Bir el ve diz benchte', kind: 'lift', dose: '3 × 8–12 / kol', rest: '60–90 sn', restSec: [60, 90], ...RIR_ACC,
      equipment: ['dambıl', 'düz bench'],
      legend: [[1, 'Sırt / lat'], [2, 'Arka omuz - romboid'], [3, 'Biceps']],
      work: { main: [MU.lat, MU.midBack], help: [MU.rearDelt, MU.bi, MU.grip] },
      cues: ['Bir el ve aynı taraf diz benchte; sırt düz, yere yaklaşık paralel.', 'Dirseği kalçaya doğru geriye çek; kürek kemiğini sık.', 'Dambılı 2 sn kontrollü indir; gövdeyi döndürme.'],
      avoid: 'Gövdeyi çevirerek ya da sallayarak kaldırmak; omzu kulağa çekmek.',
      alt: 'Oturarak kablo row.',
      anim: {
        anchor: { j: 'hip', x: 130, y: 95 }, far: 'both', hand: false,
        keys: [
          { to: -8, th2: 90, sh2: 180, ft2: 180, fx: 108, fy: FLOOR - 3, fb: 1, ua: 90, fa: 90, hx2: 168, hy2: 139, hb2: -1 },
          { to: -8, th2: 90, sh2: 180, ft2: 180, fx: 108, fy: FLOOR - 3, fb: 1, ua: 160, fa: 95, hx2: 168, hy2: 139, hb2: -1 },
        ],
        phases: [['Çek · 1 sn', 1000, 1, 'con'], ['Sık, bekle', 400, null, 'hold'], ['İndir · 2 sn', 2000, 0, 'ecc'], ['Aşağıda bekle', 400, null, 'hold']],
        still: 1020,
        muscles: [{ a: 'hip', b: 'sho', f0: 0.25, f1: 0.8, off: [0, -5], w: 14, c: 1 }, { a: 'sho', b: 'sho', off: [-4, -4], w: 16, c: 2 }, { a: 'sho', b: 'elb', w: 11, c: 3 }],
        equip: {
          stat: () => S.rect(76, 142, 98, 8, 'eqf', 3) + S.line([88, 150], [88, FLOOR], 'leg') + S.line([162, 150], [162, FLOOR], 'leg'),
          front: (J) => S.dbEnd(J.hand),
        },
      },
    },
    'db-rdl': {
      name: 'Dambıl Romanian Deadlift', sub: 'Kalça menteşesi, dambıl bacağa yakın', kind: 'lift', dose: '3 × 8–12', rest: '2 dk', restSec: [120, 120], ...RIR_MAIN,
      equipment: ['dambıl'],
      legend: [[1, 'Hamstring'], [2, 'Kalça'], [3, 'Alt sırt (sabitler)']],
      work: { main: [MU.ham, MU.glute], help: [MU.lowBack, MU.add, MU.grip] },
      cues: ['Dizler hafif bükük ve sabit; kalçayı geriye it', 'Sırt düz, boyun nötr; dambıllar bacağa yakın kayar', 'Diz altı / kaval hizasında dur, kalçayı öne sürerek kalk'],
      avoid: 'Sırtı yuvarlamak, squat gibi dizleri bükmek',
      anim: {
        anchor: { j: 'ankle', x: 140, y: FLOOR - 3 }, hand: false,
        keys: [{ th: 87, sh: 93, to: -88, ua: 88, fa: 88 }, { th: 56, sh: 98, to: -12, ua: 113, fa: 116 }],
        phases: [['İniş · 2 sn', 2000, 1, 'ecc'], ['Altta bekle', 300, null, 'hold'], ['Kalçayı öne sür · 1 sn', 1000, 0, 'con'], ['Üstte bekle', 500, null, 'hold']],
        still: 2020,
        guide: { a: 'hip', b: 'head', label: 'düz omurga' },
        muscles: [{ a: 'knee', b: 'hip', off: [-4, 0], w: 14, c: 1 }, { a: 'hip', b: 'hip', off: [-7, 0], w: 22, c: 2 }, { a: 'hip', b: 'sho', f0: 0, f1: 0.55, off: [-3, -3], w: 8, c: 3 }],
        equip: { front: (J) => S.dbEnd(J.hand) },
      },
    },
    'plank': {
      name: 'Plank', sub: 'Ön kol plank, statik tutuş', kind: 'hold', dose: '3 × 30–60 sn', rest: '60 sn', restSec: [60, 60],
      rir: 'Formu bozulmadan bitir',
      legend: [[1, 'Core'], [2, 'Kalça'], [3, 'Ön omuz']],
      work: { main: [MU.abs], help: [MU.obl, MU.glute, MU.frontDelt, MU.quad] },
      cues: ['Dirsekler omuzların tam altında', 'Baştan topuğa düz çizgi; kalçayı ve karnı sık', 'Normal nefes al, nefesi tutma', "60 sn'yi geçince zorlaştır (dirsekleri öne al)"],
      avoid: 'Kalçanın düşmesi (bel çökmesi) ya da havaya kalkması',
      anim: {
        anchor: { j: 'ankle', x: 70, y: FLOOR - 13 }, breath: true,
        keys: [{ th: 171.5, sh: 171.5, to: -8.5, ua: 90, fa: 0, ft: 56 }],
        phases: [['Tut · nefes al', 4000, null, 'iso']],
        still: 0, ring: { sec: 60, mode: 'up' },
        guide: { a: 'ankle', b: 'head', label: 'baştan topuğa düz çizgi' },
        muscles: [{ a: 'hip', b: 'sho', f0: 0.05, f1: 0.95, w: 14, c: 1, breath: 1 }, { a: 'hip', b: 'hip', off: [0, -3], w: 18, c: 2 }, { a: 'sho', b: 'sho', off: [0, -1], w: 15, c: 3 }],
      },
    },

    /* ================= Gün B ================= */
    'barbell-deadlift': {
      name: 'Barbell Deadlift', sub: 'Konvansiyonel', kind: 'lift', dose: '1 × 5 çalışma seti', rest: 'ısınma setleri arası ~1 dk', restSec: [60, 90], ...RIR_MAIN,
      warmupSets: '2–3 ısınma seti',
      equipment: ['barbell', 'plaka'],
      legend: [[1, 'Hamstring & kuadriseps'], [2, 'Kalça (gluteus)'], [3, 'Sırt / erektörler']],
      work: { main: [MU.glute, MU.ham, MU.lowBack], help: [MU.quad, MU.add, MU.midBack, MU.grip] },
      cues: ['Önce 2–3 hafif ısınma seti, sonra 1 çalışma seti.', 'Bar orta ayağın üstünde; kalça dizden yukarıda, omuzdan aşağıda.', 'Sırt nötr, göğüs açık; barı bacaklara sürterek yukarı çek.', 'Üstte kalçayı kilitle, dik dur; geriye yaslanma.'],
      avoid: 'Belin yuvarlanması; barın bacaktan uzaklaşması.',
      alt: 'Dambıl deadlift.',
      note: 'Ağırsağlam: deadlift sinir sistemini çok yorduğu için 1 çalışma seti yeter.',
      anim: {
        anchor: { j: 'ankle', x: 150, y: FLOOR - 6 }, interp: 'spline', hand: false,
        keys: [
          { th: 14.6, sh: 93.4, to: -29.1, ua: 90, fa: 90, ft: 25 },
          { th: 44.8, sh: 89, to: -51.2, ua: 91, fa: 91, ft: 25 },
          { th: 81.4, sh: 98.8, to: -88.9, ua: 92, fa: 90, ft: 25 },
        ],
        phases: TEMPO_B('Zemini it, barı bacağa sürt', 'Kontrollü indir', 3), still: 1020,
        guide: { a: 'hip', b: 'head', label: 'düz omurga' },
        muscles: [{ a: 'hip', b: 'knee', w: 13, c: 1 }, { a: 'hip', b: 'hip', w: 24, c: 2 }, { a: 'hip', b: 'sho', w: 13, c: 3 }],
        equip: {
          stat: () => S.line([155, 30], [155, FLOOR], 'path'),
          back: (J) => S.circle(J.hand, 22, 'platec'),
          front: (J) => S.circle(J.hand, 3.5, 'dbx'),
          arrows: (J) => [[J.hand[0] + 34, J.hand[1] + 10, -90]],
        },
      },
    },
    'lat-pulldown': {
      name: 'Lat Pulldown', kind: 'lift', dose: '3 × 6–10', rest: '2 dk', restSec: [120, 120], ...RIR_MACH,
      alt: 'Destekli barfiks makinesi.',
      equipment: ['makara (lat pulldown)'],
      legend: [[1, 'Lat (sırt genişliği)'], [2, 'Biceps']],
      work: { main: [MU.lat], help: [MU.bi, MU.rearDelt, MU.grip, MU.midBack] },
      cues: ['Hafif geriye yaslan, göğsünü bara doğru aç.', 'Dirsekleri aşağı ve geriye sür; bar üst göğse insin.', 'Barı yavaş bırak; kollar tam uzasın, omuzlar kulağa kalkmasın.'],
      avoid: 'Gövdeyi sallayarak çekmek veya barı ensenin arkasına indirmek.',
      anim: {
        anchor: { j: 'ankle', x: 150, y: FLOOR - 6 }, interp: 'spline', hand: false,
        keys: [[0, 92, -96, -94, -74.7, -86.1, 0.8, 0.9], [0, 92, -98, -95, -53.1, -79.7, 0.3, 0.7], [0, 92, -101, -96, 45, -77.5, 0.3, 0.6], [0, 92, -104, -97, 98.1, -56.3, 1, 0.9]].map(KB),
        phases: TEMPO_B('Barı çek', 'Barı kontrolle bırak', 4), still: 1020,
        muscles: [{ a: 'hip', b: 'sho', w: 13, c: 1 }, { a: 'sho', b: 'elb', w: 13, c: 2 }],
        equip: {
          init: (J) => ({ px: J.hand[0], hx: J.hip[0], hy: J.hip[1], post: J.hand[0] + 62 }),
          stat: (c) => S.rect(c.hx - 24, c.hy + 8, 54, 8, 'eqf', 3) + S.line([c.hx, c.hy + 16], [c.hx, FLOOR], 'leg') + S.line([c.hx - 28, FLOOR - 2], [c.hx + 28, FLOOR - 2], 'leg') +
            S.line([c.hx + 22, c.hy - 9], [c.hx + 42, c.hy - 9], 'pad', 'stroke-width:8') + S.line([c.hx + 42, c.hy - 9], [c.post, c.hy - 9]) + S.cableStack(c.px, 16, c.post, 8),
          back: (J, c) => S.line([c.px, 16], J.hand, 'cable'),
          front: (J) => S.circle(J.hand, 4.6, 'handle'),
          arrows: (J) => [[J.hand[0] + 16, J.hand[1] - 34, 90]],
        },
      },
    },
    'barbell-ohp': {
      name: 'Barbell Omuz Presi', sub: 'Ayakta (overhead press)', kind: 'lift', dose: '3 × 6–10', rest: '2–3 dk', restSec: [120, 180], ...RIR_ACC,
      equipment: ['barbell', 'rack'],
      legend: [[1, 'Omuz (deltoid)'], [2, 'Triceps'], [3, 'Core']],
      work: { main: [{ map: 'front-deltoids', tr: 'Omuz (ön ve yan deltoid)' }], help: [MU.tri, { map: 'trapezius', tr: 'Üst trapez' }, { map: 'abs', tr: 'Karın (sabitler)' }] },
      cues: ['Bar omuzların önünde, önkollar dik; dirsekler barın biraz önünde.', 'Barı düz yukarı it; bar yüzünden geçerken başını hafif geri al, sonra barın altına getir.', 'Kaburgalar aşağı, kalça ve karın sıkı; bar yukarıda orta ayağın üstünde kilitlensin.'],
      avoid: 'Geriye yaslanıp beli kavislemek; barı öne doğru itmek.',
      alt: 'Omuz press makinesi veya dambıl.',
      note: 'Ağırsağlam barbell ile başlamayı öneriyor: "doğrudan dambılla başlamayı uygun bulmuyorum".',
      anim: {
        anchor: { j: 'ankle', x: 148, y: FLOOR - 6 }, interp: 'spline', hand: false, zoom: 0.82,
        keys: [
          { to: -90, hd: -90, ft: 25, hdx: 9, hdy: 3, hb: -1 },
          { to: -90, hd: -112, ft: 25, hdx: 7, hdy: -32, hb: -1 },
          { to: -88, hd: -88, ft: 25, hdx: 3, hdy: -59, hb: -1 },
        ],
        phases: TEMPO_B('Barı düz yukarı it', 'Kontrollü indir', 3), still: 1020,
        muscles: [{ a: 'sho', b: 'sho', w: 22, c: 1 }, { a: 'sho', b: 'elb', w: 13, c: 2 }, { a: 'hip', b: 'sho', f0: 0.1, f1: 0.6, w: 10, c: 3 }],
        equip: {
          stat: () => S.line([156, 4], [156, FLOOR], 'path'),
          back: (J) => S.circle(J.hand, 11, 'platec'),
          front: (J) => S.circle(J.hand, 3.5, 'dbx'),
          arrows: (J) => [[J.hand[0] + 30, J.hand[1] + 10, -90]],
        },
      },
    },
    'leg-press': {
      name: 'Leg Press', kind: 'lift', dose: '3 × 8–12', rest: '2 dk', restSec: [120, 120], ...RIR_MACH,
      equipment: ['leg press makinesi'],
      legend: [[1, 'Kuadriseps'], [2, 'Kalça (gluteus)']],
      work: { main: [MU.quad, MU.glute], help: [MU.add] },
      cues: ['Sırt ve kalça pedde sabit; bel pedden ayrılmasın.', 'Dizler ayak parmakları yönünde ~90° bükülsün.', 'Üstte dizleri kilitleme, hafif bükük bırak.'],
      avoid: 'Çok derin inip kalçanın pedden kalkması (bel yuvarlanır); dizlerin içe çökmesi.',
      alt: 'Dambıl split squat.',
      anim: {
        anchor: { j: 'hip', x: 88, y: 126 }, interp: 'spline',
        keys: [[-81.9, 7.2, -135, -128, 86.5, -16.7], [-76.1, 1.1, -135, -128, 86.5, -16.7], [-69.3, -5.9, -135, -128, 86.5, -16.7], [-60.9, -14.6, -135, -128, 86.5, -16.7], [-46.6, -29.2, -135, -128, 86.5, -16.7]]
          .map((k) => Object.assign(KB(k), { ft: -103 })),
        phases: TEMPO_B('Platformu it', 'Kontrollü geri indir', 5), still: 1020,
        muscles: [{ a: 'hip', b: 'knee', w: 13, c: 1 }, { a: 'hip', b: 'hip', w: 24, c: 2 }],
        equip: {
          init: (J) => {
            const H = J.hip, r = V(-38), n = V(52), t = V(-135), bn = V(135);
            const pb = [H[0] + 8 * bn[0] - 10 * t[0], H[1] + 8 * bn[1] - 10 * t[1]];
            const sh = [H[0] + 50 * t[0], H[1] + 50 * t[1]];
            const pt = [sh[0] + 8 * bn[0] + 14 * t[0], sh[1] + 8 * bn[1] + 14 * t[1]];
            const rp = (k) => [H[0] + 22 * n[0] + k * r[0], H[1] + 22 * n[1] + k * r[1]];
            const a = rp(30), b = rp(140), s2 = rp(95);
            return { r, n, html: S.line(a, b, 'eq', 'stroke-width:4') + S.line(s2, [s2[0], FLOOR], 'leg') + S.line(a, [a[0], FLOOR], 'leg') +
              S.line(pb, pt, 'pad', 'stroke-width:9') + S.line([H[0] - 8, H[1] + 12], [H[0] + 34, H[1] + 12], 'pad', 'stroke-width:7') +
              S.line([H[0] + 8, H[1] + 14], [H[0] + 8, FLOOR], 'leg') + S.line([H[0] - 26, FLOOR - 2], [H[0] + 44, FLOOR - 2], 'leg') };
          },
          stat: (c) => c.html,
          back: (J, c) => {
            const a = J.ankle, r = c.r, n = c.n, p = [a[0] + 7.2 * r[0] - 4 * n[0], a[1] + 7.2 * r[1] - 4 * n[1]];
            return `<g transform="translate(${f(p[0])} ${f(p[1])}) rotate(-38)">` + S.line([2.5, 0], [2.5, 26]) + S.rect(0, -36, 5, 60, 'eqf', 1.5) +
              [6, 11, 16].map((x) => S.plate(x, -26, 4, 44)).join('') + '</g>';
          },
          arrows: (J, c) => [[J.ankle[0] + 34 * c.r[0] - 8 * c.n[0], J.ankle[1] + 34 * c.r[1] - 8 * c.n[1], -38]],
        },
      },
    },
    'face-pull': {
      name: 'Face Pull', sub: 'Makarada, ip tutamak', kind: 'lift', dose: '3 × 15–20 (hafif)', rest: '60 sn', restSec: [60, 60], rir: 'Hafif tut; son sette 0-1 tekrar kalabilir', rirTag: 'son set RIR 0-1',
      alt: 'Band pull-apart.',
      equipment: ['makara', 'ip tutamak'],
      legend: [[1, 'Arka omuz'], [2, 'Rotator manşet & üst sırt']],
      work: { main: [MU.rearDelt, MU.cuff], help: [MU.midBack, MU.bi] },
      cues: ['Makara yüz hizasında; ipi alnına / gözlere doğru çek.', 'Dirsekler yüksek: sonunda omuz hizasında veya hafif arkada.', 'Eller kulakların yanında bitsin (dışa rotasyon); omuzlar geride ve aşağıda.'],
      avoid: 'Ağır seçip gövdeyi geriye sallayarak çekmek; hafif tut.',
      anim: {
        anchor: { j: 'ankle', x: 110, y: FLOOR - 6 }, interp: 'spline',
        keys: [[88, 93, -92, -92, -14, -15.7], [88, 93, -92, -92, -45, -11.3, 0.4, 0.8], [88, 93, -92, -92, -139.4, -27.4, 0.3, 0.9], [88, 93, -92, -92, -173.9, -31.6, 1, 0.9]].map(KB),
        phases: TEMPO_B('İpi yüze çek', 'Kontrollü uzat', 4), still: 1020,
        muscles: [{ a: 'sho', b: 'sho', w: 22, c: 1 }, { a: 'hip', b: 'sho', f0: 0.45, f1: 1, w: 13, c: 2 }],
        equip: {
          init: (J) => { const pul = [J.sho[0] + 88, J.sho[1] - 18]; return { pul, post: pul[0] + 18 }; },
          stat: (c) => S.cableStack(c.pul[0], c.pul[1], c.post, c.pul[1]),
          back: (J, c) => {
            const p = c.pul, w = J.hand, d = Math.hypot(p[0] - w[0], p[1] - w[1]) || 1, k = Math.min(18 / d, 1), m = [w[0] + (p[0] - w[0]) * k, w[1] + (p[1] - w[1]) * k];
            return S.line(p, w, 'cable') + S.line(m, w, 'rope');
          },
          arrows: (J) => [[J.hand[0] + 22, J.hand[1] - 12, 180]],
        },
      },
    },

    /* ================= Blok varyantları ve Cuma eklemeleri ================= */
    'seated-leg-curl': {
      name: 'Oturarak Leg Curl', sub: 'Makinede, arka bacak', kind: 'lift', dose: '2–3 × 8–12', rest: '60–90 sn', restSec: [60, 90], ...RIR_MACH,
      equipment: ['leg curl makinesi'],
      legend: [[1, 'Hamstring (arka bacak)'], [2, 'Baldır']],
      work: { main: [MU.ham], help: [{ map: 'calves', tr: 'Baldır (gastroknemius)' }] },
      cues: ['Dizler makinenin dönme noktası hizasında; uyluk pedi dizlerin hemen üstüne sıkıca otursun.', 'Topukları aşağı ve geriye çek; en altta kısa bir an sık.', 'Bacağı 2 sn’de kontrollü aç; ağırlık yığına çarpmasın.'],
      avoid: 'Kalçayı oturaktan kaldırmak, ağırlığı savurmak.',
      alt: 'Makine yoksa yatarak leg curl; o da yoksa topla hamstring curl (sırtüstü, topuklar topta).',
      note: 'Çalışma: oturarak leg curl, yatarak olandan daha çok kas büyütüyor (Maeo ve ark., 2021).',
      anim: {
        anchor: { j: 'hip', x: 118, y: 118 }, hand: false,
        keys: [{ to: -100, th: -4, sh: 4, ft: -70, ua: 75, fa: 10 }, { to: -100, th: -4, sh: 118, ft: 30, ua: 75, fa: 10 }],
        phases: TEMPO_B('Topukları aşağı-geri çek', 'Kontrollü aç', 2), still: 1020,
        muscles: [{ a: 'hip', b: 'knee', off: [0, 5], w: 13, c: 1 }, { a: 'knee', b: 'ankle', f0: 0, f1: 0.45, w: 10, c: 2 }],
        equip: {
          init: (J) => ({ hip: J.hip, knee: J.knee }),
          stat: (c) => S.rect(c.hip[0] - 24, c.hip[1] + 7, 62, 8, 'eqf', 3) + S.line([c.hip[0] + 4, c.hip[1] + 15], [c.hip[0] + 4, FLOOR], 'leg') +
            S.line([c.hip[0] - 26, FLOOR - 2], [c.hip[0] + 34, FLOOR - 2], 'leg') + S.line([c.hip[0] - 14, c.hip[1] + 2], [c.hip[0] - 24, c.hip[1] - 52], 'pad', 'stroke-width:9') +
            S.line([c.knee[0] - 6, c.knee[1] - 10], [c.knee[0] - 6, c.knee[1] - 30], 'eq') + S.circle([c.knee[0] - 6, c.knee[1] - 10], 6.5, 'eqf'),
          back: (J) => { const p = calfPad(J); return S.line(J.knee, p, 'eq') + S.circle(J.knee, 3, 'dbx') + S.circle(p, 6.5, 'eqf'); },
          arrows: (J) => [[J.ankle[0] + 16, J.ankle[1] + 2, 115]],
        },
      },
    },
    'lying-leg-curl': {
      name: 'Yatarak Leg Curl', sub: 'Makinede, yüzüstü', kind: 'lift', dose: '2–3 × 8–12', rest: '60–90 sn', restSec: [60, 90], ...RIR_MACH,
      equipment: ['leg curl makinesi'],
      legend: [[1, 'Hamstring (arka bacak)'], [2, 'Baldır']],
      work: { main: [MU.ham], help: [{ map: 'calves', tr: 'Baldır (gastroknemius)' }] },
      cues: ['Diz kapakları benchin hemen dışında; ped topuğun biraz üstünde.', 'Kalçayı benche bastır, topukları kalçana doğru çek.', 'Bacağı 2 sn’de kontrollü indir.'],
      avoid: 'Kalçayı benchten kaldırmak, beli kavislemek.',
      alt: 'Oturarak leg curl; makine yoksa topla hamstring curl.',
      anim: {
        anchor: { j: 'hip', x: 168, y: 126 }, hand: false,
        keys: [{ to: 2, th: 180, sh: 180, ft: 95, ua: 85, fa: 30 }, { to: 2, th: 180, sh: 280, ft: 200, ua: 85, fa: 30 }],
        phases: TEMPO_B('Topukları kalçaya çek', 'Kontrollü indir', 2), still: 1020,
        muscles: [{ a: 'hip', b: 'knee', off: [0, -5], w: 13, c: 1 }, { a: 'knee', b: 'ankle', f0: 0, f1: 0.45, w: 10, c: 2 }],
        equip: {
          init: (J) => ({ hip: J.hip, knee: J.knee, hand: J.hand }),
          stat: (c) => S.rect(c.knee[0] + 4, c.hip[1] + 7, 92, 8, 'eqf', 3) + S.line([c.knee[0] + 16, c.hip[1] + 15], [c.knee[0] + 16, FLOOR], 'leg') +
            S.line([c.knee[0] + 84, c.hip[1] + 15], [c.knee[0] + 84, FLOOR], 'leg') + S.line([c.hand[0], c.hand[1]], [c.hand[0], FLOOR], 'leg') + S.circle(c.hand, 4.6, 'handle'),
          back: (J) => { const p = calfPad(J); return S.line(J.knee, p, 'eq') + S.circle(J.knee, 3, 'dbx') + S.circle(p, 6.5, 'eqf'); },
          arrows: (J) => [[J.ankle[0] - 4, J.ankle[1] - 16, -40]],
        },
      },
    },
    'push-up': {
      name: 'Şınav', sub: 'Push-up', kind: 'lift', dose: '2 × tükenişe 2 kala', rest: '60 sn', restSec: [60, 60],
      rir: 'Tükenişe 2 tekrar kala bırak', rirTag: 'RIR 2',
      equipment: [],
      legend: [[1, 'Göğüs'], [2, 'Ön omuz'], [3, 'Triceps']],
      work: { main: [MU.chest], help: [MU.frontDelt, MU.tri, { map: 'abs', tr: 'Karın (sabitler)' }] },
      cues: ['Eller omuz genişliğinden biraz geniş, omuzların altında.', 'Baştan topuğa düz çizgi; karın ve kalça sıkı.', 'Göğüs yere yaklaşana kadar in; dirsekler gövdeden ~45°.'],
      avoid: 'Kalçanın düşmesi; dirsekleri 90° yana açmak.',
      alt: 'Zorsa eller bench’te eğimli şınav; kolaylaşınca ayakları yükselt.',
      anim: {
        anchor: { j: 'ankle', x: 60, y: 169 }, hand: false,
        keys: [{ to: -19.6, th: 160.4, sh: 160.4, ft: 60, hx: 190, hy: FLOOR - 3, hb: 1 }, { to: -8, th: 172, sh: 172, ft: 60, hx: 190, hy: FLOOR - 3, hb: 1 }],
        phases: [['İn · 2 sn', 2000, 1, 'ecc'], ['Altta bekle', 300, null, 'hold'], ['İt · 1 sn', 1000, 0, 'con'], ['Üstte bekle', 500, null, 'hold']],
        still: 2020,
        guide: { a: 'ankle', b: 'head', label: 'baştan topuğa düz çizgi' },
        muscles: [{ a: 'sho', b: 'hip', f0: 0.05, f1: 0.3, off: [0, 6], w: 16, c: 1 }, { a: 'sho', b: 'sho', off: [2, 3], w: 14, c: 2 }, { a: 'sho', b: 'elb', w: 11, c: 3 }],
        equip: { arrows: (J) => [[J.sho[0] + 22, J.sho[1] + 6, -90]] },
      },
    },
    'seated-cable-row': {
      name: 'Oturarak Kablo Row', sub: 'Makarada, V tutamak', kind: 'lift', dose: '3 × 8–12', rest: '60–90 sn', restSec: [60, 90], ...RIR_ACC,
      equipment: ['makara (kablo row)'],
      legend: [[1, 'Sırt / lat'], [2, 'Arka omuz - romboid'], [3, 'Biceps']],
      work: { main: [MU.lat, MU.midBack], help: [MU.rearDelt, MU.bi, MU.grip] },
      cues: ['Dizler hafif bükük, gövde dik, göğüs açık.', 'Tutamağı karnına çek; dirsekler gövdeye yakın, kürek kemiklerini sık.', 'Kolları 2 sn’de uzat; bel yuvarlanmasın.'],
      avoid: 'Gövdeyi ileri-geri sallayarak çekmek.',
      alt: 'Kablo yoksa tek kol dambıl row veya göğüs destekli dambıl row.',
      anim: {
        anchor: { j: 'hip', x: 110, y: 148 }, hand: false,
        keys: [{ to: -80, th: -8, sh: 12, ft: -78, hx: 176, hy: 121, hb: 1 }, { to: -94, th: -8, sh: 12, ft: -78, hx: 126, hy: 124, hb: 1 }],
        phases: TEMPO_B('Karnına çek', 'Kollarını kontrollü uzat', 2), still: 1020,
        muscles: [{ a: 'hip', b: 'sho', f0: 0.25, f1: 0.85, off: [-5, 0], w: 14, c: 1 }, { a: 'sho', b: 'sho', off: [-4, 2], w: 16, c: 2 }, { a: 'sho', b: 'elb', w: 11, c: 3 }],
        equip: {
          stat: () => S.rect(62, 156, 96, 8, 'eqf', 3) + S.line([74, 164], [74, FLOOR], 'leg') + S.line([146, 164], [146, FLOOR], 'leg') +
            S.line([60, FLOOR - 2], [236, FLOOR - 2], 'leg') + S.rect(198, 124, 6, 44, 'eqf', 2) + S.line([201, 168], [201, FLOOR], 'leg') + S.cableStack(216, 128, 234, 128),
          back: (J) => S.line([216, 128], J.hand, 'cable'),
          front: (J) => S.circle(J.hand, 4.6, 'handle'),
          arrows: (J) => [[J.hand[0] + 14, J.hand[1] - 12, 180]],
        },
      },
    },
    'chest-supported-db-row': {
      name: 'Göğüs Destekli Dambıl Row', sub: 'Eğimli bench, göğüs pedde', kind: 'lift', dose: '3 × 8–12', rest: '60–90 sn', restSec: [60, 90], ...RIR_ACC,
      equipment: ['dambıl', 'eğimli bench'],
      legend: [[1, 'Sırt / lat'], [2, 'Arka omuz - romboid'], [3, 'Biceps']],
      work: { main: [MU.midBack, MU.lat], help: [MU.rearDelt, MU.bi, MU.grip] },
      cues: ['Bench 30-45° eğimde; göğüs pede yaslı, ayaklar yerde.', 'Dirsekleri geriye sürerek dambılları kaburgalara çek; kürek kemiklerini sık.', '2 sn’de kontrollü indir; kollar tam uzasın.'],
      avoid: 'Göğsü pedden kaldırmak, başı yukarı kırmak.',
      alt: 'Eğimli bench yoksa tek kol dambıl row; göğüs destekli row makinesi (T-bar) de olur.',
      anim: {
        anchor: { j: 'hip', x: 140, ground: true }, hand: false,
        keys: [{ to: -35, th: 120, sh: 100, ft: 0, ua: 90, fa: 90 }, { to: -35, th: 120, sh: 100, ft: 0, ua: 197, fa: 92 }],
        phases: [['Çek · 1 sn', 1000, 1, 'con'], ['Sık, bekle', 400, null, 'hold'], ['İndir · 2 sn', 2000, 0, 'ecc'], ['Aşağıda bekle', 400, null, 'hold']],
        still: 1020,
        muscles: [{ a: 'hip', b: 'sho', f0: 0.25, f1: 0.8, off: [-3, -5], w: 13, c: 1 }, { a: 'sho', b: 'sho', off: [-4, -5], w: 16, c: 2 }, { a: 'sho', b: 'elb', w: 11, c: 3 }],
        equip: {
          init: (J) => {
            const dx = J.sho[0] - J.hip[0], dy = J.sho[1] - J.hip[1], l = Math.hypot(dx, dy), d = [dx / l, dy / l], n = [-d[1], d[0]];
            const P1 = [J.hip[0] + 10 * n[0] - 12 * d[0], J.hip[1] + 10 * n[1] - 12 * d[1]], P2 = [J.sho[0] + 10 * n[0] - 2 * d[0], J.sho[1] + 10 * n[1] - 2 * d[1]];
            const M = [(P1[0] + P2[0]) / 2 + 5 * n[0], (P1[1] + P2[1]) / 2 + 5 * n[1]];
            return { html: S.line(P1, P2, 'pad', 'stroke-width:9') + S.line(M, [M[0], FLOOR], 'leg') + S.line([P1[0] + 4 * n[0], P1[1] + 4 * n[1]], [P1[0] - 6, FLOOR], 'leg') +
              S.line([P1[0] - 18, FLOOR - 2], [M[0] + 18, FLOOR - 2], 'leg') };
          },
          stat: (c) => c.html,
          front: (J) => S.dbEnd(J.hand),
          arrows: (J) => [[J.hand[0] + 16, J.hand[1] + 4, -95]],
        },
      },
    },
    'side-plank': {
      name: 'Yan Plank', sub: 'Ön kol üstünde, statik tutuş', kind: 'hold', dose: '2–3 × 20–40 sn / taraf', rest: '60 sn', restSec: [60, 60],
      rir: 'Formu bozulmadan bitir',
      legend: [[1, 'Yan karın (oblik)'], [2, 'Kalça yanı'], [3, 'Omuz']],
      work: { main: [MU.obl], help: [{ map: 'lower-back', tr: 'Bel yanı (kuadratus lumborum)' }, { map: 'gluteal', tr: 'Kalça yanı (gluteus medius)' }, MU.abs, { map: 'front-deltoids', tr: 'Omuz' }] },
      cues: ['Dirsek omzun tam altında; ayaklar üst üste.', 'Kalçayı kaldır: baştan ayağa düz çizgi.', 'Normal nefes al; süre bitince diğer tarafa geç.'],
      avoid: 'Kalçanın aşağı sarkması ya da geriye kaçması.',
      alt: 'Zorsa dizler bükülü yan plank.',
      note: 'Önden çizim: önkol sana doğru uzanır, üstteki el kalçada.',
      anim: {
        anchor: { j: 'ankle', x: 60, y: FLOOR - 6 }, breath: true, noFoot: true, far: 'arm',
        keys: [{ to: -10.9, th: 169.1, sh: 169.1, ua: 90, fa: 0, fs: 0.25, hx2: 150, hy2: 141, hb2: 1 }],
        phases: [['Tut · nefes al', 4000, null, 'iso']],
        still: 0, ring: { sec: 40, mode: 'up' },
        guide: { a: 'ankle', b: 'head', label: 'baştan ayağa düz çizgi' },
        muscles: [{ a: 'hip', b: 'sho', f0: 0.05, f1: 0.9, w: 14, c: 1, breath: 1 }, { a: 'hip', b: 'hip', off: [0, -2], w: 18, c: 2 }, { a: 'sho', b: 'sho', w: 14, c: 3 }],
      },
    },
    'weighted-plank': {
      name: 'Ağırlıklı Plank', sub: 'Sırtta plaka', kind: 'hold', dose: '2–3 × 30–45 sn', rest: '60 sn', restSec: [60, 60],
      rir: 'Formu bozulmadan bitir',
      equipment: ['plaka'],
      legend: [[1, 'Core'], [2, 'Kalça'], [3, 'Ön omuz']],
      work: { main: [MU.abs], help: [MU.obl, MU.glute, MU.frontDelt, MU.quad] },
      cues: ['Plakayı biri sırtına, kürek kemiklerinin arasına koysun.', 'Plank gibi: dirsekler omuz altında, baştan topuğa düz çizgi.', 'Hafif başla (5-10 kg); 45 sn rahat olunca ağırlığı artır.'],
      avoid: 'Plakayı bele koymak; kalçanın düşmesi.',
      alt: 'Plaka yoksa dirsekleri biraz öne alarak plank (daha zor kaldıraç).',
    },
    'supinated-pulldown': {
      name: 'Ters Tutuş Lat Pulldown', sub: 'Avuçlar sana dönük, omuz genişliği', kind: 'lift', dose: '3 × 6–10', rest: '2 dk', restSec: [120, 120], ...RIR_MACH,
      equipment: ['makara (lat pulldown)'],
      legend: [[1, 'Lat (sırt genişliği)'], [2, 'Biceps']],
      work: { main: [MU.lat], help: [MU.bi, MU.midBack, MU.grip] },
      cues: ['Avuçlar sana dönük, eller omuz genişliğinde.', 'Barı üst göğse çek; dirsekler aşağı ve gövdeye yakın insin.', 'Barı yavaş bırak; kollar tam uzasın.'],
      avoid: 'Geriye çok yaslanıp sallanmak.',
      alt: 'Makine yoksa destekli barfiks (ters tutuş) veya lastikle barfiks.',
      note: 'Yandan çizim tutuş farkını göstermez; hareket lat pulldown ile aynı.',
    },
    'assisted-pullup': {
      name: 'Destekli Barfiks', sub: 'Makinede, dizler pedde', kind: 'lift', dose: '3 × 6–10', rest: '2 dk', restSec: [120, 120], ...RIR_MACH,
      equipment: ['destekli barfiks makinesi'],
      legend: [[1, 'Lat (sırt genişliği)'], [2, 'Biceps']],
      work: { main: [MU.lat], help: [MU.bi, MU.midBack, MU.rearDelt, MU.grip] },
      cues: ['Dizleri pede koy; tutuş omuz genişliğinde.', 'Göğsü bara doğru çek; çene barın üstüne çıksın.', 'Yavaş in, kollar tam uzasın.'],
      avoid: 'Bacaklarla sıçrayarak çıkmak, yarım tekrar.',
      alt: 'Makine yoksa lastik destekli barfiks; o da yoksa lat pulldown.',
      note: 'Destek ağırlığı arttıkça hareket kolaylaşır. İlerledikçe desteği azalt.',
      anim: {
        anchor: { j: 'hip', x: 165, y: 124 }, hand: false, zoom: 0.88,
        keys: [{ ay: 0, to: -94, th: 92, sh: 180, ft: 90, hx: 178, hy: 16, hb: 1 }, { ay: -50, to: -102, th: 88, sh: 182, ft: 90, hx: 178, hy: 16, hb: 1 }],
        phases: TEMPO_B('Göğsü bara çek', 'Kontrollü in', 2), still: 1020,
        muscles: [{ a: 'hip', b: 'sho', f0: 0.3, f1: 0.9, off: [-4, 0], w: 13, c: 1 }, { a: 'sho', b: 'elb', w: 12, c: 2 }],
        equip: {
          stat: () => S.line([178, 16], [228, 16]) + S.line([228, 8], [228, FLOOR]) + S.line([206, FLOOR - 2], [250, FLOOR - 2], 'leg'),
          back: (J) => S.line([J.knee[0] - 2, J.knee[1] + 12], [J.knee[0] - 2, FLOOR], 'leg') + S.rect(J.knee[0] - 18, J.knee[1] + 5, 32, 7, 'eqf', 3),
          front: () => S.circle([178, 16], 3.5, 'dbx'),
          arrows: (J) => [[J.sho[0] - 26, J.sho[1] + 40, -90]],
        },
      },
    },
    'db-split-squat': {
      name: 'Dambıl Split Squat', sub: 'Sabit adım duruşu, iki elde dambıl', kind: 'lift', dose: '3 × 8–12 / bacak', rest: '60–90 sn', restSec: [60, 90], ...RIR_ACC,
      equipment: ['dambıl'],
      legend: [[1, 'Kuadriseps (öndeki bacak)'], [2, 'Kalça (gluteus)']],
      work: { main: [MU.quad, MU.glute], help: [MU.add, MU.grip] },
      cues: ['Uzun adım duruşu: arka topuk havada, ayaklar kalça genişliğinde.', 'Arka dizi yere doğru indir; ön ayak tabanı yere tam bassın.', 'Gövde dik; ön topuktan iterek kalk. Önce bir bacak, sonra diğeri.'],
      avoid: 'Ön dizin içe çökmesi; ön topuğun kalkması.',
      alt: 'Dambıl yoksa vücut ağırlığıyla; leg press de olur.',
      anim: {
        anchor: { j: 'hip', x: 140, y: 132 }, hand: false, far: 'leg',
        keys: [
          { ax: 10, ay: -26, to: -89, fx: 183, fy: FLOOR - 4, fb: -1, ft: 0, fx2: 93, fy2: 171, fb2: -1, ft2: 50, ua: 90, fa: 90 },
          { ax: 0, ay: 0, to: -86, fx: 183, fy: FLOOR - 4, fb: -1, ft: 0, fx2: 93, fy2: 171, fb2: -1, ft2: 50, ua: 90, fa: 90 },
        ],
        phases: [['İn · 2 sn', 2000, 1, 'ecc'], ['Altta bekle', 300, null, 'hold'], ['Kalk · 1 sn', 1000, 0, 'con'], ['Üstte bekle', 500, null, 'hold']],
        still: 2020,
        muscles: [{ a: 'hip', b: 'knee', w: 14, c: 1 }, { a: 'hip', b: 'hip', off: [-6, 1], w: 22, c: 2 }],
        equip: { front: (J) => S.dbEnd(J.hand), arrows: (J) => [[J.hip[0] + 30, J.hip[1] + 8, -90]] },
      },
    },
    'reverse-fly': {
      name: 'Reverse Fly', sub: 'Makinede (reverse pec deck)', kind: 'lift', dose: '3 × 15–20 (hafif)', rest: '60 sn', restSec: [60, 60], rir: 'Hafif tut; son sette 0-1 tekrar kalabilir', rirTag: 'son set RIR 0-1',
      equipment: ['pec deck makinesi'],
      legend: [[1, 'Arka omuz'], [2, 'Üst sırt']],
      work: { main: [MU.rearDelt], help: [MU.midBack, MU.cuff] },
      cues: ['Göğüs pede yaslı, tutamaklar omuz hizasında.', 'Kollar hafif bükük; geniş bir yayla geriye aç.', 'Hafif tut, 2 sn’de geri getir.'],
      avoid: 'Ağır seçip gövdeyle sallamak; omuzları kulağa kaldırmak.',
      alt: 'Makine yoksa band pull-apart veya eğilerek dambıl reverse fly.',
      note: 'Yandan çizim: kollar yana açıldıkça kısa görünür.',
      anim: {
        anchor: { j: 'hip', x: 120, y: 128 }, interp: 'spline', hand: false,
        keys: [1, 0.7, 0.38, 0.1].map((s) => ({ to: -90, th: 0, sh: 90, ft: 0, ua: 0, fa: 0, us: s, fs: s })),
        phases: TEMPO_B('Kolları geriye aç', 'Kontrollü geri getir', 4), still: 1020,
        muscles: [{ a: 'sho', b: 'sho', off: [-3, -2], w: 20, c: 1 }, { a: 'hip', b: 'sho', f0: 0.55, f1: 1, off: [-5, 0], w: 12, c: 2 }],
        equip: {
          init: (J) => ({ s: J.sho, m: J.mid, h: J.hip, piv: [J.sho[0] + 4, J.sho[1] - 46] }),
          stat: (c) => S.rect(c.h[0] - 22, c.h[1] + 7, 50, 8, 'eqf', 3) + S.line([c.h[0], c.h[1] + 15], [c.h[0], FLOOR], 'leg') + S.line([c.h[0] - 26, FLOOR - 2], [c.h[0] + 90, FLOOR - 2], 'leg') +
            S.line([c.s[0] + 10, c.s[1] + 6], [c.s[0] + 10, c.m[1] + 16], 'pad', 'stroke-width:9') + S.line([c.s[0] + 14, c.m[1] + 16], [c.s[0] + 70, c.m[1] + 16]) +
            S.line(c.piv, [c.s[0] + 70, c.piv[1]]) + S.line([c.s[0] + 70, c.piv[1]], [c.s[0] + 70, FLOOR]) + S.circle(c.piv, 3, 'dbx'),
          back: (J, c) => S.line(c.piv, J.hand, 'eq'),
          front: (J) => S.circle(J.hand, 4.6, 'handle'),
          arrows: (J) => [[J.hand[0] + 6, J.hand[1] - 12, 180]],
        },
      },
    },

    /* ================= Isınma (başlangıç) ================= */
    'bike': {
      name: 'Hafif kardiyo', sub: 'Koşu bandı veya sabit bisiklet', kind: 'cardio', dose: '5–10 dk',
      legend: [[1, 'Kalp-damar, bacaklar']],
      work: { main: [MU.quad, MU.glute], help: [MU.ham, { map: ['calves', 'left-soleus', 'right-soleus'], tr: 'Baldır' }] },
      cues: ['Koşu bandı veya sabit bisiklet.', 'Konuşabileceğin tempo, hafif terleme.'],
      anim: (() => {
        const B = { rear: [64, 148.8], front: [240, 148.8], bb: [152, 136], seat: [131.2, 73.6], head: [208, 78.4], bar: [220.8, 62.4] };
        return {
          anchor: { j: 'hip', x: 131.2, y: 70 }, far: 'both', period: 4200, still: 500,
          fn: (ms) => {
            const th = 2 * Math.PI * (ms / 1000) / 1.4, r = 11 * K, C = B.bb;
            return { lt: -50, ut: -35, hd: -40, fx: C[0] + r * Math.cos(th), fy: C[1] + r * Math.sin(th), fx2: C[0] - r * Math.cos(th), fy2: C[1] - r * Math.sin(th),
              fb: -1, hx: B.bar[0], hy: B.bar[1], hx2: B.bar[0], hy2: B.bar[1] };
          },
          muscles: HL(['leg']),
          equip: {
            back: (J, c, ms) => {
              const w = 2 * Math.PI * (ms / 1000) / 0.7, rw = 35.2;
              let s = '';
              for (const c0 of [B.rear, B.front]) {
                s += S.circle(c0, rw);
                for (let i = 0; i < 4; i++) { const a = w + i * Math.PI / 2; s += S.line(c0, [c0[0] + rw * Math.cos(a), c0[1] + rw * Math.sin(a)], 'eqt'); }
              }
              s += S.line(B.rear, B.bb) + S.line(B.bb, B.seat) + S.line(B.seat, B.head) + S.line(B.bb, B.head) + S.line(B.head, B.front) + S.line(B.seat, B.rear) + S.line(B.head, B.bar) + S.line([121.6, 73.6], [142.4, 73.6]);
              const th = 2 * Math.PI * (ms / 1000) / 1.4, r = 11 * K;
              return s + S.line([B.bb[0] + r * Math.cos(th), B.bb[1] + r * Math.sin(th)], [B.bb[0] - r * Math.cos(th), B.bb[1] - r * Math.sin(th)], 'grip');
            },
          },
        };
      })(),
    },
    'leg-swing': {
      name: 'Bacak salınımı', sub: 'Öne-arkaya', kind: 'dynamic', dose: '8–10 tekrar/taraf',
      legend: [[1, 'Kalça fleksörleri, hamstring']],
      work: { main: [MU.ham, MU.hipFlex], help: [MU.glute] }, joints: [JT.hipSwing],
      cues: ['Duvara tutun, gövde dik; salınımı kalçadan yap.', 'Önce küçük, sonra daha geniş salla.'],
      anim: Object.assign(WT({ t1: 4, t2: 7, ul2: 0, ll2: 0, wx: 146, wh: 86 },
        [[0, { ul: -28, ll: -32 }], [1.2, { ul: 62, ll: 48 }], [2.4, { ul: -28, ll: -32 }]],
        { hy: undefined, hy2: undefined, hdy: 9.6, hdy2: 9.6 }), {
        anchor: { j: 'hip', x: mx(92), ground: true }, far: 'both', still: 1200, muscles: HL(['nleg']),
        equip: { stat: () => S.wall(220.8, 0, FLOOR) },
      }),
    },
    'worlds-greatest-stretch': {
      name: "World's Greatest Stretch", sub: 'Kalça açıcı', kind: 'dynamic', dose: '8–10 tekrar/taraf',
      legend: [[1, 'Kalça, üst sırt, hamstring']],
      work: { main: [MU.hipFlex, MU.add], help: [MU.glute, MU.ham, MU.chest] }, joints: [JT.hipExt, JT.hipFlex, JT.tspineRot],
      cues: ['Öne adım at, eller yerde, dirsek ayağın içine doğru.', 'Aynı taraf kolu tavana aç, bakışın elini izlesin.'],
      anim: (() => {
        const LG = { ul: 85, ll: -10, ul2: -57, ll2: -57 };
        const g = (o) => Object.assign({}, LG, o);
        const a = g({ t1: 75, t2: 85, h: 55, hdx: -14, hh: 0 }), b = g({ t1: 80, t2: 100, h: 75, hdx: -14, hh: 0 }), c = g({ t1: 60, t2: 35, h: -15, hdx: -4, hh: 0, hdx2: 0, hh2: 90 });
        return Object.assign(WT({ h: 40, hdx: -14, hh: 0 }, [[0, a], [0.8, a], [2.0, b], [2.6, b], [4.2, c], [5.0, c], [6.6, a], [7.2, a]]), {
          anchor: { j: 'ankle', x: mx(122), ground: true }, far: 'both', still: 4600, muscles: HL(['leg', 'back']),
        });
      })(),
    },
    'arm-circles': {
      name: 'Kol çevirme', sub: 'Öne ve geriye', kind: 'dynamic', dose: '8–10 tekrar/yön',
      legend: [[1, 'Omuzlar, üst sırt']],
      work: { main: [{ map: ['front-deltoids', 'back-deltoids'], tr: 'Omuz (deltoid)' }], help: [MU.cuff, { map: 'trapezius', tr: 'Trapez' }] }, joints: [JT.shoCirc],
      cues: ['Küçük dairelerle başla, yavaş yavaş büyüt.', 'Omuzları kulaktan uzak tut, gövde sabit.'],
      anim: {
        anchor: { j: 'hip', x: mx(105), ground: true }, far: 'both', period: 12000, still: 3000, muscles: HL(['arm']),
        fn: (ms) => {
          const u = ms / 12000, th = 6 * Math.PI * Math.pow(Math.sin(Math.PI * u), 2);
          return W(WR({ t1: 0 }, { hr: 26 - 12 * Math.cos(2 * Math.PI * u), ha: th / R }));
        },
      },
    },
    'stick-pass-through': {
      name: 'Sopayla omuz geçişi', kind: 'dynamic', dose: '8–10 tekrar',
      legend: [[1, 'Omuz, göğüs, üst sırt']],
      work: { main: [MU.chest, MU.frontDelt], help: [MU.bi, MU.cuff] }, joints: [JT.shoPass],
      cues: ['Geniş tutuşla başla, kollar düz; sopayı önden başın üstünden arkaya taşı.', 'Dar tutuş daha zor; omuz zorlanırsa tutuşu genişlet.'],
      note: 'Yandan çizim: sopa uçtan görünür (koyu nokta), kesikli çizgi yolunu gösterir.',
      anim: {
        anchor: { j: 'hip', x: mx(105), ground: true }, far: 'both', still: 2200, muscles: HL(['arm']), hand: false,
        keys: [{ ua: 90, fa: 90 }, { ua: -245, fa: -245 }],
        phases: [['', 3500, 1, 'move'], ['', 3500, 0, 'move']],
        equip: {
          back: (J) => S.circle(J.sho, 60, 'path'),
          front: (J) => S.circle(J.hand, 4, 'stick'),
        },
      },
    },
    'bodyweight-squat': {
      name: 'Vücut ağırlığıyla squat', kind: 'dynamic', dose: '8–10 tekrar',
      legend: [[1, 'Kalça, kuadriseps, ayak bileği']],
      work: { main: [MU.glute, MU.add], help: [MU.quad] }, joints: [JT.hipFlex, JT.kneeFlex, JT.ankleDF],
      cues: ['Yavaş in, derin ol; topuklar yerde, göğüs dik.', 'Dizler ayak parmakları yönünde.'],
      anim: (() => {
        const a = { ul: 0, ll: 0, t1: 0, h: 0, ua: 30, fa: 80 }, b = { ul: 100, ll: -25, t1: 42, t2: 50, h: 35, ua: 80, fa: 88 };
        return Object.assign(WT({}, [[0, a], [0.2, a], [2.0, b], [2.5, b], [4.4, a], [4.6, a]]), {
          anchor: { j: 'ankle', x: mx(100), ground: true }, far: 'both', still: 2100, muscles: HL(['leg']),
        });
      })(),
    },
    'cat-cow': {
      name: 'Kedi-deve', sub: 'Cat-cow', kind: 'dynamic', dose: '8–10 tekrar',
      legend: [[1, 'Omurga, karın, sırt']],
      work: { main: [MU.lowBack, MU.abs], help: [MU.midBack] }, joints: [JT.spineFE],
      cues: ['Nefes verirken sırtı yuvarla, alırken aç.', 'Yavaş git; hareket omurga boyunca aksın.'],
      anim: Object.assign(WT({ ul: 0, ll: -90, hh: 0, hdx: 0 },
        [[0, { t1: 75, t2: 75, h: 85 }], [2, { t1: 50, t2: 97, h: 135 }], [4, { t1: 75, t2: 75, h: 85 }], [6, { t1: 100, t2: 46, h: 40 }], [8, { t1: 75, t2: 75, h: 85 }]]), {
        anchor: { j: 'sho', x: mx(128), ground: true }, far: 'both', noFoot: true, still: 2000, muscles: HL(['back']),
      }),
    },

    /* ================= Soğuma ================= */
    'pancake-stretch': {
      name: 'Pancake', sub: 'Oturarak geniş açı', kind: 'static', dose: '30 sn',
      legend: [[1, 'Hamstring, iç bacak']],
      work: { main: [MU.ham, MU.add], help: [] }, joints: [JT.hipFlex, JT.hipAbd], tissue: [TS.hamTendon],
      cues: ['Kalçadan katlan, sırt düz kalsın.', 'Başta ellerini bir basamağa veya benche koy; yükseklik arttıkça kolay, alçaldıkça zor.'],
      note: 'Yandan çizim; gerçekte bacaklar yana açık.',
      anim: Object.assign({}, STATIC, {
        keys: [{ t1: 15, t2: 20, h: 20 }, { t1: 50, t2: 60, h: 55 }].map((k) => W(WR({ wx: 150, wh: 30, ul: 84, ll: 84 }, k), { hx: 210, hx2: 210 })),
        anchor: { j: 'hip', x: mx(80), ground: true }, far: 'both', muscles: HL(['leg', 'back']),
        equip: { stat: () => S.rect(208, 136, 54, FLOOR - 136, 'eqf', 2) },
      }),
    },
    'figure-4-stretch': {
      name: 'Figure-4', sub: 'Sırtüstü kalça', kind: 'static', dose: '30 sn/taraf',
      legend: [[1, 'Kalça, piriformis']],
      work: { main: [MU.glute, { map: 'gluteal', tr: 'Piriformis (derin kalça)' }], help: [] }, joints: [JT.hipER, JT.hipFlex],
      cues: ['Sırtüstü yat, bilek karşı dizin üstünde; alttaki uyluğu göğse çek.', 'Zorsa dizini elinle destekle; esneyince dizi düzleştirmeye çalış.'],
      note: 'Squat ve deadlift sonrası iyi gelir. Videoda oturarak yapılışı da var.',
      anim: Object.assign({}, STATIC, {
        anchor: { j: 'hip', x: 150, y: FLOOR - 5 }, far: 'leg', noFoot: true, muscles: HL(['nleg']),
        keys: [
          { to: 180, hd: 194, th2: -75, sh2: 75, fj: 'knee2', fdx: 3.2, fdy: -4.8, fb: -1, hj: 'hip', hdx: -22.4, hdy: 3.2, hb: -1 },
          { to: 180, hd: 194, th2: -110, sh2: -30, fj: 'knee2', fdx: 3.2, fdy: -4.8, fb: -1, hj: 'hip', hdx: -10.9, hdy: -30, hb: -1 },
        ],
      }),
    },
    'hip-flexor-reach': {
      name: 'Diz çökerek kalça fleksörü + uzanma', kind: 'static', dose: '30 sn/taraf',
      legend: [[1, 'Kalça fleksörü, ön uyluk, karın']],
      work: { main: [MU.hipFlex, { map: 'quadriceps', tr: 'Ön bacak (rektus femoris)' }], help: [MU.abs, MU.obl] },
      joints: [JT.hipExt, JT.spineSide], tissue: [TS.hipCapsule],
      cues: ['Arka dizi yere koy, kalçayı öne it, gövde dik.', 'Arka dizi tarafındaki kolu tavana uzat, hafifçe karşı yana eğil; gerginlik karna kadar uzanır.'],
      anim: Object.assign({}, STATIC, {
        keys: [{ ul: 90, ll: 0, t1: 14, t2: 14, h: 14, ua: -10, fa: 50, ua2: 10, fa2: 20 }, { ul: 100, ll: -17, t1: -4, t2: -6, h: -6, ua: -10, fa: 50, ua2: 165, fa2: 172 }]
          .map((k) => W(WR({ ll2: -90 }, k))),
        anchor: { j: 'ankle', x: mx(126), ground: true }, far: 'both', kneel2: true, noFoot: true, muscles: HL(['fleg', 'back']),
      }),
    },
    'lat-stretch-rail': {
      name: 'Lat esnetmesi', sub: 'Bench / rack / çit', kind: 'static', dose: '30 sn',
      legend: [[1, 'Lat, sırt, omuz']],
      work: { main: [MU.lat], help: [MU.tri] }, joints: [JT.shoUp, JT.hipFlex], tissue: [TS.tlf],
      cues: ['Bench, rack veya çite tutun; eller kalça-göğüs hizasında.', 'Kalçayı geriye it, göğsü kolların arasında aşağı bırak.'],
      note: 'Videoda kolaydan zora üç seviye gösteriliyor; kolay olanla başla.',
      anim: Object.assign({}, STATIC, {
        keys: [{ ul: 5, ll: 0, t1: 55, t2: 60, h: 60 }, { ul: 14, ll: 10, t1: 80, t2: 88, h: 115 }].map((k) => W(WR({ wx: 164, wh: 57 }, k), { hx: 234, hx2: 234 })),
        anchor: { j: 'ankle', x: mx(100), ground: true }, far: 'both', muscles: HL(['back', 'arm']),
        equip: { stat: () => S.rect(236, 83, 11, FLOOR - 83, 'eqf', 0) + S.line([236, 83], [247, 83], 'eq', 'stroke-width:3') },
      }),
    },
    'quad-stretch': {
      name: 'Ayakta ön bacak', sub: 'Kuadriseps', kind: 'static', dose: '30 sn/taraf',
      legend: [[1, 'Ön uyluk']],
      work: { main: [MU.quad], help: [MU.hipFlex] }, joints: [JT.kneeFlex, JT.hipExt],
      cues: ['Topuğu kalçaya çek, dizler yan yana.', 'Bel kavislenmesin; kalçayı hafif öne it.'],
      anim: Object.assign({}, STATIC, {
        keys: [{ ul: 0, ll: 0, t1: 0, h: 0, ul2: 0, ll2: 0 }, { ul: 14, ll: -145, t1: 0, h: 0, ul2: 0, ll2: 0 }]
          .map((k) => W(WR({ wx: null, wh: null, wx2: 146, wh2: 86 }, k), { hj: 'ankle', hdx: 0, hdy: 0, hy2: undefined, hdy2: 9.6 })),
        anchor: { j: 'ankle2', x: mx(114), ground: true }, far: 'both', muscles: HL(['nleg']),
        equip: { stat: () => S.wall(220.8, 0, FLOOR) },
      }),
    },
    'chest-doorway-stretch': {
      name: 'Kapı kenarında göğüs esnetme', kind: 'static', dose: '30 sn/taraf',
      legend: [[1, 'Göğüs, ön omuz']],
      work: { main: [MU.chest], help: [MU.frontDelt, MU.bi] }, joints: [JT.shoOpen],
      cues: ['Önkol çerçevede, dirsek omuz hizasında.', 'Bir adım öne çık, göğüste hafif gerginlik.'],
      anim: Object.assign({}, STATIC, {
        keys: [{ ul: 0, ll: 0, ul2: 0, ll2: 0, t1: 0, h: 0 }, { ul: -18, ll: -18, ul2: 25, ll2: 0, t1: 6, h: 4 }]
          .map((k) => W(WR({ wx: 74, wh: 100, wx2: null, wh2: null, ua2: 5, fa2: 8 }, k), { hy: undefined, hdy: -12.8 }, -1)),
        anchor: { j: 'ankle', x: mx(92), ground: true }, far: 'both', muscles: HL(['arm', 'back']),
        equip: { stat: () => S.rect(89.6, 0, 12.8, FLOOR, 'eqf', 0) + S.line([102.4, 0], [102.4, FLOOR], 'eq', 'stroke-width:3') },
      }),
    },

    /* Listed in the cool-downs, no drawing yet (the card shows the text and the video). */
    'hamstring-stretch': { name: 'Hamstring esnetme', kind: 'static', dose: '30 sn/taraf', legend: [[1, 'Arka bacak (hamstring)']], work: { main: [MU.ham], help: [] }, joints: [JT.hipFlex, JT.kneeExt], tissue: [TS.hamTendon], cues: [] },
    'hip-flexor-stretch': { name: 'Kalça fleksörü esnetme', kind: 'static', dose: '30 sn/taraf', legend: [[1, 'Kalça fleksörü']], work: { main: [MU.hipFlex], help: [{ map: 'quadriceps', tr: 'Ön bacak (rektus femoris)' }] }, joints: [JT.hipExt], tissue: [TS.hipCapsule], cues: [] },

    /* ================= Günlük esneme (sabah dinamik, akşam statik) ================= */
    'thoracic-rotation': {
      name: 'Dört ayakta sırt rotasyonu', sub: 'Göğüs omurgası (T-spine) rotasyonu', kind: 'dynamic', dose: '6 tekrar/taraf',
      legend: [[1, 'Üst sırt (göğüs omurgası), omuz']],
      work: { main: [MU.chest, MU.obl], help: [MU.midBack] }, joints: [JT.tspineRot],
      cues: ['Dört ayak dur; kalçayı biraz topuklara doğru geri al, bel sabit kalsın.', 'Bir elini ensene koy; dirseği karşı kolun altına indir, sonra tavana aç.', 'Bakışın dirseği izlesin; nefes verirken aç.'],
      avoid: 'Dönüşü belden ya da kalçadan yapmak; hızlı savurmak.',
      alt: 'Yan yatarak açık kitap (open book): dizler bükülü, üstteki kolu yay çizerek arkaya aç.',
      note: 'Yandan çizim: dönüş kolun aşağı-yukarı yayı olarak görünür.',
      anim: Object.assign(WT({ ul: 0, ll: -90, hh2: 0, hdx2: 0, t1: 70, t2: 75 },
        [[0, { ua: 0, fa: 0, h: 85 }], [0.4, { ua: 0, fa: 0, h: 85 }], [2.0, { ua: -40, fa: -30, t2: 85, h: 115 }], [2.6, { ua: -40, fa: -30, t2: 85, h: 115 }], [4.6, { ua: 175, fa: 180, t2: 66, h: 45 }], [5.4, { ua: 175, fa: 180, t2: 66, h: 45 }], [7.0, { ua: 0, fa: 0, h: 85 }]]), {
        anchor: { j: 'sho', x: mx(128), ground: true }, far: 'both', noFoot: true, still: 4900, muscles: HL(['back', 'arm']),
      }),
    },
    'ankle-rock': {
      name: 'Duvara diz değdirme', sub: 'Ayak bileği mobilitesi (knee-to-wall)', kind: 'dynamic', dose: '10 tekrar/taraf',
      legend: [[1, 'Baldır, ayak bileği'], [2, 'Ön uyluk']],
      work: { main: [{ map: ['calves', 'left-soleus', 'right-soleus'], tr: 'Baldır (soleus)' }], help: [MU.quad] }, joints: [JT.ankleDF], tissue: [TS.achilles],
      cues: ['Öndeki ayak duvardan bir karış uzakta, arka ayak geride.', 'Topuk yerde kalsın; dizi ikinci parmak yönünde duvara doğru it, 1-2 sn bekle, geri gel.', 'Diz duvara kolay değiyorsa ayağı biraz geri al.'],
      avoid: 'Topuğun kalkması; dizin içe çökmesi.',
      alt: 'Duvar yoksa yarım diz çök; öndeki dizi ayak ucunun ötesine it.',
      anim: {
        anchor: { j: 'hip', x: 136, y: 112 }, far: 'leg',
        keys: [
          { ax: 0, ay: 0, to: -88, fx: 176, fy: FLOOR - 4, fb: -1, ft: 0, fx2: 96, fy2: FLOOR - 4, fb2: -1, ft2: 5, ua: 85, fa: 85 },
          { ax: 26, ay: 14, to: -84, fx: 176, fy: FLOOR - 4, fb: -1, ft: 0, fx2: 96, fy2: FLOOR - 4, fb2: -1, ft2: 25, ua: 80, fa: 80 },
        ],
        phases: [['Dizi duvara it · 2 sn', 2000, 1, 'con'], ['Bekle', 1000, null, 'hold'], ['Geri gel · 2 sn', 2000, 0, 'ecc'], ['', 400, null, 'hold']],
        still: 2600,
        muscles: [{ a: 'knee', b: 'ankle', f0: 0.1, f1: 0.7, off: [-3, 0], w: 11, c: 1 }, { a: 'hip', b: 'knee', w: 12, c: 2 }],
        equip: { stat: () => S.wall(212, 0, FLOOR) },
      },
    },
    'deep-squat-hold': {
      name: 'Derin squat bekleme', sub: 'Kapı kasasına tutunarak', kind: 'static', dose: '30–45 sn',
      legend: [[1, 'Kalça, iç bacak'], [2, 'Ayak bileği'], [3, 'Alt sırt (gevşek)']],
      work: { main: [MU.glute, MU.add], help: [{ map: ['calves', 'left-soleus', 'right-soleus'], tr: 'Baldır' }, { map: 'lower-back', tr: 'Bel' }] },
      joints: [JT.hipFlex, JT.kneeFlex, JT.ankleDF], tissue: [TS.achilles],
      cues: ['Kapı kasasını iki elle tut; ayaklar omuz genişliğinde, uçlar hafif dışa.', 'Yavaşça en aşağı otur; topuklar yerde, dizleri dirseklerle hafifçe dışa it.', 'Göğüs açık, rahat nefes al; zorlanırsan ellerle daha çok destek al.'],
      avoid: 'Topukların kalkması; ağrıya kadar zorlamak.',
      alt: 'Topuklar kalkıyorsa altına ince bir kitap veya plaka koy.',
      note: 'Ağırsağlam: çömelme zor geliyorsa bir yere tutunarak squat pozisyonunda esnemeyi öneriyor.',
      anim: {
        anchor: { j: 'ankle', x: 150, y: FLOOR - 3 }, hand: false,
        keys: [
          { th: 88, sh: 92, to: -88, ft: 0, hx: 214, hy: 92, hb: 1, hx2: 214, hy2: 92, hb2: 1 },
          { th: -12, sh: 122, to: -66, hd: -78, ft: 0, hx: 214, hy: 118, hb: 1, hx2: 214, hy2: 118, hb2: 1 },
        ],
        phases: [['Yavaşça in', 2500, 1, 'in'], ['Altta bekle', 45000, null, 'static'], ['Kalk', 2500, 0, 'out']],
        still: 20000, ring: { sec: 45, mode: 'down' },
        muscles: [{ a: 'hip', b: 'hip', off: [-6, 2], w: 22, c: 1 }, { a: 'knee', b: 'ankle', f0: 0.5, f1: 1, w: 10, c: 2 }, { a: 'hip', b: 'sho', f0: 0, f1: 0.4, w: 9, c: 3 }],
        equip: { stat: () => S.rect(218, 0, 12, FLOOR, 'eqf', 0) + S.line([218, 0], [218, FLOOR], 'eq', 'stroke-width:3') },
      },
    },
    'neck-tilt-turn': {
      name: 'Boyun eğme ve çevirme', sub: 'Yavaş, dinamik', kind: 'dynamic', dose: '5 tekrar/yön',
      legend: [[1, 'Boyun yanı, üst trapez']],
      work: { main: [{ map: 'neck', tr: 'Boyun yanı (SKM, skalen)' }, { map: 'trapezius', tr: 'Üst trapez' }], help: [] }, joints: [JT.neck],
      cues: ['Dik otur veya dur, omuzlar aşağıda.', 'Kulağı omza doğru yavaşça eğ, ortaya dön, diğer tarafa eğ.', 'Sonra başı sağa ve sola çevir; çene yere paralel kalsın.'],
      avoid: 'Başı çember çizerek geriye atmak; ağrılı noktaya zorlamak.',
      alt: 'Masada çene geri çekme (chin tuck): başı duvara yasla, çeneyi hafifçe içeri çek, 5 sn tut.',
      note: 'Önden yapılan bir hareket; çizim yok.',
    },
    'calf-stretch-wall': {
      name: 'Duvarda baldır esnetme', sub: 'Arka bacak düz, topuk yerde', kind: 'static', dose: '30 sn/taraf',
      legend: [[1, 'Baldır (gastroknemius)'], [2, 'Aşil tendonu']],
      work: { main: [{ map: 'calves', tr: 'Baldır (gastroknemius)' }], help: [{ map: ['left-soleus', 'right-soleus'], tr: 'Soleus (diz bükülünce)' }] }, joints: [JT.ankleDF], tissue: [TS.achilles],
      cues: ['Ellerini duvara koy, bir bacağı geriye uzat; arka ayak ucu ileri baksın.', 'Arka topuğu yere bastır, dizi düz tut; kalçayı duvara doğru it.', 'Sonra arka dizi hafifçe bük: gerginlik aşağı, aşile iner.'],
      avoid: 'Arka topuğun kalkması; ayağın dışa dönmesi.',
      alt: 'Basamakta topuk sarkıtma: ayak ucu basamakta, topuğu yavaşça aşağı bırak.',
      anim: Object.assign({}, STATIC, {
        anchor: { j: 'hip', x: 146, y: 100 }, far: 'leg',
        keys: [
          { ax: -6, ay: 0, to: -78, fx: 176, fy: FLOOR - 4, fb: 1, ft: 0, fx2: 90, fy2: FLOOR - 4, fb2: -1, ft2: 0, hx: 222, hy: 52, hb: 1, hx2: 222, hy2: 52, hb2: 1 },
          { ax: 8, ay: 4, to: -70, fx: 176, fy: FLOOR - 4, fb: 1, ft: 0, fx2: 90, fy2: FLOOR - 4, fb2: -1, ft2: 0, hx: 222, hy: 56, hb: 1, hx2: 222, hy2: 56, hb2: 1 },
        ],
        muscles: [{ a: 'knee2', b: 'ankle2', f0: 0.05, f1: 0.55, w: 11, c: 1 }, { a: 'knee2', b: 'ankle2', f0: 0.75, f1: 1, w: 7, c: 2 }],
        equip: { stat: () => S.wall(226, 0, FLOOR) },
      }),
    },
    'childs-pose-lat-stretch': {
      name: 'Çocuk pozu + yana uzanma', sub: 'Yerde lat esnetme', kind: 'static', dose: '30 sn/taraf',
      legend: [[1, 'Lat, yan gövde'], [2, 'Alt sırt']],
      work: { main: [MU.lat, { map: 'obliques', tr: 'Yan gövde (oblik)' }], help: [{ map: 'lower-back', tr: 'Bel' }, MU.tri] },
      joints: [JT.shoUp, JT.spineSide, JT.hipFlex], tissue: [TS.tlf],
      cues: ['Dizler kalça genişliğinde açık, kalça topuklara otursun; kollar önde.', 'İki eli birlikte sağa yürüt: sol yan esner. 30 sn sonra sola yürüt.', 'Nefes verirken kalçayı geriye, elleri ileri it.'],
      avoid: 'Kalçayı topuklardan kaldırmak; omzu zorlamak.',
      alt: 'Bench, rack veya çit varsa ayakta lat esnetmesi.',
      note: 'Yandan çizim; yana uzanma görünmez.',
      anim: Object.assign({}, STATIC, {
        anchor: { j: 'hip', x: 112, y: 158 }, far: 'leg', noFoot: true,
        keys: [
          { th: 30, sh: 180, lt: 4, ut: 8, hd: -5, hx: 226, hy: FLOOR - 4, hb: -1, hx2: 226, hy2: FLOOR - 4, hb2: -1 },
          { th: 30, sh: 180, lt: 18, ut: 22, hd: 0, hx: 232, hy: FLOOR - 4, hb: -1, hx2: 232, hy2: FLOOR - 4, hb2: -1 },
        ],
        muscles: [{ a: 'hip', b: 'sho', f0: 0.3, f1: 1, off: [0, -5], w: 13, c: 1 }, { a: 'hip', b: 'sho', f0: 0, f1: 0.35, w: 10, c: 2 }],
      }),
    },
    'supine-breathing': {
      name: 'Sırtüstü nefes', sub: 'Burundan al, uzun ver', kind: 'hold', dose: '1 dk',
      legend: [[1, 'Diyafram, karın']],
      work: { main: [{ map: null, tr: 'Diyafram' }], help: [{ map: 'abs', tr: 'Karın (nefes verirken)' }, MU.obl] },
      cues: ['Sırtüstü yat, dizler bükülü; bir el göğüste, bir el karında.', 'Burundan ~4 sn al: karın kalksın, göğüs az oynasın.', 'Ağızdan veya burundan ~6-8 sn yavaşça ver; omuzları ve çeneyi gevşet.'],
      avoid: 'Nefesi zorlamak ya da tutmak; göğüsten hızlı solumak.',
      alt: 'Baldırları bir sandalyeye koy (90/90) veya yüzüstü yatıp alnını ellere koy.',
      anim: {
        anchor: { j: 'hip', x: 150, y: FLOOR - 6 }, breath: true, far: 'leg', hand: false,
        keys: [{ to: 180, hd: 186, fx: 196, fy: FLOOR - 4, fb: -1, ft: 0, hj: 'hip', hdx: -16, hdy: -8, hb: 1 }],
        phases: [['Burundan al · 4 sn', 4000, null, 'iso'], ['Yavaşça ver · 6 sn', 6000, null, 'iso']],
        still: 0, ring: { sec: 60, mode: 'down' },
        muscles: [{ a: 'hip', b: 'sho', f0: 0.1, f1: 0.55, off: [0, -4], w: 15, c: 1, breath: 1 }],
      },
    },
  };

  /* ---------- shared drawings ---------- */
  EX['supinated-pulldown'].anim = EX['lat-pulldown'].anim;
  EX['weighted-plank'].anim = Object.assign({}, EX.plank.anim, {
    ring: { sec: 45, mode: 'up' },
    equip: {
      front: (J) => { // plate between the shoulder blades
        const dx = J.sho[0] - J.mid[0], dy = J.sho[1] - J.mid[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
        const c = [J.mid[0] + dx * 0.45 + 8 * u[1], J.mid[1] + dy * 0.45 - 8 * u[0]];
        return `<g transform="translate(${f(c[0])} ${f(c[1])}) rotate(${f(Math.atan2(dy, dx) / R)})">` + S.plate(-16, -3.5, 32, 7) + '</g>';
      },
    },
  });

  /* ---------- videos (.fluid/sources/youtube-links.json) ---------- */
  const YT = {
    'goblet-squat': { url: 'https://www.youtube.com/watch?v=ms0a3kk9Z5g', title: 'Salonumda Squat Rack Yok, Ne Yapmalıyım? | AĞIRSAĞLAM', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 169, note: "ayrı goblet squat videosu yok; goblet squat'ı 2:49-4:37 arasında öneriyor" },
    'db-bench-press': { url: 'https://www.youtube.com/watch?v=GvmhuLgnd3c', title: 'Dambıl Press Verimini Artır!', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'kısa video' },
    'one-arm-db-row': { url: 'https://www.youtube.com/watch?v=g9_G3ZF9t2Q', title: "Neden Barbell Row'u Programıma Ekledim? (Row Tekniği) | AĞIRSAĞLAM", channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 1274, note: "tek kol dambıl row önerisi 21:14'te" },
    'db-rdl': { url: 'https://www.youtube.com/watch?v=DQnFG4-SVys', title: 'Dambıl ile Deadlift Hareketi Nasıl Yapılır ? | AĞIRSAĞLAM | How to', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'dambıl deadlift; ayrı RDL videosu yok. Kalça menteşesi çalışması: PB25g5ViNN4' },
    'barbell-deadlift': { url: 'https://www.youtube.com/watch?v=1VrZ1QLTdUs', title: 'Deadlift Nasıl Yapılır? Detaylı ve Adım Adım! (+ 2 Büyük Deadlift Hatası!) AER #2 (2018) | AĞIRSAĞLAM', channel: 'AĞIRSAĞLAM', source: 'agirsaglam' },
    'barbell-ohp': { url: 'https://www.youtube.com/watch?v=BVLwFQKVOgI', title: 'Omuzlarına Rütbe Atlat!: Overhead Press Detaylı Analiz ve Program (OHP)', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 710, note: 'dambıl yerine barbell ile başlama gerekçesi 11:50-12:13' },
    'pancake-stretch': { url: 'https://www.youtube.com/shorts/gcv9Hj-Bud8', title: 'The ONLY Stretches you need! #stayflexy', channel: 'MovementbyDavid', source: 'user', note: "kullanıcının paylaştığı short, hareket 0:04'te" },
    'figure-4-stretch': { url: 'https://www.youtube.com/shorts/gcv9Hj-Bud8', title: 'The ONLY Stretches you need! #stayflexy', channel: 'MovementbyDavid', source: 'user', note: "kullanıcının paylaştığı short, hareket 0:08'te" },
    'plank': { url: 'https://www.youtube.com/watch?v=FUUNGmMetNU', title: 'Plank Nasıl Yapılır: Bilimsel Olarak En Etkili Metot', channel: 'AĞIRSAĞLAM', source: 'agirsaglam' },
    'lat-pulldown': { url: 'https://www.youtube.com/watch?v=k_apZ_osz-I', title: 'Lat Pulldown Detaylı Teknik ve Sırt Antrenman Programı', channel: 'AĞIRSAĞLAM', source: 'agirsaglam' },
    'leg-press': { url: 'https://www.youtube.com/watch?v=qoN3WTCoBM0', title: 'Bacaklarını Büyütecek Leg Press Taktikleri', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'kısa video' },
    'face-pull': { url: 'https://www.youtube.com/watch?v=vuDO21_zqbQ', title: 'Face Pull: Yapmadığın En Faydalı Hareket (Rotator Cuff)', channel: 'AĞIRSAĞLAM', source: 'agirsaglam' },
    'leg-swing': { url: 'https://www.youtube.com/watch?v=cjpASeIsm2g', title: 'Kalça ve Bacak Mobilitesi: Sağlıklı ve Güçlü Bacak Egzersizleri', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'kalça ve bacak mobilitesi videosu; leg swing segmenti doğrulanmadı' },
    'worlds-greatest-stretch': { url: 'https://www.youtube.com/watch?v=4Mxup_XtmLk', title: 'Antrenman Öncesi Isınma ve Mobilite Rutini', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'dinamik ısınma rutini; bu hareketin segmenti doğrulanmadı' },
    'arm-circles': { url: 'https://www.youtube.com/watch?v=qcccnaQHHho', title: 'Omuz Mobilitesi: Sağlıklı ve Güçlü Omuz Egzersizleri', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'omuz mobilitesi videosu; segment doğrulanmadı' },
    'bodyweight-squat': { url: 'https://www.youtube.com/watch?v=-Mg0luyGdBI', title: 'İLK DEFA: Squat Nasıl Yapılır?', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'squat temel anlatımı' },
    'cat-cow': { url: 'https://www.youtube.com/watch?v=CaG7FKLtgSw', title: 'Antrenman Öncesi Isınma ve Mobilite Egzersizleri (TEK VİDEO!)', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: "kedi-deve segmenti yaklaşık 2:19'da" },
    'quad-stretch': { url: 'https://www.youtube.com/watch?v=6u-5ajM58O4', title: 'Hangi Kas Nasıl Esnetilir | Bütün Kaslar için Egzersizler | AĞIRSAĞLAM', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: "quadriceps esnetme 3:04-3:14'te" },
    'hamstring-stretch': { url: 'https://www.youtube.com/watch?v=6u-5ajM58O4', title: 'Hangi Kas Nasıl Esnetilir | Bütün Kaslar için Egzersizler | AĞIRSAĞLAM', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: "arka bacak esnetme 3:24'te" },
    'chest-doorway-stretch': { url: 'https://www.youtube.com/watch?v=6u-5ajM58O4', title: 'Hangi Kas Nasıl Esnetilir | Bütün Kaslar için Egzersizler | AĞIRSAĞLAM', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'göğüs esnetme 1:11-2:18; kapı çerçevesi versiyonu doğrulanmadı' },
    'childs-pose-lat-stretch': { url: 'https://www.youtube.com/watch?v=2pkLUbN34GI', title: 'Childs Pose with Lat Stretch', channel: 'Functional Bodybuilding', source: 'fallback' },
    'thoracic-rotation': { url: 'https://www.youtube.com/watch?v=snzLuyYgbVI', title: 'Thoracic Rotation in Quadruped - Ask Doctor Jo', channel: 'AskDoctorJo', source: 'fallback', note: 'fizyoterapist; Ağırsağlam kanalında bu hareketin videosu yok' },
    'ankle-rock': { url: 'https://www.youtube.com/watch?v=ElrpduJn92Y', title: 'Knee To Wall Exercise for Ankle Mobility', channel: 'Dr. Jess Harvey, Osteopath & Health Coach', source: 'fallback' },
    'deep-squat-hold': { url: 'https://www.youtube.com/watch?v=qQwZbF3lWyI', title: '[AER] #5 - Çömelme ve Squat Nasıl Yapılır?', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 109, note: "tutunarak çömelip esneme 1:49-2:14" },
    'neck-tilt-turn': { url: 'https://www.youtube.com/watch?v=iTdJ9phzBZk', title: 'Boyun Ağrısı, Tutulmalar ve Boyundaki Kas Dengesizlikleri', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 244, note: 'boyun yanı esnetme 4:04-5:40 (statik); sabah yavaş ve dinamik yap' },
    'calf-stretch-wall': { url: 'https://www.youtube.com/watch?v=mafo7o7OnFo', title: 'Standing Calf Stretch (HSS)', channel: 'Hospital for Special Surgery', source: 'fallback' },
    'supine-breathing': { url: 'https://www.youtube.com/watch?v=WEqcbzeQdnA', title: '90/90 Supine Breathing', channel: 'Movement As Medicine', source: 'fallback', note: 'baldırlar sandalyede (90/90) versiyonu' },
    'general-warmup': { url: 'https://www.youtube.com/watch?v=CaG7FKLtgSw', title: 'Antrenman Öncesi Isınma ve Mobilite Egzersizleri (TEK VİDEO!)', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'tam vücut ısınma ve mobilite rutini, 6:27. Kısa alternatif: 4Mxup_XtmLk' },
    'stick-pass-through': { url: 'https://www.youtube.com/shorts/gcv9Hj-Bud8', title: 'The ONLY Stretches you need! #stayflexy', channel: 'MovementbyDavid', source: 'user', note: "kullanıcının paylaştığı short, hareket 0:22'te" },
    'lat-stretch-rail': { url: 'https://www.youtube.com/shorts/gcv9Hj-Bud8', title: 'The ONLY Stretches you need! #stayflexy', channel: 'MovementbyDavid', source: 'user', note: "kullanıcının paylaştığı short, hareket 0:34'te" },
    'hip-flexor-reach': { url: 'https://www.youtube.com/shorts/gcv9Hj-Bud8', title: 'The ONLY Stretches you need! #stayflexy', channel: 'MovementbyDavid', source: 'user', note: "kullanıcının paylaştığı short, hareket 0:17'te" },
    'hip-flexor-stretch': { url: 'https://www.youtube.com/watch?v=6u-5ajM58O4', title: 'Hangi Kas Nasıl Esnetilir | Bütün Kaslar için Egzersizler | AĞIRSAĞLAM', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: "hip flexor esnetme 2:37'de" },
    'seated-leg-curl': { url: 'https://www.youtube.com/watch?v=RRLr4uKN2Zo', title: 'Hamstringlerini Seated Leg Curl ile Büyüt', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'kısa video' },
    'lying-leg-curl': { url: 'https://www.youtube.com/watch?v=69_4qE2o-9A', title: 'Leg Curl Hareketi Nasıl Yapılır | AĞIRSAĞLAM | How to', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'yatarak leg curl makinesi, 54 sn' },
    'push-up': { url: 'https://www.youtube.com/watch?v=RyzxRrBHn7k', title: 'İLK DEFA: Şınav Nasıl Yapılır?', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'yeni başlayan için şınav. Kolaydan zora çeşitler: 8eYrT_0nQKw' },
    'seated-cable-row': { url: 'https://www.youtube.com/watch?v=85IRNXb4sUA', title: 'Cable Row Hareketi Nasıl Yapılır ve Faydaları | AĞIRSAĞLAM | How to', channel: 'AĞIRSAĞLAM', source: 'agirsaglam' },
    'chest-supported-db-row': { url: 'https://www.youtube.com/watch?v=k_apZ_osz-I', title: 'Lat Pulldown Detaylı Teknik ve Sırt Antrenman Programı', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 1295, note: "ayrı video yok; 21:35'te eğimli bench'te dambıl row'u öneriyor" },
    'side-plank': { url: 'https://www.youtube.com/watch?v=W-Q0FzvIlS0', title: 'Bel Simitleri Side Bend ile GİTMEZ! (En İyi Egzersizler)', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 541, note: "yan plank 9:01-9:30" },
    'weighted-plank': { url: 'https://www.youtube.com/watch?v=kvLXt1R-PHg', title: 'Karın Kası için En İyi Egzersizler!', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 355, note: "plank 5:55: \"ağırlıklı veya vücut ağırlığıyla\"" },
    'supinated-pulldown': { url: 'https://www.youtube.com/watch?v=k_apZ_osz-I', title: 'Lat Pulldown Detaylı Teknik ve Sırt Antrenman Programı', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 1176, note: "19:36'da ters tutuş pulldown programı (3 × 6-8)" },
    'assisted-pullup': { url: 'https://www.youtube.com/watch?v=cImbL8ALYco', title: '0 Barfiksten 20 Barfikse Adım Adım Bunları Yap!', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', start: 214, note: "lastik destekli barfiks 3:34'te; makine videosu yok" },
    'db-split-squat': { url: 'https://www.youtube.com/watch?v=RG5fkQWDhhw', title: 'Neden Split Squat’ı Mutlaka Programına Eklemelisin?', channel: 'AĞIRSAĞLAM', source: 'agirsaglam' },
    'reverse-fly': { url: 'https://www.youtube.com/watch?v=lcVOQxhGrkM', title: 'Omuzları PATLAT: Reverse Pec Deck!', channel: 'AĞIRSAĞLAM', source: 'agirsaglam', note: 'kısa video' },
  };
  for (const k in EX) { EX[k].slug = k; if (YT[k]) EX[k].video = YT[k]; }
  window.FIT_EXERCISES = EX;
  window.FIT_VIDEOS = YT;

  /* ---------- sessions ---------- */
  const exMin = (warm, sets, workSec, restSec, sw) => warm + sets * workSec / 60 + (sets - 1) * restSec / 60 + sw;
  window.exMin = exMin;
  const ANIM_NOTE = 'Animasyonlar "Isınma & Soğuma" görünümünde.';
  window.FIT_SESSION_META = {
    sali: { label: 'Salı', title: 'Gün A — İtiş & ön bacak', accent: 'var(--fit-sali)', note: 'Tahmin: set başına ~40 sn iş + dinlenme; hareketler arası ~1 dk geçiş. Ağırsağlam yeni başlayan için ~40 dk ağırlığı yeterli buluyor.' },
    cuma: { label: 'Cuma', title: 'Gün B — Çekiş & arka zincir', accent: 'var(--fit-cuma)', note: 'Tahmin: set başına ~40 sn iş + dinlenme; hareketler arası ~1 dk geçiş. Ağırsağlam yeni başlayan için ~40 dk ağırlığı yeterli buluyor.' },
    sabah: { label: 'Sabah', title: 'Sabah mobilite', accent: 'var(--fit-sabah)', routine: true,
      note: 'Her gün, kalkınca. Dinamik: tutup beklemek yok, yavaş ve kontrollü hareket. Süre hareket başına; zamanlayıcı kendisi ilerler.' },
    aksam: { label: 'Akşam', title: 'Akşam esneme', accent: 'var(--fit-aksam)', routine: true,
      note: 'Her gün, yatmadan önce. Statik: her taraf 30 sn, ağrı değil hafif gerginlik; zıplama yok, nefes rahat.' },
  };
  // A daily routine step: one move per step (a one-item list), so the workout mode shows one move per
  // screen. holdSec = timer seconds per side (dynamic moves get a time budget for their reps);
  // min counts both sides plus ROUTINE_PREP seconds to get into position before each side.
  const ROUTINE_PREP = 5;
  window.FIT_ROUTINE_PREP = ROUTINE_PREP;
  const MOVE = (slug, dose, sec, o = {}) => {
    const sides = o.perSide ? 2 : 1;
    return { id: slug, type: 'list', phase: 'mob', name: EX[slug].name, min: sides * (sec + ROUTINE_PREP) / 60, detail: dose + (o.optional ? ' · isteğe bağlı' : '') + (o.tip ? ' · ' + o.tip : ''),
      items: [Object.assign({ slug, dose, holdSec: sec }, o)] };
  };
  // Minutes: warm-up sets + sets × work + (sets − 1) × rest + 1 min to switch. `min` uses ~40 s per set
  // and the middle of the rest range; `hi` uses ~45 s and the top of the range (per-side moves: both sides).
  const ROW_B = { sets: 3, reps: '8–12', perSide: false, warmupSets: 0, workSec: 40, restSec: [60, 90],
    min: exMin(0, 3, 40, 75, 1), hi: exMin(0, 3, 45, 90, 1), detail: '3×8-12 · 2×60-90 sn dinlenme + 1 dk geçiş' };
  const CORE = (sets) => ({
    2: { slug: 'side-plank', holdSec: [20, 40], perSide: true, workSec: 70, dose: `${sets} × 20–40 sn / taraf`,
      min: exMin(0, sets, 70, 60, 1), hi: exMin(0, sets, 90, 60, 1), detail: `${sets}×20-40 sn/taraf · iki taraf ~70 sn + ${sets - 1}×60 sn dinlenme + 1 dk geçiş` },
    3: { slug: 'weighted-plank', holdSec: [30, 45], workSec: 40, dose: `${sets} × 30–45 sn`,
      min: exMin(0, sets, 40, 60, 1), hi: exMin(0, sets, 45, 60, 1), detail: `${sets}×30-45 sn, sırtta plaka · ${sets - 1}×60 sn dinlenme + 1 dk geçiş` },
  });
  window.FIT_SESSIONS = {
    sali: [
      { id: 'kardiyo', type: 'cardio', phase: 'warm', name: 'Kardiyo', slug: 'bike', min: 7, lo: 5, hi: 10, detail: 'Koşu bandı veya bisiklet, hafif tempo (5-10 dk)' },
      { id: 'dinamik-esneme', type: 'list', phase: 'warm', name: 'Dinamik esneme', min: 5, video: YT['general-warmup'],
        detail: 'Bacak salınımı, vücut ağırlığıyla squat, kol çevirme, sopayla omuz geçişi, kedi-deve, 8-10 tekrar; bacak salınımı her bacakla ayrı. ' + ANIM_NOTE,
        items: [{ slug: 'leg-swing', dose: '8–10 tekrar/taraf', perSide: true }, { slug: 'bodyweight-squat', dose: '8–10 tekrar' }, { slug: 'arm-circles', dose: '8–10 tekrar/yön' }, { slug: 'stick-pass-through', dose: '8–10 tekrar' }, { slug: 'cat-cow', dose: '8–10 tekrar' }] },
      { id: 'goblet-squat', type: 'exercise', phase: 'main', name: 'Goblet Squat', slug: 'goblet-squat', sets: 3, reps: '8–12', warmupSets: 1, workSec: 40, restSec: [120, 180],
        min: exMin(2, 3, 40, 150, 1), hi: exMin(2, 3, 45, 180, 1), detail: '3×8-12 · ısınma seti ~2 dk + 2×2-3 dk dinlenme + 1 dk geçiş' },
      { id: 'db-bench-press', type: 'exercise', phase: 'main', name: 'Dambıl Bench Press', slug: 'db-bench-press', sets: 3, reps: '8–12', warmupSets: 1, workSec: 40, restSec: [120, 180],
        min: exMin(2, 3, 40, 150, 1), hi: exMin(2, 3, 45, 180, 1), detail: '3×8-12 · ısınma seti ~2 dk + 2×2-3 dk dinlenme + 1 dk geçiş' },
      { id: 'one-arm-db-row', type: 'exercise', phase: 'main', name: 'Tek Kol Dambıl Row', slug: 'one-arm-db-row', sets: 3, reps: '8–12 / kol', perSide: true, warmupSets: 0, workSec: 80, restSec: [60, 90],
        min: exMin(0, 3, 80, 75, 1), hi: exMin(0, 3, 90, 90, 1), detail: '3×8-12/kol · set başı iki kol ~80 sn + 2×60-90 sn dinlenme + 1 dk geçiş',
        variants: { 2: Object.assign({ slug: 'seated-cable-row' }, ROW_B), 3: Object.assign({ slug: 'chest-supported-db-row' }, ROW_B) } },
      { id: 'db-rdl', type: 'exercise', phase: 'main', name: 'Dambıl RDL', slug: 'db-rdl', sets: 3, reps: '8–12', warmupSets: 0, workSec: 40, restSec: [120, 120],
        min: exMin(0, 3, 40, 120, 1), hi: exMin(0, 3, 45, 120, 1), detail: '3×8-12 · 2×2 dk dinlenme + 1 dk geçiş' },
      { id: 'plank', type: 'exercise', phase: 'main', name: 'Plank', slug: 'plank', sets: 3, holdSec: [30, 60], warmupSets: 0, workSec: 45, restSec: [60, 60], dose: '3 × 30–60 sn',
        min: exMin(0, 3, 45, 60, 1), hi: exMin(0, 3, 60, 60, 1), detail: '3×30-60 sn · 2×60 sn dinlenme + 1 dk geçiş', variants: CORE(3) },
      { id: 'soguma', type: 'list', phase: 'cool', name: 'Soğuma', min: 6,
        detail: 'Pancake 30 sn; figure-4, kalça fleksörü + uzanma, ön bacak, göğüs: önce sol, sonra sağ, her taraf 30 sn. ' + ANIM_NOTE,
        items: [{ slug: 'pancake-stretch', dose: '30 sn', holdSec: 30 }, { slug: 'figure-4-stretch', dose: '30 sn/taraf', holdSec: 30, perSide: true }, { slug: 'hip-flexor-reach', dose: '30 sn/taraf', holdSec: 30, perSide: true }, { slug: 'quad-stretch', dose: '30 sn/taraf', holdSec: 30, perSide: true }, { slug: 'chest-doorway-stretch', dose: '30 sn/taraf', holdSec: 30, perSide: true }] },
    ],
    cuma: [
      { id: 'kardiyo', type: 'cardio', phase: 'warm', name: 'Kardiyo', slug: 'bike', min: 5, lo: 5, hi: 10, detail: 'Koşu bandı veya bisiklet · 5 dk (vakit varsa 10)' },
      { id: 'dinamik-esneme', type: 'list', phase: 'warm', name: 'Dinamik esneme', min: 5, video: YT['general-warmup'],
        detail: 'Bacak salınımı, World’s Greatest Stretch, kol çevirme, sopayla omuz geçişi, kedi-deve, 8-10 tekrar; bacak salınımı ve World’s Greatest Stretch her tarafla ayrı. ' + ANIM_NOTE,
        items: [{ slug: 'leg-swing', dose: '8–10 tekrar/taraf', perSide: true }, { slug: 'worlds-greatest-stretch', dose: '8–10 tekrar/taraf', perSide: true }, { slug: 'arm-circles', dose: '8–10 tekrar/yön' }, { slug: 'stick-pass-through', dose: '8–10 tekrar' }, { slug: 'cat-cow', dose: '8–10 tekrar' }] },
      { id: 'barbell-deadlift', type: 'exercise', phase: 'main', name: 'Barbell Deadlift', slug: 'barbell-deadlift', sets: 1, reps: '5', warmupSets: 3, workSec: 40, restSec: [60, 90],
        min: 4 + exMin(0, 1, 40, 0, 1), hi: 5 + exMin(0, 1, 45, 0, 1), detail: '2-3 ısınma seti (~4-5 dk) + 1×5 çalışma seti + 1 dk geçiş' },
      { id: 'lat-pulldown', type: 'exercise', phase: 'main', name: 'Lat Pulldown', slug: 'lat-pulldown', sets: 3, reps: '6–10', warmupSets: 1, workSec: 40, restSec: [120, 120],
        min: exMin(1, 3, 40, 120, 1), hi: exMin(1, 3, 45, 120, 1), detail: '3×6-10 · ~1 dk ısınma + 2×2 dk dinlenme + 1 dk geçiş',
        variants: { 2: 'supinated-pulldown', 3: 'assisted-pullup' } },
      { id: 'barbell-ohp', type: 'exercise', phase: 'main', name: 'Barbell Omuz Presi', slug: 'barbell-ohp', sets: 3, reps: '6–10', warmupSets: 1, workSec: 40, restSec: [120, 180],
        min: exMin(2, 3, 40, 150, 1), hi: exMin(2, 3, 45, 180, 1), detail: '3×6-10 · ısınma seti ~2 dk + 2×2-3 dk dinlenme + 1 dk geçiş' },
      { id: 'leg-press', type: 'exercise', phase: 'main', name: 'Leg Press', slug: 'leg-press', sets: 3, reps: '8–12', warmupSets: 0, workSec: 40, restSec: [120, 120],
        min: exMin(0, 3, 40, 120, 1), hi: exMin(0, 3, 45, 120, 1), detail: '3×8-12 · 2×2 dk dinlenme + 1 dk geçiş',
        variants: { 2: { slug: 'db-split-squat', reps: '8–12 / bacak', perSide: true, workSec: 80, restSec: [60, 90],
          min: exMin(0, 3, 80, 75, 1), hi: exMin(0, 3, 90, 90, 1), detail: '3×8-12/bacak · set başı iki bacak ~80 sn + 2×60-90 sn dinlenme + 1 dk geçiş' } } },
      { id: 'seated-leg-curl', type: 'exercise', phase: 'main', name: 'Oturarak Leg Curl', slug: 'seated-leg-curl', sets: 2, reps: '8–12', warmupSets: 0, workSec: 40, restSec: [60, 90], dose: '2–3 × 8–12',
        min: exMin(0, 2, 40, 75, 1), hi: exMin(0, 3, 45, 90, 1), detail: '2×8-12 (vakit varsa 3) · 60-90 sn dinlenme + 1 dk geçiş',
        variants: { 2: 'lying-leg-curl' } },
      { id: 'push-up', type: 'exercise', phase: 'main', name: 'Şınav', slug: 'push-up', sets: 2, reps: 'tükenişe 2 kala', warmupSets: 0, workSec: 40, restSec: [60, 60],
        min: exMin(0, 2, 40, 60, 1), hi: exMin(0, 2, 45, 60, 1), detail: '2 set, tükenişe 2 tekrar kala · 60 sn dinlenme + 1 dk geçiş' },
      { id: 'face-pull', type: 'exercise', phase: 'main', name: 'Face Pull', slug: 'face-pull', sets: 3, reps: '15–20', warmupSets: 0, workSec: 45, restSec: [60, 60],
        min: exMin(0, 3, 45, 60, 1), hi: exMin(0, 3, 50, 60, 1), detail: '3×15-20 hafif · 2×60 sn dinlenme + 1 dk geçiş',
        variants: { 2: 'reverse-fly' } },
      { id: 'plank', type: 'exercise', phase: 'main', name: 'Plank', slug: 'plank', sets: 2, holdSec: [30, 60], warmupSets: 0, workSec: 45, restSec: [60, 60], dose: '2 × 30–60 sn',
        min: exMin(0, 2, 45, 60, 1), hi: exMin(0, 2, 60, 60, 1), detail: '2×30-60 sn · 60 sn dinlenme + 1 dk geçiş', variants: CORE(2) },
      { id: 'soguma', type: 'list', phase: 'cool', name: 'Soğuma', min: 5,
        detail: 'Pancake ve lat 30 sn; figure-4, kalça fleksörü + uzanma, ön bacak: önce sol, sonra sağ, her taraf 30 sn. ' + ANIM_NOTE,
        items: [{ slug: 'pancake-stretch', dose: '30 sn', holdSec: 30 }, { slug: 'figure-4-stretch', dose: '30 sn/taraf', holdSec: 30, perSide: true }, { slug: 'hip-flexor-reach', dose: '30 sn/taraf', holdSec: 30, perSide: true }, { slug: 'lat-stretch-rail', dose: '30 sn', holdSec: 30 }, { slug: 'quad-stretch', dose: '30 sn/taraf', holdSec: 30, perSide: true }] },
    ],
    // daily routines (FIT_SESSION_META[k].routine): morning dynamic ~6 min, evening static ~8 min
    sabah: [
      MOVE('cat-cow', '8 yavaş tekrar', 45),
      MOVE('thoracic-rotation', '6 tekrar/taraf', 30, { perSide: true }),
      MOVE('worlds-greatest-stretch', '4 tekrar/taraf', 30, { perSide: true }),
      MOVE('arm-circles', '10 tekrar/yön', 30),
      MOVE('stick-pass-through', '10 tekrar', 30, { tip: 'sopa yoksa havlu' }),
      MOVE('ankle-rock', '10 tekrar/taraf', 30, { perSide: true }),
      MOVE('deep-squat-hold', '30–45 sn', 45),
      MOVE('neck-tilt-turn', '5 tekrar/yön', 30, { optional: true }),
    ],
    aksam: [
      MOVE('hip-flexor-reach', '30 sn/taraf', 30, { perSide: true }),
      MOVE('figure-4-stretch', '30 sn/taraf', 30, { perSide: true }),
      MOVE('pancake-stretch', '30 sn', 30),
      MOVE('chest-doorway-stretch', '30 sn/taraf', 30, { perSide: true }),
      MOVE('childs-pose-lat-stretch', '30 sn/taraf', 30, { perSide: true }),
      MOVE('calf-stretch-wall', '30 sn/taraf', 30, { perSide: true }),
      MOVE('supine-breathing', '1 dk', 60),
    ],
  };
  // routine length in minutes without the optional moves (Bugün shows "Sabah ~6 dk")
  for (const k of ['sabah', 'aksam']) {
    window.FIT_SESSION_META[k].min = Math.round(window.FIT_SESSIONS[k].reduce((a, s) => a + (s.items[0].optional ? 0 : s.min), 0));
  }

  /* ---------- 12 weeks in three 4-week blocks ---------- */
  window.FIT_BLOCKS = [
    { n: 1, weeks: '1-4', name: 'Blok 1', from: 1, to: 4 },
    { n: 2, weeks: '5-8', name: 'Blok 2', from: 5, to: 8 },
    { n: 3, weeks: '9-12', name: 'Blok 3', from: 9, to: 12 },
  ];
  const LSget = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const LSset = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch { /* storage off */ } };
  const okBlock = (n) => (n === 1 || n === 2 || n === 3 ? n : 0);
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  let urlBlock = 0;
  try { urlBlock = okBlock(+new URLSearchParams(location.search).get('block')); } catch { /* no location */ }
  // program week from localStorage 'fit-start' (1 = the first week), 0 before the start, null without a start
  window.FIT_programWeek = () => {
    const d = parseDay(LSget('fit-start'));
    if (!d) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const days = Math.round((t - d) / 864e5);
    return days < 0 ? 0 : Math.floor(days / 7) + 1;
  };
  // {block, source: 'url' | 'manual' | 'start' | 'default', week, start}
  window.FIT_blockInfo = () => {
    const week = window.FIT_programWeek(), start = LSget('fit-start');
    if (urlBlock) return { block: urlBlock, source: 'url', week, start };
    const m = okBlock(+LSget('fit-block'));
    if (m) return { block: m, source: 'manual', week, start };
    if (week != null) return { block: Math.min(3, Math.max(1, Math.ceil(Math.max(week, 1) / 4))), source: 'start', week, start };
    return { block: 1, source: 'default', week, start };
  };
  window.FIT_currentBlock = () => window.FIT_blockInfo().block;
  const announce = () => window.dispatchEvent(new CustomEvent('fit-block', { detail: window.FIT_blockInfo() }));
  // n = 1..3 picks a block by hand; null goes back to the start date
  window.FIT_setBlock = (n) => { urlBlock = 0; LSset('fit-block', okBlock(+n) || null); announce(); };
  window.FIT_setStart = (iso) => { LSset('fit-start', parseDay(iso) ? iso.slice(0, 10) : null); announce(); };
  // fn runs on a block or start change in this view ('fit-block') or in another view ('storage')
  window.FIT_onBlockChange = (fn) => {
    const s = (e) => { if (e.key == null || e.key === 'fit-block' || e.key === 'fit-start') fn(e); };
    window.addEventListener('fit-block', fn); window.addEventListener('storage', s);
    return () => { window.removeEventListener('fit-block', fn); window.removeEventListener('storage', s); };
  };
  // a step resolved for one block: variant fields over the step, `slot` = the step's own id,
  // `id` = the variant's slug (block-1 steps keep their id), `block` = the block used
  window.FIT_step = (step, block) => {
    const b = okBlock(+block) || window.FIT_currentBlock();
    const raw = step.variants && step.variants[b];
    const r = Object.assign({}, step, { slot: step.id, block: b });
    if (!raw) return r;
    const v = typeof raw === 'string' ? { slug: raw } : raw;
    Object.assign(r, v);
    r.id = v.id || v.slug;
    r.name = v.name || (EX[v.slug] && EX[v.slug].name) || r.name;
    if (!('dose' in v)) delete r.dose;
    return r;
  };
  window.FIT_sessionSteps = (key, block) => (window.FIT_SESSIONS[key] || []).map((s) => window.FIT_step(s, block));
  // No start date yet: take the first Tuesday on or after the first logged session.
  if (!LSget('fit-start')) {
    // PWA build: the log lives in localStorage 'fit-log' (JSON array of the same records)
    let recs = []; try { recs = JSON.parse(LSget('fit-log') || '[]'); } catch { /* bad log */ }
    const dates = (Array.isArray(recs) ? recs : []).map((r) => r && r.date).filter((d) => parseDay(d)).sort();
    if (dates.length) {
      const d = parseDay(dates[0]);
      while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
      LSset('fit-start', isoDay(d));
    }
  }
})();
