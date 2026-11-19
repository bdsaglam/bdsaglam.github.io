/*
fl-proof-steps: a proof revealed one line at a time, the reader naming each move first.

It shows what is to be shown and the starting facts. For the next hidden line it offers three move
chips (the right move and two others from the fixed list) and a "Show the step" button. A pick
reveals the line, says whether the pick was right ("Right: Rearrange" / "This step: Rearrange"), and
gives the reason. Lines turn compact once the next one is revealed; click a compact line to read its
reason again. After the last line: "Proved", the moves this proof used (or, on a primer's last
proof, every move the primer used: see primerMoves), and the look-back questions; "Show" opens one
answer at a time and turns the proof lines compact, so the whole fits.

Light DOM (no shadow root), so the hosting view's KaTeX auto-render works inside it: the component
calls window.renderMathInElement on what it adds, with $...$ delimiters. Load KaTeX and auto-render
in the page first. Text fields take $...$ math; `tex` fields are bare TeX (no dollars).

Data: the `data` property, or a JSON `data` attribute.
  {
    "id": "log-product",                              string, used in events and data-id marks
    "goal": {"tex": "...", "words": "..."},           what is to be shown; either field optional
    "facts": [{"tex": "...", "words": "...", "ref": "Primer · Logarithms, step 1"}],
                                                      starting facts; each field optional
    "lines": [{"tex": "...", "move": "Rearrange", "why": "...",
               "choices": ["Name a piece", "Take a limit"], "highlight": "sticks"}],
        move       one of FlProofSteps.MOVES (exact names)
        choices    optional, the two other moves offered; default: two drawn from the list at
                   random, the same draw on every load (seeded by id and line)
        highlight  optional, any value; handed to onHighlight when the line is revealed
    "lookBack": [{"q": "...", "a": "..."}],           shown after the last line
    "maxLines": 6                                     optional; a longer proof logs an error
  }

Properties (set from code):
  onEvent(detail)        one call per meaningful act; pass it on with
                         fluid.emit('view.action', detail). detail is one of
                           {action: 'proof-step', proof, line, move, pick, correct}
                              line counts from 1; move is the line's move; pick is the chip
                              chosen, or null with correct null for "Show the step"
                           {action: 'proof-lookback', proof, question}   question counts from 1
                         The same detail also goes out as a bubbling DOM event named 'proof'.
  onHighlight(key, k)    the part of the picture to light: called with line k's highlight when
                         line k is revealed or reopened, and with (null, 0) on reset.
  lookBackHost           optional element. When set, the look-back questions appear there once the
                         proof is done, in place of the element's own content, which comes back on
                         reset. Primer slides pass the "Test it" block under the picture.
  lookBackHint           optional text added after "Proved", e.g. "Look back: under the picture."
  primerMoves            optional array of move names, set on a primer's last proof only: every
                         move the primer's proofs used, in order of first use. The "Proved" line
                         then lists these ("Moves in this primer: ...") in place of this proof's
                         moves. Nothing shows the list before the last proof
                         is done, so it never gives a pick away. A name outside FlProofSteps.MOVES,
                         or a move of this proof missing from the list, logs an error.
  endNote                optional text that closes the "Proved" line on a view's last proof, e.g.
                         "Next: Primer · Waves."
Methods: reset(), pick(move), showStep(), revealAll(). Property `state` (read only).

Layout: fills its parent's height when the parent is a flex column (flex: 1 1 0) and never
scrolls. Hidden lines keep the room their line will take, and the size level is chosen once for
the tallest finished states (the last line open after a wrong pick; the longest reason reopened),
from data-fit "-3" roomy to "4" tight, so the layout stays put while the reader
works through it; a state taller than the finished proof tightens further. The list of lines takes
the height left over and spreads its lines evenly. A proof of three lines or fewer that has the room
keeps every revealed line's reason open ("notes mode"), so a short proof fills its column with
reasons instead of blank bands; hidden lines then keep the room of their reason too. A line's
formula ignores the pointer, so KaTeX's invisible boxes never take a click meant for the line above.
Look: inherits the page font; colors from the theme palette (--pal-*, see ../../components/theme.js), else
--fl-* or the primer views' --accent, --fg, --muted, --line, --chip, --red. Amber marks the newest line, the color views use to light the picture.
Keyboard: chips and buttons are buttons (Enter or Space picks); revealed lines are focusable and
Enter opens one.

Example:
  <script src="../../components/proof-steps.js"></script>
  <fl-proof-steps data='{"id":"demo","goal":{"tex":"b^mb^n=b^{m+n}","words":"for whole $m,n$"},
    "lines":[{"tex":"b^mb^n=(b\\cdots b)(b\\cdots b)","move":"Unfold the definition","why":"a power is repeated multiplication"},
             {"tex":"=b^{m+n}","move":"Rearrange","why":"count the factors"}]}'></fl-proof-steps>
  In code: const p = document.createElement('fl-proof-steps');
           p.onEvent = d => fluid.emit('view.action', d); p.onHighlight = k => light(k);
           p.data = spec; column.append(p);
*/
// The palette (theme.js) makes the component follow the board's theme. A view that did not load it gets it here;
// the colors are CSS variables, so they update when the script arrives.
if (!window.FluidTheme && !document.querySelector('script[src$="../../components/theme.js"]')) {
  const t = document.createElement('script');
  t.src = '../../components/theme.js';
  document.head.append(t);
}

