/**
 * <coinfinhub-list coins="bitcoin,ethereum"> or <coinfinhub-list top="5">: rows of coins, or with
 * layout="strip" compact cells side by side. A coin CoinFinHub doesn't know is simply left out.
 */
import type { Coin, Coins } from './api';
import { add, coinView, type CoinView } from './dom';
import { slugs, Widget } from './widget';

/** Reuses each coin's parts between refreshes, so logos and nodes stay put. */
export class Rows {
  readonly list: HTMLUListElement;
  readonly #itemClass: string;
  #views = new Map<string, CoinView>();

  constructor(parent: Node, className: string, itemClass: string) {
    this.list = add(parent, 'ul', className);
    this.#itemClass = itemClass;
  }

  set(coins: Coin[]): void {
    const views = new Map<string, CoinView>();
    for (const coin of coins) {
      const view = this.#views.get(coin.slug) ?? coinView(this.list, 'li', this.#itemClass);
      view.set(coin);
      views.set(coin.slug, view);
    }
    this.#views = views;
    this.list.replaceChildren(...[...views.values()].map((view) => view.root));
  }
}

/** The units for coins="…" or top="…" (1 to 20; `top` when neither is usable). */
export function listUnits(element: Element, top: number): string[] {
  const asked = slugs(element.getAttribute('coins'));
  if (asked.length) return asked;
  const n = Math.round(Number(element.getAttribute('top')));
  return [`top=${n >= 1 ? Math.min(20, n) : top}`];
}

export class CoinfinhubList extends Widget {
  static override observedAttributes = [...Widget.observedAttributes, 'coins', 'top'];

  readonly #rows: Rows;

  constructor() {
    super('', false);
    this.card.setAttribute('aria-label', 'Coin prices');
    this.#rows = new Rows(this.main, 'cfh-items', 'cfh-item');
  }

  protected units(): string[] {
    return listUnits(this, 5);
  }

  protected paint(data: Coins | null): void {
    this.main.hidden = !data;
    if (data) this.#rows.set(data.coins);
  }
}
