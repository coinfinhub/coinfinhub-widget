/**
 * The widgets' one stylesheet, adopted by every shadow root (no inline styles, so a strict CSP needs no
 * 'unsafe-inline'). Colours are CoinFinHub's light and dark tokens; sizes are in em so the widgets follow
 * the host's text size, but never below 15 px.
 */

/** Light theme. Text tokens are at least 4.5:1 on both surfaces, up and down at least 4.77:1 (test/styles.test.ts). */
export const light = {
  surface: '#ffffff',
  'surface-2': '#fafafc',
  line: '#e8e8ef',
  ink: '#131840',
  'ink-2': '#3b4066',
  muted: '#5e6287',
  accent: '#2c3c9e',
  'accent-soft': '#eceefa',
  up: '#077556',
  down: '#c0321c',
  flat: '#6b6880',
};

/** Dark theme (warm charcoal), the same tokens. */
export const dark: typeof light = {
  surface: '#1a1920',
  'surface-2': '#212028',
  line: '#2f2d37',
  ink: '#f1ece2',
  'ink-2': '#d0c9bb',
  muted: '#a39c8e',
  accent: '#b6b8f7',
  'accent-soft': '#26253a',
  up: '#28ad7b',
  down: '#f37251',
  flat: '#9a98ab',
};

const tokens = (theme: typeof light, scheme: string): string =>
  `${Object.entries(theme)
    .map(([name, value]) => `--cfh-${name}:${value}`)
    .join(';')};color-scheme:${scheme}`;

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
:host([background='transparent' i]) .cfh-card {
  background: transparent;
}
:host([border='none' i]) .cfh-card {
  border-color: transparent;
}
.cfh-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.6em;
  min-width: 0;
}
.cfh-status,
.cfh-note,
.cfh-foot,
.cfh-sum,
.cfh-fine,
.cfh-items {
  margin: 0;
}
.cfh-items {
  padding: 0;
  list-style: none;
}
.cfh-status {
  color: var(--cfh-ink-2);
}
.cfh-note,
.cfh-fine {
  font-size: 0.83em;
  color: var(--cfh-muted);
}

/* One coin's parts */
.cfh-logo {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 1.9em;
  height: 1.9em;
  overflow: hidden;
  border-radius: 50%;
  background: var(--cfh-accent-soft);
  color: var(--cfh-accent);
  font-size: 0.85em;
  font-weight: 700;
  line-height: 1;
}
.cfh-pic {
  background: none;
}
.cfh-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cfh-id {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.1em 0.4em;
  min-width: 0;
}
.cfh-name {
  font-weight: 600;
}
.cfh-sym {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--cfh-muted);
}
.cfh-badge {
  padding: 0 0.45em;
  border: 1px solid var(--cfh-line);
  border-radius: 0.4em;
  background: var(--cfh-surface-2);
  color: var(--cfh-ink-2);
  font-size: 0.8em;
  font-weight: 600;
}
.cfh-val {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.1em 0.6em;
}
.cfh-price {
  font-weight: 700;
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

/* The price card, and the converter's head */
.cfh-coin {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.35em 0.55em;
}
.cfh-coin .cfh-val {
  grid-column: 1 / -1;
}
.cfh-one .cfh-price {
  font-size: 1.3em;
  line-height: 1.15;
}
.cfh-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.4em;
}
.cfh-spark {
  display: block;
  flex: 1;
  min-width: 0;
  height: 2.6em;
  overflow: visible;
}
.cfh-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.cfh-area {
  fill: currentColor;
  fill-opacity: 0.12;
}
.cfh-chart .cfh-per {
  font-size: 0.8em;
}

