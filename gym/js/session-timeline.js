/**
 * fl-session-timeline: the "Seans programı" strip of one workout session: a proportional bar,
 * one card per step with its start minute, length and detail, and a total card. The total turns
 * red when the planned length passes 60 minutes; a note warns when only the longest case does.
 * Steps come from window.FIT_SESSIONS[session], resolved for the active program block
 * (FIT_sessionSteps); the strip re-renders when the block changes. Load /components/exercise-data.js first.
 *
 * Attributes:
 *   session  "sali" | "cuma"   key in FIT_SESSIONS (required)
 *   heading  string            title (default "Seans programı — <label>"); `noheading` hides it
 *   active   string            step id to highlight (for a session player)
 *   limit    number            minutes before the total turns red (default 60)
 *   block    1 | 2 | 3         pin a block instead of following the active one
 *
 * Colours: warm-up and cool-down steps use --fit-warm, the lifting steps the session accent
 * (--fit-sali / --fit-cuma, or --fit-accent).
 * Each step carries data-item="step", data-id and data-title.
 * `active` matches a step's id or its block-1 id (slot).
 * Events: `stepclick` {step} (the resolved step) when a step is clicked or Enter is pressed on it.
 *
 * Example:
 *   <script src="/components/exercise-data.js"></script>
 *   <script src="/components/session-timeline.js"></script>
 *   <fl-session-timeline session="sali"></fl-session-timeline>
 */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const half = (x) => String(Math.round(x * 2) / 2).replace('.', ',');
  const CSS = `
    :host {
      --_font: var(--fl-font, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
      --_fg: var(--fl-fg, #1d2433); --_muted: var(--fl-muted, #6b7280); --_bg: var(--fl-bg, #ffffff);
      --_surface: var(--fl-surface, #f5f7fa); --_border: var(--fl-border, #e4e7ec); --_bad: var(--fl-bad, #dc2626);
      --_warm: var(--fit-warm, #f59e0b); --_radius: var(--fl-radius, 10px);
      display: block; font-family: var(--_font); color: var(--_fg); font-size: 13px; line-height: 1.4;
    }
    * { box-sizing: border-box; }
    .plan { background: var(--_surface); border: 1px solid var(--_border); border-radius: var(--_radius); padding: 12px; }
    h2 { font-size: 12px; margin: 0 0 8px; color: var(--_muted); font-weight: 650; letter-spacing: .05em; text-transform: uppercase; }
    .bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; margin-bottom: 10px; }
    .bar i { display: block; min-width: 3px; }
    .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(108px, 1fr)); gap: 8px; }
    .step { background: var(--_bg); border: 1px solid var(--_border); border-top: 3px solid var(--c); border-radius: 8px;
      padding: 6px 9px; min-width: 0; cursor: pointer; }
    .step:focus-visible { outline: 2px solid var(--_acc); outline-offset: 2px; }
    .step.on { box-shadow: 0 0 0 2px var(--c); }
    .st { font-size: 11px; color: var(--_muted); font-variant-numeric: tabular-nums; }
    .st b { color: var(--_fg); font-weight: 650; }
    .nm { font-weight: 650; font-size: 13px; overflow-wrap: anywhere; margin: 1px 0 2px; }
    .dt { font-size: 11px; color: var(--_muted); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .total { cursor: default; border-top-color: var(--_acc); }
    .total.over { border-color: var(--_bad); }
    .total.over .nm { color: var(--_bad); }
    .note { font-size: 12px; margin-top: 8px; color: var(--_muted); }
    .note.over { color: var(--_bad); font-weight: 600; }
    .err { color: var(--_bad); }
  `;

  class FlSessionTimeline extends HTMLElement {
    static observedAttributes = ['session', 'heading', 'noheading', 'active', 'limit', 'block'];
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    connectedCallback() {
      if (!this._off && window.FIT_onBlockChange) this._off = window.FIT_onBlockChange(() => this.render());
      this.render();
    }
    disconnectedCallback() { if (this._off) { this._off(); this._off = null; } }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      const key = this.getAttribute('session') || '';
      const raw = window.FIT_SESSIONS && window.FIT_SESSIONS[key];
      const steps = raw && (window.FIT_sessionSteps ? window.FIT_sessionSteps(key, this.getAttribute('block')) : raw);
      const blk = steps && steps[0] && (window.FIT_BLOCKS || []).find((b) => b.n === steps[0].block);
      const meta = (window.FIT_SESSION_META && window.FIT_SESSION_META[key]) || { label: key };
      const root = this.shadowRoot;
      if (!steps) { root.innerHTML = `<style>${CSS}</style><div class="plan err">fl-session-timeline: "${esc(key)}" yok (exercise-data.js yüklendi mi?)</div>`; return; }
      const limit = +this.getAttribute('limit') || 60;
      const acc = meta.accent || 'var(--fit-accent, var(--fl-accent, #4f6bed))';
      const color = (s) => (s.phase === 'warm' || s.phase === 'cool' ? 'var(--_warm)' : 'var(--_acc)');
      let t = 0, lo = 0, hi = 0;
      const rows = steps.map((s) => { const r = { s, start: t }; t += s.min; lo += s.lo ?? s.min; hi += s.hi ?? s.min; return r; });
      const total = Math.round(t), tLo = Math.round(lo), tHi = Math.round(hi);
      const over = total > limit, overHi = !over && tHi > limit;
      const range = tLo < total ? `${tLo}–${tHi} dk` : tHi > total ? `en uzun senaryo ~${tHi} dk` : '';
      const note = over ? `Toplam ~${total} dk: ${limit} dk sınırını ${total - limit} dk aşıyor.`
        : overHi ? `Toplam ~${total} dk; en uzun senaryoda ~${tHi} dk, ${limit} dk sınırını aşabilir.`
          : `Toplam ~${total} dk${range ? ` (${range})` : ''}: ${limit} dk sınırı içinde.`;
      const active = this.getAttribute('active');
      const heading = this.hasAttribute('noheading') ? '' : `<h2>${esc(this.getAttribute('heading') || 'Seans programı — ' + (meta.label || key) + (blk ? ` · ${blk.name} (hf ${blk.weeks})` : ''))}</h2>`;
      root.innerHTML = `<style>${CSS}:host{--_acc:${acc}}</style><section class="plan">${heading}
        <div class="bar" aria-hidden="true">${rows.map(({ s }) => `<i style="flex:${s.min} 1 0;background:${color(s)}" title="${esc(s.name)} ~${half(s.min)} dk"></i>`).join('')}</div>
        <div class="steps">${rows.map(({ s, start }) => `<div class="step${active && (s.id === active || s.slot === active) ? ' on' : ''}" tabindex="0" style="--c:${color(s)}" data-item="step" data-id="${esc(s.id)}" data-title="${esc(s.name)}" title="${esc(s.detail || '')}">
            <div class="st"><b>${Math.round(start)}. dk</b> · ~${half(s.min)} dk</div><div class="nm">${esc(s.name)}</div><div class="dt">${esc(s.detail || '')}</div></div>`).join('')}
          <div class="step total${over ? ' over' : ''}" data-item="step" data-id="toplam" data-title="Toplam">
            <div class="st"><b>${total}. dk</b> · çıkış</div><div class="nm">Toplam ~${total} dk</div><div class="dt">${range ? esc(range) + ' · ' : ''}ısınma ve soğuma dahil</div></div>
        </div>
        <div class="note${over ? ' over' : ''}">${esc(note)}${meta.note ? ' ' + esc(meta.note) : ''}</div></section>`;
      root.querySelectorAll('.step:not(.total)').forEach((el, i) => {
        const fire = () => this.dispatchEvent(new CustomEvent('stepclick', { detail: { step: steps[i] } }));
        el.addEventListener('click', fire);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') fire(); });
      });
    }
  }
  if (!customElements.get('fl-session-timeline')) customElements.define('fl-session-timeline', FlSessionTimeline);
})();
