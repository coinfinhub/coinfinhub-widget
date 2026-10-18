/**
 * The widget's only stylesheet, adopted by every shadow root (no inline styles, so a strict
 * CSP needs no 'unsafe-inline'). Colours are CoinFinHub's light and dark tokens; sizes are in
 * em so the widget follows the host's text size, but never below 15 px.
 */

/** Light theme. Text tokens are at least 4.5:1 on the surface, up and down at least 4.77:1 (test/styles.test.ts). */
export const light = {
  surface: '#ffffff',
  line: '#e8e8ef',
  ink: '#131840',
  'ink-2': '#3b4066',
  muted: '#5e6287',
  accent: '#2c3c9e',
  gold: '#e1af40',
  'tip-bg': '#161f5a',
  'tip-ink': '#ffffff',
  up: '#077556',
  down: '#c0321c',
  flat: '#6b6880',
};

/** Dark theme (warm charcoal), the same tokens. */
export const dark: typeof light = {
  surface: '#1a1920',
  line: '#2f2d37',
  ink: '#f1ece2',
  'ink-2': '#d0c9bb',
  muted: '#a39c8e',
  accent: '#b6b8f7',
  gold: '#e1af40',
  'tip-bg': '#f1ece2',
  'tip-ink': '#131840',
  up: '#0da06f',
  down: '#e46444',
  flat: '#9a98ab',
};

const tokens = (theme: typeof light): string =>
  Object.entries(theme)
    .map(([name, value]) => `--cfh-${name}:${value}`)
    .join(';');

// The build minifies this template (scripts/build.mjs); keep it free of ${} so it stays plain CSS.
const rules = /* css */ `
:host {
  all: initial;
  display: block;
  min-width: 200px;
  font-family: Inter, system-ui, sans-serif;
  font-size: max(1em, 15px);
  line-height: 1.4;
  color: var(--cfh-ink);
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
:host([hidden]),
[hidden] {
  display: none !important;
}
.cfh-card {
  container: cfh / inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  box-sizing: border-box;
  padding: 0.8em 0.9em 0.35em;
  border: 1px solid var(--cfh-line);
  border-radius: 0.8em;
  background: var(--cfh-surface);
  overflow-wrap: anywhere;
}
.cfh-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6em 1.2em;
}
.cfh-top {
  flex: 1 1 11em;
  display: grid;
  gap: 0.2em;
}
.cfh-head,
.cfh-row,
.cfh-note,
.cfh-status,
.cfh-foot {
  margin: 0;
}
.cfh-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 0.4em;
}
.cfh-name {
  font-weight: 600;
}
.cfh-sym {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--cfh-muted);
}
.cfh-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.1em 0.6em;
}
.cfh-price {
  font-size: 1.3em;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cfh-chg {
  font-size: 0.93em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--cfh-ink-2);
}
.cfh-up {
  color: var(--cfh-up);
}
.cfh-down {
  color: var(--cfh-down);
}
.cfh-flat {
  color: var(--cfh-flat);
}
.cfh-per {
  font-weight: 400;
  color: var(--cfh-muted);
}
.cfh-ctx {
  flex: 1 1 13em;
  position: relative;
  padding-left: 0.8em;
  border-left: 3px solid var(--cfh-gold);
  font-size: 0.93em;
  color: var(--cfh-ink-2);
  cursor: default;
}
.cfh-lbl {
  display: block;
  font-size: 0.79em;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cfh-muted);
}
.cfh-tip {
  display: none;
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  bottom: 100%;
  box-sizing: border-box;
  padding: 0.55em 0.7em;
  border-bottom: 0.45em solid transparent;
  border-radius: 0.5em;
  background: var(--cfh-tip-bg) padding-box;
  color: var(--cfh-tip-ink);
  font-size: 0.9em;
}
.cfh-ctx:hover .cfh-tip,
.cfh-ctx:focus .cfh-tip {
  display: block;
}
.cfh-ctx.cfh-shut .cfh-tip {
  display: none;
}
.cfh-note {
  font-size: 0.83em;
  color: var(--cfh-muted);
  white-space: pre-line;
}
.cfh-status {
  color: var(--cfh-ink-2);
}
.cfh-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 0.35em;
  font-size: 0.83em;
  color: var(--cfh-muted);
}
.cfh-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  font-weight: 600;
  color: var(--cfh-accent);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
.cfh-ctx:focus {
  outline: none;
}
.cfh-ctx:focus-visible,
.cfh-link:focus-visible {
  outline: 2px solid var(--cfh-accent);
  outline-offset: 2px;
  border-radius: 0.2em;
}
@media (pointer: coarse) {
  .cfh-link {
    min-height: 32px;
  }
}
@container cfh (min-width: 260px) {
  .cfh-price {
    font-size: 1.5em;
  }
}
@container cfh (min-width: 400px) {
  .cfh-price {
    font-size: 1.8em;
  }
}
`;

/** The whole sheet: light tokens, dark tokens for theme="auto" and theme="dark", then the rules. */
export const css = `:host{${tokens(light)}}@media (prefers-color-scheme:dark){:host(:not([theme=light])){${tokens(dark)}}}:host([theme=dark]){${tokens(dark)}}${rules}`;

let sheet: CSSStyleSheet | undefined;

/** One constructed sheet, shared by every widget on the page. */
export function styleSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  }
  return sheet;
}
