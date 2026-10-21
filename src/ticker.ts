/**
 * <coinfinhub-ticker top="10"> or <coinfinhub-ticker coins="…">: a strip that scrolls sideways in a loop,
 * with CSS only. It pauses on hover and focus; with reduced motion it stands still and scrolls by hand.
 */
import type { Coins } from './api';
import { add } from './dom';
import { listUnits, Rows } from './list';
import { Widget } from './widget';

/** Seconds each coin takes to pass, so the speed is the same however many coins there are. */
const PER_COIN = 5;

export class CoinfinhubTicker extends Widget {
  static override observedAttributes = [...Widget.observedAttributes, 'coins', 'top'];

  readonly #track: HTMLDivElement;
  readonly #runs: [Rows, Rows];

  constructor() {
    super('cfh-ticker', false);
    this.card.setAttribute('aria-label', 'Coin prices');
    // Focusable, so a keyboard can pause it (focus) or scroll it (reduced motion).
    const view = add(this.main, 'div', 'cfh-view');
    view.tabIndex = 0;
    this.#track = add(view, 'div', 'cfh-track');
    this.#runs = [new Rows(this.#track, 'cfh-run', 'cfh-tick'), new Rows(this.#track, 'cfh-run', 'cfh-tick')];
    // The second run only makes the loop seamless: hidden from screen readers and never focusable.
    const copy = this.#runs[1].list;
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
  }

  protected units(): string[] {
    return listUnits(this, 10);
  }

  protected paint(data: Coins | null): void {
    this.main.hidden = !data;
    if (!data) return;
    for (const run of this.#runs) run.set(data.coins);
    this.#track.style.animationDuration = `${data.coins.length * PER_COIN}s`;
  }
}
