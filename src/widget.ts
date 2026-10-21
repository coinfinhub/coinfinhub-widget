/**
 * What every CoinFinHub widget shares: the attributes currency and api, the states (loading, data, error),
 * the refresh while on screen, the backoff, the US-dollar fallback, and the footer with its link.
 * Each element fills `main` and says which coins it wants.
 */
import { BAD_COIN, coinLink, getCoins, SITE, SLUG, type Coins, type Failure, type Want } from './api';
import { add, svg } from './dom';
import { styleSheet } from './styles';

const MINUTE = 60_000;
const STALE = 10 * MINUTE;
/** Codes whose message from the server helps the site's author; others get the plain "unavailable". */
const OWN_MESSAGE = new Set([...BAD_COIN, 'no_coin', 'invalid_currency', 'invalid_query']);
/** A failure the widget finds itself, before any call. */
const NO_CALL = { ok: false, retryAfter: null } as const;

/** One IntersectionObserver for every widget, so widgets that come on screen together ask in the same tick. */
let observer: IntersectionObserver | undefined;
const watchers = new Map<Element, (visible: boolean) => void>();

/**
 * The page's refresh clock: every widget showing prices refreshes on its beat (60 s plus one jitter of up
 * to 10 s for the whole page), so their calls merge. A widget that fails leaves it for its own backoff.
 */
const onBeat = new Set<() => void>();
let clock = 0;

function join(listener: () => void): void {
  onBeat.add(listener);
  if (clock) return;
  const period = MINUTE + Math.random() * 10_000;
  const beat = (): void => {
    clock = window.setTimeout(beat, period);
    for (const each of [...onBeat]) each();
  };
  clock = window.setTimeout(beat, period);
}

function leave(listener: () => void): void {
  onBeat.delete(listener);
  if (!onBeat.size) {
    clearTimeout(clock);
    clock = 0;
  }
}

/** Slugs from an attribute: trimmed, lower case, no repeats, at most 20; empty when there are none. */
export function slugs(value: string | null): string[] {
  return [...new Set((value ?? '').split(',').map((slug) => slug.trim().toLowerCase()))].filter(Boolean).slice(0, 20);
}

export abstract class Widget extends HTMLElement {
  static observedAttributes = ['currency', 'api', 'width'];

  protected readonly card: HTMLDivElement;
  protected readonly main: HTMLDivElement;
  readonly #one: boolean;
  readonly #status: HTMLParagraphElement;
  readonly #note: HTMLParagraphElement;
  readonly #link: HTMLAnchorElement;
  readonly #rate: HTMLSpanElement;
  /** The narrowest width="…" may make it. */
  readonly #least: number;
  /** This widget's own sheet, beside the shared one: its width, so the host's styles are never touched. */
  readonly #own = new CSSStyleSheet();

  #live = false;
  #key = '';
  #generation = 0;
  #busy = false;
  #inView = true;
  #timer = 0;
  #due = 0;
  #failures = 0;
  #data: Coins | null = null;
  #receivedAt = 0;
  /** The currency asked for while its rate is unavailable and prices are shown in USD instead. */
  #usdFor = '';
  #usdUntil = 0;

