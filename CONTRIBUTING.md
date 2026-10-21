# Contributing

Thanks for helping. These are small widgets, and keeping them small and safe on other people's pages is the whole point, so please read the scope before writing code.

## Setup

You need Node.js 24 or newer.

```sh
npm ci
npm run check        # type check, lint, knip, unused CSS, unit tests, build, size, SRI
npm run serve        # the demo on http://localhost:4173/ and a mock API on http://127.0.0.1:4174/
```

Open `http://localhost:4173/?api=http://127.0.0.1:4174` to point every widget on the demo at the mock API. `CFH_PAGES_PORT` and `CFH_API_PORT` move the two servers to other ports.

Browser tests (Chromium, Firefox and WebKit with a mocked API on another origin, plus axe):

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

CI runs all of it on every push and pull request.

## Where things are

| Path | What it is |
|---|---|
| `src/coinfinhub-widget.ts` | The entry: defines the four elements, each once. |
| `src/widget.ts` | What every widget shares: attributes, states, refresh, backoff, the US-dollar fallback, the footer. |
| `src/price.ts`, `src/list.ts`, `src/ticker.ts`, `src/converter.ts` | The four elements. |
| `src/api.ts` | The one request layer: merged calls, the once-a-minute floor, checking every answer and turning its numbers into each coin's text. |
| `src/format.ts` | The one formatter: prices, changes, days, the converter's amounts, and reading what a visitor types. |
| `src/dom.ts`, `src/spark.ts` | One coin's parts, the 7-day line's maths. |
| `src/styles.ts` | The one stylesheet, light and dark tokens. |
| `test/fixtures/` | **The endpoint's contract:** its answers and errors, which the API service's tests copy and must match, plus a few bodies only the widgets need (hostile text, unknown values, missing fields, a coin without a price, an unknown error code). |
| `docs/` | The demo page; `docs/mock.js` answers like the endpoint, for the demo and the browser tests. |

## The checks

| Command | What it checks |
|---|---|
| `npm run typecheck` | Strict TypeScript, for the widgets and for the tests. |
| `npm run lint` | ESLint with typescript-eslint's strict, type-checked rules. |
| `npm run knip` | No unused files, exports or dependencies. |
| `npm run css:check` | Every `cfh-*` class in `src/styles.ts` is rendered, every rendered class is styled, and every `--cfh-*` token is both defined and used. |
| `npm test` | Unit tests (Vitest + happy-dom), fed by the fixtures in `test/fixtures/`. |
| `npm run build` | Builds `dist/coinfinhub-widget.js` with esbuild. |
| `npm run size` | The size budget: at most 12,288 bytes gzipped (level 9) for all four widgets. |
| `npm run sri -- --check` | The snippets in `README.md` and `docs/index.html` load this version from `cdn.coinfinhub.com`, and every hash in them is `dist`'s. |

## `dist/` is committed

A release's `dist/coinfinhub-widget.js` is what `cdn.coinfinhub.com/widgets/{version}/` serves, and jsDelivr mirrors it straight from the repo's git tags, so the built file lives in git. After any change under `src/`:

1. `npm run build`
2. `npm run sri` and paste the new hash into the snippets in `README.md` and `docs/index.html`
3. commit `dist/` with the change

CI rebuilds `dist` and fails if it differs from the committed file, so a tag can never carry a stale build. The build gives the same bytes on every machine (LF line endings, a pinned esbuild, minified CSS).

## Rules for the code

- **No runtime dependencies.** Everything ships in one file.
- **No tracking.** No cookies, storage, fingerprinting or analytics, and no requests other than the prices and the logos.
- **Text only.** Everything from the server is written with `textContent`, never as HTML. Links only ever point at a page on `https://www.coinfinhub.com`, and logos only come from `/coin-logos/…` on `https://coinfinhub.com` or a `https://*.coinfinhub.com` host.
- **One request layer.** Every widget asks through `src/api.ts`, so calls stay merged and the once-a-minute floor holds for pinned embeds that can't be patched.
- **Our own names.** Classes are `cfh-*`, custom properties `--cfh-*`.
- **Motion only in the ticker,** paused on hover and focus and off under reduced motion; sizes in `em` (the host sets `font-size: max(1em, 15px)`), never `rem`.
- **Every word in English, written by the widgets.** The endpoint sends numbers and codes; `src/format.ts` writes every price, change and day with `Intl`, and the widgets their own words. The one exception is an error the widgets don't know, which shows the server's message.
- **Fall back safely** on any value or field it doesn't know: the endpoint may add fields and values within v1.
- **Nothing unused:** knip and the CSS check enforce it.
- **Tests for every behaviour,** and a fixture for every new case of the contract.

## Scope

In v1 the widgets show prices; they are not a feed. These are out of scope:

- npm packages, iframe versions, and React or Vue wrappers;
- history beyond the 7-day line, volumes, market cap, exchanges or pairs;
- API keys, accounts, or an uptime promise;
- custom colours, font downloads, and languages other than English;
- anything that changes the "Powered by CoinFinHub" link's text, target or `rel`.

If you're not sure whether something fits, open an issue first.

## Pull requests

Keep them small, with a clear description, passing checks, and the rebuilt `dist` if `src/` changed. Releases (tags `v*`) are made only by the maintainers, from a `dist` that CI built.
