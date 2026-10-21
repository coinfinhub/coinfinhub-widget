/** <coinfinhub-price coin="bitcoin" chart="7d">: one coin's price and 24h change, with the 7-day line if asked. */
import type { Coins } from './api';
import { add, coinView, DIRECTIONS, svg, type CoinView } from './dom';
import { points, trend } from './spark';
import { Widget } from './widget';

const WIDE = 120;
const HIGH = 32;

export class CoinfinhubPrice extends Widget {
  static override observedAttributes = [...Widget.observedAttributes, 'coin', 'chart'];

  readonly #view: CoinView;
  readonly #chart: HTMLDivElement;
  readonly #line: SVGSVGElement;
  readonly #area: SVGPolygonElement;
  readonly #path: SVGPolylineElement;

  constructor() {
    super('cfh-one', true);
    this.#view = coinView(this.main, 'div', 'cfh-coin');
    this.#chart = add(this.main, 'div', 'cfh-chart');
    this.#line = svg(this.#chart, 'svg', { viewBox: `0 0 ${WIDE} ${HIGH}`, preserveAspectRatio: 'none', role: 'img' });
    this.#area = svg(this.#line, 'polygon', { class: 'cfh-area' });
    this.#path = svg(this.#line, 'polyline', { class: 'cfh-line' });
    const period = add(this.#chart, 'span', 'cfh-per');
    period.textContent = '7d';
    period.setAttribute('aria-hidden', 'true');
  }

  protected override spark(): boolean {
    return (this.getAttribute('chart') ?? '').trim().toLowerCase() === '7d';
  }

  protected paint(data: Coins | null): void {
    const coin = data?.coins[0];
    this.main.hidden = !coin;
    this.card.setAttribute('aria-label', coin ? `${coin.name} price` : 'CoinFinHub price');
    if (!coin) return;
    this.#view.set(coin);
    const line = this.spark() ? coin.spark : null;
    this.#chart.hidden = !line;
    if (!line) return;
    const drawn = points(line, WIDE, HIGH, 2);
    this.#path.setAttribute('points', drawn);
    this.#area.setAttribute('points', `0,${HIGH} ${drawn} ${WIDE},${HIGH}`);
    const way = trend(line);
    this.#line.setAttribute('class', `cfh-spark ${DIRECTIONS.get(way)?.[0] ?? ''}`);
    this.#line.setAttribute('aria-label', `Price over 7 days, ${way}`);
  }
}
