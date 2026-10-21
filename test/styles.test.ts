import { describe, expect, it } from 'vitest';
import { css, dark, light } from '../src/styles';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

describe.each([
  ['light', light],
  ['dark', dark],
])('the %s theme', (_name, theme) => {
  // The surfaces text sits on: the card, the strip's cells and badges, and the lettered logo.
  const surfaces = ['surface', 'surface-2'] as const;

  it.each(['ink', 'ink-2', 'muted', 'accent', 'flat'] as const)('%s text is at least 4.5:1 on both surfaces', (token) => {
    for (const surface of surfaces) expect(contrast(theme[token], theme[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['up', 'down'] as const)('%s is at least 4.77:1 on both surfaces', (token) => {
    for (const surface of surfaces) expect(contrast(theme[token], theme[surface])).toBeGreaterThanOrEqual(4.77);
  });

  it("keeps the logo's letter readable on its circle", () => {
    expect(contrast(theme.accent, theme['accent-soft'])).toBeGreaterThanOrEqual(4.5);
  });

  it('gives the fields a border of at least 3:1, as a control needs', () => {
    expect(contrast(theme.muted, theme.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('the stylesheet', () => {
  const rules = css.toLowerCase();

  it('defines the same tokens for both themes', () => {
    expect(Object.keys(dark)).toEqual(Object.keys(light));
  });

  it('switches to dark for theme="auto" in a dark scheme and for theme="dark", never for theme="light"', () => {
    expect(css).toContain('@media (prefers-color-scheme:dark){:host(:not([theme=light])){--cfh-surface:#1a1920;');
    expect(css).toContain(':host([theme=dark]){--cfh-surface:#1a1920;');
    expect(css).toMatch(/:host\(\[theme=dark\]\)\{[^}]*color-scheme:dark/);
  });

  it("follows the host's text size, but never below 15 px", () => {
    expect(rules).toMatch(/:host\s*\{[^}]*font-size:\s*max\(1em,\s*15px\)/);
    expect(rules).toMatch(/:host\s*\{[^}]*all:\s*initial/);
  });

  it('sizes text in em only: no rem, no px font sizes (fields never below 16 px, so phones never zoom)', () => {
    expect(rules).not.toMatch(/\drem\b/);
    for (const [, value] of rules.matchAll(/font-size:\s*([^;}]+)/g)) {
      expect(value?.trim()).toMatch(/^(max\(1em,\s*1[56]px\)|[\d.]+em)$/);
    }
    expect(rules).toMatch(/\.cfh-in\s*\{[^}]*font-size:\s*max\(1em,\s*16px\)/);
  });

  it('moves only in the ticker, paused on hover and focus, and not at all with reduced motion', () => {
    expect(rules.match(/animation[\w-]*:/g)).toEqual(['animation:', 'animation-play-state:', 'animation:']);
    expect(rules).not.toMatch(/transition|scroll-behavior/);
    expect(rules).toMatch(/\.cfh-track\s*\{[^}]*animation:\s*cfh-roll/);
    expect(rules).toMatch(/\.cfh-view:hover \.cfh-track,\s*\.cfh-view:focus-within \.cfh-track\s*\{\s*animation-play-state:\s*paused/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(rules)?.[1] ?? '';
    expect(reduced).toMatch(/\.cfh-track\s*\{\s*animation:\s*none/);
    expect(reduced).toMatch(/\.cfh-view\s*\{\s*overflow-x:\s*auto/);
    expect(reduced).toMatch(/\.cfh-run \+ \.cfh-run\s*\{\s*display:\s*none/);
  });

  it('keeps link targets at least 28 px tall, 32 px for touch, and fields taller still', () => {
    expect(rules).toMatch(/\.cfh-link\s*\{[^}]*min-height:\s*28px/);
    expect(rules).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.cfh-link\s*\{\s*min-height:\s*32px/);
    expect(rules).toMatch(/\.cfh-in\s*\{[^}]*min-height:\s*2\.5em/);
  });

  it('draws a 2 px focus ring in the accent colour on everything focusable', () => {
    expect(rules).toMatch(/\.cfh-link:focus-visible,\s*\.cfh-view:focus-visible,\s*\.cfh-in:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--cfh-accent\)/);
  });

  it('steps the layout with container queries from 200 px', () => {
    expect(rules).toMatch(/min-width:\s*200px/);
    expect(rules).toMatch(/container:\s*cfh \/ inline-size/);
    expect(rules).toMatch(/@container cfh \(min-width: \d+px\)/);
  });

  it('uses Inter when the page has it, with no font download', () => {
    expect(rules).toContain('font-family: inter, system-ui, sans-serif');
    expect(rules).not.toMatch(/@font-face|@import|url\(/);
  });
});
