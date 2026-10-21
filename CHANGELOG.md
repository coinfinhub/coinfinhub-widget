# Changelog

All notable changes to the widgets. Versions follow [semantic versioning](https://semver.org/); each release is a git tag (`v1.0.0`) and a [GitHub release](https://github.com/coinfinhub/coinfinhub-widget/releases). Security fixes are marked **Security**.

## 1.0.0 (unreleased)

The first public release: four widgets in one script, `dist/coinfinhub-widget.js`, served from `https://cdn.coinfinhub.com/widgets/1.0.0/` (also as the latest 1.x at `/widgets/1/`, and mirrored by jsDelivr from this tag), reading the widgets' own endpoint, `https://widgets.coinfinhub.com/v1/coins`.

- `<coinfinhub-price coin="…" chart="7d">`: a coin's logo, name, symbol, price and 24h change, with an optional 7-day line drawn as SVG and coloured by the week.
- `<coinfinhub-list coins="…" | top="…" layout="rows|strip">`: rows of coins, or a headline strip of cells side by side that wraps on narrow screens. Coins CoinFinHub doesn't know are left out.
- `<coinfinhub-ticker coins="…" | top="…">`: a looping strip, CSS only, at a steady speed whatever its width, that pauses on hover and focus and stands still (scrollable by hand) under reduced motion.
- `<coinfinhub-converter coin="…">`: an amount of the coin and its value, both editable, with a picker for the 8 currencies; the maths and formatting happen in the widget. For display, not a quote.
- All take `currency`, `theme`, `width` (the widest it gets; at least 200 px, the ticker 240), `background="transparent"`, `border="none"` and `api`. A badge for little trading or no trades; "Powered by CoinFinHub" with the brand mark, linking to the coin's page or the home page, and the ECB label on other currencies.
- The endpoint sends numbers and codes only; the widgets write every price, change, badge and note themselves with the browser's `Intl` (as CoinFinHub's pages write them: two decimals from 1 up, none in yen, four decimals from 0.01 up to 1, four significant digits below 0.01, each chosen by the price once rounded, lakh grouping for rupees, a true minus).
- "Updated 4 min ago" in the footer when the prices shown are more than 3 minutes old, worked out again on every refresh, by the server's clock (the answer's `now`), so a visitor's wrong clock doesn't change it; by the browser's clock when an answer has none.
- Logos from `/coin-logos/` on `https://coinfinhub.com` or any `https://*.coinfinhub.com` host, and links to any page on `https://www.coinfinhub.com`, so either can move without a new version.
- States: loading, failed refreshes that keep the last prices for up to 10 minutes, unavailable, unknown coins, and US-dollar prices (labelled) when a currency's rate is unavailable. An error the widgets don't know (such as a blocked site) shows the server's message, as text.
- Refreshes every 60 seconds (plus one jitter per page) on a page-wide clock, while on screen and in a visible tab. Widgets on one page share calls (up to 20 coins each; every ranked list is cut from one top-20 call), each coin is asked for at most once a minute, with backoff after failures and the server's `retryAfter` honoured.
- Light and dark themes, container queries from 200 px, em sizing (never below 15 px), accessible names and focus, a strict-CSP-friendly stylesheet.
- About 9 KB gzipped for all four, no dependencies.
