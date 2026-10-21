# Changelog

All notable changes to the widgets. Versions follow [semantic versioning](https://semver.org/); each release is a git tag (`v1.0.0`) and a [GitHub release](https://github.com/coinfinhub/coinfinhub-widget/releases). Security fixes are marked **Security**.

## 1.0.0 (unreleased)

The first release: four widgets in one script, `dist/coinfinhub-widget.js`, reading CoinFinHub's widget endpoint (`/api/widget/v1/coins`).

- `<coinfinhub-price coin="…" chart="7d">`: a coin's logo, name, symbol, price and 24h change, with an optional 7-day line drawn as SVG and coloured by the week.
- `<coinfinhub-list coins="…" | top="…" layout="rows|strip">`: rows of coins, or a headline strip of cells side by side that wraps on narrow screens. Coins CoinFinHub doesn't know are left out.
- `<coinfinhub-ticker coins="…" | top="…">`: a looping strip, CSS only, at a steady speed whatever its width, that pauses on hover and focus and stands still (scrollable by hand) under reduced motion.
- `<coinfinhub-converter coin="…">`: an amount of the coin and its value, both editable, with a picker for the 8 currencies; the maths and formatting happen in the widget. For display, not a quote.
- All take `currency`, `theme` and `api`. A badge for little trading or no trades; "Powered by CoinFinHub" with the brand mark, linking to the coin's page or the home page, and the ECB label on other currencies.
- States: loading, failed refreshes that keep the last prices for up to 10 minutes, unavailable, unknown coins, and US-dollar prices (labelled) when a currency's rate is unavailable.
- Refreshes every 60 seconds (plus one jitter per page) on a page-wide clock, while on screen and in a visible tab. Widgets on one page share calls (up to 20 coins each; every ranked list is cut from one top-20 call), each coin is asked for at most once a minute, with backoff after failures and the server's `retryAfter` honoured.
- Light and dark themes, container queries from 200 px, em sizing (never below 15 px), accessible names and focus, a strict-CSP-friendly stylesheet.
- About 8 KB gzipped for all four, no dependencies.
