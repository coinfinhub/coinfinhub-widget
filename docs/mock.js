// Sample answers for the demo page and the browser tests: which fixture (test/fixtures/*.json) a coin
// and currency get. `n` counts the requests for that coin and currency so far, starting at 1.
// The fixtures are illustrative examples of the endpoint's contract, not real prices.

const SAMPLES = {
  ethereum: 'ok-old',
  hostile: 'ok-hostile',
  oldcoin: 'ok-stopped',
  quietcoin: 'ok-quiet',
  solana: 'ok-missing-fields',
  tether: 'ok-stablecoin',
  tinycoin: 'ok-low',
};

/** The fixture's name, or null for a request that never answers. Prefixes make scenarios, so tests can use unique coins. */
export function pick(coin, currency, n) {
  if (coin.startsWith('hang')) return null;
  if (coin.startsWith('limited')) return n === 1 ? 'error-rate-limited' : 'ok-usd';
  if (coin.startsWith('flaky')) return n === 1 ? 'ok-usd' : 'error-prices-unavailable';
  if (coin.startsWith('down')) return 'error-prices-unavailable';
  if (coin.startsWith('count') || coin === 'bitcoin') {
    if (currency === 'USD') return 'ok-usd';
    return currency === 'INR' ? 'ok-inr' : 'error-rate-unavailable';
  }
  return Object.hasOwn(SAMPLES, coin) ? SAMPLES[coin] : 'error-unknown-coin';
}

/** The HTTP status a fixture is sent with: its error's own status, or 200 for a price. */
export const statusOf = (body) => body?.error?.status ?? 200;
