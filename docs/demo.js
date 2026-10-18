// The demo page: sample data for every state, the live endpoint when it answers, and the snippet.
//
//   ?api=http://127.0.0.1:4174       every widget uses that API (the browser tests' mock)
//   ?api=https://www.coinfinhub.com  every widget uses the live endpoint, sample coins included
//
// This module runs before the widget's script, so the sample answers are in place before any widget asks.
import { pick, statusOf } from './mock.js';

const SAMPLE = 'https://sample.invalid';
const LIVE = 'https://www.coinfinhub.com';
const api = new URLSearchParams(location.search).get('api');

// Sample mode: requests to SAMPLE are answered in the page from the fixtures; anything else goes out as usual.
const realFetch = window.fetch.bind(window);
const counts = new Map();
window.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== SAMPLE) return realFetch(input, init);
  const coin = decodeURIComponent(url.pathname.split('/').pop() ?? '');
  const currency = (url.searchParams.get('currency') ?? 'USD').toUpperCase();
  const key = `${coin} ${currency}`;
  const n = (counts.get(key) ?? 0) + 1;
  counts.set(key, n);
  const name = pick(coin, currency, n);
  if (!name) return new Promise(() => undefined);
  return realFetch(`fixtures/${name}.json`)
    .then((response) => response.json())
    .then(
      (body) =>
        new Response(JSON.stringify(body), { status: statusOf(body), headers: { 'content-type': 'application/json' } }),
    );
};

for (const widget of document.querySelectorAll('coinfinhub-price[api]')) widget.setAttribute('api', api ?? SAMPLE);

// "Try it": the live endpoint if it answers with a price, otherwise sample data, and the page says which.
const slot = document.querySelector('#cfh-demo-live');
const source = document.querySelector('#cfh-demo-source');
const form = document.querySelector('#cfh-demo-form');
const snippet = document.querySelector('#cfh-demo-snippet');
const live = document.createElement('coinfinhub-price');

async function liveAnswers() {
  try {
    const response = await realFetch(`${LIVE}/api/widget/v1/price/bitcoin?currency=USD`, { credentials: 'omit' });
    return response.ok;
  } catch {
    return false;
  }
}

function update() {
  const coin = form.coin.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'bitcoin';
  const currency = form.currency.value;
  const theme = form.theme.value;
  live.setAttribute('coin', coin);
  live.setAttribute('currency', currency);
  live.setAttribute('theme', theme);
  const [script] = snippet.textContent.split('\n');
  snippet.textContent = `${script}\n<coinfinhub-price coin="${coin}" currency="${currency}" theme="${theme}"><a href="https://www.coinfinhub.com/price/${coin}" target="_blank" rel="nofollow noopener">CoinFinHub</a></coinfinhub-price>`;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
});

if (api) {
  live.setAttribute('api', api);
  source.textContent = `Every widget on this page asks ${api}.`;
} else if (await liveAnswers()) {
  source.textContent = 'Live prices from www.coinfinhub.com.';
} else {
  live.setAttribute('api', SAMPLE);
  source.textContent =
    "The live endpoint isn't answering yet, so this widget shows sample data. Sample coins: bitcoin, ethereum, tether, solana, tinycoin, oldcoin, quietcoin.";
}
update();
slot.append(live);

// Copy the snippet.
const copy = document.querySelector('#cfh-demo-copy');
const copied = document.querySelector('#cfh-demo-copied');
copy.addEventListener('click', () => {
  navigator.clipboard.writeText(snippet.textContent).then(
    () => {
      copied.textContent = 'Copied.';
    },
    () => {
      copied.textContent = 'Copying failed: select the code and copy it.';
    },
  );
});
