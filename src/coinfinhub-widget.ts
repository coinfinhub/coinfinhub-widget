/**
 * CoinFinHub widgets: <coinfinhub-price>, <coinfinhub-list>, <coinfinhub-ticker> and <coinfinhub-converter>.
 *
 * Framework-free, no dependencies, Shadow DOM. Every word from the server is written with textContent,
 * never as HTML, and links and logos only ever come from www.coinfinhub.com. Each element is defined
 * once, even when the script loads twice.
 */
import { CoinfinhubConverter } from './converter';
import { CoinfinhubList } from './list';
import { CoinfinhubPrice } from './price';
import { CoinfinhubTicker } from './ticker';

for (const [name, element] of [
  ['coinfinhub-price', CoinfinhubPrice],
  ['coinfinhub-list', CoinfinhubList],
  ['coinfinhub-ticker', CoinfinhubTicker],
  ['coinfinhub-converter', CoinfinhubConverter],
] as const) {
  if (!customElements.get(name)) customElements.define(name, element);
}
