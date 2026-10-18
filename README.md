# CoinFinHub price widget

`<coinfinhub-price>` shows a coin's price from [CoinFinHub](https://www.coinfinhub.com) on any website. It's one script and one element, with no dependencies, and about 5 KB gzipped.

[Live demo](https://coinfinhub.github.io/coinfinhub-widget/) · [CoinFinHub](https://www.coinfinhub.com) · [MIT licence](LICENSE)

<!-- Screenshots arrive with v1.0.0: docs/screenshot-light.png and docs/screenshot-dark.png. -->

| Light | Dark |
|---|---|
| *Screenshot to come with v1.0.0* | *Screenshot to come with v1.0.0* |

## Quick start (30 seconds)

Paste this where the price should appear:

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/coinfinhub/coinfinhub-widget@1.0.0/dist/coinfinhub-price.js" integrity="sha384-kistrLAWcGrPDlmTrdZbIRoj4BdL7KxRu1/ygBKYC6qx3kQ9R+h911ZrDnAoPrUh" crossorigin="anonymous"></script>
<coinfinhub-price coin="bitcoin" currency="USD" theme="auto"><a href="https://www.coinfinhub.com/price/bitcoin" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-price>
```

That's all. For more widgets on one page, add more `<coinfinhub-price>` elements: the script is needed only once, and nothing breaks if it's there twice. Without JavaScript, or in a browser older than the ones below, the plain link shows instead.

- **Which coin:** the end of its page address on CoinFinHub, such as `bitcoin` in `https://www.coinfinhub.com/price/bitcoin`. Search for the coin on coinfinhub.com to find it.
- **Why the `integrity` hash:** it pins the exact file. If the file at that address ever changed, the browser would refuse to run it. A `@1` address that picks up fixes without editing your page (and so without the hash) will be documented here once it's tested.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `coin` | A coin's slug, such as `bitcoin`. Required. | |
| `currency` | `USD` `EUR` `GBP` `JPY` `CNY` `INR` `AUD` `CHF`, in any case | `USD` |
| `theme` | `auto` follows the visitor's light or dark setting; `light` and `dark` fix it | `auto` |
| `api` | The endpoint's base URL, for development and tests only. Leave it out. | `https://www.coinfinhub.com` |

Change `coin`, `currency` or `api` and the widget fetches again; `theme` changes only the colours.

## What it shows

- The coin's name, symbol and price.
- The 24h change as "▼ −1.34% 24h": arrow, sign and period always together, so colour is never the only signal.
- The **Today** line, such as "Bitcoin slips 1.3%, in line with the market.", marked with CoinFinHub's gold rule. Hover over it, focus it or tap it for what "the market" means and for the reminder that it's analysis of past prices, not a prediction or financial advice.
- A note when there is one: little trading, no trades since a date, a price unchanged for hours, or prices more than 10 minutes old.
- "Powered by CoinFinHub", linking to the coin's page, plus "USD rate derived from ECB data" on prices in other currencies.

Before the first answer it says "Loading price…". If a refresh fails, it keeps the last price until that price is 10 minutes old; then it says "Price unavailable right now." and when the price was last updated. A coin that doesn't exist gets a message for you, the site's author. The link stays in every state.

## Currencies

`USD` `EUR` `GBP` `JPY` `CNY` `INR` `AUD` `CHF`.

Prices are in US dollars first. CoinFinHub converts them with a dollar rate it derives from the European Central Bank's euro reference rates, and the widget says so under the price. If a currency's rate isn't available, the widget shows the US-dollar price, labelled "Shown in US dollars", and tries your currency again later. It never shows a price in the wrong currency.

## Size, look and fit

- About 5 KB gzipped (CI fails any build over 10 KB). It has no dependencies and loads no fonts or images.
- It fills its container from 200 px wide. Set a width on the element, or on what holds it. The layout adapts to its own width (container queries), not the window's.
- Its text follows your page's text size and the visitor's zoom, but never goes below 15 px, even if your page shrinks its root font size.
- It brings its own surface, border and colours (CoinFinHub's, light and dark), in Shadow DOM, so your page's styles don't leak in. It uses Inter if your page already loads it, otherwise the system font. There are no custom colours in v1.
- No animation, so there is nothing to switch off for reduced motion.

## Accessibility

- A group named after the coin. The arrow is hidden from screen readers; the sign carries the direction.
- The Today line is focusable. Its explanation opens on hover, focus or tap, and Escape closes it. There's no ⓘ icon to find.
- A 2 px focus ring. The link is at least 28 px tall (32 px on touch screens).
- Text is at least 4.5:1 against the background, and the up and down colours at least 4.77:1, in both themes.
- Refreshes are silent: nothing is announced every minute.
- Checked with axe in Chromium, Firefox and WebKit on every change.

## How it refreshes

- Every 60 seconds plus up to 10 seconds of jitter, and only while the widget is on screen and the tab is visible.
- Widgets showing the same coin and currency share one request, and each coin and currency is asked for at most once a minute, however often the attributes change.
- After a failed request it retries after 10 to 15 seconds, then backs off to 5 minutes, or waits as long as the server asks.
- Requests are plain GETs with no cookies and no custom headers.

## Browser support

Chrome and Edge 111+, Firefox 115+, and Safari 16.4+ (macOS and iOS). Older browsers, and pages without JavaScript, show the plain link from the snippet.

## Content Security Policy

If your site sends a Content Security Policy, add these sources to your existing directives:

```
script-src https://cdn.jsdelivr.net;
connect-src https://www.coinfinhub.com;
```

No `style-src` change and no `'unsafe-inline'` are needed: the styles come as a constructed stylesheet (`adoptedStyleSheets`), which a strict policy allows. A browser test runs the widget under `default-src 'none'; script-src 'self'; style-src 'self'`. If you host the script yourself, `script-src 'self'` replaces the jsDelivr source.

## Privacy for your visitors

- When a page shows the widget, the visitor's browser loads the script from `cdn.jsdelivr.net` (unless you host it yourself) and asks `www.coinfinhub.com` for the price.
- CoinFinHub's server logs that request (IP address, time, browser, and the page that asked) for 14 days, for security and rate limits. In memory it counts only which sites show the widget. See the [CoinFinHub privacy policy](https://www.coinfinhub.com/privacy).
- No cookies are sent or set, nothing is stored on the visitor's device, and there is no fingerprinting or analytics on your page.
- Depending on where you are, you may need to name both hosts in your own privacy notice. Hosting `dist/coinfinhub-price.js` yourself removes jsDelivr.
- The "Powered by CoinFinHub" link has `rel="nofollow noopener"` and opens in a new tab. It keeps the browser's normal referrer, which is how CoinFinHub sees which sites send visitors.

## Data terms

- The prices are for display, not for trading. Their use falls under "The CoinFinHub widget" section of the [CoinFinHub Terms](https://www.coinfinhub.com/terms): any website, commercial ones included, may show them with the "Powered by CoinFinHub" link visible beside them. Don't hide or remove the link, collect the data in bulk, resell it, or use it for trading.
- There is no uptime promise. CoinFinHub may change or withdraw the widget, or block a site.
- The price is the one CoinFinHub shows: the last trade on the coin's busiest up-to-date dollar market among the exchanges CoinFinHub reads. The choice of market, the 24h change and the Today line are CoinFinHub's own. The data comes from third parties, and parts of it may be removed at a rights holder's request.

## The JSON: the widget's own endpoint

This is the endpoint the widget reads, documented for transparency. **It is not a public API:** it has no keys and no uptime promise, it's rate-limited per address, and the Terms allow calling it only to show prices as the widget does, with the link visible.

**Request:** `GET https://www.coinfinhub.com/api/widget/v1/price/{coin}?currency={code}`. `currency` is optional (`USD` by default) and case-insensitive. Send simple GETs with no custom headers: a CORS preflight (`OPTIONS`) fails.

**200** (numbers illustrative):

```json
{
  "coin": { "slug": "bitcoin", "name": "Bitcoin", "symbol": "BTC" },
  "currency": "INR",
  "price": 7586424.4,
  "change24h": -1.34,
  "trading": "listed",
  "context": "Bitcoin slips 1.3%, in line with the market.",
  "updatedAt": "2026-10-18T09:41:03.000Z",
  "priceChangedAt": "2026-10-18T09:40:47.000Z",
  "url": "https://www.coinfinhub.com/price/bitcoin",
  "rate": { "source": "ECB", "basis": "derived from EUR reference rates", "date": "2026-10-16", "perUsd": 88.12 },
  "display": {
    "price": "₹75,86,424.40",
    "change": "−1.34%",
    "direction": "down",
    "contextLabel": "Today",
    "contextTip": "Compared with the combined value of the coins CoinFinHub lists. This is analysis of past prices, not a prediction or financial advice.",
    "age": null,
    "note": null,
    "rate": "USD rate derived from ECB data"
  }
}
```

| Field | Meaning |
|---|---|
| `price` | In `currency`: the price CoinFinHub shows. |
| `change24h` | Percent over 24 hours; `null` when unknown, and for a coin with no trades. |
| `trading` | `listed`, `low` (little trading) or `stopped` (no trades). |
| `context` | The Today line; `null` when the coin's or the market's change is unknown, and for a stopped coin. |
| `updatedAt` | When CoinFinHub last read this coin's price. It moves even when the price doesn't. |
| `priceChangedAt` | When the price last changed, as CoinFinHub saw it. |
| `url` | The coin's page on CoinFinHub. |
| `rate` | `null` for USD. Otherwise the rate's source and date. The dollar rate is derived from the ECB's euro rates. |
| `display` | Ready-made text: the formatted price and change (with a true minus sign, and lakh grouping for INR), the change's `direction` (`up`, `down` or `flat`), the Today line's label and explanation, the price's `age` once it's more than 10 minutes old, a `note` for little trading, no trades or a price unchanged for 6 hours, and the rate's label. |

**Errors** all have the same shape. 429 and 503 also say in the body how many seconds to wait:

```json
{ "error": { "status": 503, "code": "prices_unavailable", "message": "Prices are unavailable right now.", "retryAfter": 60 } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_coin` | The coin isn't a valid slug. |
| 400 | `invalid_currency` | Not one of the eight currencies. |
| 400 | `invalid_query` | A parameter is given twice. |
| 404 | `unknown_coin` | No coin page has that slug. |
| 429 | `rate_limited` | Too many requests from one address. |
| 503 | `prices_unavailable` | Prices can't be read right now. |
| 503 | `rate_unavailable` | No rate for that currency right now. The widget shows USD instead. |
| 503 | `widget_off` | The endpoint is switched off. |

**Versioning.** The major version is in the path. Within v1, fields may be added and the lists of values (`trading`, `direction`, `code`) may grow; nothing is removed, renamed or retyped. The widget falls back safely on anything it doesn't know. A breaking change would become `/v2/`, and v1 is never simply switched off, because pinned widgets can't be updated.

## Hosting the script yourself

Copy `dist/coinfinhub-price.js` from a release tag to your site and load it from there:

```html
<script type="module" src="/js/coinfinhub-price.js"></script>
```

The widget still asks `www.coinfinhub.com` for prices.

## Releases and security

Releases are git tags (`v1.0.0`), announced as [GitHub releases](https://github.com/coinfinhub/coinfinhub-widget/releases) and in the [changelog](CHANGELOG.md). A pinned version never changes, so to take a fix, update the version and the `integrity` hash in your snippet. To report a security problem, see [SECURITY.md](SECURITY.md).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `npm ci`, then `npm run check`, and `npm run serve` for the demo on http://localhost:4173/.

## Licence

The code is [MIT-licensed](LICENSE), © 2026 Rudranx Digital Labs. The licence covers this code only: it gives no rights to the CoinFinHub name or logo, and the price data falls under the [CoinFinHub Terms](https://www.coinfinhub.com/terms), not under this licence.
