/*
theme.js: the project palette for the Fluid views, light and dark.

Load it in a view's <head> or before the view's script: <script src="../../components/theme.js"></script>

It injects one <style> with the palette as CSS variables: --pal-<name>, light values on :root and dark
values on :root[data-fluid-theme="dark"]. The dark values take the board's --fl-* colors (fg, muted,
bg, surface, border, accent, warn, bad) and fall back to the same literal when the board's rule is
missing. Use the variables in CSS (var(--pal-ink)); in JS-drawn SVG, read them with
FluidTheme.color('ink') at draw time.

  FluidTheme.color(name)  the current value of --pal-<name>, e.g. FluidTheme.color('accent') -> "#2563eb"
  FluidTheme.isDark()     true when the board's theme is dark
  window event 'fluid-themechange'  fired when the board switches the theme (data-fluid-theme on <html>)
                          A view redraws what JS drew on this event; CSS variables update by themselves.

Names: bg, panel (surface), soft (readout and button fill), soft-2 (unlit cells), grid, line, guide
(dotted guides), ink (lines, marks, main text), fg (body text), text-2 (secondary text), muted, accent,
accent-2 (second blue series), accent-soft (chip, takeaway), on-accent (text on blue or grey bars),
grey (grey series and axes), amber (proof highlight, stroke),
amber-bg (highlight fill), amber-ink (text on amber-bg), amber-row (lit proof line), red, red-bg, green,
red-pale (over-the-line fill).
Data series (added for the l-views): blue-deep, blue-strong, blue-pale, blue-light, grey-bar,
grey-blue, slate-2, slate-3, slate-4, ink-navy, orange, orange-deep, orange-soft, orange-bright,
amber-deep.
*/
(() => {
  if (window.FluidTheme) return;

  const LIGHT = {
    bg: '#ffffff', panel: '#ffffff', soft: '#f3f4f6', 'soft-2': '#e5e7eb', grid: '#eef0f3',
    line: '#d1d5db', guide: '#cbd5e1', ink: '#111111', fg: '#1f2937', 'text-2': '#374151',
    muted: '#5b6270', accent: '#2563eb', 'accent-2': '#60a5fa', 'accent-soft': '#eff6ff',
    'on-accent': '#ffffff', grey: '#9ca3af', amber: '#f59e0b', 'amber-bg': '#fde68a',
    'amber-ink': '#111111', 'amber-row': '#fff7e0', red: '#c81e1e', 'red-bg': '#fdecec', 'red-pale': '#fca5a5', green: '#15803d',
    // Data hues and tints used by the l12/l13 views. Light values are the literals those views used.
    'hue-green': '#16a34a', 'hue-orange': '#d97706', 'hue-orange-ink': '#b45309', 'hue-purple': '#9333ea',
    'hue-pink': '#db2777', 'hue-teal': '#059669', 'hue-violet': '#7c3aed',
    'accent-deep': '#1d4ed8', 'accent-ink': '#1e40af', 'accent-3': '#93c5fd', 'accent-tint': '#dbeafe',
    'info-line': '#0969da', 'info-tint': '#ddf4ff', 'ink-2': '#1f2328', 'text-3': '#4b5563',
    'muted-2': '#656d76', 'grey-2': '#8c959f', 'grey-3': '#9aa1a9', 'soft-3': '#eceef2',
    'soft-hover': '#f9fafb', 'red-tint': '#fff5f5', 'red-tint-2': '#fbe3e0', 'bad-bg': '#ffebe9',
    'bad-line': '#cf222e', 'bad-ink': '#82071e', 'good-bg': '#dafbe1', 'good-line': '#1a7f37',
    'good-ink': '#116329', 'warn-bg': '#fff8c5', 'warn-line': '#bf8700', 'warn-ink': '#7d4e00',
    'bar-label': '#c81e1e',
    'blue-deep': '#1e3a8a', 'blue-strong': '#1d4ed8', 'blue-pale': '#bfdbfe',
    'blue-light': '#93c5fd', 'grey-bar': '#c7cdd6', 'grey-blue': '#94a3b8',
    'slate-2': '#475569', 'slate-3': '#334155', 'slate-4': '#64748b', 'ink-navy': '#111827',
    orange: '#c2410c', 'orange-deep': '#9a3412', 'orange-soft': '#fdba74', 'orange-bright': '#fb923c',
    'amber-deep': '#92400e', 'amber-muted': '#5b6270',
    // Heat-map base and orange bar of the l13/l14 views. Light values are the literals those views used.
    'orange-bar': '#f97316', heat: '#ea580c',
  };

  // Dark values: the board's --fl-* first, then the literal. Text pairs are checked to 4.5:1 on their
  // backgrounds (see workspace/theme-2026-10-23/recipe.md).
  const DARK = {
    bg: 'var(--fl-bg, #16181d)', panel: 'var(--fl-surface, #1f232b)', soft: '#2a2f38', 'soft-2': '#2b3039',
    grid: '#2a2f38', line: '#4b5464', guide: '#6b7587', ink: 'var(--fl-fg, #e6e8ee)', fg: 'var(--fl-fg, #e6e8ee)',
    'text-2': '#c9ced8', muted: 'var(--fl-muted, #9aa3b2)', accent: 'var(--fl-accent, #7b93ff)',
    'accent-2': '#93c5fd', 'accent-soft': '#1e2a4a', 'on-accent': '#0f1116', grey: '#8b94a3',
    amber: 'var(--fl-warn, #fbbf24)', 'amber-bg': '#6b5216',
    'amber-ink': '#f5f0e0', 'amber-row': '#3a2e10', red: 'var(--fl-bad, #f87171)', 'red-bg': '#3d1f24', 'red-pale': '#5a2630',
    green: 'var(--fl-good, #4ade80)',
    'hue-green': 'var(--fl-good, #4ade80)', 'hue-orange': '#fb923c', 'hue-orange-ink': '#fdba74',
    'hue-purple': '#c084fc', 'hue-pink': '#f472b6', 'hue-teal': '#34d399', 'hue-violet': '#a78bfa',
    'accent-deep': '#93c5fd', 'accent-ink': '#bfdbfe', 'accent-3': '#5a7cc4', 'accent-tint': '#3566a8',
    'info-line': '#60a5fa', 'info-tint': '#1e2a4a', 'ink-2': 'var(--fl-fg, #e6e8ee)', 'text-3': '#b4bcc9',
    'muted-2': 'var(--fl-muted, #9aa3b2)', 'grey-2': '#7d8590', 'grey-3': '#8b94a3', 'soft-3': '#2a2f38',
    'soft-hover': '#252a33', 'red-tint': '#2a1a1d', 'red-tint-2': '#3d1f24', 'bad-bg': '#3d1f24',
    'bad-line': 'var(--fl-bad, #f87171)', 'bad-ink': '#fecaca', 'good-bg': '#14321f',
    'good-line': 'var(--fl-good, #4ade80)', 'good-ink': '#bbf7d0', 'warn-bg': '#3a2e10',
    'warn-line': 'var(--fl-warn, #fbbf24)', 'warn-ink': '#fde68a',
    'bar-label': '#0f1116',
    'blue-deep': '#b9cdff', 'blue-strong': '#c2d4ff', 'blue-pale': '#4f70b8',
    'blue-light': '#a9c6ff', 'grey-bar': '#737d8f', 'grey-blue': '#7d8aa0',
    'slate-2': '#aab4c3', 'slate-3': '#c9d1dd', 'slate-4': '#8f9bb0', 'ink-navy': '#e6e8ee',
    orange: '#fb923c', 'orange-deep': '#fff0dc', 'orange-soft': '#7c2d12', 'orange-bright': '#9d4a1e',
    'amber-deep': '#fcd9a0', 'amber-muted': '#f5f0e0',
    'orange-bar': '#fb923c', heat: '#9a3412',
  };

  const decl = (o) => Object.keys(o).map((k) => `--pal-${k}:${o[k]};`).join('');
  // Faded "not yet" text (.dim: .takeaway, .proof-line, any row the view dims): one opacity per theme.
  const css = `:root{${decl(LIGHT)}--fade:0.3}\n:root[data-fluid-theme="dark"]{${decl(DARK)}--fade:0.4}\n.dim{opacity:var(--fade)}`;
  const style = document.createElement('style');
  style.id = 'fl-palette';
  style.textContent = css;
  (document.head || document.documentElement).prepend(style);

  const root = document.documentElement;
  const FluidTheme = {
    color(name) {
      const v = getComputedStyle(root).getPropertyValue('--pal-' + name).trim();
      return v || LIGHT[name] || '';
    },
    isDark() {
      return root.dataset.fluidTheme === 'dark';
    },
  };
  window.FluidTheme = FluidTheme;

  // The board sets data-fluid-theme on <html> each time the user switches; tell the view.
  let last = root.dataset.fluidTheme;
  new MutationObserver(() => {
    const now = root.dataset.fluidTheme;
    if (now === last) return;
    last = now;
    window.dispatchEvent(new Event('fluid-themechange'));
  }).observe(root, { attributes: true, attributeFilter: ['data-fluid-theme'] });
})();