(() => {
  if (customElements.get('fl-proof-steps')) return;

  const MOVES = [
    'Unfold the definition', 'Undo with the inverse', 'Use an earlier result', 'Rearrange',
    'Add zero or multiply by one', 'Name a piece', 'Change variables', 'Compute it two ways',
    'Telescope', 'Use symmetry', 'Compare or bound', 'Take a limit', 'Induction', 'Contradiction'];

  const MATH = { delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false }], throwOnError: false };

  const CSS = `
fl-proof-steps{position:relative;display:flex;flex-direction:column;justify-content:space-evenly;gap:8px;flex:1 1 0;
  min-height:0;min-width:0;overflow:hidden;font-size:16px;line-height:1.35;color:var(--pal-fg,var(--fl-fg,var(--fg,#1f2937)))}
fl-proof-steps,.fps-look{
  --fps-accent:var(--pal-accent,var(--fl-accent,var(--accent,#2563eb)));--fps-muted:var(--pal-muted,var(--fl-muted,var(--muted,#6b7280)));
  --fps-line:var(--pal-line,var(--fl-border,var(--line,#d1d5db)));--fps-chip:var(--pal-accent-soft,var(--chip,#eff6ff));
  --fps-red:var(--pal-red,var(--fl-bad,var(--red,#c81e1e)));--fps-lit:var(--pal-amber,#f59e0b);--fps-litbg:var(--pal-amber-row,#fff7e0);
  --fps-panel:var(--pal-panel,#fff);--fps-soft:var(--pal-soft,#f3f4f6);--fps-grid:var(--pal-grid,#eef0f3);
  --fps-eq:17px;--fps-eq-new:18px;--fps-pad:3px}
fl-proof-steps>*{flex-shrink:0}
fl-proof-steps .fps-head{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 10px;align-items:baseline}
fl-proof-steps .fps-label,.fps-look .fps-label{color:var(--fps-muted);font-weight:600}
fl-proof-steps .fps-goal-tex{display:block;font-size:var(--fps-eq)}
fl-proof-steps .fps-facts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
fl-proof-steps .fps-ref{color:var(--fps-muted)}
fl-proof-steps .fps-lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;flex-grow:1;justify-content:space-evenly}
fl-proof-steps .fps-line{position:relative;display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:8px;align-items:baseline;
  padding:var(--fps-pad) 8px var(--fps-pad) 5px;border-radius:8px;border-left:3px solid transparent}
fl-proof-steps .fps-num{font:15px ui-monospace,Menlo,monospace;color:var(--fps-muted)}
fl-proof-steps .fps-body{min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px}
fl-proof-steps .fps-eq{font-size:var(--fps-eq);min-width:0;max-width:100%;pointer-events:none}
fl-proof-steps .is-new .fps-eq,fl-proof-steps .is-open .fps-eq{font-size:var(--fps-eq-new)}
fl-proof-steps .is-new,fl-proof-steps .is-open{background:var(--fps-litbg);border-left-color:var(--fps-lit)}
fl-proof-steps .is-done{cursor:pointer}
fl-proof-steps .is-done:hover,fl-proof-steps .is-done:focus-visible{background:var(--fps-soft);outline:none}
fl-proof-steps .is-open{cursor:pointer}
fl-proof-steps .fps-tag{margin-left:auto;font-size:15px;color:var(--fps-muted);white-space:nowrap}
fl-proof-steps .fps-note{flex-basis:100%;color:var(--fps-muted)}
fl-proof-steps .fps-right,fl-proof-steps .fps-this{color:var(--fps-accent);font-weight:600}
fl-proof-steps .fps-wrong{color:var(--fps-red);margin-right:4px}
fl-proof-steps .is-next{border:1px dashed var(--fps-line);border-left:3px solid var(--fps-accent)}
fl-proof-steps .fps-ask{font-weight:600}
fl-proof-steps .is-next .fps-body{gap:6px 6px;align-items:center}
fl-proof-steps .fps-chips{display:contents}
fl-proof-steps .fps-chip,fl-proof-steps .fps-btn,.fps-look .fps-btn{font:inherit;font-size:16px;line-height:1.2;padding:5px 12px;
  border:1px solid var(--fps-line);background:var(--fps-panel);color:inherit;cursor:pointer}
fl-proof-steps .fps-chip{border-radius:999px}
fl-proof-steps .fps-chip:hover{border-color:var(--fps-accent);color:var(--fps-accent)}
fl-proof-steps .fps-btn,.fps-look .fps-btn{border-style:dashed;border-radius:8px;color:var(--fps-muted)}
fl-proof-steps .fps-btn:hover,.fps-look .fps-btn:hover{color:var(--fps-accent);border-color:var(--fps-accent)}
.fps-look .fps-btn{padding:2px 10px;margin-left:6px}
fl-proof-steps .fps-chip:focus-visible,fl-proof-steps .fps-btn:focus-visible,.fps-look .fps-btn:focus-visible{outline:2px solid var(--fps-accent);outline-offset:1px}
fl-proof-steps .is-later .fps-eq,fl-proof-steps .is-later .fps-tag,fl-proof-steps .is-later .fps-note{visibility:hidden}
fl-proof-steps .is-noted{cursor:pointer}
fl-proof-steps .fps-ghost{visibility:hidden}
fl-proof-steps .is-noted:hover,fl-proof-steps .is-noted:focus-visible{background:var(--fps-soft);outline:none}
fl-proof-steps .fps-bar{position:absolute;left:33px;top:50%;width:60%;height:8px;margin-top:-4px;border-radius:4px;background:var(--fps-grid)}
fl-proof-steps .fps-end{padding:5px 10px;border-radius:8px;background:var(--fps-chip)}
fl-proof-steps .fps-all{color:var(--fps-muted);font-size:15px}
fl-proof-steps .fps-next{display:block;margin-top:2px;color:var(--fps-muted);font-size:15px}
fl-proof-steps .fps-proved{color:var(--pal-accent-deep,var(--fps-accent));font-weight:700}
fl-proof-steps .fps-score{color:var(--fps-muted)}
.fps-look{display:flex;flex-direction:column;gap:4px;font-size:16px;line-height:1.35}
.fps-look .fps-q{font-weight:600}
.fps-look .fps-a{margin:2px 0 0;padding-left:10px;border-left:3px solid var(--fps-lit)}
fl-proof-steps[data-fit="-3"]{--fps-eq:24px;--fps-eq-new:25px;--fps-pad:11px;gap:16px;font-size:17px}
fl-proof-steps[data-fit="-2"]{--fps-eq:21px;--fps-eq-new:22px;--fps-pad:8px;gap:12px}
fl-proof-steps[data-fit="-1"]{--fps-eq:19px;--fps-eq-new:20px;--fps-pad:5px;gap:10px}
fl-proof-steps[data-fit="1"],fl-proof-steps[data-fit="2"],fl-proof-steps[data-fit="3"]{gap:4px;--fps-pad:1px}
fl-proof-steps[data-fit="2"],fl-proof-steps[data-fit="3"]{--fps-eq:16px;--fps-eq-new:17px;line-height:1.28}
fl-proof-steps[data-fit="3"] .fps-chip,fl-proof-steps[data-fit="3"] .fps-btn{padding:3px 10px}
fl-proof-steps[data-fit="4"]{gap:2px;--fps-pad:0px;--fps-eq:15px;--fps-eq-new:16px;line-height:1.22}
fl-proof-steps[data-fit="4"] .fps-lines{gap:1px}
fl-proof-steps[data-fit="4"] .fps-head{gap:1px 10px}
fl-proof-steps[data-fit="4"] .fps-chip,fl-proof-steps[data-fit="4"] .fps-btn{padding:2px 8px}
fl-proof-steps[data-fit="4"] .is-next .fps-body{gap:3px 4px}
`;

  function injectCss() {
    if (document.getElementById('fl-proof-steps-css')) return;
    const s = document.createElement('style');
    s.id = 'fl-proof-steps-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function renderMath(node) {
    if (typeof window.renderMathInElement === 'function') window.renderMathInElement(node, MATH);
  }
  // A seeded generator, so the offered moves are the same on every load.
  function seeded(str) {
    let a = 2166136261;
    for (let i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 16777619); }
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function make(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function display(tex) { return '$\\displaystyle ' + tex + '$'; }

  function normalize(d) {
    d = d || {};
    const id = String(d.id || 'proof');
    const bad = (msg) => console.error('fl-proof-steps "' + id + '": ' + msg);
    const lines = (d.lines || []).map((ln, k) => {
      if (!MOVES.includes(ln.move)) bad('line ' + (k + 1) + ': "' + ln.move + '" is not one of the moves');
      let others = Array.isArray(ln.choices) ? ln.choices.filter(m => m !== ln.move) : [];
      others.forEach(m => { if (!MOVES.includes(m)) bad('line ' + (k + 1) + ': choice "' + m + '" is not one of the moves'); });
      others = [...new Set(others)].slice(0, 2);
      const rng = seeded(id + ':' + k);
      const pool = MOVES.filter(m => m !== ln.move && !others.includes(m));
      while (others.length < 2 && pool.length) others.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      const options = [ln.move, ...others];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return Object.assign({}, ln, { options });
    });
    const maxLines = d.maxLines || 6;
    if (lines.length > maxLines) bad(lines.length + ' lines, more than maxLines ' + maxLines + '; split the proof');
    return { id, goal: d.goal || null, facts: d.facts || [], lines, lookBack: d.lookBack || [], maxLines };
  }
  function checkPrimerMoves(d, list) {
    if (!d || !list || !list.length) return;
    const bad = (msg) => console.error('fl-proof-steps "' + d.id + '": ' + msg);
    list.forEach(m => { if (!MOVES.includes(m)) bad('primerMoves: "' + m + '" is not one of the moves'); });
    d.lines.forEach(l => { if (!list.includes(l.move)) bad('primerMoves misses this proof\'s move "' + l.move + '"'); });
  }
  function fresh() { return { shown: 0, picks: [], open: -1, look: -1, answered: [] }; }

  class FlProofSteps extends HTMLElement {
    static get observedAttributes() { return ['data']; }
    constructor() {
      super();
      this._d = null;
      this._s = fresh();
      this._ro = null;
      this._rq = 0;
      this._lvl = 0;
      this._sizedFor = '';
      this._saved = null;
      this.onEvent = null;
      this.onHighlight = null;
      this.lookBackHost = null;
      this.lookBackHint = '';
      this._endNote = '';
      this._primer = null;
      this._notes = false;
    }
    connectedCallback() {
      injectCss();
      if (!this._d && this.hasAttribute('data')) this.attributeChangedCallback('data', null, this.getAttribute('data'));
      else this._render();
      if (!this._ro && 'ResizeObserver' in window) {
        this._ro = new ResizeObserver(() => this._queue());
        this._ro.observe(this);
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this._sizedFor = ''; this._queue(); });
    }
    disconnectedCallback() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
    }
    attributeChangedCallback(name, old, val) {
      if (name !== 'data' || !val) return;
      try { this.data = JSON.parse(val); } catch (e) { console.error('fl-proof-steps: the data attribute is not JSON', e); }
    }
    get data() { return this._d; }
    set data(d) { this._d = normalize(d); this._s = fresh(); this._sizedFor = ''; checkPrimerMoves(this._d, this._primer); this._render(); }
    get endNote() { return this._endNote; }
    set endNote(t) { this._endNote = t ? String(t) : ''; this._sizedFor = ''; if (this._d) this._render(); }
    get primerMoves() { return this._primer; }
    set primerMoves(list) {
      this._primer = Array.isArray(list) && list.length ? list.slice() : null;
      checkPrimerMoves(this._d, this._primer);
      this._sizedFor = '';
      if (this._d) this._render();
    }
    get state() {
      const s = this._s;
      return { shown: s.shown, total: this._d ? this._d.lines.length : 0, picks: s.picks.slice(), answered: s.answered.slice() };
    }
    reset() { this._s = fresh(); this._render(); this._light(null, 0); }
    pick(move) { this._reveal(move); }
    showStep() { this._reveal(null); }
    revealAll() { while (this._d && this._s.shown < this._d.lines.length) this._reveal(null); }

    _emit(detail) {
      if (typeof this.onEvent === 'function') { try { this.onEvent(detail); } catch (e) { console.error(e); } }
      this.dispatchEvent(new CustomEvent('proof', { detail, bubbles: true }));
    }
    _light(key, k) {
      if (typeof this.onHighlight === 'function') { try { this.onHighlight(key, k); } catch (e) { console.error(e); } }
    }
    _reveal(pick) {
      const d = this._d, s = this._s;
      if (!d || s.shown >= d.lines.length) return;
      const k = s.shown, ln = d.lines[k];
      const correct = pick == null ? null : pick === ln.move;
      s.picks[k] = { pick: pick == null ? null : pick, correct };
      s.shown++;
      s.open = -1;
      s.look = -1;
      this._render();
      this._light(ln.highlight == null ? null : ln.highlight, k + 1);
      this._emit({ action: 'proof-step', proof: d.id, line: k + 1, move: ln.move, pick: pick == null ? null : pick, correct });
    }
    _toggle(k) {
      const d = this._d, s = this._s;
      s.open = s.open === k ? -1 : k;
      s.look = -1;
      this._render();
      const j = s.open >= 0 ? s.open : s.shown - 1;
      const ln = d.lines[j];
      this._light(ln && ln.highlight != null ? ln.highlight : null, j + 1);
    }
    _answer(i) {
      const s = this._s;
      s.answered[i] = true;
      s.look = i;
      s.open = -1;
      this._render();
      this._emit({ action: 'proof-lookback', proof: this._d.id, question: i + 1 });
    }
    // Give the host its own content back (on reset, or whenever the proof is not done).
    _restoreHost() {
      if (this.lookBackHost && this._saved) { this.lookBackHost.replaceChildren(...this._saved); this._saved = null; }
    }

    // Build the element's children for a state. The look-back block is returned apart, so the
    // caller can place it in the host.
    _build(s) {
      const d = this._d, n = d.lines.length, done = s.shown >= n;
      const kids = [];
      if (d.goal || d.facts.length) {
        const head = make('div', 'fps-head');
        if (d.goal) {
          head.append(make('span', 'fps-label', 'To show'));
          const g = make('div', 'fps-goal');
          if (d.goal.tex) g.append(make('span', 'fps-goal-tex', display(d.goal.tex)));
          if (d.goal.words) g.append(make('span', 'fps-words', d.goal.words));
          head.append(g);
        }
        if (d.facts.length) {
          head.append(make('span', 'fps-label', 'From'));
          const ul = make('ul', 'fps-facts');
          for (const ft of d.facts) {
            const li = make('li');
            const bits = [];
            if (ft.tex) bits.push('$' + ft.tex + '$');
            if (ft.words) bits.push(ft.words);
            li.append(make('span', '', bits.join(' ')));
            if (ft.ref) li.append(make('span', 'fps-ref', ' (' + ft.ref + ')'));
            ul.append(li);
          }
          head.append(ul);
        }
        kids.push(head);
      }

      const ol = make('ol', 'fps-lines');
      d.lines.forEach((ln, k) => {
        const li = make('li', 'fps-line');
        li.dataset.item = 'proof-line';
        li.dataset.id = d.id + '-' + (k + 1);
        li.append(make('span', 'fps-num', String(k + 1)));
        const body = make('div', 'fps-body');
        if (k < s.shown) {
          const notes = this._notes;
          const full = notes || (s.look >= 0 ? false : s.open >= 0 ? s.open === k : k === s.shown - 1);
          li.classList.add(s.open === k ? 'is-open' : k === s.shown - 1 && s.open < 0 && (notes || s.look < 0) ? 'is-new' : full ? 'is-noted' : 'is-done');
          body.append(make('span', 'fps-eq', display(ln.tex)));
          if (full) {
            const note = make('div', 'fps-note');
            const p = s.picks[k] || { pick: null, correct: null };
            if (p.correct === true) note.append(make('span', 'fps-right', 'Right: ' + ln.move + '.'));
            else {
              if (p.correct === false) note.append(make('s', 'fps-wrong', p.pick));
              note.append(make('span', 'fps-this', 'This step: ' + ln.move + '.'));
            }
            if (ln.why) note.append(' ', make('span', 'fps-why', ln.why));
            body.append(note);
          } else {
            body.append(make('span', 'fps-tag', ln.move));
          }
          if (!full || s.open >= 0 || notes) {
            li.tabIndex = 0;
            li.title = full ? 'Click to close' : 'Click to read the reason';
            li.addEventListener('click', () => this._toggle(k));
            li.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._toggle(k); }
            });
          }
        } else if (k === s.shown) {
          li.classList.add('is-next');
          body.append(make('span', 'fps-ask', 'Which move comes next?'));
          const chips = make('div', 'fps-chips');
          for (const m of ln.options) {
            const b = make('button', 'fps-chip', m);
            b.type = 'button';
            b.dataset.item = 'control';
            b.dataset.id = d.id + '-' + (k + 1) + '-' + slug(m);
            b.addEventListener('click', () => this._reveal(m));
            chips.append(b);
          }
          const show = make('button', 'fps-btn', 'Show the step');
          show.type = 'button';
          show.dataset.item = 'control';
          show.dataset.id = d.id + '-' + (k + 1) + '-show';
          show.addEventListener('click', () => this._reveal(null));
          chips.append(show);
          body.append(chips);
        } else {
          // A hidden line keeps the room it will take; a bar stands in for it.
          li.classList.add('is-later');
          li.setAttribute('aria-hidden', 'true');
          if (this._notes) {
            const note = make('div', 'fps-note');
            note.append(make('span', 'fps-this', 'This step: ' + ln.move + '.'));
            if (ln.why) note.append(' ', make('span', 'fps-why', ln.why));
            body.append(make('span', 'fps-eq', display(ln.tex)), note);
          } else body.append(make('span', 'fps-eq', display(ln.tex)), make('span', 'fps-tag', ln.move));
          li.append(make('span', 'fps-bar'));
        }
        li.append(body);
        ol.append(li);
      });
      kids.push(ol);

      let look = null;
      if (n && !done && this._notes) {
        // Notes mode keeps the room of the "Proved" line, so the lines stay put when it appears.
        const ghost = make('div', 'fps-end fps-ghost', 'Proved. You named ' + n + ' of ' + n + '.');
        ghost.setAttribute('aria-hidden', 'true');
        if (this.lookBackHint && d.lookBack.length && this.lookBackHost) ghost.append(' ', make('span', '', this.lookBackHint));
        if (this._primer) ghost.append(' ', make('span', 'fps-all', 'Moves in this primer: ' + this._primer.join(' · ') + '.'));
        else ghost.append(' ', make('span', '', 'Moves: ' + [...new Set(d.lines.map(l => l.move))].join(' · ') + '.'));
        if (this._endNote) ghost.append(make('span', 'fps-next', this._endNote));
        kids.push(ghost);
      }
      if (done && n) {
        const end = make('div', 'fps-end');
        end.dataset.item = 'proof-end';
        const used = [...new Set(d.lines.map(l => l.move))];
        const named = s.picks.filter(p => p && p.correct).length;
        end.append(make('span', 'fps-proved', 'Proved.'), ' ');
        if (!this._primer) end.append(make('span', 'fps-used', 'Moves: ' + used.join(' · ') + '.'), ' ');
        end.append(make('span', 'fps-score', 'You named ' + named + ' of ' + n + '.'));
        if (this.lookBackHint && d.lookBack.length && this.lookBackHost) end.append(' ', make('span', 'fps-hint', this.lookBackHint));
        if (this._primer) end.append(' ', make('span', 'fps-all', 'Moves in this primer: ' + this._primer.join(' · ') + '.'));
        if (this._endNote) end.append(make('span', 'fps-next', this._endNote));
        kids.push(end);
        if (d.lookBack.length) {
          look = make('div', 'fps-look');
          look.append(make('span', 'fps-label', 'Look back'));
          d.lookBack.forEach((it, i) => {
            const row = make('div', 'fps-lb');
            row.dataset.item = 'look-back';
            row.dataset.id = d.id + '-look-' + (i + 1);
            row.append(make('span', 'fps-q', it.q));
            if (s.look === i) row.append(make('p', 'fps-a', it.a));
            else {
              const b = make('button', 'fps-btn', 'Show');
              b.type = 'button';
              b.dataset.item = 'control';
              b.dataset.id = d.id + '-look-' + (i + 1) + '-show';
              b.addEventListener('click', () => this._answer(i));
              row.append(' ', b);
            }
            look.append(row);
          });
          if (!this.lookBackHost) kids.push(look);
        }
      }
      return { kids, look };
    }
    _overflows() { return this.scrollHeight > this.clientHeight + 1; }
    // Choose the size level for the finished proof (all lines shown, look-back closed), roomiest first.
    _size() {
      const d = this._d, n = d.lines.length;
      const key = this.clientWidth + 'x' + this.clientHeight;
      if (key === this._sizedFor) return;
      // Size for the tallest states the reader will see: the last line open after a wrong pick (its
      // note then shows the struck pick too), and the line with the longest reason reopened, both with
      // "Proved" below. In notes mode every line shows its note, so every pick counts as wrong.
      const wrong = k => {
        const o = d.lines[k].options.filter(m => m !== d.lines[k].move);
        return { pick: o.reduce((a, b) => (b.length > a.length ? b : a), o[0]), correct: false };
      };
      const picks = all => d.lines.map((_, k) => this._s.picks[k] || (all || k === n - 1 ? wrong(k) : { pick: null, correct: null }));
      const size = k => (d.lines[k].why || '').length + d.lines[k].move.length;
      const longest = d.lines.reduce((best, _, k) => (size(k) > size(best) ? k : best), 0);
      const fit = (state, from, to) => {
        this.replaceChildren(...this._build(state).kids);
        renderMath(this);
        let lvl = from;
        this.dataset.fit = String(lvl);
        while (this._overflows() && lvl < to) { lvl++; this.dataset.fit = String(lvl); }
        return this._overflows() ? null : lvl;
      };
      const last = all => ({ shown: n, picks: picks(all), open: -1, look: -1, answered: [] });
      const reopened = () => { const st = last(false); st.picks[longest] = this._s.picks[longest] || wrong(longest); st.open = longest; return st; };
      // A short proof that has the room keeps every revealed line's reason open (notes mode), so the
      // column holds reasons, not blank bands. Otherwise revealed lines turn compact.
      let lvl = null;
      this._notes = n <= 3;
      if (this._notes) lvl = fit(last(true), -3, 0);
      if (lvl === null) {
        this._notes = false;
        const a = fit(last(false), -3, 4), b = fit(reopened(), -3, 4);
        lvl = a === null || b === null ? 4 : Math.max(a, b);
      }
      this._lvl = lvl;
      this._sizedFor = key;
    }
    _render() {
      if (!this._d) { this.replaceChildren(); return; }
      injectCss();
      const active = document.activeElement, host = this.lookBackHost;
      const hadFocus = active && active !== this && (this.contains(active) || (host && host.contains(active)));
      const d = this._d, s = this._s;
      this.dataset.item = 'proof';
      this.dataset.id = d.id;
      const measurable = this.isConnected && this.clientHeight > 0;
      if (measurable) this._size();
      const { kids, look } = this._build(s);
      if (look && host) {
        if (!this._saved) this._saved = [...host.childNodes];
        host.replaceChildren(look);
        renderMath(host);
      } else this._restoreHost();
      this.replaceChildren(...kids);
      renderMath(this);
      if (measurable) {   // a state taller than the finished proof tightens further
        let lvl = this._lvl;
        this.dataset.fit = String(lvl);
        while (this._overflows() && lvl < 4) { lvl++; this.dataset.fit = String(lvl); }
      }
      if (hadFocus) {
        const next = this.querySelector('.fps-chip') || (host && host.querySelector('.fps-look .fps-btn')) ||
          this.querySelector('.fps-look .fps-btn') || this.querySelector('.is-open, .is-new') || this.querySelector('.fps-end');
        if (next) {
          if (!next.hasAttribute('tabindex') && next.tagName !== 'BUTTON') next.tabIndex = -1;
          next.focus({ preventScroll: true });
        }
      }
    }
    _queue() {
      if (this._rq) return;
      this._rq = requestAnimationFrame(() => {
        this._rq = 0;
        if (this._d && this.clientWidth + 'x' + this.clientHeight !== this._sizedFor) this._render();
      });
    }
  }

  window.FlProofSteps = { MOVES };
  customElements.define('fl-proof-steps', FlProofSteps);
})();