  /**
   * `kind` is the card's own class, if it needs one; `one` is true for the widgets that show a single coin;
   * `least` is the narrowest width="…" may set.
   */
  constructor(kind: string, one: boolean, least = 200) {
    super();
    this.#one = one;
    this.#least = least;
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [styleSheet(), this.#own];
    const card = (this.card = add(root, 'div', `cfh-card ${kind}`.trim()));
    card.setAttribute('role', 'group');
    // English text, read as English and laid out left to right on any host page.
    card.lang = 'en';
    card.dir = 'ltr';
    this.main = add(card, 'div', 'cfh-main');
    this.#status = add(card, 'p', 'cfh-status');
    this.#status.setAttribute('role', 'status');
    this.#note = add(card, 'p', 'cfh-note');
    const foot = add(card, 'p', 'cfh-foot');
    this.#link = add(foot, 'a', 'cfh-link');
    // A quiet credit, "Powered by ▣ CoinFinHub": the words in the muted colour, the name in the ink colour.
    add(this.#link, 'span', 'cfh-by').textContent = 'Powered by ';
    // CoinFinHub's mark, drawn here (no image request): the navy tile, the white C and F, the gold bar.
    const mark = svg(this.#link, 'svg', { class: 'cfh-mark', viewBox: '0 0 512 512', 'aria-hidden': 'true' });
    add(this.#link, 'span', 'cfh-brand').textContent = 'CoinFinHub';
    svg(mark, 'rect', { width: '512', height: '512', rx: '104', fill: '#161f5a' });
    const strokes = svg(mark, 'g', {
      transform: 'translate(231 258) scale(1.08) translate(-231 -258)',
      fill: 'none',
      stroke: '#fff',
      'stroke-width': '42',
    });
    svg(strokes, 'path', { d: 'M303.7 393.5V189a46 46 0 0 1 46-46h20.8' });
    svg(strokes, 'rect', { x: '217', y: '229', width: '153.5', height: '35', fill: '#e1af40', stroke: 'none' });
    svg(strokes, 'path', { d: 'M229.3 248a70.7 70.7 0 1 0 8.3 99.2' });
    this.#link.target = '_blank';
    // No noreferrer: the referrer is how CoinFinHub sees which sites send visitors.
    this.#link.rel = 'nofollow noopener';
    this.#rate = add(foot, 'span');
  }

  /** What to ask for: slugs, or N for the top N. By default the coin attribute's slug; none when it is missing. */
  protected units(): Want[] {
    const coin = this.coin();
    return coin ? [coin] : [];
  }
  /** Shows the data, or clears it (null: loading or error, with the status line shown by the base). */
  protected abstract paint(data: Coins | null): void;
  /** Whether to ask for the 7-day line. */
  protected spark(): boolean {
    return false;
  }

  /** The coin attribute, as a slug is written: trimmed, in lower case. */
  protected coin(): string {
    return (this.getAttribute('coin') ?? '').trim().toLowerCase();
  }

  /** The currency attribute, upper case, USD when there is none. */
  protected currency(): string {
    return (this.getAttribute('currency') ?? '').trim().toUpperCase() || 'USD';
  }

  connectedCallback(): void {
    this.#live = true;
    if ('IntersectionObserver' in window) {
      this.#inView = false;
      observer ??= new IntersectionObserver((entries) => {
        for (const entry of entries) watchers.get(entry.target)?.(entry.isIntersecting);
      });
      watchers.set(this, (visible) => {
        this.#inView = visible;
        this.#tick();
      });
      observer.observe(this);
    }
    document.addEventListener('visibilitychange', this.#onVisibility);
    // Moved within the page: keep what it shows. New coins, currency or API: start again.
    if (this.#key === this.#settings().join(' ')) this.#tick();
    else this.#restart();
  }

  disconnectedCallback(): void {
    this.#live = false;
    watchers.delete(this);
    observer?.unobserve(this);
    // Off the page clock; back on the page, it refreshes once its prices are a minute old.
    leave(this.#onBeat);
    if (this.#due === Infinity) this.#due = this.#receivedAt + MINUTE;
    document.removeEventListener('visibilitychange', this.#onVisibility);
    clearTimeout(this.#timer);
    this.#generation++;
    this.#busy = false;
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (name === 'width') {
      // A number of CSS pixels, never below the least; anything else, or 0, fills the container.
      const width = Math.round(Number(after));
      this.#own.replaceSync(width > 0 && width < 1e5 ? `:host{max-width:${String(Math.max(this.#least, width))}px}` : '');
    } else if (this.#live && before !== after) {
      this.#restart();
    }
  }

  readonly #onVisibility = (): void => {
    this.#tick();
  };

  readonly #onBeat = (): void => {
    this.#due = 0;
    this.#tick();
  };

  /** The API base, currency, line and units, as the attributes say now. */
  #settings(): [string, string, boolean, ...Want[]] {
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
    return [base, this.currency(), this.spark(), ...this.units()];
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
    // Due now, at a time of its own (a retry), or on the page clock's next beat (Infinity).
    const wait = this.#due - performance.now();
    if (wait <= 0) {
      void this.#load();
    } else if (wait < Infinity) {
      this.#timer = window.setTimeout(() => {
        this.#tick();
      }, wait);
    }
  }

  async #load(): Promise<void> {
    const [base, currency, spark, ...units] = this.#settings();
    // Only well-formed slugs are asked for: a list leaves the others out, a single coin says so.
    const wants = units.filter((unit) => typeof unit === 'number' || SLUG.test(unit));
    if (!wants.length) {
      this.#render(
        units.length
          ? { ...NO_CALL, code: 'invalid_coin', message: "That isn't a coin name. Use the end of the coin's page address, such as bitcoin." }
          : { ...NO_CALL, code: 'no_coin', message: 'Add a coin, for example coin="bitcoin".' },
      );
      return;
    }
    const generation = this.#generation;
    const usd = currency !== 'USD' && performance.now() < this.#usdUntil;
    this.#busy = true;
    const answer = await getCoins(base, usd ? 'USD' : currency, spark, wants);
    if (generation !== this.#generation) return;
    this.#busy = false;
    const now = performance.now();

    if (answer.ok) {
      this.#data = answer;
      this.#receivedAt = now;
      this.#failures = 0;
      this.#usdFor = usd ? currency : '';
      this.#due = Infinity;
      join(this.#onBeat);
      this.#render(null);
      return;
    }
    leave(this.#onBeat);
    if (answer.code === 'rate_unavailable' && !usd && currency !== 'USD') {
      // No rate for this currency: show US-dollar prices, labelled, and ask for the currency again later.
      this.#usdUntil = now + (answer.retryAfter ?? 600) * 1000;
      this.#due = now;
    } else {
      this.#failures++;
      const backoff = Math.min(5 * MINUTE, 10_000 * 3 ** (this.#failures - 1) * (1 + Math.random() / 2));
      this.#due = now + (answer.retryAfter ? answer.retryAfter * 1000 : backoff);
      // A failed refresh keeps the last good prices until they are 10 minutes old.
      if (!this.#data || this.#age(now) > STALE) this.#render(answer);
    }
    this.#tick();
  }

  /** How old the shown prices are: from the newest updatedAt, but never less than the time since they arrived. */
  #age(now: number): number {
    const since = now - this.#receivedAt;
    const newest = Math.max(0, ...(this.#data?.coins ?? []).map((coin) => coin.updatedAt ?? 0));
    return newest ? Math.max(since, Date.now() - newest) : since;
  }

  /** Shows the data (failure null, data present), loading (both null) or the error state. */
  #render(failure: Failure | null): void {
    const data = failure ? null : this.#data;
    const one = this.#one;
    const s = one ? '' : 's';
    this.card.dataset.state = data ? 'data' : failure ? 'error' : 'loading';
    this.#status.hidden = !!data;
    const status = data
      ? ''
      : !failure
        ? `Loading price${s}…`
        : !OWN_MESSAGE.has(failure.code)
          ? `Price${s} unavailable right now.`
          : (failure.message ?? `CoinFinHub has no page for ${one ? 'this coin' : 'these coins'}.`);
    // Written only when it changes: the status region never announces a refresh.
    if (this.#status.textContent !== status) this.#status.textContent = status;
    this.#note.textContent = data && this.#usdFor ? `Shown in US dollars: no ${this.#usdFor} rate right now.` : '';
    this.#note.hidden = !this.#note.textContent;
    this.#rate.textContent = data?.rate ? `· ${data.rate}` : '';
    // A single coin links to its page (home when the coin is wrong); lists and the ticker to the home page.
    const coin = this.coin();
    this.#link.href =
      one && coin && !(failure && BAD_COIN.has(failure.code)) ? (data?.coins[0]?.url ?? coinLink(coin)) : `${SITE}/`;
    this.paint(data);
  }
}
