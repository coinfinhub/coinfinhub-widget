# Changelog

All notable changes to the widget. Versions follow [semantic versioning](https://semver.org/); each release is a git tag (`v1.0.0`) and a [GitHub release](https://github.com/coinfinhub/coinfinhub-widget/releases). Security fixes are marked **Security**.

## 1.0.0 (unreleased)

The first release.

- `<coinfinhub-price coin="…" currency="…" theme="…">`: a coin's price, its 24h change and the Today line from CoinFinHub's widget endpoint (`/api/widget/v1/`), with a "Powered by CoinFinHub" link to the coin's page.
- States: loading, the price, a failed refresh that keeps the last price for up to 10 minutes, unavailable, unknown coin, and the US-dollar price (labelled) when a currency's rate is unavailable. Notes for little trading, no trades, a quiet price and old prices.
- Refreshes every 60 seconds (plus jitter) while on screen and in a visible tab; one shared request per coin and currency, at most once a minute; backoff after failures, and the server's `retryAfter` honoured.
- Light and dark themes, container queries from 200 px, em sizing (never below 15 px), no motion, accessible names and focus, a strict-CSP-friendly stylesheet.
- About 5 KB gzipped, no dependencies.
