/**
 * fl-block-picker: picks the active program block (Blok 1 · hf 1-4 | Blok 2 · hf 5-8 | Blok 3 · hf 9-12).
 * Every workout view shares the choice: it lives in localStorage ('fit-block' for a manual pick,
 * 'fit-start' for the program start date), and fl-exercise and fl-session-timeline re-render when
 * it changes. Without a manual pick the block follows the start date (4 weeks per block).
 * Load /components/exercise-data.js first (FIT_BLOCKS, FIT_blockInfo, FIT_setBlock, FIT_setStart).
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
  const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const day = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} ${AY[+m[2] - 1]}` : ''; };
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
      this.render();
    }
    disconnectedCallback() { if (this._off) { this._off(); this._off = null; } }
    get block() { return window.FIT_currentBlock ? window.FIT_currentBlock() : 1; }
    render() {
      const root = this.shadowRoot, B = window.FIT_BLOCKS;
      if (!B || !window.FIT_blockInfo) { root.innerHTML = `<style>${CSS}</style><span class="cap">fl-block-picker: /components/exercise-data.js yüklenmedi</span>`; return; }
      const info = window.FIT_blockInfo();
      this.setAttribute('data-item', 'block-picker'); this.setAttribute('data-id', String(info.block));
      const wk = info.week;
      const weekTxt = wk == null ? '' : wk === 0 ? `program ${day(info.start)} başlıyor` : wk > 12 ? `${wk}. hafta: 12 hafta bitti` : `${wk}. hafta`;
      let cap;
      if (info.source === 'manual') cap = `Elle seçildi${weekTxt ? ' · tarihe göre ' + weekTxt : ''}${info.start ? ' <button type="button" data-auto>Tarihe göre seç</button>' : ''}`;
      else if (info.source === 'url') cap = 'Bağlantıdan seçildi';
      else if (info.source === 'start') cap = `${weekTxt} · başlangıç ${day(info.start)}`;
      else cap = 'Başlangıç tarihi yok; ilk kayıttan sonraki salı başlangıç sayılır';
      root.innerHTML = `<style>${CSS}</style><div class="bp"><span class="lab">Program</span>
        <span class="seg" role="group" aria-label="Program bloğu">${B.map((b) => `<button type="button" data-item="block" data-id="${b.n}" data-title="${esc(b.name + ' · hf ' + b.weeks)}" aria-pressed="${b.n === info.block}">${esc(b.name)} <small>· hf ${esc(b.weeks)}</small></button>`).join('')}</span>
        <span class="cap">${cap}<label>Başlangıç <input type="date" value="${esc(info.start || '')}" aria-label="Program başlangıç tarihi"></label></span></div>`;
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
