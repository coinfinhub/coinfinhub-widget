# Contributing

Thanks for helping. This is a small widget, and keeping it small and safe on other people's pages is the whole point, so please read the scope before writing code.

## Setup

You need Node.js 24 or newer.

```sh
npm ci
npm run check        # type check, lint, knip, unused CSS, unit tests, build, size, SRI
npm run serve        # the demo on http://localhost:4173/ and a mock API on http://127.0.0.1:4174/
```

Open `http://localhost:4173/?api=http://127.0.0.1:4174` to point every widget on the demo at the mock API.

Browser tests (Chromium, Firefox and WebKit with a mocked API on another origin, plus axe):

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

CI runs all of it on every push and pull request.

## The checks

| Command | What it checks |
|---|---|
| `npm run typecheck` | Strict TypeScript, for the widget and for the tests. |
| `npm run lint` | ESLint with typescript-eslint's strict, type-checked rules. |
| `npm run knip` | No unused files, exports or dependencies. |
| `npm run css:check` | Every `cfh-*` class in `src/styles.ts` is rendered, every rendered class is styled, and every `--cfh-*` token is both defined and used. |
| `npm test` | Unit tests (Vitest + happy-dom), fed by the contract's fixtures in `test/fixtures/`. |
| `npm run build` | Builds `dist/coinfinhub-price.js` with esbuild. |
| `npm run size` | The size budget: at most 10,240 bytes gzipped (level 9), with a 6 KB target. |
| `npm run sri -- --check` | The snippets in `README.md` and `docs/index.html` carry the hash and version of `dist`. |

## `dist/` is committed

jsDelivr serves `dist/coinfinhub-price.js` straight from the repo's git tags, so the built file lives in git. After any change under `src/`:

1. `npm run build`
2. `npm run sri` and paste the new hash into the snippets in `README.md` and `docs/index.html`
3. commit `dist/` with the change

CI rebuilds `dist` and fails if it differs from the committed file, so a tag can never carry a stale build. The build gives the same bytes on every machine (LF line endings, a pinned esbuild, minified CSS).

## Rules for the code

- **No runtime dependencies.** Everything ships in one file.
- **No tracking.** No cookies, storage, fingerprinting or analytics, and no requests other than the price.
- **Text only.** Everything from the server is written with `textContent`, never as HTML. The link only ever points at `https://www.coinfinhub.com/price/…`.
- **Our own names.** Classes are `cfh-*`, custom properties `--cfh-*`.
- **No motion,** and sizes in `em` (the host sets `font-size: max(1em, 15px)`), never `rem`.
- **Every word in English, and every number formatted by the server.** The widget shows the server's text; it doesn't format prices itself.
- **Fall back safely** on any value or field it doesn't know: the endpoint may add fields and values within v1.
- **Nothing unused:** knip and the CSS check enforce it.
- **Tests for every behaviour,** and a fixture for every new case of the contract.

## Scope

In v1 the widget is a price display, not a feed. These are out of scope:

- npm packages, iframe versions, and React or Vue wrappers;
- lists, batches, history, charts, volumes, market cap, exchanges, pairs or logos;
- API keys, accounts, or an uptime promise;
- custom colours, font downloads, and languages other than English;
- anything that changes the "Powered by CoinFinHub" link's text, target or `rel`.

If you're not sure whether something fits, open an issue first.

## Pull requests

Keep them small, with a clear description, passing checks, and the rebuilt `dist` if `src/` changed. Releases (tags `v*`) are made only by the maintainers, from a `dist` that CI built.
