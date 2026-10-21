/**
 * <coinfinhub-converter coin="bitcoin">: "1 BTC = $88,888.00", with an amount of the coin and its value,
 * both editable, and a currency picker. The maths happens here, from the price the server sends.
 */
import type { Coins } from './api';
import { add, coinView, type CoinView } from './dom';
import { formatAmount, parseAmount } from './format';
import { Widget } from './widget';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CHF'];

export class CoinfinhubConverter extends Widget {
  static override observedAttributes = [...Widget.observedAttributes, 'coin'];

  readonly #view: CoinView;
  readonly #sum: HTMLParagraphElement;
  readonly #amountLabel: HTMLSpanElement;
  readonly #valueLabel: HTMLSpanElement;
  readonly #amount: HTMLInputElement;
  readonly #value: HTMLInputElement;
  readonly #currency: HTMLSelectElement;
  /** The coin whose name and logo are showing: kept while another currency loads. */
  #shown = '';
  /** The field the visitor typed in last: the other one follows it. */
  #typed: 'amount' | 'value' = 'amount';
  #data: Coins | null = null;
  /** Shows a currency the picker doesn't list, such as currency="SEK", so picking any listed one is a change. */
  readonly #unlisted: HTMLOptionElement;

  constructor() {
    super('cfh-conv', true);
    this.#view = coinView(this.main, 'div', 'cfh-coin');
    this.#sum = add(this.main, 'p', 'cfh-sum');
    const form = add(this.main, 'div', 'cfh-form');
    const field = (): [HTMLSpanElement, HTMLInputElement] => {
      const label = add(form, 'label', 'cfh-field');
      const text = add(label, 'span', 'cfh-lab');
      const input = add(label, 'input', 'cfh-in');
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.spellcheck = false;
      return [text, input];
    };
    [this.#amountLabel, this.#amount] = field();
    [this.#valueLabel, this.#value] = field();
    this.#amount.value = '1';
    const pick = add(form, 'label', 'cfh-field');
    add(pick, 'span', 'cfh-lab').textContent = 'Currency';
    this.#currency = add(pick, 'select', 'cfh-in');
    this.#unlisted = add(this.#currency, 'option');
    this.#unlisted.disabled = true;
    for (const code of CURRENCIES) add(this.#currency, 'option').textContent = code;
    add(this.main, 'p', 'cfh-fine').textContent = 'For display, not a quote.';

    this.#amount.addEventListener('input', () => {
      this.#typed = 'amount';
      this.#follow();
    });
    this.#value.addEventListener('input', () => {
      this.#typed = 'value';
      this.#follow();
    });
    // Another currency keeps the coin amount and asks for the price in it.
    this.#currency.addEventListener('change', () => {
      this.#typed = 'amount';
      this.setAttribute('currency', this.#currency.value);
    });
  }

  protected paint(data: Coins | null): void {
    this.#data = data;
    const coin = data?.coins[0];
    const slug = this.coin();
    if (coin) {
      this.#view.set(coin);
      this.#shown = slug;
    }
    // Hidden only until there is a coin to show, so a change of currency never takes the focus away.
    this.#view.root.hidden = this.#shown !== slug;
    this.card.setAttribute('aria-label', coin ? `${coin.name} converter` : 'CoinFinHub converter');
    this.#sum.textContent = coin ? `1 ${coin.symbol || coin.name} = ${coin.price}` : '';
    this.#sum.hidden = !coin;
    const asked = this.currency();
    const listed = CURRENCIES.includes(asked);
    this.#unlisted.textContent = listed ? '' : asked;
    this.#unlisted.hidden = listed;
    this.#currency.value = asked;
    this.#amountLabel.textContent = coin?.symbol ? `Amount (${coin.symbol})` : 'Amount';
    this.#valueLabel.textContent = `Value (${data?.currency ?? asked})`;
    this.#follow();
  }

  /** Works out the field the visitor didn't type in last; it stays empty without a price or a number. */
  #follow(): void {
    const price = this.#data?.coins[0]?.value;
    const currency = this.#data?.currency ?? '';
    const typed = parseAmount((this.#typed === 'amount' ? this.#amount : this.#value).value);
    const other = this.#typed === 'amount' ? this.#value : this.#amount;
    other.value =
      price && typed !== null
        ? formatAmount(this.#typed === 'amount' ? typed * price : typed / price, currency, this.#typed === 'amount' ? 'money' : 'coin')
        : '';
  }
}
