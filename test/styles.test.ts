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
  it.each(['ink', 'ink-2', 'muted', 'accent', 'flat'] as const)('%s text is at least 4.5:1 on the surface', (token) => {
    expect(contrast(theme[token], theme.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['up', 'down'] as const)('%s is at least 4.77:1 on the surface', (token) => {
    expect(contrast(theme[token], theme.surface)).toBeGreaterThanOrEqual(4.77);
  });

  it('keeps the tip readable', () => {
    expect(contrast(theme['tip-ink'], theme['tip-bg'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the brand gold for the "explained" rule', () => {
    expect(theme.gold).toBe('#e1af40');
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
  });

  it("follows the host's text size, but never below 15 px", () => {
    expect(rules).toMatch(/:host\s*\{[^}]*font-size:\s*max\(1em,\s*15px\)/);
    expect(rules).toMatch(/:host\s*\{[^}]*all:\s*initial/);
  });

  it('sizes text in em only: no rem, no px font sizes', () => {
    expect(rules).not.toMatch(/\drem\b/);
    for (const [, value] of rules.matchAll(/font-size:\s*([^;}]+)/g)) {
      expect(value?.trim()).toMatch(/^(max\(1em,\s*15px\)|[\d.]+em)$/);
    }
  });

  it('has no motion at all', () => {
    expect(rules).not.toMatch(/animation|transition|@keyframes|scroll-behavior/);
  });

  it('keeps link targets at least 28 px tall, 32 px for touch', () => {
    expect(rules).toMatch(/\.cfh-link\s*\{[^}]*min-height:\s*28px/);
    expect(rules).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.cfh-link\s*\{\s*min-height:\s*32px/);
  });

  it('draws a 2 px focus ring in the accent colour', () => {
    expect(rules).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--cfh-accent\)/);
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