/* The list: rows, or the strip */
.cfh-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.2em 0.6em;
  padding: 0.5em 0;
  border-top: 1px solid var(--cfh-line);
}
.cfh-item:first-child {
  border-top: 0;
}
.cfh-item .cfh-val {
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
}
:host([layout='strip' i]) .cfh-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5em, 1fr));
  gap: 0.5em;
}
:host([layout='strip' i]) .cfh-item {
  grid-template-columns: auto 1fr;
  padding: 0.5em 0.6em;
  border: 1px solid var(--cfh-line);
  border-radius: 0.6em;
  background: var(--cfh-surface-2);
}
:host([layout='strip' i]) .cfh-name {
  display: none;
}
:host([layout='strip' i]) .cfh-item .cfh-val {
  grid-column: 1 / -1;
  align-items: flex-start;
}

/* The ticker */
.cfh-ticker {
  flex-flow: row wrap;
  align-items: center;
  column-gap: 1em;
  padding-top: 0.35em;
}
.cfh-ticker .cfh-main {
  flex: 1 1 18em;
}
.cfh-view {
  overflow: hidden;
  border-radius: 0.3em;
}
.cfh-track {
  display: flex;
  width: max-content;
  animation: cfh-roll 50s linear infinite;
}
.cfh-view:hover .cfh-track,
.cfh-view:focus-within .cfh-track {
  animation-play-state: paused;
}
.cfh-run {
  display: flex;
}
.cfh-tick {
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.3em 1.4em 0.3em 0;
  white-space: nowrap;
}
.cfh-tick .cfh-name {
  display: none;
}
.cfh-tick .cfh-id,
.cfh-tick .cfh-val {
  flex-wrap: nowrap;
}
@keyframes cfh-roll {
  to {
    transform: translateX(-50%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cfh-track {
    animation: none;
  }
  .cfh-view {
    overflow-x: auto;
  }
  .cfh-run + .cfh-run {
    display: none;
  }
}

/* The converter */
.cfh-conv .cfh-val {
  display: none;
}
.cfh-sum {
  font-size: 1.15em;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cfh-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7em, 1fr));
  gap: 0.6em;
}
.cfh-field {
  display: grid;
  gap: 0.25em;
  min-width: 0;
}
.cfh-lab {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--cfh-ink-2);
}
.cfh-in {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 2.5em;
  margin: 0;
  padding: 0.3em 0.55em;
  border: 1px solid var(--cfh-muted);
  border-radius: 0.6em;
  background: var(--cfh-surface);
  color: var(--cfh-ink);
  font: inherit;
  font-size: max(1em, 16px);
  font-variant-numeric: tabular-nums;
}

/* The footer */
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
.cfh-mark {
  flex: none;
  width: 1.2em;
  height: 1.2em;
  margin-right: 0.35em;
}
.cfh-link:focus-visible,
.cfh-view:focus-visible,
.cfh-in:focus-visible {
  outline: 2px solid var(--cfh-accent);
  outline-offset: 2px;
}
@media (pointer: coarse) {
  .cfh-link {
    min-height: 32px;
  }
}
@container cfh (max-width: 259px) {
  :host(:not([layout='strip' i])) .cfh-item {
    grid-template-columns: auto 1fr;
  }
  :host(:not([layout='strip' i])) .cfh-item .cfh-val {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: baseline;
    gap: 0.1em 0.6em;
  }
}
@container cfh (min-width: 260px) {
  .cfh-one .cfh-price {
    font-size: 1.5em;
  }
}
@container cfh (min-width: 400px) {
  .cfh-one .cfh-price {
    font-size: 1.8em;
  }
  :host(:not([layout='strip' i])) .cfh-item .cfh-val {
    flex-direction: row;
    align-items: baseline;
    gap: 1em;
  }
  :host(:not([layout='strip' i])) .cfh-item .cfh-chg {
    min-width: 7.5em;
    text-align: right;
  }
}
`;

/** The whole sheet: light tokens, dark tokens for theme="auto" and theme="dark", then the rules. */
export const css = `:host{${tokens(light, 'light')}}@media (prefers-color-scheme:dark){:host(:not([theme=light])){${tokens(dark, 'dark')}}}:host([theme=dark]){${tokens(dark, 'dark')}}${rules}`;

let sheet: CSSStyleSheet | undefined;

/** One constructed sheet, shared by every widget on the page. */
export function styleSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  }
  return sheet;
}
