// The Fluid board: views from .fluid/views/ placed freely on a pannable, zoomable plane.
// The server owns board.json; this page sends the user's actions to POST /action and redraws
// from GET /state whenever /events reports a change. The viewport (pan and zoom) is this
// page's own and is never reset by updates.
//
// With a stage (.fluid/stage.json has roles), the board is directed. In follow mode it lays the
// views out from their roles (stage.js), animates the change, and points the camera; it fires
// the flow's time cues when a view's clock reaches them. Any navigation by the user (pan, zoom,
// move, resize, open, close, fullscreen) switches to manual: the board freezes what the user
// sees into board.json, stops applying the stage, and shows a Follow button that animates back.
// Without roles, nothing of this runs and the board behaves as a free canvas.
(() => {
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  const world = $('#world');
  const DEFAULT = { w: 480, h: 360 };
  const MIN = { w: 200, h: 140 };
  const GAP = 24;
  const GROUP_GAP = 120;   // between a new view and other groups' views

  let project = '';
  let views = {};          // id -> {title, size: {w, h}, board: {x, y, w, h, z, pinned, hidden} | null}
  let order = [];
  let version = '';         // the plugin version this page was served by
  let groups = {};         // id -> {title, folded}, in the order of their first view
  const cards = new Map(); // id -> {el, iframe, title, pin, full}
  let vp = { x: 0, y: 0, zoom: 1 };
  let full = null;         // {id, saved viewport} while a view fills the pane
  let busy = null;         // the view the user is dragging or resizing
  const placing = new Set();
  // A published copy (publish.py) is static files: it reads state.json, stage.json, and flow.json
  // once, stays read-only, and gets no live updates. publish.py turns this on in the copy.
  const STATIC = true;
  if (STATIC) document.body.classList.add('static');
  const source = (name) => STATIC ? `${name}.json` : `/${name}`;

  let readonly = false;     // a shared canvas (share.py)
  let arranging = false;     // the frozen stage is on its way to board.json; keep the local copy

  const send = (url, body) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fluid': '1' }, body: JSON.stringify(body),
  });
  // A shared canvas (share.py) is read-only: look, don't touch.
  const post = (action) => readonly ? Promise.resolve() : send('/action', action).catch(() => {});
  const emit = (kind, data = {}) => readonly ? Promise.resolve() : send('/emit', { kind, data, source: 'board' }).catch(() => {});
  const postStage = (actions, source) => readonly ? Promise.resolve(null) : send('/stage', { actions, source }).then((r) => r.json()).catch(() => null);

  // ---- stage state ----------------------------------------------------------------------
  const S = window.FluidStage;
  let stg = { seq: 0, mode: 'follow', roles: {}, camera: null, beat: null, flow: '', cues: {}, scope: null, origin: null };
  let flow = { beats: [] };
  let staged = null;         // {zoom, rects} while following
  let manualSeq = null;      // the user took over; set until the server's stage reaches this seq
  const directed = () => Object.keys(stg.roles || {}).length > 0;
  const manual = () => directed() && (stg.mode === 'manual' || manualSeq != null);
  const following = () => directed() && !manual();
  const sc = (g) => g?.s || 1;
  // Following a group's flow, the stage arranges only that group's views, from the group's origin.
  const inScope = (id) => !stg.scope || groupOf(id) === stg.scope;
  // What the user sees for a view: its staged rect while following, else its board.json entry.
  function geo(id) {
    const b = views[id]?.board;
    if (!b) return b;
    if (!staged || !following()) return folded(id) ? { ...b, hidden: true } : b;  // the roles decide while following
    if (b.pinned) return b;
    const r = staged.rects[id];
    return r ? { ...b, ...r, hidden: false } : { ...b, hidden: true };
  }
  // ---- groups -----------------------------------------------------------------------------
  // A view's group comes from its meta.json; a folded group hides its views (outside a followed flow).
  const groupOf = (id) => { const g = views[id]?.group; return g && groups[g] ? g : null; };
  const folded = (id) => !!groups[groupOf(id)]?.folded;
  const hue = (g) => Math.round((Object.keys(groups).indexOf(g) * 137.508) % 360);  // golden angle: neighbours differ
  // ---- sleeping views -------------------------------------------------------------------------
  // A view's page runs while it can be seen: closed views and folded groups sleep (their frame is
  // emptied), and so do views off screen, beyond the KEEP_AWAKE most recently seen. A pinned or
  // fullscreen view, and a view playing media (it publishes a clock), stay awake. Waking reloads
  // the page, and the stage sends its cue again. Dozens of live pages would otherwise all run.
  const KEEP_AWAKE = 6;
  // A phone or tablet has far less memory per tab, and iOS reloads a page that runs out, again and
  // again. There a view runs once the user opens it (a tap on it, or its name in the list) and
  // while it is on screen, at most TOUCH_AWAKE at a time, the latest opened first. The others
  // show their title; a tap flies there and opens the view.
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  const TOUCH_AWAKE = 2;
  const opened = new Map();  // id -> when the user last opened it
  const seen = new Map();   // id -> when it was last on screen
  const ticking = {};       // id -> when it last published a clock
  const viewUrl = (id, fresh) => `views/${encodeURIComponent(id)}/index.html${fresh ? `?t=${Date.now()}` : ''}`;
  function onScreen(id) {
    const g = geo(id);
    if (!g || g.hidden) return false;
    const W = stage.clientWidth, H = stage.clientHeight, m = 0.5;  // half a screen of margin
    const x = g.x * vp.zoom + vp.x, y = g.y * vp.zoom + vp.y, w = g.w * sc(g) * vp.zoom, h = g.h * sc(g) * vp.zoom;
    return x < W * (1 + m) && x + w > -W * m && y < H * (1 + m) && y + h > -H * m;
  }
  function inView(id) {  // any part of it on the stage, no margin
    const g = geo(id);
    if (!g || g.hidden) return false;
    const W = stage.clientWidth, H = stage.clientHeight;
    const x = g.x * vp.zoom + vp.x, y = g.y * vp.zoom + vp.y, w = g.w * sc(g) * vp.zoom, h = g.h * sc(g) * vp.zoom;
    return x < W && x + w > 0 && y < H && y + h > 0;
  }
  function setAwake(id, on) {
    const c = cards.get(id);
    if (!c || c.awake === on) return;
    c.awake = on;
    c.el.classList.toggle('asleep', !on);
    c.iframe.src = on ? viewUrl(id, c.stale) : 'about:blank';
    c.stale = false;
    pageGone(id);
  }
  function reloadView(id) {
    const c = cards.get(id);
    if (c.awake) { c.iframe.src = viewUrl(id, true); pageGone(id); }
    else c.stale = true;
  }
  function sleepCheck() {
    const now = Date.now(), rest = [];
    if (TOUCH) {
      const must = (id) => full?.id === id || now - (ticking[id] || 0) < 15000;
      const ranked = [...cards.keys()].filter((id) => must(id) || (opened.has(id) && inView(id)))
        .sort((a, b) => must(b) - must(a) || opened.get(b) - opened.get(a));
      const awake = new Set(ranked.slice(0, TOUCH_AWAKE));
      for (const id of cards.keys()) setAwake(id, awake.has(id));
      return;
    }
    for (const id of cards.keys()) {
      const g = geo(id);
      if (full?.id === id || now - (ticking[id] || 0) < 15000 || (g && !g.hidden && (g.pinned || onScreen(id)))) {
        seen.set(id, now);
        setAwake(id, true);
      } else if (!g || g.hidden) setAwake(id, false);
      else rest.push(id);
    }
    rest.sort((a, b) => (seen.get(b) || 0) - (seen.get(a) || 0));
    rest.forEach((id, i) => setAwake(id, i < KEEP_AWAKE && seen.has(id)));
  }
  const afterMove = () => { sleepCheck(); renderFollow(); };  // when the view settles
  let sleepTimer = null;
  const scheduleSleep = () => { clearTimeout(sleepTimer); sleepTimer = setTimeout(afterMove, 250); };

  const interacting = (on) => document.body.classList.toggle('interacting', on);
  const topZ = () => Math.max(0, ...Object.values(views).map((v) => v.board?.z ?? 0));

  // ---- viewport -------------------------------------------------------------------------
  function applyViewport() {
    world.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`;
    world.style.setProperty('--zoom', vp.zoom);
    stage.style.backgroundSize = `${20 * vp.zoom}px ${20 * vp.zoom}px`;
    stage.style.backgroundPosition = `${vp.x}px ${vp.y}px`;
    $('#zoom-level').textContent = `${Math.round(vp.zoom * 100)}%`;
    scheduleSleep();
    if (!full && project) localStorage.setItem(`fluid.viewport:${project}`, JSON.stringify(vp));
  }
  function zoomAt(factor, cx, cy) {
    closeComment();
    cameraMoved();
    setLink(null);
    const z = Math.min(2.5, Math.max(0.1, vp.zoom * factor));
    vp = { x: cx - (cx - vp.x) * (z / vp.zoom), y: cy - (cy - vp.y) * (z / vp.zoom), zoom: z };
    applyViewport();
  }
  function fit(rects, pad = 40) {
    if (!rects.length) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.w * sc(r))), y1 = Math.max(...rects.map((r) => r.y + r.h * sc(r)));
    const z = Math.max(0.1, Math.min(1, (W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0)));
    vp = { x: (W - (x1 - x0) * z) / 2 - x0 * z, y: (H - (y1 - y0) * z) / 2 - y0 * z, zoom: z };
    applyViewport();
  }
  const shown = () => Object.keys(views).map(geo).filter((g) => g && !g.hidden);

  // Pan: drag empty space or a sleeping view, or scroll (two fingers, wheel; Shift+wheel sideways).
  // Zoom: pinch or Ctrl/Cmd+wheel (trackpad pinch arrives as ctrl+wheel; Safari's as gesture events).
  // A tap on a sleeping view flies to it.
  stage.addEventListener('pointerdown', (e) => {
    const sleeper = e.target.closest?.('.card.asleep .body') && e.target.closest('.card').dataset.id;
    if (full || e.button !== 0 || (e.target !== stage && e.target !== world && !sleeper)) return;
    const start = { px: e.clientX, py: e.clientY, x: vp.x, y: vp.y };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('panning');
    interacting(true);
    const move = (m) => { cameraMoved(); vp.x = start.x + m.clientX - start.px; vp.y = start.y + m.clientY - start.py; applyViewport(); };
    const up = (u) => {
      stage.classList.remove('panning');
      interacting(false);
      if (sleeper && u.type === 'pointerup' && Math.hypot(u.clientX - start.px, u.clientY - start.py) < 8) goTo(sleeper);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  });
  stage.addEventListener('wheel', (e) => {
    if (full) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const k = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * k * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
    else panBy(e.shiftKey && !e.deltaX ? e.deltaY * k : e.deltaX * k, e.shiftKey && !e.deltaX ? 0 : e.deltaY * k);
  }, { passive: false });
  function panBy(dx, dy) { cameraMoved(); setLink(null); vp.x -= dx; vp.y -= dy; applyViewport(); }
  let gesture = 1;
  stage.addEventListener('gesturestart', (e) => { e.preventDefault(); gesture = 1; });
  stage.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (full) return;
    const r = stage.getBoundingClientRect();
    zoomAt(e.scale / gesture, e.clientX - r.left, e.clientY - r.top);
    gesture = e.scale;
  });
  $('#zoom').addEventListener('click', (e) => {
    const what = e.target.closest('button')?.dataset.zoom;
    const cx = stage.clientWidth / 2, cy = stage.clientHeight / 2;
    if (what === 'in') zoomAt(1.2, cx, cy);
    if (what === 'out') zoomAt(1 / 1.2, cx, cy);
    if (what === 'reset') zoomAt(1 / vp.zoom, cx, cy);
    if (what === 'fit') { cameraMoved(); fit(shown()); }
    if (what === 'export') exportPage(e.target.closest('button'));
    if (what === 'theme') setTheme({ auto: 'light', light: 'dark', dark: 'auto' }[themePref()]);
  });

  // ---- links -----------------------------------------------------------------------------
  // #view/<id> and #group/<gid> open the board as a click on that view or group in the list does.
  // The address bar follows: going to a view or group sets its link, and panning or zooming away
  // clears it, so the URL in the bar is always a link to what is on screen. Same in a live share
  // and a static export, where only the host differs.
  const linkTo = (kind, id) => `#${kind}/${encodeURIComponent(id)}`;
  function setLink(kind, id) {
    const hash = kind ? linkTo(kind, id) : '';
    if (location.hash === hash || (!hash && !location.hash)) return;
    history.replaceState(null, '', hash || location.pathname + location.search);
  }
  function copyLink(kind, id) {
    const url = location.href.split('#')[0] + linkTo(kind, id);
    navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast(url));
  }
  function openLink() {
    const m = /^#(view|group)\/(.+)$/.exec(location.hash);
    if (!m) return;
    const id = decodeURIComponent(m[2]);
    if (m[1] === 'view' && views[id]) goTo(id);
    if (m[1] === 'group' && groups[id]) goToGroup(id, order.filter((v) => groupOf(v) === id));
  }
  window.addEventListener('hashchange', openLink);

  // ---- cards ----------------------------------------------------------------------------
  const ICONS = {
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
    expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
    shrink: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    open: '<path d="m6 9 6 6 6-6"/>',
    shut: '<path d="m9 18 6-6-6-6"/>',
    collapseAll: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
    expandAll: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    fit: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  };
  const icon = (name) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" `
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  function render(id) {
    const c = cards.get(id), v = views[id];
    if (!c || !v?.board) return;
    const b = geo(id);
    const isFull = full?.id === id;
    Object.assign(c.el.style, {
      left: `${b.x}px`, top: `${b.y}px`,
      width: `${isFull ? stage.clientWidth : b.w}px`, height: `${isFull ? stage.clientHeight : b.h}px`,
      zIndex: isFull ? 1000000 : b.z ?? 0,
      transform: !isFull && sc(b) !== 1 ? `scale(${sc(b)})` : '',
    });
    c.el.classList.toggle('pinned', !!b.pinned);
    c.el.classList.toggle('hidden', !!b.hidden);
    c.el.classList.toggle('full', isFull);
    c.el.classList.toggle('tiny', !isFull && sc(b) < 0.75);  // a mini thumbnail: no notes strip
    c.title.textContent = v.title;
    c.el.querySelector('.body').dataset.title = v.title;
    const g = groupOf(id);
    c.el.classList.toggle('grouped', !!g);
    if (g) c.el.style.setProperty('--gh', hue(g));
    c.tag.textContent = g ? groups[g].short || groups[g].title : '';
    c.title.title = [v.title, g && `Group: ${groups[g].title}`, v.about].filter(Boolean).join('\n');
    c.pin.innerHTML = icon('pin');
    c.pin.classList.toggle('on', !!b.pinned);
    c.pin.title = b.pinned ? 'Unpin: the agent may change this view again' : 'Pin: the agent will ask before changing this view';
    c.full.innerHTML = icon(isFull ? 'shrink' : 'expand');
    c.full.title = isFull ? 'Exit fullscreen (Esc)' : 'Fullscreen';
    scheduleSleep();
  }

  function front(id) {
    const b = views[id]?.board;
    if (!b) return;
    const others = Object.entries(views).filter(([k, v]) => k !== id && v.board).map(([, v]) => v.board.z ?? 0);
    if (others.every((z) => (b.z ?? 0) > z)) return;  // already in front
    b.z = topZ() + 1;
    render(id);
    post({ type: 'front', view: id });
  }

  function inject(iframe) {
    // Same origin, so the board can add point-and-talk to whatever page the view is.
    if (STATIC) return;
    try {
      const d = iframe.contentDocument;
      if (!d || d.querySelector('script[data-fluid-point]')) return;
      const s = d.createElement('script');
      s.src = '/viewer/point.js';
      s.dataset.fluidPoint = '';
      (d.head || d.documentElement).append(s);
    } catch { /* a page from another origin: no pointing there */ }
  }

  // Drag the title bar to move, the corner grip to resize. Pinned views stay put.
  function dragger(id, handle, resize) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      front(id);
      let b = geo(id);
      if (!b || b.pinned || full || readonly) return;
      e.preventDefault();
      e.stopPropagation();
      const start = { px: e.clientX, py: e.clientY, x: b.x, y: b.y, w: b.w, h: b.h };
      handle.setPointerCapture(e.pointerId);
      busy = id;
      interacting(true);
      let took = false;
      const move = (m) => {
        if (!took) { took = true; takeOver(); b = views[id].board; }  // what the user saw becomes theirs
        const dx = (m.clientX - start.px) / vp.zoom / sc(b), dy = (m.clientY - start.py) / vp.zoom / sc(b);
        if (resize) { b.w = Math.max(MIN.w, Math.round(start.w + dx)); b.h = Math.max(MIN.h, Math.round(start.h + dy)); }
        else { b.x = Math.round(start.x + dx); b.y = Math.round(start.y + dy); }
        render(id);
      };
      const up = () => {
        busy = null;
        interacting(false);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        const moved = resize ? b.w !== start.w || b.h !== start.h : b.x !== start.x || b.y !== start.y;
        if (moved) post(resize ? { type: 'resize', view: id, w: b.w, h: b.h } : { type: 'move', view: id, x: b.x, y: b.y });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  function createCard(id) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = id;
    el.innerHTML = `<div class="bar"><span class="gtag"></span><span class="title"></span><button data-act="link" title="Copy a link to this view">${icon('link')}</button><button data-act="pin"></button><button data-act="full"></button>`
      + `<button data-act="close" title="Close (reopen it from the list on the right)">${icon('close')}</button></div>`
      + `<div class="body"><iframe></iframe></div><div class="grip" title="Resize"></div>`;
    const iframe = el.querySelector('iframe');
    iframe.title = id;
    iframe.addEventListener('load', () => {
      if (iframe.getAttribute('src') === 'about:blank') return;  // asleep
      inject(iframe);
      themeView(iframe);
      if (!manual()) deliver(id);
    });
    const c = { el, iframe, title: el.querySelector('.title'), tag: el.querySelector('.gtag'), pin: el.querySelector('[data-act=pin]'), full: el.querySelector('[data-act=full]') };
    el.querySelector('.bar').addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      const b = views[id]?.board;
      if (!act || !b) return;
      if (act === 'pin') { b.pinned = !b.pinned; render(id); renderList(); post({ type: 'pin', view: id, pinned: b.pinned }); }
      if (act === 'full') toggleFull(id);
      if (act === 'close') setHidden(id, true);
      if (act === 'link') copyLink('view', id);
    });
    el.querySelector('.bar').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) toggleFull(id); });
    dragger(id, el.querySelector('.bar'), false);
    dragger(id, el.querySelector('.grip'), true);
    world.append(el);
    cards.set(id, c);
    return c;
  }

  function setHidden(id, hidden) {
    if (!views[id]?.board) return;
    takeOver();
    const b = views[id].board;
    if (hidden && full?.id === id) toggleFull(id);
    b.hidden = hidden;
    render(id);
    renderList();
    post({ type: 'hide', view: id, hidden });
  }

  // Fullscreen: the view takes the pane's size at zoom 1, on this screen only; the layout is unchanged.
  function toggleFull(id) {
    closeComment();
    const b = views[id]?.board;
    if (full?.id === id || !b) {
      const saved = full?.saved;
      const was = full?.id;
      full = null;
      document.body.classList.remove('full');
      if (saved) vp = saved;
      applyViewport();
      if (was) render(was);
      return;
    }
    takeOver();
    const saved = full ? full.saved : { ...vp };
    const prev = full?.id;
    full = { id, saved };
    setLink('view', id);
    if (prev) render(prev);
    document.body.classList.add('full');
    const g = geo(id);
    vp = { x: -g.x, y: -g.y, zoom: 1 };
    applyViewport();
    render(id);
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && full) toggleFull(full.id); });
  // The stage changes size with the window and with the sidebar's width.
  let resizeTimer = null;
  new ResizeObserver(() => {
    if (full) render(full.id);
    scheduleSleep();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (following()) relayout(false); }, 120);
  }).observe(stage);

  // A new view with no board entry goes into free space near the middle of the screen.
  // A view with a group goes next to its group's open views, and keeps a wider gap from other groups.
  function place(id) {
    const v = views[id];
    const w = Math.max(MIN.w, Number(v.size?.w) || DEFAULT.w), h = Math.max(MIN.h, Number(v.size?.h) || DEFAULT.h);
    const g = groupOf(id);
    // Space is taken by the view's group mates one by one, and by each other group as a whole (its
    // area, closed and folded views included: the server keeps groups' areas apart).
    const rects = [], areas = {};
    for (const [oid, o] of Object.entries(views)) {
      if (!o.board || oid === id) continue;
      const r = { x: o.board.x, y: o.board.y, w: o.board.w * sc(o.board), h: o.board.h * sc(o.board) };
      const og = groupOf(oid);
      if (g && og === g) { if (!o.board.hidden) rects.push({ ...r, gap: GAP, mate: true }); continue; }
      if (!og) { rects.push({ ...r, gap: g ? GROUP_GAP : GAP }); continue; }
      const a = areas[og] ??= { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h };
      a.x0 = Math.min(a.x0, r.x); a.y0 = Math.min(a.y0, r.y); a.x1 = Math.max(a.x1, r.x + r.w); a.y1 = Math.max(a.y1, r.y + r.h);
    }
    for (const a of Object.values(areas)) rects.push({ x: a.x0, y: a.y0, w: a.x1 - a.x0, h: a.y1 - a.y0, gap: GROUP_GAP });
    const mates = rects.filter((r) => r.mate);
    const left = (40 - vp.x) / vp.zoom, top = (40 - vp.y) / vp.zoom;
    let cx = (stage.clientWidth / 2 - vp.x) / vp.zoom, cy = (stage.clientHeight / 2 - vp.y) / vp.zoom;
    if (mates.length) {
      cx = mates.reduce((s, r) => s + r.x + r.w / 2, 0) / mates.length;
      cy = mates.reduce((s, r) => s + r.y + r.h / 2, 0) / mates.length;
    }
    const cands = [{ x: left, y: top }];
    for (const r of rects) cands.push({ x: r.x + r.w + r.gap, y: r.y }, { x: r.x, y: r.y + r.h + r.gap }, { x: r.x - w - r.gap, y: r.y });
    const free = (p) => rects.every((r) => p.x >= r.x + r.w + r.gap - 1 || p.x + w + r.gap - 1 <= r.x || p.y >= r.y + r.h + r.gap - 1 || p.y + h + r.gap - 1 <= r.y);
    const dist = (p) => Math.hypot(p.x + w / 2 - cx, p.y + h / 2 - cy);
    const spot = cands.filter(free).sort((a, b) => dist(a) - dist(b))[0]
      ?? { x: Math.max(...rects.map((r) => r.x + r.w)) + GAP, y: top };
    v.board = { x: Math.round(spot.x), y: Math.round(spot.y), w, h, z: topZ() + 1, pinned: false, hidden: false };
    placing.add(id);
    post({ type: 'place', view: id, ...v.board }).finally(() => placing.delete(id));
  }

  // ---- sidebar --------------------------------------------------------------------------
  const eye = (open) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>${open ? '' : '<line x1="3" y1="3" x2="21" y2="21"/>'}</svg>`;
  // Views listed by group: a section per group (fold, go to, drop a view in to regroup it), then
  // the ungrouped. A flat list while no view has a group. While a flow is followed, the sections
  // with staged views open and the rest close.
  let filterText = '';
  const collapsedKey = () => `fluid.collapsed:${project}`;
  const collapsed = () => new Set(JSON.parse(localStorage.getItem(collapsedKey()) || 'null') ?? Object.keys(groups).filter(g => groups[g].folded));
  function setAllCollapsed(on) {
    localStorage.setItem(collapsedKey(), JSON.stringify(on ? [...Object.keys(groups), ''] : []));
    renderList();
  }
  $('#collapse-all').innerHTML = icon('collapseAll');
  for (const k of ['fit', 'export']) $(`#zoom [data-zoom=${k}]`).innerHTML = icon(k);

  // ---- theme ----------------------------------------------------------------------------
  // Auto (the system's), light, or dark, kept in this browser. Views get it too: data-fluid-theme
  // and color-scheme on their <html>, and the components' --fl-* colors for dark.
  const DARK_VIEW = ':root[data-fluid-theme="dark"] { --fl-fg: #e6e8ee; --fl-muted: #9aa3b2; --fl-bg: #16181d; '
    + '--fl-surface: #1f232b; --fl-border: #2e3440; --fl-accent: #7b93ff; --fl-good: #4ade80; --fl-warn: #fbbf24; --fl-bad: #f87171; }';
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const themePref = () => { try { return localStorage.getItem('fluid.theme') || 'auto'; } catch { return 'auto'; } };
  const theme = () => { const t = themePref(); return t === 'auto' ? (systemDark.matches ? 'dark' : 'light') : t; };
  function themeView(iframe) {
    try {
      const d = iframe.contentDocument;
      if (!d?.documentElement) return;
      d.documentElement.dataset.fluidTheme = theme();
      d.documentElement.style.colorScheme = theme();
      if (!d.getElementById('fluid-theme')) {
        const s = Object.assign(d.createElement('style'), { id: 'fluid-theme', textContent: DARK_VIEW });
        (d.head || d.documentElement).prepend(s);  // first, so a view's own rules win
      }
    } catch { /* another origin */ }
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme();
    const btn = $('#zoom [data-zoom=theme]');
    btn.innerHTML = icon(themePref());
    btn.dataset.tip = `theme: ${themePref()}`;
    for (const c of cards.values()) themeView(c.iframe);
  }
  function setTheme(t) {
    try { localStorage.setItem('fluid.theme', t); } catch { /* private mode: this page only */ }
    applyTheme();
  }
  systemDark.addEventListener('change', applyTheme);
  window.addEventListener('storage', (e) => { if (e.key === 'fluid.theme') applyTheme(); });  // another tab
  applyTheme();
  $('#expand-all').innerHTML = icon('expandAll');
  $('#collapse-all').onclick = () => setAllCollapsed(true);
  $('#expand-all').onclick = () => setAllCollapsed(false);
  // Show or hide every group on the board at once: each group's eye, for all of them.
  $('#show-all').innerHTML = eye(true);
  $('#hide-all').innerHTML = eye(false);
  $('#show-all').onclick = () => { for (const g of Object.keys(groups)) if (groups[g].folded) setFolded(g, false); };
  $('#hide-all').onclick = () => { for (const g of Object.keys(groups)) if (!groups[g].folded) setFolded(g, true); };
  function toggleCollapsed(g) {
    const c = collapsed();
    c.has(g) ? c.delete(g) : c.add(g);
    localStorage.setItem(collapsedKey(), JSON.stringify([...c]));
    renderList();
  }
  function renderList() {
    const list = $('#list');
    list.innerHTML = '';
    const hidden = order.filter((id) => geo(id)?.hidden).length;
    $('#count').textContent = order.length ? `${order.length}${hidden ? ` · ${hidden} hidden` : ''}` : '';
    $('#empty').hidden = order.some((id) => !geo(id)?.hidden);
    $('#empty').textContent = order.length ? 'Every view is closed. Reopen one with its eye in the list of views.'
      : 'No views yet. Ask the agent in the terminal; its views appear here.';
    $('#filter').hidden = order.length < 8 && !filterText;
    const q = filterText.trim().toLowerCase();
    const match = (id) => !q || [views[id].title, views[id].about, groups[groupOf(id)]?.title, groupOf(id)]
      .some((t) => t && t.toLowerCase().includes(q));
    const gids = Object.keys(groups);
    $('#collapse-all').hidden = $('#expand-all').hidden = $('#show-all').hidden = $('#hide-all').hidden = !gids.length || readonly;
    if (readonly) $('#collapse-all').hidden = $('#expand-all').hidden = !gids.length;
    if (!gids.length) { for (const id of order.filter(match)) list.append(row(id)); return; }
    const staged_ = following() ? new Set(order.filter((id) => stg.roles[id] && stg.roles[id] !== 'hidden').map(groupOf)) : null;
    const shut = collapsed();
    for (const g of [...gids, null]) {
      const ids = order.filter((id) => groupOf(id) === g);
      const shownIds = ids.filter(match);
      if (!ids.length || (q && !shownIds.length)) continue;
      const open = q ? true : staged_ ? staged_.has(g) : !shut.has(g ?? '');
      list.append(header(g, ids, open));
      if (open) for (const id of shownIds) list.append(row(id, g));
    }
  }
  function header(g, ids, open) {
    const li = document.createElement('li');
    li.className = 'group';
    const isFolded = !!(g && groups[g].folded);
    if (isFolded) li.classList.add('off');
    if (g) li.style.setProperty('--gh', hue(g));
    const chev = Object.assign(document.createElement('button'), { className: 'chev', innerHTML: icon(open ? 'open' : 'shut'), title: open ? 'Collapse' : 'Expand' });
    chev.onclick = () => toggleCollapsed(g ?? '');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = g ? groups[g].title : 'Ungrouped';
    name.title = g ? `${groups[g].title}: go to its views` : 'Views without a group';
    name.onclick = () => goToGroup(g, ids);
    const n = ids.filter((id) => !geo(id)?.hidden).length;
    const count = Object.assign(document.createElement('span'), { className: 'n', textContent: `${n}/${ids.length}` });
    li.append(chev, Object.assign(document.createElement('span'), { className: 'dot' }), name, count);
    if (g && groups[g].flow && !readonly) {
      const playing = directed() && stg.scope === g;
      const pb = Object.assign(document.createElement('button'), {
        className: 'play' + (playing ? ' on' : ''), innerHTML: icon(playing ? 'stop' : 'play'),
        title: playing ? 'Stop following; the board is yours' : `Follow this group's flow (${groups[g].flow})`,
      });
      pb.onclick = () => playGroup(playing ? null : g);
      li.append(pb);
    }
    if (g) {
      const btn = document.createElement('button');
      btn.className = 'eye';
      btn.title = isFolded ? 'Unfold: show this group on the board' : 'Fold: hide this group from the board';
      btn.innerHTML = eye(!isFolded);
      btn.onclick = () => setFolded(g, !isFolded);
      li.append(btn);
      if (!readonly) {
        li.draggable = true;
        li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-fluid-group', g); e.dataTransfer.effectAllowed = 'move'; });
      }
    }
    dropTarget(li, g);
    return li;
  }
  function row(id, g) {
    const v = views[id], off = !!geo(id)?.hidden;
    const li = document.createElement('li');
    li.className = (off ? 'off' : '') + (g !== undefined ? ' member' : '');
    const btn = document.createElement('button');
    btn.className = 'eye';
    btn.title = off ? 'Show on the board' : 'Hide from the board';
    btn.innerHTML = eye(!off);
    btn.onclick = () => { if (off && folded(id)) setFolded(groupOf(id), false); setHidden(id, !off); };
    const name = document.createElement('span');
    name.className = 'name';
    name.title = [`${v.title}: go to it`, v.about].filter(Boolean).join('\n');
    if (v.board?.pinned) name.append(Object.assign(document.createElement('span'), { className: 'pin-mark', textContent: '● ' }));
    name.append(v.title);
    name.onclick = () => goTo(id);
    li.append(btn, name);
    if (!readonly) {
      li.draggable = true;
      li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-fluid-view', id); e.dataTransfer.effectAllowed = 'move'; });
      dropTarget(li, g, id);
    }
    return li;
  }
  // Drag to reorder. A view dropped on a row goes before it, into that row's group; dropped on a
  // group's header it moves into that group. A group dropped on another group's header goes before it.
  function dropTarget(li, g, before) {
    if (readonly) return;
    const kind = (e) => e.dataTransfer.types.includes('text/x-fluid-group') ? 'group'
      : e.dataTransfer.types.includes('text/x-fluid-view') ? 'view' : null;
    li.addEventListener('dragover', (e) => {
      const k = kind(e);
      if (!k || (k === 'group' && (before || !g))) return;
      e.preventDefault();
      li.classList.add(k === 'view' && !before ? 'drop' : 'drop-before');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop', 'drop-before'));
    li.addEventListener('drop', (e) => {
      li.classList.remove('drop', 'drop-before');
      const k = kind(e);
      if (k === 'group') {
        const moved = e.dataTransfer.getData('text/x-fluid-group');
        if (!moved || moved === g || !groups[moved]) return;
        e.preventDefault();
        const ids = Object.keys(groups).filter((x) => x !== moved);
        ids.splice(ids.indexOf(g), 0, moved);
        groups = Object.fromEntries(ids.map((x) => [x, groups[x]]));
        renderList();
        post({ type: 'order', groups: ids });
        return;
      }
      const id = e.dataTransfer.getData('text/x-fluid-view');
      if (!id || !views[id] || id === before) return;
      e.preventDefault();
      const target = g === undefined ? groupOf(id) : g;
      if (before) {
        order = order.filter((x) => x !== id);
        order.splice(order.indexOf(before), 0, id);
        post({ type: 'order', views: order });
      }
      if (target !== groupOf(id) && g !== undefined) {
        views[id].group = g;
        if (cards.has(id)) render(id);
        post({ type: 'regroup', view: id, group: g });
      }
      renderList();
    });
  }
  // Follow a group's flow (the server opens its first beat), or stop: the board becomes free again.
  async function playGroup(g) {
    if (full) toggleFull(full.id);
    if (!g && following()) takeOver();
    manualSeq = null;
    await postStage([g ? { type: 'play', group: g } : { type: 'stop' }], 'user');
    loadStage().catch(() => {});
  }
  function setFolded(g, on) {
    if (!groups[g]) return;
    if (directed()) takeOver();
    groups[g].folded = on;
    for (const id of cards.keys()) render(id);
    renderList();
    post({ type: 'fold', group: g, folded: on });
  }
  function goToGroup(g, ids) {
    if (g) setLink('group', g);
    if (g && groups[g].folded) setFolded(g, false);
    let open = ids.filter((id) => views[id]?.board && !geo(id)?.hidden);
    if (!open.length) { for (const id of ids) if (views[id]?.board) setHidden(id, false); open = ids.filter((id) => views[id]?.board); }
    if (!open.length) return;
    cameraMoved();
    if (full) toggleFull(full.id);
    fit(open.map((id) => { const b = views[id].board; return { ...b, w: b.w * sc(b), h: b.h * sc(b) }; }), 60);
  }
  $('#filter').addEventListener('input', (e) => { filterText = e.target.value; renderList(); });
  function goTo(id) {
    if (!views[id]?.board) return;
    setLink('view', id);
    if (folded(id)) setFolded(groupOf(id), false);
    opened.set(id, Date.now());
    cameraMoved();
    const b = views[id].board;
    if (full && full.id !== id) toggleFull(full.id);
    if (b.hidden) setHidden(id, false);
    if (!full) fit([b], 60);
    front(id);
    const el = cards.get(id)?.el;
    el?.classList.add('flash');
    setTimeout(() => el?.classList.remove('flash'), 900);
  }
  const side = $('#side');
  const setSide = (open) => {
    side.classList.toggle('collapsed', !open);
    $('#side-toggle').textContent = open ? '›' : '‹';
    $('#side-toggle').title = open ? 'Collapse' : 'Show the list of views';
    localStorage.setItem('fluid.side', open ? '1' : '0');
  };
  $('#side-toggle').onclick = () => setSide(side.classList.contains('collapsed'));
  const sidePref = localStorage.getItem('fluid.side');
  side.classList.add('resizing');  // no slide on load: the first fit needs the stage's final width
  setSide(sidePref ? sidePref !== '0' : window.innerWidth >= 700);  // a phone starts with the board, not the list
  requestAnimationFrame(() => side.classList.remove('resizing'));

  // Dragging the sidebar's left edge resizes it; the width is kept, and a double-click restores the default.
  const SIDE_W = 230, SIDE_MIN = 180;
  const setSideWidth = (w) => {
    w = Math.round(Math.max(SIDE_MIN, Math.min(w, Math.max(SIDE_MIN, window.innerWidth * 0.6))));
    side.style.setProperty('--side-w', `${w}px`);
    return w;
  };
  setSideWidth(Number(localStorage.getItem('fluid.sideWidth')) || SIDE_W);
  const sideGrip = $('#side-grip');
  sideGrip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    sideGrip.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, w: side.offsetWidth };
    let w = start.w;
    side.classList.add('resizing');
    interacting(true);
    const move = (m) => { w = setSideWidth(start.w + start.x - m.clientX); };
    const up = () => {
      side.classList.remove('resizing');
      interacting(false);
      sideGrip.removeEventListener('pointermove', move);
      sideGrip.removeEventListener('pointerup', up);
      sideGrip.removeEventListener('pointercancel', up);
      if (w !== start.w) localStorage.setItem('fluid.sideWidth', String(w));
    };
    sideGrip.addEventListener('pointermove', move);
    sideGrip.addEventListener('pointerup', up);
    sideGrip.addEventListener('pointercancel', up);
  });
  sideGrip.addEventListener('dblclick', () => { localStorage.removeItem('fluid.sideWidth'); setSideWidth(SIDE_W); });

  // ---- point and talk -------------------------------------------------------------------
  // Alt+click in a view records a "point" at once, so talking about "this" in the terminal works
  // as before, and opens a comment box beside the element. Enter records a "comment" carrying the
  // same description plus the user's words; Esc or a click elsewhere closes the box unsent.
  let toastTimer = null;
  // Export: the interactive page, a static copy of the open views that any web host can serve. It
  // stays in .fluid/exports/ and opens in a new tab.
  async function exportPage(button) {
    if (button.disabled) return;
    button.disabled = true;
    button.dataset.tip = 'exporting…';
    button.classList.add('busy');
    const tab = window.open('', '_blank');  // now, while the click still counts
    try {
      const r = await send('/export', {});
      if (!r.ok) throw new Error(await r.text());
      const out = await r.json();
      if (tab) tab.location = out.url;
      toast(`Exported ${out.dir}/ (${out.views.length} views)`);
    } catch (err) {
      tab?.close();
      toast(`Export failed: ${err.message}`);
    } finally {
      button.disabled = false;
      button.dataset.tip = 'export';
      button.classList.remove('busy');
    }
  }
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  const box = $('#comment'), boxText = box.querySelector('textarea');
  let commenting = null;   // {view, target, what} while the box is open
  const label = (t) => t.attrs?.['data-title'] || t.attrs?.['data-key'] || t.text?.slice(0, 50) || t.path || 'element';
  const unpointAll = () => { for (const c of cards.values()) c.iframe.contentWindow?.postMessage({ fluid: 'unpoint' }, location.origin); };

  function openComment(id, target, rect) {
    // The element's frame coordinates, scaled by the zoom, give its place on the stage.
    const f = cards.get(id)?.iframe.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!f) return;
    commenting = { view: id, target, what: label(target) };
    box.querySelector('.what').textContent = `Comment on “${commenting.what}” in ${views[id].title}`;
    boxText.value = '';
    box.hidden = false;
    const r = rect || { left: 0, top: 0, width: 0, height: 0 };
    const k = vp.zoom * sc(geo(id));
    const left = f.left - s.left + r.left * k;
    const top = f.top - s.top + r.top * k, bottom = top + r.height * k;
    const w = box.offsetWidth, h = box.offsetHeight;
    let y = bottom + 6;
    if (y + h > s.height - 8) y = top - h - 6;               // no room below: open above
    y = Math.min(Math.max(8, y), s.height - h - 8);
    box.style.left = `${Math.min(Math.max(8, left), s.width - w - 8)}px`;
    box.style.top = `${y}px`;
    boxText.focus({ preventScroll: true });
  }
  function closeComment() {
    if (!commenting) return;
    commenting = null;
    box.hidden = true;
    boxText.blur();
  }
  function sendComment() {
    const text = boxText.value.trim();
    const c = commenting;
    closeComment();
    if (!c || !text) return;
    post({ type: 'comment', view: c.view, ...c.target, comment: text });
    toast(`Comment on “${c.what}” sent to the agent.`);
  }
  boxText.addEventListener('keydown', (e) => {
    e.stopPropagation();  // keep Esc from leaving fullscreen
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendComment(); }
    if (e.key === 'Escape') { e.preventDefault(); closeComment(); unpointAll(); }
  });
  boxText.addEventListener('input', () => { boxText.style.height = 'auto'; boxText.style.height = `${boxText.scrollHeight + 2}px`; });
  document.addEventListener('pointerdown', (e) => { if (commenting && !box.contains(e.target)) closeComment(); }, true);
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.fluid !== true || !views[e.data.view]) return;
    const id = e.data.view;
    if (e.data.type === 'clock') { ticking[id] = Date.now(); mediaClock(id, e.data); }
    if (e.data.type === 'clock') return onClock(String(e.data.name || 'video'), Number(e.data.t));
    if (e.data.type === 'cue-ready') return manual() ? undefined : deliver(id);
    activity();
    if (e.data.type === 'press') { closeComment(); front(id); }
    if (e.data.type === 'escape' && full) toggleFull(full.id);
    if (e.data.type === 'pan' && !full) panBy(e.data.dx, e.data.dy);
    if (e.data.type === 'zoom' && !full) {
      // The frame's own coordinates, scaled by the zoom, give the point on the stage.
      const f = cards.get(id)?.iframe.getBoundingClientRect(), s = stage.getBoundingClientRect();
      if (!f) return;
      const factor = e.data.factor ?? Math.exp(-e.data.dy * 0.01);
      const k = vp.zoom * sc(geo(id));
      zoomAt(factor, f.left - s.left + e.data.x * k, f.top - s.top + e.data.y * k);
    }
    if (e.data.type === 'point' && !readonly) {
      const t = e.data.target || {};
      post({ type: 'point', view: id, ...t });
      for (const [other, c] of cards) if (other !== id) c.iframe.contentWindow?.postMessage({ fluid: 'unpoint' }, location.origin);
      $('#toast').hidden = true;
      openComment(id, t, e.data.rect);
    }
  });

  // ---- timestamped notes ------------------------------------------------------------------
  // A view that plays media publishes a clock (fl-youtube, fl-audio); its card then gets a notes
  // strip under the page and keeps it (this browser remembers which views had one). A note takes
  // the clock's time on its first keystroke, or a time typed into the time box; Enter saves it,
  // Esc clears it. The list's times play the media from there. The file is the view's meta.json
  // "notes" path, else the one the server picks (state's views[id].notes; null: the view opted
  // out). Every change reads the file fresh and touches only its own line (notes.js), and goes
  // through POST /files, so the agent hears of it with the next prompt. In a published copy the
  // notes stay in the visitor's browser, as a view's writes do. A live share shows no strip.
  const NT = window.FluidNotes;
  const media = {};        // id -> {clock, link, title, t}: the last clock the view published
  const pendingSeek = {};  // id -> a seek for a page that is not running yet
  const mediaKey = () => `fluid.media:${project}`;
  const notesOn = (id) => !!views[id]?.notes && (STATIC || !readonly);
  const enc = (path) => String(path).split('/').map(encodeURIComponent).join('/');
  // A published copy keeps the canvas's own files (.fluid/...) in canvas/, the project's in files/.
  const notesUrl = (path) => !STATIC ? `/files/${enc(path)}` : path.startsWith('.fluid/') ? `canvas/${enc(path.slice(7))}` : `files/${enc(path)}`;
  const savedKey = (path) => `fluid.file:${new URL('./', location.href).pathname}${enc(path)}`;  // as fluid.js keeps a copy's writes
  function restoreMedia() {
    try { Object.assign(media, JSON.parse(localStorage.getItem(mediaKey()) || '{}')); } catch { /* none kept */ }
    for (const m of Object.values(media)) m.t = null;
  }
  function saveMedia() {
    const keep = Object.fromEntries(Object.entries(media).map(([id, m]) => [id, { clock: m.clock, link: m.link, title: m.title }]));
    try { localStorage.setItem(mediaKey(), JSON.stringify(keep)); } catch { /* private mode */ }
  }
  async function readNotes(path) {
    if (STATIC) { try { const v = localStorage.getItem(savedKey(path)); if (v != null) return v; } catch { /* none */ } }
    const r = await fetch(notesUrl(path), { cache: 'no-store' });
    if (r.status === 404) return '';
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.text();
  }
  async function writeNotes(path, text, id) {
    if (STATIC) { localStorage.setItem(savedKey(path), text); return; }
    const r = await fetch('/files/' + enc(path), { method: 'POST', body: text,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Fluid': '1', 'X-Fluid-View': id } });
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
  }
  const chains = {};  // one change at a time per file
  const queue = (path, fn) => (chains[path] = (chains[path] || Promise.resolve()).catch(() => {}).then(fn));

  // The view's page stopped (asleep, reloading): its clock is stale until it ticks again.
  function pageGone(id) {
    const c = cards.get(id);
    if (c) c.live = false;
    if (media[id]) media[id].t = null;
    renderChip(id);
  }
  function mediaClock(id, d) {
    const c = cards.get(id);
    if (!c) return;
    c.live = true;
    if (pendingSeek[id]) { c.iframe.contentWindow?.postMessage(pendingSeek[id], location.origin); delete pendingSeek[id]; }
    const m = media[id], name = String(d.name || 'video'), t = Number(d.t);
    const next = { clock: name, link: d.link || (m?.clock === name ? m.link : '') || '', title: d.title || m?.title || '',
                   t: Number.isFinite(t) ? t : null };
    media[id] = next;
    if (!m || m.clock !== next.clock || m.link !== next.link || m.title !== next.title) saveMedia();
    syncStrip(id);
    renderChip(id);
  }
  // Ask the view's media to seek or pause. A page that is not running gets the seek once it ticks.
  function control(id, type, t) {
    const c = cards.get(id), m = media[id];
    if (!c || !m) return;
    const msg = { fluid: type, clock: m.clock, ...(type === 'seek' ? { t } : {}) };
    if (c.awake && c.live) return c.iframe.contentWindow?.postMessage(msg, location.origin);
    if (type !== 'seek') return;
    pendingSeek[id] = msg;
    opened.set(id, Date.now());  // a phone runs a view once the user opens it
    sleepCheck();
  }

  function syncStrip(id) {
    const c = cards.get(id);
    if (!c) return;
    const want = notesOn(id) && !!media[id];
    if (!want) { c.notes?.el.remove(); c.notes = null; return; }
    if (c.notes) {
      if (c.notes.path !== views[id].notes) { c.notes.path = views[id].notes; refreshNotes(id); }
      return;
    }
    const el = document.createElement('div');
    el.className = 'notes';
    el.innerHTML = '<ul class="nlist" hidden></ul><div class="nbar"><button type="button" class="ntoggle"></button>'
      + '<input class="nchip" value="--:--" spellcheck="false" autocomplete="off" aria-label="Time of the next note; type mm:ss to change it" title="The note\'s time: live until you type a note; click to type one (mm:ss)">'
      + '<input class="ninput" type="text" autocomplete="off" placeholder="Note at this moment · Enter saves · Esc clears" aria-label="Note">'
      + '<label class="npause" title="Pause the media when you start typing a note"><input type="checkbox">pause</label></div>';
    c.el.insertBefore(el, c.el.querySelector('.grip'));
    const n = c.notes = {
      el, list: el.querySelector('.nlist'), toggle: el.querySelector('.ntoggle'), chip: el.querySelector('.nchip'),
      input: el.querySelector('.ninput'), pause: el.querySelector('.npause input'),
      path: views[id].notes, items: [], loaded: false, open: false, draft: { sec: null, manual: false },
    };
    try { n.pause.checked = localStorage.getItem('fluid.notes.pause') === '1'; } catch { /* default off */ }
    n.pause.onchange = () => { try { localStorage.setItem('fluid.notes.pause', n.pause.checked ? '1' : '0'); } catch { /* this page only */ } };
    el.addEventListener('pointerdown', () => front(id));
    el.addEventListener('keydown', (e) => e.stopPropagation());  // keep Esc from leaving fullscreen
    n.list.addEventListener('wheel', (e) => {  // scroll the list, not the board
      if (!e.ctrlKey && !e.metaKey && n.list.scrollHeight > n.list.clientHeight) e.stopPropagation();
    }, { passive: true });
    n.toggle.onclick = () => { n.open = !n.open; renderNotes(id); if (n.open) refreshNotes(id); };
    // The time box: live while the note is empty, frozen on its first keystroke, or typed by hand.
    const commitChip = () => {
      if (!n.chip.dataset.dirty) return;
      n.chip.dataset.dirty = '';
      const sec = NT.parseTime(n.chip.value);
      if (sec == null) return toast('Time not read: type mm:ss or h:mm:ss.');
      n.draft = { sec, manual: true };
    };
    n.chip.addEventListener('focus', () => n.chip.select());
    n.chip.addEventListener('input', () => { n.chip.dataset.dirty = '1'; });
    n.chip.addEventListener('blur', () => { commitChip(); renderChip(id); });
    n.chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitChip(); n.input.focus(); }
      if (e.key === 'Escape') { e.preventDefault(); n.chip.dataset.dirty = ''; n.input.focus(); }
    });
    n.input.addEventListener('focus', () => { if (!n.loaded) refreshNotes(id); });
    n.input.addEventListener('input', () => {
      if (!n.input.value) { if (!n.draft.manual) n.draft.sec = null; }
      else if (n.draft.sec == null && media[id]?.t != null) {
        n.draft.sec = Math.floor(media[id].t);
        if (n.pause.checked) control(id, 'pause');
      }
      renderChip(id);
    });
    n.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveNote(id); }
      if (e.key === 'Escape') { e.preventDefault(); n.input.value = ''; n.draft = { sec: null, manual: false }; renderChip(id); }
    });
    renderNotes(id);
    renderChip(id);
    refreshNotes(id);
  }
  function renderChip(id) {
    const c = cards.get(id), n = c?.notes;
    if (!n || document.activeElement === n.chip) return;
    const t = c.live ? media[id]?.t : null;
    const live = n.draft.sec == null && !n.input.value && t != null;
    n.chip.value = n.draft.sec != null ? NT.fmt(n.draft.sec) : live ? NT.fmt(t) : '--:--';
    n.chip.classList.toggle('live', live);
  }
  function renderNotes(id) {
    const n = cards.get(id)?.notes;
    if (!n) return;
    const count = n.loaded ? `${n.items.length} ${n.items.length === 1 ? 'note' : 'notes'}` : 'notes';
    n.toggle.innerHTML = `${icon(n.open ? 'open' : 'shut')}<span>${count}</span>`;
    n.toggle.title = `${n.open ? 'Hide' : 'Show'} the notes (${n.path})`;
    n.el.classList.toggle('open', n.open);
    n.list.hidden = !n.open;
    if (!n.open) return;
    const rows = [...n.items].sort((a, b) => a.sec - b.sec || a.line - b.line).map((item) => {
      const li = document.createElement('li');
      li.dataset.item = 'note';
      li.dataset.id = String(item.sec);
      const ts = Object.assign(document.createElement('button'), { type: 'button', className: 'nts', textContent: NT.fmt(item.sec), title: 'Play from here' });
      ts.onclick = () => control(id, 'seek', item.sec);
      const text = Object.assign(document.createElement('span'), { className: 'ntext', textContent: item.text });
      if (item.children) text.title = `${item.children} more ${item.children === 1 ? 'line' : 'lines'} under it in the file`;
      const del = Object.assign(document.createElement('button'), { type: 'button', className: 'ndel', textContent: '×', title: 'Delete this note' });
      del.setAttribute('aria-label', 'Delete this note');
      del.onclick = () => deleteNote(id, item);
      li.append(ts, text, del);
      return li;
    });
    if (!rows.length) rows.push(Object.assign(document.createElement('li'), { className: 'nempty',
      textContent: n.loaded ? 'No notes yet. Type one below: it takes the time when you start.' : 'Reading…' }));
    rows.push(Object.assign(document.createElement('li'), { className: 'npath', textContent: n.path }));
    n.list.replaceChildren(...rows);
  }
  function setNotes(id, text) {
    const n = cards.get(id)?.notes;
    if (!n) return;
    n.items = NT.parse(text);
    n.loaded = true;
    renderNotes(id);
  }
  async function refreshNotes(id) {
    const n = cards.get(id)?.notes;
    if (!n) return;
    const path = n.path;
    try {
      const text = await readNotes(path);
      if (cards.get(id)?.notes === n && n.path === path) setNotes(id, text);
    } catch (err) { if (n.open) toast(`Notes not read (${path}): ${err.message}`); }
  }
  function saveNote(id) {
    const n = cards.get(id)?.notes;
    const text = n && NT.clean(n.input.value);
    if (!text) return;
    if (n.draft.sec == null) { toast('No time yet: type one in the time box (mm:ss).'); n.chip.focus(); return; }
    const sec = n.draft.sec, path = n.path;
    const note = { sec, text, link: NT.link(media[id]?.link, sec) };
    n.input.value = '';
    n.draft = { sec: null, manual: false };
    renderChip(id);
    queue(path, async () => {
      const next = NT.insert(await readNotes(path), note, `# ${views[id]?.title || id} · notes`);
      await writeNotes(path, next, id);
      if (n.path === path) setNotes(id, next);
      n.toggle.classList.add('saved');
      setTimeout(() => n.toggle.classList.remove('saved'), 900);
    }).catch((err) => {
      if (!n.input.value) { n.input.value = text; n.draft = { sec, manual: true }; renderChip(id); }
      toast(`Note not saved: ${err.message}`);
    });
  }
  function deleteNote(id, item) {
    const n = cards.get(id)?.notes;
    if (!n) return;
    const path = n.path;
    queue(path, async () => {
      const r = NT.remove(await readNotes(path), item.raw, item.line);
      if (r.removed) await writeNotes(path, r.text, id);
      else toast('That note changed in the file; nothing deleted.');
      if (n.path === path) setNotes(id, r.text);
    }).catch((err) => toast(`Note not deleted: ${err.message}`));
  }
  // An open list follows the file, which the agent may write too.
  setInterval(() => {
    if (document.hidden) return;
    for (const [id, c] of cards) if (c.notes?.open && inView(id)) refreshNotes(id);
  }, 5000);

  // ---- sync with the server -------------------------------------------------------------
  let loading = null, again = null;
  async function load(changed = []) {
    if (loading) { again = [...(again || []), ...changed]; return; }
    loading = true;
    try {
      const s = await (await fetch(source('state'))).json();
      const first = !project;
      if (!first && s.version && s.version !== version) { location.reload(); return; }  // the server moved to a newer plugin
      if (first) {
        version = s.version;
        project = s.project;
        readonly = !!s.readonly;
        document.body.classList.toggle('readonly', readonly);
        $('#project').textContent = s.name;
        $('#project').title = s.project;
        document.title = STATIC ? s.name : `Fluid · ${s.name}`;
        restoreMedia();
        const saved = JSON.parse(localStorage.getItem(`fluid.viewport:${project}`) || 'null');
        if (saved) { vp = saved; applyViewport(); }
      }
      groups = s.groups || {};
      const before = new Set(Object.keys(views));
      for (const id of Object.keys(views)) {
        if (!(id in s.views)) {
          cards.get(id)?.el.remove();
          cards.delete(id);
          delete views[id];
          if (full?.id === id) { full = null; document.body.classList.remove('full'); }
        }
      }
      for (const [id, v] of Object.entries(s.views)) {
        const old = views[id];
        const keep = busy === id || placing.has(id) || arranging;
        views[id] = { ...v, board: keep || (!v.board && old?.board) ? old.board : v.board };
        if (!cards.has(id)) createCard(id);
        if (!views[id].board) place(id);
        render(id);
        syncStrip(id);
      }
      order = s.order;
      for (const id of changed) {
        if (before.has(id) && cards.has(id)) reloadView(id);
      }
      renderList();
      if (first && !localStorage.getItem(`fluid.viewport:${project}`)) fit(shown());
      applyViewport();
      if (first) { await loadStage(true); await loadFlow(); openLink(); }
      else if (following()) relayout(true);
    } catch { /* the server is gone; /events reconnects and calls load again */ }
    loading = null;
    if (again) { const c = again; again = null; load(c); }
  }

  // ---- the stage: layout, camera, follow and manual ---------------------------------------
  let stagingTimer = null;
  function relayout(animate) {
    if (!following()) { staged = null; return; }
    const was = new Set(Object.keys(views).filter((id) => geo(id)?.hidden));
    const list = order.filter((id) => views[id]?.board && !views[id].board.pinned && inScope(id))
      .map((id) => ({ id, role: stg.roles[id] || 'hidden', w: views[id].size?.w, h: views[id].size?.h }));
    const next = S.layout({ views: list, width: stage.clientWidth, height: stage.clientHeight });
    const o = stg.origin || { x: 0, y: 0 };
    for (const r of Object.values(next.rects)) if (r) { r.x += o.x; r.y += o.y; }
    if (animate && JSON.stringify(next) !== JSON.stringify(staged)) {
      document.body.classList.add('staging');
      clearTimeout(stagingTimer);
      stagingTimer = setTimeout(() => document.body.classList.remove('staging'), 450);
    }
    staged = next;
    for (const id of cards.keys()) {
      render(id);
      if (animate && was.has(id) && !geo(id)?.hidden) {
        const el = cards.get(id).el;
        el.classList.remove('enter');
        void el.offsetWidth;  // restart the fade
        el.classList.add('enter');
      }
    }
    renderList();
    renderFollow();
    aim();
  }
  function aim() {
    if (!following() || !staged || full) return;
    const r = stg.camera && staged.rects[stg.camera];
    const o = stg.origin || { x: 0, y: 0 };
    vp = r ? S.cameraOn(r, stage.clientWidth, stage.clientHeight) : { x: -o.x * staged.zoom, y: -o.y * staged.zoom, zoom: staged.zoom };
    applyViewport();
  }
  // The user navigates: what they see becomes the board's free layout, and the stage stops applying.
  function takeOver() {
    if (!following()) return;
    const geoms = {};
    for (const id of Object.keys(views)) {
      const g = geo(id);
      if (!g || views[id].board.pinned || !inScope(id)) continue;  // other groups keep their own layout
      geoms[id] = { x: g.x, y: g.y, w: g.w, h: g.h, s: sc(g), hidden: !!g.hidden };
      views[id].board = { ...views[id].board, ...geoms[id] };
    }
    manualSeq = Infinity;
    staged = null;
    if (Object.keys(geoms).length) { arranging = true; post({ type: 'arrange', views: geoms }).finally(() => { arranging = false; }); }
    postStage([{ type: 'manual' }], 'user').then((r) => { if (manualSeq === Infinity) manualSeq = r?.stage?.seq ?? null; });
    for (const id of cards.keys()) render(id);
    renderFollow();
  }
  // Pan or zoom by the user: take over at once, and log one canvas.camera when the gesture settles.
  let cameraTimer = null;
  function cameraMoved() {
    if (!directed()) return;
    takeOver();
    clearTimeout(cameraTimer);
    cameraTimer = setTimeout(() => {
      const cx = (stage.clientWidth / 2 - vp.x) / vp.zoom, cy = (stage.clientHeight / 2 - vp.y) / vp.zoom;
      const under = Object.keys(views).find((id) => {
        const g = geo(id);
        return g && !g.hidden && cx >= g.x && cx <= g.x + g.w * sc(g) && cy >= g.y && cy <= g.y + g.h * sc(g);
      });
      emit('canvas.camera', { zoom: Math.round(vp.zoom * 100) / 100, ...(under ? { view: under } : {}) });
    }, 800);
  }
  // The group the user is looking at: the one whose views cover the most of the screen.
  function groupInView() {
    const W = stage.clientWidth, H = stage.clientHeight, area = {};
    for (const id of Object.keys(views)) {
      const g = groupOf(id), r = geo(id);
      if (!g || !r || r.hidden) continue;
      const x = r.x * vp.zoom + vp.x, y = r.y * vp.zoom + vp.y, w = r.w * sc(r) * vp.zoom, h = r.h * sc(r) * vp.zoom;
      const a = Math.max(0, Math.min(W, x + w) - Math.max(0, x)) * Math.max(0, Math.min(H, y + h) - Math.max(0, y));
      area[g] = (area[g] || 0) + a;
    }
    const best = Object.entries(area).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : null;
  }
  // Follow: the flow of the group in view, when it has one and is not the one playing; else back
  // to the stage's flow.
  const followTarget = () => {
    const g = groupInView();
    return g && groups[g]?.flow && !readonly && !(directed() && stg.scope === g) ? g : null;
  };
  function renderFollow() {
    const btn = $('#follow');
    const g = following() ? null : followTarget();
    btn.hidden = !manual() && !g;
    document.body.classList.toggle('following', following());
    const what = stg.scope ? (groups[stg.scope]?.title || stg.scope) : 'the stage';
    btn.textContent = g ? `Follow ${groups[g].short || groups[g].title}` : 'Follow';
    btn.title = g ? `Follow the flow of ${groups[g].title}`
      : stg.beat ? `Back to ${what} (now: ${stg.beat})` : `Back to ${what}`;
  }
  $('#follow').addEventListener('click', () => {
    const g = followTarget();
    if (g) return playGroup(g);
    if (full) toggleFull(full.id);
    closeComment();
    manualSeq = null;
    stg = { ...stg, mode: 'follow' };
    relayout(true);
    for (const v of Object.keys(lastCue)) deliver(v);
    renderFollow();
    postStage([{ type: 'follow' }], 'user');
  });

  async function loadStage(first = false) {
    const s = await (await fetch(source('stage'))).json();
    const wasFollowing = following();
    const flowPath = stg.flow;
    stg = s;
    if (manualSeq != null && manualSeq !== Infinity && s.seq >= manualSeq) manualSeq = null;
    if (!first && s.flow !== flowPath) loadFlow();
    if (beatPosted === s.beat) beatPosted = null;
    for (const [view, c] of Object.entries(s.cues || {})) {
      if (c && seenCue[view] !== c.seq) { seenCue[view] = c.seq; sendCue(view, c.msg || {}); }
    }
    if (following()) relayout(!first);
    else if (wasFollowing || staged) { staged = null; for (const id of cards.keys()) render(id); }
    renderList();  // the playing group's button
    renderFollow();
  }
  async function loadFlow() {
    try { flow = await (await fetch(source('flow'))).json(); } catch { flow = { beats: [] }; }
    if (!Array.isArray(flow.beats)) flow.beats = [];
    for (const k of Object.keys(armed)) delete armed[k];
    for (const [name, t] of Object.entries(clockAt)) onClock(name, t);
  }

  // ---- cues and the clock -----------------------------------------------------------------
  // A cue is a message for a view, {fluid: 'cue', ...msg}. lastCue holds what each view should
  // show now; in manual it is kept, not sent, and Follow sends it.
  const lastCue = {}, seenCue = {}, armed = {}, clockAt = {};
  let beatPosted = null;
  function deliver(view) {
    const m = lastCue[view], w = cards.get(view)?.iframe.contentWindow;
    if (m && w) w.postMessage({ ...m, fluid: 'cue' }, location.origin);
  }
  function sendCue(view, msg) {
    lastCue[view] = msg;
    if (!manual()) deliver(view);
  }
  // A view published its clock: start the beat whose anchor holds this time (the server applies its
  // stage), and send each view the latest time cue it has reached. No model call, so cues land on time.
  function onClock(name, t) {
    if (!Number.isFinite(t)) return;
    clockAt[name] = t;
    if (!flow.beats.length) return;
    const beat = S.activeBeat(flow.beats, name, t);
    if (beat && beat.id !== stg.beat && beat.id !== beatPosted) {
      beatPosted = beat.id;
      postStage([{ type: 'beat', id: beat.id, clock: name, at: Math.round(t) }], 'board');
    }
    for (const [view, c] of Object.entries(S.cuesAt(flow.beats, name, t))) {
      if (armed[view] !== c.key) { armed[view] = c.key; sendCue(view, c.msg); }
    }
  }

  // ---- idle -------------------------------------------------------------------------------
  // One user.idle per idle stretch while a stage runs: no input on the board or in a view for a minute.
  const IDLE_MS = 60000;
  let lastInput = Date.now(), idleSent = false;
  function activity() { lastInput = Date.now(); idleSent = false; }
  for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown']) window.addEventListener(type, activity, { capture: true, passive: true });
  setInterval(() => {
    if (!directed() || idleSent || Date.now() - lastInput < IDLE_MS) return;
    idleSent = true;
    emit('user.idle', { seconds: Math.round((Date.now() - lastInput) / 1000), mode: manual() ? 'manual' : 'follow', beat: stg.beat });
  }, 5000);

  if (STATIC) load();
  else {
    const events = new EventSource('/events');
    events.onopen = () => { $('#dot').classList.add('on'); $('#dot').title = 'Connected'; load(); };
    events.onerror = () => { $('#dot').classList.remove('on'); $('#dot').title = 'Disconnected: is serve.py running?'; };
    events.onmessage = (e) => {
      let d = {};
      try { d = JSON.parse(e.data); } catch { /* reload everything */ }
      if (d.stage) loadStage().catch(() => {});
      if (d.flow) loadFlow();
      if (!d.stage && !d.flow || d.views?.length || d.board) load(d.views || []);
    };
  }
  applyViewport();
})();
