/**
 * <coinfinhub-ticker top="10"> or <coinfinhub-ticker coins="…">: a strip that scrolls sideways in a loop,
 * with CSS only. It pauses on hover and focus; with reduced motion it stands still and scrolls by hand.
 */
import type { Coin, Coins, Want } from './api';
import { add } from './dom';
import { listUnits, Rows } from './list';
import { Widget } from './widget';

/** How fast the strip moves, in pixels a second, however many coins and however wide the view. */
const SPEED = 45;

export class CoinfinhubTicker extends Widget {
  static override observedAttributes = [...Widget.observedAttributes, 'coins', 'top'];

  readonly #view: HTMLDivElement;
  readonly #track: HTMLDivElement;
  /** The run of coins, then copies of it: the loop moves the track by half its width. */
  readonly #runs: Rows[] = [];
  #coins: Coin[] = [];
  /** The distance one loop covers, in pixels, as its duration was last set for. */
  #shift = 0;

  constructor() {
    super('cfh-ticker', false, 240);
    this.card.setAttribute('aria-label', 'Coin prices');
    // Focusable, so a keyboard can pause it (focus) or scroll it (reduced motion).
    this.#view = add(this.main, 'div', 'cfh-view');
    this.#view.tabIndex = 0;
    this.#track = add(this.#view, 'div', 'cfh-track');
    this.#copies(2);
    if ('ResizeObserver' in window) {
      const sizes = new ResizeObserver(() => {
        this.#fit();
      });
      sizes.observe(this.#view);
      sizes.observe(this.#runs[0]?.list ?? this.#view);
    }
  }

  protected override units(): Want[] {
    return listUnits(this, 10);
  }

  protected paint(data: Coins | null): void {
    this.main.hidden = !data;
    if (!data) return;
    this.#coins = data.coins;
    for (const run of this.#runs) run.set(data.coins);
  }

  /** Keeps `count` runs. Every copy only fills the loop: hidden from screen readers and never focusable. */
  #copies(count: number): void {
    while (this.#runs.length < count) {
      const run = new Rows(this.#track, 'cfh-run', 'cfh-tick');
      if (this.#runs.length) {
        run.list.setAttribute('aria-hidden', 'true');
        run.list.inert = true;
      }
      run.set(this.#coins);
      this.#runs.push(run);
    }
    for (const run of this.#runs.splice(count)) run.list.remove();
  }

  /**
   * Enough runs that half the track covers the view, so no blank band ever scrolls through, and a duration
   * from that half's width, so the speed stays the same. Small changes of width (a price that grew a digit)
   * keep the duration, so the strip never jumps.
   */
  #fit(): void {
    const width = this.#runs[0]?.list.offsetWidth ?? 0;
    if (!width) return;
    const half = Math.max(1, Math.ceil(this.#view.clientWidth / width));
    this.#copies(2 * half);
    const shift = half * width;
    if (Math.abs(shift - this.#shift) > this.#shift / 10) {
      this.#shift = shift;
      this.ownRules(`.cfh-track{animation-duration:${String(Math.max(1, Math.round(shift / SPEED)))}s}`);
    }
  }
}
