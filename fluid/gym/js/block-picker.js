/**
 * fl-block-picker: picks the active program block (Blok 1 · hf 1-4 | Blok 2 · hf 5-8 | Blok 3 · hf 9-12).
 * Every workout view shares the choice: it lives in localStorage ('fit-block' for a manual pick,
 * 'fit-start' for the program start date), and fl-exercise and fl-session-timeline re-render when
 * it changes. Without a manual pick the block follows the start date (4 weeks per block).
 * Load /components/exercise-data.js first (FIT_BLOCKS, FIT_blockInfo, FIT_setBlock, FIT_setStart). With js/i18n.js the
 * text and dates follow the active language and the picker re-renders on a switch ('fit-lang').
 *
 * Attributes:
 *   compact  boolean attr   buttons only (no start date line)
 *
 * The host carries data-item="block-picker" and data-id=<active block>; each button data-item="block",
 * data-id=<n>, data-title=<label>.
 * Events: `change` {block} after the user picks a block.
 *
 * Example:
 *   <script src="/components/exercise-data.js"></script>
 *   <script src="/components/block-picker.js"></script>
 *   <fl-block-picker></fl-block-picker>
 */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const T = (k, ...a) => (window.FIT_I18N ? FIT_I18N.t(k, ...a) : k);
  const day = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') && window.FIT_I18N ? FIT_I18N.day(iso, { short: true }) : iso || '');
  const CSS = `
    :host {
      --_font: var(--fl-font, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
      --_fg: var(--fl-fg, #1d2433); --_muted: var(--fl-muted, #6b7280); --_bg: var(--fl-bg, #ffffff);
      --_border: var(--fl-border, #e4e7ec); --_acc: var(--fit-accent, var(--fl-accent, #4f6bed));
      display: block; font-family: var(--_font); color: var(--_fg); font-size: 13px; line-height: 1.35;
    }
    * { box-sizing: border-box; }
    .bp { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
    .lab { font-weight: 650; color: var(--_muted); font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
    .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); flex: 1 1 100%; }
    .seg button small { display: block; }
    button { font: inherit; color: var(--_fg); background: var(--_bg); border: 1px solid var(--_border); padding: 5px 11px;
      cursor: pointer; line-height: 1.3; min-height: 44px; }
    .seg button { border-radius: 0; margin-left: -1px; }
    .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
    .seg button:last-child { border-radius: 0 8px 8px 0; }
    .seg button[aria-pressed="true"] { background: var(--_acc); border-color: var(--_acc); color: #fff; font-weight: 650; position: relative; }
    .seg button small { opacity: .8; font-weight: 500; }
    button:focus-visible, input:focus-visible { outline: 2px solid var(--_acc); outline-offset: 2px; }
    .cap { color: var(--_muted); display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
    .cap button { border-radius: 8px; padding: 2px 10px; min-height: 40px; font-size: 13px; }
    .cap input { font: inherit; font-size: 15px; min-height: 40px; color: var(--_fg); background: var(--_bg); border: 1px solid var(--_border); border-radius: 6px; padding: 1px 4px; }
    :host([compact]) .lab, :host([compact]) .cap { display: none; }
    :host([compact]) button { min-height: 40px; padding: 0 12px; font-size: 13px; }
  `;
  class FlBlockPicker extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    connectedCallback() {
      if (!this._off && window.FIT_onBlockChange) this._off = window.FIT_onBlockChange(() => this.render());
      if (!this._offLang) { const f = () => this.render(); window.addEventListener('fit-lang', f); this._offLang = () => window.removeEventListener('fit-lang', f); }
      this.render();
    }
    disconnectedCallback() { if (this._off) { this._off(); this._off = null; } if (this._offLang) { this._offLang(); this._offLang = null; } }
    get block() { return window.FIT_currentBlock ? window.FIT_currentBlock() : 1; }
    render() {
      const root = this.shadowRoot, B = (window.FIT_BLOCKS || []).map((b) => (window.FIT_tx ? FIT_tx.block(b) : b));
      if (!window.FIT_BLOCKS || !window.FIT_blockInfo) { root.innerHTML = `<style>${CSS}</style><span class="cap">${esc(T('bp.noData'))}</span>`; return; }
      const info = window.FIT_blockInfo();
      this.setAttribute('data-item', 'block-picker'); this.setAttribute('data-id', String(info.block));
      const wk = info.week;
      const weekTxt = wk == null ? '' : wk === 0 ? T('bp.starts', day(info.start)) : wk > 12 ? T('weekDone', wk) : T('week', wk);
      let cap;
      if (info.source === 'manual') cap = `${esc(T('bp.manual'))}${weekTxt ? esc(T('bp.byDate') + weekTxt) : ''}${info.start ? ` <button type="button" data-auto>${esc(T('bp.auto'))}</button>` : ''}`;
      else if (info.source === 'url') cap = esc(T('bp.url'));
      else if (info.source === 'start') cap = esc(`${weekTxt} · ${T('bp.since', day(info.start))}`);
      else cap = esc(T('bp.none'));
      root.innerHTML = `<style>${CSS}</style><div class="bp"><span class="lab">Program</span>
        <span class="seg" role="group" aria-label="${esc(T('bp.aria'))}">${B.map((b) => `<button type="button" data-item="block" data-id="${b.n}" data-title="${esc(b.name + ' · ' + T('wk') + ' ' + b.weeks)}" aria-pressed="${b.n === info.block}">${esc(b.name)} <small>· ${esc(T('wk'))} ${esc(b.weeks)}</small></button>`).join('')}</span>
        <span class="cap">${cap}<label>${esc(T('bp.start'))} <input type="date" value="${esc(info.start || '')}" aria-label="${esc(T('bp.startAria'))}"></label></span></div>`;
      root.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
        window.FIT_setBlock(+b.dataset.id);
        this.dispatchEvent(new CustomEvent('change', { detail: { block: +b.dataset.id } }));
      }));
      const auto = root.querySelector('[data-auto]');
      if (auto) auto.addEventListener('click', () => { window.FIT_setBlock(null); this.dispatchEvent(new CustomEvent('change', { detail: { block: this.block } })); });
      root.querySelector('input[type="date"]').addEventListener('change', (e) => {
        window.FIT_setStart(e.target.value || null);
        this.dispatchEvent(new CustomEvent('change', { detail: { block: this.block } }));
      });
    }
  }
  if (!customElements.get('fl-block-picker')) customElements.define('fl-block-picker', FlBlockPicker);
})();
