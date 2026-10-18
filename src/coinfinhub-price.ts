/**
 * <coinfinhub-price coin="bitcoin" currency="USD" theme="auto">: a coin's price from CoinFinHub.
 *
 * Framework-free, no dependencies, Shadow DOM. Every word from the server is written with
 * textContent, never as HTML, and the link only ever points at www.coinfinhub.com.
 */
import { coinLink, getPrice, SITE, type Failure, type Price } from './api';
import { styleSheet } from './styles';

const NAME = 'coinfinhub-price';
const MINUTE = 60_000;
const STALE = 10 * MINUTE;

/** Direction: its colour class and arrow. An unknown direction gets neither. */
const DIRECTIONS = new Map([
  ['up', ['cfh-up', '▲']],
  ['down', ['cfh-down', '▼']],
  ['flat', ['cfh-flat', '•']],
]);

/** Codes that mean the coin itself is wrong: the server's message helps the site's author, and the link goes home. */
const BAD_COIN = new Set(['invalid_coin', 'unknown_coin', 'no_coin']);
const OWN_MESSAGE = new Set([...BAD_COIN, 'invalid_currency', 'invalid_query']);
const UNAVAILABLE = 'Price unavailable right now.';

const ago = (ms: number): string => {
  const words = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return words.format(-minutes, 'minute');
  if (minutes < 48 * 60) return words.format(-Math.round(minutes / 60), 'hour');
  return words.format(-Math.round(minutes / 1440), 'day');
};

function add<K extends keyof HTMLElementTagNameMap>(parent: Node, tag: K, className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent.appendChild(node);
  return node;
}

class CoinfinhubPrice extends HTMLElement {
  static observedAttributes = ['coin', 'currency', 'api'];

  readonly #card: HTMLDivElement;
  readonly #main: HTMLDivElement;
  readonly #name: HTMLSpanElement;
  readonly #symbol: HTMLSpanElement;
  readonly #price: HTMLSpanElement;
  readonly #change: HTMLSpanElement;
  readonly #arrow: HTMLSpanElement;
  readonly #changeText: HTMLSpanElement;
  readonly #context: HTMLDivElement;
  readonly #label: HTMLSpanElement;
  readonly #contextText: HTMLSpanElement;
  readonly #tip: HTMLSpanElement;
  readonly #status: HTMLParagraphElement;
  readonly #note: HTMLParagraphElement;
  readonly #link: HTMLAnchorElement;
  readonly #rate: HTMLSpanElement;

  #live = false;
  #key = '';
  #generation = 0;
  #busy = false;
  #inView = true;
  #observer: IntersectionObserver | null = null;
  #timer = 0;
  #due = 0;
  #failures = 0;
  #data: Price | null = null;
  #receivedAt = 0;
  /** The currency asked for while its rate is unavailable and the price is shown in USD instead. */
  #usdFor = '';
  #usdUntil = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [styleSheet()];

