# CoinFinHub widgets

Four small widgets that show coin prices from [CoinFinHub](https://www.coinfinhub.com) on any website: a **price card**, a **list** (rows, or a headline strip), a **ticker** and a **converter**. One script defines all four, with no dependencies, in about 8 KB gzipped.

[Live demo](https://coinfinhub.github.io/coinfinhub-widget/) · [CoinFinHub](https://www.coinfinhub.com) · [MIT licence](LICENSE)

<!-- Screenshots arrive with v1.0.0: docs/screenshot-light.png and docs/screenshot-dark.png. -->

| Light | Dark |
|---|---|
| *Screenshot to come with v1.0.0* | *Screenshot to come with v1.0.0* |

## Quick start (30 seconds)

Add the script once per page, however many widgets it has:

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/coinfinhub/coinfinhub-widget@1.0.0/dist/coinfinhub-widget.js" integrity="sha384-0cBfGdSz6+9vpT/pVRJc5qGFuGb34YjW9hG17x0r09T9QUILeilt/YtqBDdyNnW/" crossorigin="anonymous"></script>
```

Then put a widget where it should appear. Each one carries a plain link inside it, which shows instead when JavaScript is off or the browser is older than the ones below.

**Price card:** one coin's price and its 24-hour change, with the last 7 days as a line if you ask for it.

```html
<coinfinhub-price coin="bitcoin" chart="7d"><a href="https://www.coinfinhub.com/price/bitcoin" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-price>
```

**List:** the top coins, or the ones you name, in rows. `layout="strip"` puts them side by side as a headline strip, which wraps on narrow screens.

```html
<coinfinhub-list top="5"><a href="https://www.coinfinhub.com/" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-list>
<coinfinhub-list coins="bitcoin,ethereum,solana" layout="strip"><a href="https://www.coinfinhub.com/" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-list>
```

**Ticker:** a strip that moves sideways in a loop (the top 10 unless you say otherwise).

```html
<coinfinhub-ticker top="10"><a href="https://www.coinfinhub.com/" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-ticker>
```

**Converter:** "1 BTC = $86,091.97", with an amount of the coin and its value, both editable, and a currency picker.

```html
<coinfinhub-converter coin="bitcoin" currency="EUR"><a href="https://www.coinfinhub.com/price/bitcoin" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-converter>
```

- **Which coin:** the end of its page address on CoinFinHub, such as `bitcoin` in `https://www.coinfinhub.com/price/bitcoin`. Search for the coin on coinfinhub.com to find it.
- **Why the `integrity` hash:** it pins the exact file. If the file at that address ever changed, the browser would refuse to run it. A `@1` address that picks up fixes without editing your page (and so without the hash) will be documented here once it's tested.
- The [demo](https://coinfinhub.github.io/coinfinhub-widget/) has a builder that writes the snippet for you.

## Attributes

| Attribute | Widgets | Values | Default |
|---|---|---|---|
| `coin` | price, converter | A coin's slug, such as `bitcoin`. Required. | |
| `coins` | list, ticker | Up to 20 slugs, comma-separated, such as `bitcoin,ethereum`. Shown in that order; used instead of `top`. | |
| `top` | list, ticker | `1` to `20`: CoinFinHub's top coins by rank. | `5` (list), `10` (ticker) |
| `layout` | list | `rows`, or `strip` for cells side by side | `rows` |
| `chart` | price | `none`, or `7d` for the 7-day line | `none` |
| `currency` | all | `USD` `EUR` `GBP` `JPY` `CNY` `INR` `AUD` `CHF`, in any case | `USD` |
| `theme` | all | `auto` follows the visitor's light or dark setting; `light` and `dark` fix it | `auto` |
| `api` | all | The endpoint's base URL, for development and tests only. Leave it out. | `https://www.coinfinhub.com` |

Change `coin`, `coins`, `top`, `chart`, `currency` or `api` and the widget fetches again; `theme` and `layout` change only the look. The converter's picker sets its own `currency` attribute.

## What they show

- **Every coin:** its logo (or the first letter of its symbol in a circle), name or symbol, price, and the 24-hour change as "▼ −1.34% 24h": arrow, sign and period always together, so colour is never the only signal.
- **A badge** for a coin with little trading ("Little trading": its price may be far from what you'd pay) or one that stopped trading ("No trades since 1 Oct 2026": the last price, with no change), so a page never shows a dead coin's old price as live.
- **The 7-day line** on the price card with `chart="7d"`: coloured by which way the week went, labelled "7d", and named for screen readers ("Price over 7 days, up").
- **The converter** works out either field from the other as the visitor types, from the price CoinFinHub sends. Commas, spaces and an empty field are fine. It is labelled "For display, not a quote".
- **The footer:** "Powered by CoinFinHub", linking to the coin's page (price card, converter) or CoinFinHub's home page (list, ticker), plus "USD rate derived from ECB data" on prices in other currencies.

Before the first answer a widget says "Loading prices…" (or "price…"). If a refresh fails, it keeps the last prices until they are 10 minutes old; then it says "Prices unavailable right now." A coin CoinFinHub doesn't know is left out of a list, and on a price card or converter it gets a message for you, the site's author. The link stays in every state.

## Currencies

`USD` `EUR` `GBP` `JPY` `CNY` `INR` `AUD` `CHF`.

Prices are in US dollars first. CoinFinHub converts them with a dollar rate it derives from the European Central Bank's euro reference rates, and the widgets say so under the prices. If a currency's rate isn't available, a widget shows US-dollar prices, labelled "Shown in US dollars", and tries your currency again later. It never shows a price in the wrong currency. Rupees use lakh grouping (₹82,99,733.90).

## Size, look and fit

- About 8 KB gzipped for all four widgets (CI fails any build over 12 KB). No dependencies and no fonts; the only images are the coins' logos, from `www.coinfinhub.com`.
- Each widget fills its container from 200 px wide. Set a width on the element, or on what holds it. The layout adapts to its own width (container queries), not the window's.
- Text follows your page's text size and the visitor's zoom, but never goes below 15 px, even if your page shrinks its root font size. The converter's fields stay at 16 px or more, so phones don't zoom in on them.
- Each widget brings its own surface, border and colours (CoinFinHub's, light and dark), in Shadow DOM, so your page's styles don't leak in. It uses Inter if your page already loads it, otherwise the system font. There are no custom colours in v1.
- Only the ticker moves. It stops while the pointer is over it or it has focus, and for visitors who ask for reduced motion it stands still and scrolls sideways by hand.

## Accessibility

- Each widget is a group with a name ("Bitcoin price", "Coin prices"). Arrows are hidden from screen readers; the sign carries the direction.
- The ticker's second copy, which only makes the loop seamless, is hidden from screen readers and can't be focused. The ticker itself can be focused, to pause it, or to scroll it with the arrow keys when it stands still.
- The converter's fields have visible labels ("Amount (BTC)", "Value (USD)", "Currency") and a decimal keypad on phones.
- A 2 px focus ring. The link is at least 28 px tall (32 px on touch screens); the converter's fields are taller.
- Text is at least 4.5:1 against its background, and the up and down colours at least 4.77:1, in both themes.
- Refreshes are silent: nothing is announced every minute.
- Checked with axe in Chromium, Firefox and WebKit on every change.

## How they refresh

- Every 60 seconds plus up to 10 seconds of jitter, and only while the widget is on screen and the tab is visible.
- Widgets share requests: those that come on screen together ask in one call per currency (and 7-day line), up to 20 coins a call, and each coin is asked for at most once a minute, however many widgets show it and however often their attributes change.
- After a failed request a widget retries after 10 to 15 seconds, then backs off to 5 minutes, or waits as long as the server asks.
- Requests are plain GETs with no cookies and no custom headers.

## Browser support

Chrome and Edge 111+, Firefox 115+, and Safari 16.4+ (macOS and iOS). Older browsers, and pages without JavaScript, show the plain link from the snippet.

## Content Security Policy

If your site sends a Content Security Policy, add these sources to your existing directives:

```
script-src https://cdn.jsdelivr.net;
connect-src https://www.coinfinhub.com;
img-src https://www.coinfinhub.com;
```

No `style-src` change and no `'unsafe-inline'` are needed: the styles come as a constructed stylesheet (`adoptedStyleSheets`), which a strict policy allows, and the ticker's speed is set through the CSS object model, which no policy blocks. A browser test runs the widgets under `default-src 'none'; script-src 'self'; style-src 'self'`. Without the `img-src` source, the logos are refused and each coin shows its letter instead. If you host the script yourself, `script-src 'self'` replaces the jsDelivr source.

## Privacy for your visitors

- When a page shows a widget, the visitor's browser loads the script from `cdn.jsdelivr.net` (unless you host it yourself), and asks `www.coinfinhub.com` for the prices and the coins' logos.
- CoinFinHub's server logs those requests (IP address, time, browser, and the page that asked) for 14 days, for security and rate limits. In memory it counts only which sites show the widgets. See the [CoinFinHub privacy policy](https://www.coinfinhub.com/privacy).
- No cookies are sent or set, nothing is stored on the visitor's device, and there is no fingerprinting or analytics on your page.
- Depending on where you are, you may need to name both hosts in your own privacy notice. Hosting `dist/coinfinhub-widget.js` yourself removes jsDelivr.
- The "Powered by CoinFinHub" link has `rel="nofollow noopener"` and opens in a new tab. It keeps the browser's normal referrer, which is how CoinFinHub sees which sites send visitors.

## Data terms

- The prices are for display, not for trading. Their use falls under "The CoinFinHub widget" section of the [CoinFinHub Terms](https://www.coinfinhub.com/terms): any website, commercial ones included, may show them with the "Powered by CoinFinHub" link visible beside them. Don't hide or remove the link, collect the data in bulk, resell it, or use it for trading.
- There is no uptime promise. CoinFinHub may change or withdraw the widgets, or block a site.
- The price is the one CoinFinHub shows: the last trade on the coin's busiest up-to-date dollar market among the exchanges CoinFinHub reads. The choice of market and the 24h change are CoinFinHub's own. The data comes from third parties, and parts of it may be removed at a rights holder's request.

## The JSON: the widgets' own endpoint

This is the endpoint the widgets read, documented for transparency. **It is not a public API:** it has no keys and no uptime promise, it's rate-limited per address, and the Terms allow calling it only to show prices as the widgets do, with the link visible.

**Request:** `GET https://www.coinfinhub.com/api/widget/v1/coins?ids=bitcoin,ethereum&currency=USD&spark=7d`, or `?top=10` instead of `ids`.

- `ids`: 1 to 20 slugs, comma-separated; repeats are dropped and the order is kept. `top`: 1 to 20, the coins ranked 1 to N. Give exactly one of the two.
- `spark`: optional, only `7d`, for the 7-day line. `currency`: optional (`USD` by default), case-insensitive.
- Send simple GETs with no custom headers: a CORS preflight (`OPTIONS`) fails.

**200** (numbers illustrative):

```json
{
  "currency": "USD",
  "coins": [
    {
      "slug": "bitcoin", "name": "Bitcoin", "symbol": "BTC",
      "logo": "https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=1",
      "rank": 1,
      "price": 88888, "change24h": 2.8, "trading": "listed",
      "updatedAt": "2026-10-18T09:41:03.000Z",
      "url": "https://www.coinfinhub.com/price/bitcoin",
      "sparkline7d": [86120.5, 86410.2],
      "display": { "price": "$88,888.00", "change": "+2.80%", "direction": "up", "badge": null }
    }
  ],
  "missing": [],
  "rate": null,
  "display": { "rate": null }
}
```

| Field | Meaning |
|---|---|
| `coins` | In the order asked (`ids`) or by rank (`top`). |
| `logo` | The coin's logo on CoinFinHub; `null` when there is none. |
| `rank` | Its rank; `null` outside the ranked list. |
| `price` | In `currency`: the price CoinFinHub shows. |
| `change24h` | Percent over 24 hours; `null` when unknown, and for a coin with no trades. |
| `trading` | `listed`, `low` (little trading) or `stopped` (no trades). |
| `updatedAt` | When CoinFinHub last read this coin's price. It moves even when the price doesn't. |
| `url` | The coin's page on CoinFinHub. |
| `sparkline7d` | Only with `spark=7d`: the last 7 days in `currency`, oldest first, at most 56 points. |
| `display` | Ready-made text: the price and change (with a true minus sign, and lakh grouping for INR), the change's `direction` (`up`, `down` or `flat`; `null` with no change), and a `badge` ("Little trading", "No trades since 1 Oct 2026") or `null`. |
| `missing` | Slugs asked for that have no page on CoinFinHub. |
| `rate` | `null` for USD. Otherwise the rate's source and date: the dollar rate is derived from the ECB's euro rates, and `display.rate` says so. |

**Errors** all have the same shape. 429 and 503 also say in the body how many seconds to wait:

```json
{ "error": { "status": 503, "code": "prices_unavailable", "message": "Prices are unavailable right now.", "retryAfter": 60 } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_coin` | A slug isn't well-formed. |
| 400 | `invalid_currency` | Not one of the eight currencies. |
| 400 | `invalid_query` | Both or neither of `ids` and `top`, more than 20 coins, `top` outside 1 to 20, a parameter given twice, or a `spark` other than `7d`. |
| 404 | `unknown_coin` | None of the coins asked for has a page on CoinFinHub. (Some unknown: they are listed in `missing`.) |
| 429 | `rate_limited` | Too many requests from one address. |
| 503 | `prices_unavailable` | Prices can't be read right now. |
| 503 | `rate_unavailable` | No rate for that currency right now. The widgets show USD instead. |
| 503 | `widget_off` | The endpoint is switched off. |

**Versioning.** The major version is in the path. Within v1, fields may be added and the lists of values (`trading`, `direction`, `badge`, `code`) may grow; nothing is removed, renamed or retyped. The widgets fall back safely on anything they don't know. A breaking change would become `/v2/`, and v1 is never simply switched off, because pinned widgets can't be updated.

## Hosting the script yourself

Copy `dist/coinfinhub-widget.js` from a release tag to your site and load it from there:

```html
<script type="module" src="/js/coinfinhub-widget.js"></script>
```

The widgets still ask `www.coinfinhub.com` for prices and logos.

## Releases and security

Releases are git tags (`v1.0.0`), announced as [GitHub releases](https://github.com/coinfinhub/coinfinhub-widget/releases) and in the [changelog](CHANGELOG.md). A pinned version never changes, so to take a fix, update the version and the `integrity` hash in your snippet. To report a security problem, see [SECURITY.md](SECURITY.md).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `npm ci`, then `npm run check`, and `npm run serve` for the demo on http://localhost:4173/.

## Licence

The code is [MIT-licensed](LICENSE), © 2026 Rudranx Digital Labs. The licence covers this code only: it gives no rights to the CoinFinHub name or logo, and the price data falls under the [CoinFinHub Terms](https://www.coinfinhub.com/terms), not under this licence.
