/** Small DOM helpers shared by every widget. Everything is written with textContent, never as HTML. */
import type { Coin } from './api';

/** Direction: its colour class and arrow. An unknown direction gets neither. */
export const DIRECTIONS = new Map([
  ['up', ['cfh-up', '▲']],
  ['down', ['cfh-down', '▼']],
  ['flat', ['cfh-flat', '•']],
]);

export function add<K extends keyof HTMLElementTagNameMap>(parent: Node, tag: K, className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent.appendChild(node);
  return node;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  parent: Node,
  tag: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  parent.appendChild(node);
  return node;
}

/** Logos that failed to load once: the lettered circle from then on, with no new request every minute. */
const broken = new Set<string>();

/** One coin's parts: logo, name, symbol, badge, price and "▲ +2.80% 24h". Each widget lays them out its own way. */
export interface CoinView {
  root: HTMLElement;
  set(coin: Coin): void;
}

export function coinView(parent: Node, tag: 'div' | 'li', className: string): CoinView {
  const root = add(parent, tag, className);
  const logo = add(root, 'span', 'cfh-logo');
  logo.setAttribute('aria-hidden', 'true');
  const id = add(root, 'span', 'cfh-id');
  const name = add(id, 'span', 'cfh-name');
  id.append(' ');
  const symbol = add(id, 'span', 'cfh-sym');
  id.append(' ');
  const badge = add(id, 'span', 'cfh-badge');
  root.append(' ');
  const value = add(root, 'span', 'cfh-val');
  const price = add(value, 'span', 'cfh-price');
  value.append(' ');
  const change = add(value, 'span', 'cfh-chg');
  const arrow = add(change, 'span');
  arrow.setAttribute('aria-hidden', 'true');
  change.append(' ');
  const changeText = add(change, 'span');
  change.append(' ');
  add(change, 'span', 'cfh-per').textContent = '24h';

  return {
    root,
    set(coin) {
      const letter = (Array.from(coin.symbol || coin.name)[0] ?? '').toUpperCase();
      const src = coin.logo && !broken.has(coin.logo) ? coin.logo : null;
      if (!src) {
        if (logo.textContent !== letter || logo.firstElementChild) logo.textContent = letter;
      } else if (logo.firstElementChild?.getAttribute('src') !== src) {
        const image = document.createElement('img');
        image.alt = '';
        image.decoding = 'async';
        image.addEventListener('error', () => {
          broken.add(src);
          // Only while this image is still the one shown: a late error must not wipe a newer logo.
          if (logo.firstElementChild === image) logo.textContent = letter;
        });
        image.src = src;
        logo.replaceChildren(image);
      }
      name.textContent = coin.name;
      symbol.textContent = coin.symbol;
      badge.textContent = coin.badge;
      badge.hidden = !coin.badge;
      price.textContent = coin.price;
      const direction = DIRECTIONS.get(coin.direction ?? '');
      change.hidden = !coin.change;
      change.className = direction ? `cfh-chg ${direction[0]}` : 'cfh-chg';
      arrow.textContent = direction?.[1] ?? '';
      changeText.textContent = coin.change;
    },
  };
}
