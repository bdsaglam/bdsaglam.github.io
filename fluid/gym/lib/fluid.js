/**
 * fluid: the bridge from a view to the project's files and the agent, over plain HTTP to the
 * canvas server. Load it with <script src="/lib/fluid.js"></script> (components load it themselves).
 *
 *   fluid.readFile(path)         -> Promise<string>       UTF-8 text, up to 5 MB
 *   fluid.writeFile(path, text)  -> Promise<void>         the agent hears about it on the next prompt
 *   fluid.listFiles(dir = "")    -> Promise<{name, type: "file"|"dir", size, mtime}[]>
 *   fluid.fileBytes(path)        -> Promise<ArrayBuffer>  binary read (PDFs), up to 5 MB
 *   fluid.fileUrl(path)          -> string                URL for <img src>, read-only
 *   fluid.send(text)             -> Promise<void>         a note to the agent from this view
 *   fluid.action({type, ...})    -> Promise<void>         a canvas action from this view ("video": playback position)
 *   fluid.emit(kind, data = {})  -> Promise<void>         a semantic event for the session log, e.g.
 *                                                         fluid.emit('view.step', {step: 'split'})
 *   fluid.clock(seconds, name = "video")                  publish a clock the stage times its flow by;
 *                                                         call it as often as you like (it is throttled)
 *   fluid.onCue(fn)              -> () => void            fn(msg) runs for each cue the stage sends
 *                                                         this view, e.g. {step: 'split'}; returns unsubscribe
 *   fluid.connected              -> Promise<void>         resolved at once (kept for old components)
 *
 * Paths are relative to the project folder. The server refuses paths outside it, .git/, and
 * writes into a pinned view's folder. Errors reject with the server's message, e.g. "not found: x".
 *
 * In a published copy (publish.py) there is no server: reads come from the files published with
 * the canvas, writes stay in this browser (localStorage), and send, action, and emit do nothing.
 *
 * Cues arrive as window messages {fluid: 'cue', ...msg} from the board, and also as a
 * "fluid:cue" event on window (detail: msg). A view that ignores them still works.
 */
(() => {
  if (window.fluid) return;
  const STATIC = true;  // publish.py turns this on in a published copy
  // The canvas's root: this file is <root>/lib/fluid.js, served at / or, when published, in a folder.
  const ROOT = new URL('../', document.currentScript?.src || new URL('/lib/fluid.js', location.href)).href;
  const view = (location.pathname.match(/\/views\/([^/]+)\/[^/]*$/) || [])[1] || '';
  const clean = (path) => {
    const parts = String(path ?? '').split('/').filter((s) => s && s !== '.');
    if (parts.includes('..')) throw new Error(`path may not contain "..": ${path}`);
    return parts.map(encodeURIComponent).join('/');
  };
  const req = async (url, opts = {}) => {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r;
  };
  const post = (url, body, type) => STATIC ? Promise.resolve() : req(url, {
    method: 'POST', body, headers: { 'Content-Type': type, 'X-Fluid': '1', 'X-Fluid-View': view },
  });
  // A published copy keeps the canvas's own files (.fluid/...) in canvas/, the project's in files/.
  const fileUrl = (path) => {
    const p = clean(path);
    return ROOT + (STATIC && p.startsWith('.fluid/') ? 'canvas/' + p.slice(7) : 'files/' + p);
  };
  const saved = (path) => `fluid.file:${new URL(ROOT).pathname}${clean(path)}`;  // a write in a published copy
  const local = (path) => { try { return STATIC ? localStorage.getItem(saved(path)) : null; } catch { return null; } };

  const tell = (msg) => { if (window.parent !== window) window.parent.postMessage({ fluid: true, view, ...msg }, location.origin); };
  // Clock ticks go to the board only (never to the server), at most every 250 ms, and at once
  // after a jump of more than a second (a seek), so time cues land on time.
  const clocks = {};
  const clock = (seconds, name = 'video') => {
    const t = Number(seconds);
    if (!Number.isFinite(t)) return;
    const c = clocks[name] ??= { at: 0, timer: null, t: null, last: null };
    c.t = t;
    const now = performance.now();
    const jumped = c.last == null || Math.abs(t - c.last) > 1 + (now - c.at) / 1000;
    const send = () => { c.timer = null; c.at = performance.now(); c.last = c.t; tell({ type: 'clock', name, t: c.t }); };
    if (jumped || now - c.at >= 250) { clearTimeout(c.timer); send(); }
    else c.timer ??= setTimeout(send, 250 - (now - c.at));
  };
  const cueFns = new Set();
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== window.parent || e.data?.fluid !== 'cue') return;
    const { fluid: _f, ...msg } = e.data;
    for (const fn of cueFns) { try { fn(msg); } catch (err) { console.error(err); } }
    window.dispatchEvent(new CustomEvent('fluid:cue', { detail: msg }));
  });

  window.fluid = {
    connected: Promise.resolve(),
    view,
    readFile: async (path) => local(path) ?? (await req(fileUrl(path))).text(),
    fileBytes: async (path) => (await req(fileUrl(path))).arrayBuffer(),
    writeFile: async (path, text) => {
      if (STATIC) localStorage.setItem(saved(path), String(text));
      else await post(ROOT + 'files/' + clean(path), String(text), 'text/plain; charset=utf-8');
    },
    listFiles: async (dir = '') => {
      if (!STATIC) return (await req(ROOT + 'list/' + clean(dir))).json();
      // files.json lists the published files: [{path, size, mtime}]; show one folder's level of it.
      const d = String(dir ?? '').split('/').filter((x) => x && x !== '.').join('/');
      const pre = d ? d + '/' : '', out = new Map();
      for (const f of await (await req(ROOT + 'files.json')).json()) {
        if (!f.path.startsWith(pre)) continue;
        const [name, ...rest] = f.path.slice(pre.length).split('/');
        if (!out.has(name)) out.set(name, rest.length ? { name, type: 'dir', size: 0, mtime: f.mtime } : { name, type: 'file', size: f.size, mtime: f.mtime });
      }
      return [...out.values()];
    },
    fileUrl,
    action: async (a) => {
      await post(ROOT + 'action', JSON.stringify({ ...a, view }), 'application/json');
    },
    emit: async (kind, data = {}) => {
      await post(ROOT + 'emit', JSON.stringify({ kind, data }), 'application/json');
    },
    clock,
    onCue: (fn) => {
      cueFns.add(fn);
      tell({ type: 'cue-ready' });  // the board replies with this view's current cue, if any
      return () => cueFns.delete(fn);
    },
    send: async (text) => {
      await post(ROOT + 'action', JSON.stringify({ type: 'note', view: view || null, text: String(text) }), 'application/json');
    },
  };
})();
