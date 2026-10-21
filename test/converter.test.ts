import { describe, expect, it } from 'vitest';
import '../src/coinfinhub-widget';
import {
  fixture,
  footText,
  freshBase,
  link,
  mount,
  noteText,
  only,
  part,
  parts,
  queries,
  respond,
  settle,
  shown,
  state,
  statusText,
  stubFetch,
  useWidgetSetup,
  wait,
} from './helpers';

useWidgetSetup();

const converter = (attributes: Record<string, string>) => mount('coinfinhub-converter', attributes);
const byIds = (...names: string[]) =>
  stubFetch((url) => only([url.searchParams.get('currency') === 'INR' ? 'coins-inr' : 'coins-usd', ...names], url));
const amount = (element: HTMLElement) => part(element, '.cfh-in') as HTMLInputElement;
const value = (element: HTMLElement) => parts(element, '.cfh-in')[1] as HTMLInputElement;
const select = (element: HTMLElement) => part(element, 'select') as HTMLSelectElement;

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('<coinfinhub-converter>', () => {
  it('shows "1 BTC = $86,091.97" with both fields, their labels, and the currency picker', async () => {
    byIds();
    const element = await converter({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('data');
    expect(part(element, '.cfh-card').getAttribute('aria-label')).toBe('Bitcoin converter');
    expect(part(element, '.cfh-name').textContent).toBe('Bitcoin');
    expect(part(element, '.cfh-sum').textContent).toBe('1 BTC = $86,091.97');
    expect(parts(element, '.cfh-lab').map((label) => label.textContent)).toEqual(['Amount (BTC)', 'Value (USD)', 'Currency']);
    for (const field of parts(element, '.cfh-field')) expect(field.tagName).toBe('LABEL');
    expect(amount(element).value).toBe('1');
    expect(value(element).value).toBe('86,091.97');
    for (const input of [amount(element), value(element)]) {
      expect(input.inputMode).toBe('decimal');
      expect(input.autocomplete).toBe('off');
    }
    const listed = [...select(element).options].filter((option) => !option.hidden);
    expect(listed.map((option) => option.textContent)).toEqual(['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CHF']);
    expect(select(element).value).toBe('USD');
    expect(select(element).selectedOptions[0]?.hidden).toBe(false);
    expect(part(element, '.cfh-fine').textContent).toBe('For display, not a quote.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it('works out the value from the amount, and the amount from the value', async () => {
    byIds();
    const element = await converter({ coin: 'bitcoin', api: freshBase() });
    type(amount(element), '2');
    expect(value(element).value).toBe('172,183.94');
    type(value(element), '1,000');
    expect(amount(element).value).toBe('0.0116155');
    type(value(element), '');
    expect(amount(element).value).toBe('');
    type(amount(element), 'abc');
    expect(value(element).value).toBe('');
    type(amount(element), '0,5');
    expect(value(element).value).toBe('43,045.99');
  });

  it('keeps the field typed in last when the price refreshes', async () => {
    let price = 0.0123;
    stubFetch(() => {
      const body = fixture('coins-usd') as { coins: { slug: string; price: number }[] };
      for (const coin of body.coins) coin.price = price;
      return new Response(JSON.stringify(body));
    });
    const element = await converter({ coin: 'quietcoin', api: freshBase() });
    type(value(element), '1');
    expect(amount(element).value).toBe('81.300813');
    price = 0.025;
    await wait(61_000);
    expect(value(element).value).toBe('1');
    expect(amount(element).value).toBe('40');
  });

  it('groups rupees in lakhs, and asks again when the picker changes, keeping the coin amount', async () => {
    const mock = byIds();
    const element = await converter({ coin: 'bitcoin', api: freshBase() });
    type(amount(element), '1');
    select(element).value = 'INR';
    select(element).dispatchEvent(new Event('change'));
    expect(element.getAttribute('currency')).toBe('INR');
    // While the price in rupees loads, the coin and the fields stay, so focus never moves.
    expect(shown(part(element, '.cfh-coin'))).toBe(true);
    expect(value(element).value).toBe('');
    await settle();
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=bitcoin&currency=INR']);
    expect(amount(element).value).toBe('1');
    expect(value(element).value).toBe('82,99,733.90');
    expect(parts(element, '.cfh-lab')[1]?.textContent).toBe('Value (INR)');
    expect(part(element, '.cfh-sum').textContent).toBe('1 BTC = ₹82,99,733.90');
    expect(footText(element)).toBe('USD rate derived from ECB data');
  });

  it('shows a currency it does not list, so picking any listed one is a change', async () => {
    stubFetch((url) => (url.searchParams.get('currency') === 'SEK' ? respond('error-invalid-currency') : only(['coins-usd'], url)));
    const element = await converter({ coin: 'bitcoin', currency: 'sek', api: freshBase() });
    expect(statusText(element)).toBe('Unknown currency. Use one of USD, EUR, GBP, JPY, CNY, INR, AUD or CHF.');
    const shown = select(element).selectedOptions[0];
    expect(shown?.textContent).toBe('SEK');
    expect(shown?.disabled).toBe(true);
    expect(parts(element, '.cfh-lab')[1]?.textContent).toBe('Value (SEK)');
    select(element).value = 'USD';
    select(element).dispatchEvent(new Event('change'));
    expect(element.getAttribute('currency')).toBe('USD');
    await settle();
    expect(value(element).value).toBe('86,091.97');
    expect(select(element).selectedOptions[0]?.hidden).toBe(false);
  });

  it('follows the currency attribute set by the page', async () => {
    byIds();
    const element = await converter({ coin: 'bitcoin', currency: 'inr', api: freshBase() });
    expect(select(element).value).toBe('INR');
    expect(value(element).value).toBe('82,99,733.90');
  });

  it('shows US dollars, labelled, when the currency has no rate', async () => {
    stubFetch((url) => (url.searchParams.get('currency') === 'EUR' ? respond('error-rate-unavailable') : only(['coins-usd'], url)));
    const element = await converter({ coin: 'bitcoin', currency: 'EUR', api: freshBase() });
    expect(select(element).value).toBe('EUR');
    expect(parts(element, '.cfh-lab')[1]?.textContent).toBe('Value (USD)');
    expect(value(element).value).toBe('86,091.97');
    expect(noteText(element)).toBe('Shown in US dollars: no EUR rate right now.');
  });

  it('works from the price alone when other fields are missing', async () => {
    stubFetch(() => respond('coins-missing-fields'));
    const element = await converter({ coin: 'solana', api: freshBase() });
    expect(part(element, '.cfh-sum').textContent).toBe('1 Solana = $162.08');
    expect(parts(element, '.cfh-lab')[0]?.textContent).toBe('Amount');
    expect(value(element).value).toBe('162.08');
  });

  it('keeps its fields while loading and on errors, with the status beside them', async () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    const loading = await converter({ coin: 'bitcoin', api: freshBase() });
    expect(statusText(loading)).toBe('Loading price…');
    expect(shown(part(loading, '.cfh-form'))).toBe(true);
    expect(shown(part(loading, '.cfh-coin'))).toBe(false);
    expect(shown(part(loading, '.cfh-sum'))).toBe(false);
    expect(part(loading, '.cfh-card').getAttribute('aria-label')).toBe('CoinFinHub converter');
    stubFetch(() => respond('error-unknown-coin'));
    const unknown = await converter({ coin: 'not-a-coin', api: freshBase() });
    expect(statusText(unknown)).toBe('CoinFinHub has no page for this coin.');
    expect(link(unknown).href).toBe('https://www.coinfinhub.com/');
  });
});