    const card = (this.#card = add(root, 'div', 'cfh-card'));
    card.setAttribute('role', 'group');
    // English text, read as English and laid out left to right on any host page.
    card.lang = 'en';
    card.dir = 'ltr';
    this.#main = add(card, 'div', 'cfh-main');
    const top = add(this.#main, 'div', 'cfh-top');
    const head = add(top, 'p', 'cfh-head');
    this.#name = add(head, 'span', 'cfh-name');
    this.#symbol = add(head, 'span', 'cfh-sym');
    const row = add(top, 'p', 'cfh-row');
    this.#price = add(row, 'span', 'cfh-price');
    this.#change = add(row, 'span', 'cfh-chg');
    this.#arrow = add(this.#change, 'span');
    this.#arrow.setAttribute('aria-hidden', 'true');
    this.#change.append(' ');
    this.#changeText = add(this.#change, 'span');
    this.#change.append(' ');
    add(this.#change, 'span', 'cfh-per').textContent = '24h';

    // The context line: focusable, with its definition and disclaimer on hover, focus or tap. No ⓘ.
    const context = (this.#context = add(this.#main, 'div', 'cfh-ctx'));
    context.tabIndex = 0;
    context.setAttribute('aria-describedby', 'tip');
    this.#label = add(context, 'span', 'cfh-lbl');
    this.#contextText = add(context, 'span');
    this.#tip = add(context, 'span', 'cfh-tip');
    this.#tip.id = 'tip';
    this.#tip.setAttribute('role', 'tooltip');
    let focusedBefore = false;
    context.addEventListener('pointerdown', () => {
      focusedBefore = root.activeElement === context;
    });
    context.addEventListener('click', () => {
      if (focusedBefore) {
        context.classList.toggle('cfh-shut');
      } else {
        context.classList.remove('cfh-shut');
        context.focus();
      }
    });
    context.addEventListener('focusout', () => {
      context.classList.remove('cfh-shut');
    });
    context.addEventListener('pointerleave', () => {
      if (root.activeElement !== context) context.classList.remove('cfh-shut');
    });

    this.#status = add(card, 'p', 'cfh-status');
    this.#status.setAttribute('role', 'status');
    this.#note = add(card, 'p', 'cfh-note');
    const foot = add(card, 'p', 'cfh-foot');
    this.#link = add(foot, 'a', 'cfh-link');
    this.#link.textContent = 'Powered by CoinFinHub';
    this.#link.target = '_blank';
    // No noreferrer: the referrer is how CoinFinHub sees which sites send visitors.
    this.#link.rel = 'nofollow noopener';
    this.#rate = add(foot, 'span');
  }

  connectedCallback(): void {
    this.#live = true;
    if ('IntersectionObserver' in window) {
      this.#inView = false;
      this.#observer = new IntersectionObserver((entries) => {
        this.#inView = entries.at(-1)?.isIntersecting ?? false;
        this.#tick();
      });
      this.#observer.observe(this);
    }
    document.addEventListener('visibilitychange', this.#onVisibility);
    document.addEventListener('keydown', this.#onKey);
    // Moved within the page: keep what it shows. New coin, currency or API: start again.
    if (this.#key === this.#settings().join(' ')) this.#tick();
    else this.#restart();
  }

  disconnectedCallback(): void {
    this.#live = false;
    this.#observer?.disconnect();
    this.#observer = null;
    document.removeEventListener('visibilitychange', this.#onVisibility);
    document.removeEventListener('keydown', this.#onKey);
    clearTimeout(this.#timer);
    this.#generation++;
    this.#busy = false;
  }

  attributeChangedCallback(_name: string, before: string | null, after: string | null): void {
    if (this.#live && before !== after) this.#restart();
  }

  readonly #onVisibility = (): void => {
    this.#tick();
  };

  /** Escape closes an open tip, wherever focus is; it opens again on the next hover, focus or tap. */
  readonly #onKey = (event: KeyboardEvent): void => {
    const line = this.#context;
    if (event.key === 'Escape' && (line.matches(':hover') || this.shadowRoot?.activeElement === line)) {
      line.classList.add('cfh-shut');
    }
  };

  /** The API base, coin and currency, as the attributes say now. */
  #settings(): [string, string, string] {
    let base = SITE;
    const api = this.getAttribute('api');
    if (api) {
      try {
        const url = new URL(api, document.baseURI);
        if (url.protocol === 'https:' || url.protocol === 'http:') base = url.href.replace(/\/+$/, '');
      } catch {
        // Not a URL: the real endpoint.
      }
    }
    const coin = (this.getAttribute('coin') ?? '').trim();
    const currency = (this.getAttribute('currency') ?? '').trim().toUpperCase() || 'USD';
    return [base, coin, currency];
  }

  #restart(): void {
    this.#key = this.#settings().join(' ');
    this.#generation++;
    this.#busy = false;
    this.#data = null;
    this.#failures = 0;
    this.#due = 0;
    this.#usdFor = '';
    this.#usdUntil = 0;
    this.#render(null);
    this.#tick();
  }

  /** Fetches when due, but only while connected, on screen and in a visible tab; otherwise waits. */
  #tick(): void {
    clearTimeout(this.#timer);
    if (!this.#live || this.#busy || !this.#inView || document.hidden) return;
    const wait = this.#due - performance.now();
    if (wait > 0) {
      this.#timer = window.setTimeout(() => {
        this.#tick();
      }, wait);
    } else {
      void this.#load();
    }
  }

  async #load(): Promise<void> {
    const [base, coin, currency] = this.#settings();
    if (!coin) {
      this.#render({ ok: false, code: 'no_coin', message: 'Add a coin, for example coin="bitcoin".', retryAfter: null });
      return;
    }
    const generation = this.#generation;
    const usd = currency !== 'USD' && performance.now() < this.#usdUntil;
    this.#busy = true;
    const answer = await getPrice(base, coin, usd ? 'USD' : currency);
    if (generation !== this.#generation) return;
    this.#busy = false;
    const now = performance.now();

    if (answer.ok) {
      this.#data = answer.price;
      this.#receivedAt = now;
      this.#failures = 0;
      this.#usdFor = usd ? currency : '';
      this.#due = now + MINUTE + Math.random() * 10_000;
      this.#render(null);
    } else if (answer.code === 'rate_unavailable' && !usd && currency !== 'USD') {
      // No rate for this currency: show the USD price, labelled, and ask for the currency again later.
      this.#usdUntil = now + (answer.retryAfter ?? 600) * 1000;
      this.#due = now;
    } else {
      this.#failures++;
      const backoff = Math.min(5 * MINUTE, 10_000 * 3 ** (this.#failures - 1) * (1 + Math.random() / 2));
      this.#due = now + (answer.retryAfter ? answer.retryAfter * 1000 : backoff);
      // A failed refresh keeps the last good price until it is 10 minutes old.
      if (!this.#data || this.#age(now) > STALE) this.#render(answer);
    }
    this.#tick();
  }

  /** How old the shown price is: from updatedAt, but never less than the time since it arrived. */
  #age(now: number): number {
    const since = now - this.#receivedAt;
    const updatedAt = this.#data?.updatedAt;
    return updatedAt ? Math.max(since, Date.now() - updatedAt) : since;
  }

  /** Shows the data (failure null, data present), loading (both null) or the error state. */
  #render(failure: Failure | null): void {
    const data = failure ? null : this.#data;
    const coin = this.#settings()[1];
    this.#card.dataset.state = data ? 'data' : failure ? 'error' : 'loading';
    this.#card.setAttribute('aria-label', data ? `${data.name} price` : 'CoinFinHub price');
    this.#main.hidden = !data;
    this.#status.hidden = !!data;
    const status = data
      ? ''
      : !failure
        ? 'Loading price…'
        : OWN_MESSAGE.has(failure.code)
          ? (failure.message ?? UNAVAILABLE)
          : UNAVAILABLE;
    // Written only when it changes: the status region never announces a refresh.
    if (this.#status.textContent !== status) this.#status.textContent = status;
    this.#link.href = data ? data.url : !coin || (failure && BAD_COIN.has(failure.code)) ? `${SITE}/` : coinLink(coin);

    const notes: (string | null)[] = [];
    if (data) {
      this.#name.textContent = data.name;
      this.#symbol.textContent = data.symbol;
      this.#price.textContent = data.price;
      const direction = DIRECTIONS.get(data.direction ?? '');
      this.#change.hidden = !data.change;
      this.#change.className = direction ? `cfh-chg ${direction[0]}` : 'cfh-chg';
      this.#arrow.textContent = direction?.[1] ?? '';
      this.#changeText.textContent = data.change;
      // The line travels with its period, its definition and the disclaimer, or not at all.
      this.#context.hidden = !data.context || !data.contextTip;
      this.#label.hidden = !data.contextLabel;
      this.#label.textContent = data.contextLabel;
      this.#contextText.textContent = data.context;
      this.#tip.textContent = data.contextTip;
      if (this.#usdFor) notes.push(`Shown in US dollars: no ${this.#usdFor} rate right now.`);
      notes.push(data.note, data.age);
      this.#rate.textContent = data.rate ? `· ${data.rate}` : '';
    } else {
      if (failure && this.#data) notes.push(`Updated ${ago(this.#age(performance.now()))}`);
      this.#rate.textContent = '';
    }
    this.#note.textContent = notes.filter(Boolean).join('\n');
    this.#note.hidden = !this.#note.textContent;
  }
}

if (!customElements.get(NAME)) customElements.define(NAME, CoinfinhubPrice);
