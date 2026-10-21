// The demo page: sample data for every widget and state, the live endpoint for the builder when it
// answers, and the snippet.
//
//   ?api=http://127.0.0.1:4174       every widget uses that API (the browser tests' mock)
//   ?api=https://www.coinfinhub.com  every widget uses the live endpoint, sample states included
//
// This module runs before the widgets' script, so the sample answers are in place before any widget asks.
import { answer } from './mock.js';

const SAMPLE = 'https://sample.invalid';
const LIVE = 'https://www.coinfinhub.com';
const api = new URLSearchParams(location.search).get('api')?.replace(/\/+$/, '');

// Sample mode: requests to SAMPLE are answered in the page from the fixtures; anything else goes out as usual.
const realFetch = window.fetch.bind(window);
const fixtures = new Map();
const load = (name) => {
  if (!fixtures.has(name)) fixtures.set(name, realFetch(`fixtures/${name}.json`).then((response) => response.json()));
  return fixtures.get(name);
};
const counts = new Map();
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== SAMPLE) return realFetch(input, init);
  const key = url.pathname + url.search;
  const n = (counts.get(key) ?? 0) + 1;
  counts.set(key, n);
  const result = await answer(url, n, load);
  if (!result) return new Promise(() => undefined);
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'content-type': 'application/json' } });
};

// With ?api=, the sample widgets ask that API instead, keeping their scenario path (/hang, /down, …).
if (api) {
  for (const widget of document.querySelectorAll('[api]')) {
    widget.setAttribute('api', widget.getAttribute('api').replace(SAMPLE, api));
  }
}

// The builder: the live endpoint if it answers, otherwise sample data, and the page says which.
const slot = document.querySelector('#cfh-demo-live');
const source = document.querySelector('#cfh-demo-source');
const form = document.querySelector('#cfh-demo-form');
const snippet = document.querySelector('#cfh-demo-snippet');
let builderApi = null;

async function liveAnswers() {
  try {
    const response = await realFetch(`${LIVE}/api/widget/v1/coins?ids=bitcoin`, { credentials: 'omit' });
    return response.ok;
  } catch {
    return false;
  }
}

const slugsOf = (text) =>
  text
    .toLowerCase()
    .split(',')
    .map((slug) => slug.trim().replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean)
    .slice(0, 20);

/** The attributes the builder's choices give, in the order the snippet shows them. */
function attributesFor(widget) {
  const one = widget === 'price' || widget === 'converter';
  const attributes = [];
  if (one) attributes.push(['coin', slugsOf(form.coin.value)[0] ?? 'bitcoin']);
  else {
    const coins = slugsOf(form.coins.value);
    const top = Math.min(20, Math.max(1, Math.round(Number(form.top.value)) || (widget === 'ticker' ? 10 : 5)));
    attributes.push(coins.length ? ['coins', coins.join(',')] : ['top', String(top)]);
  }
  if (widget === 'list' && form.layout.value === 'strip') attributes.push(['layout', 'strip']);
  if (widget === 'price' && form.chart.value === '7d') attributes.push(['chart', '7d']);
  attributes.push(['currency', form.currency.value], ['theme', form.theme.value]);
  return attributes;
}

function update() {
  const widget = form.widget.value;
  for (const field of document.querySelectorAll('[data-for]')) field.hidden = !field.dataset.for.split(' ').includes(widget);
  const tag = `coinfinhub-${widget}`;
  const attributes = attributesFor(widget);
  const preview = document.createElement(tag);
  for (const [name, value] of attributes) preview.setAttribute(name, value);
  if (builderApi) preview.setAttribute('api', builderApi);
  slot.replaceChildren(preview);
  const coin = attributes.find(([name]) => name === 'coin')?.[1];
  const href = coin ? `https://www.coinfinhub.com/price/${coin}` : 'https://www.coinfinhub.com/';
  const [script] = snippet.textContent.split('\n');
  const written = attributes.map(([name, value]) => ` ${name}="${value}"`).join('');
  snippet.textContent = `${script}\n<${tag}${written}><a href="${href}" target="_blank" rel="nofollow noopener">CoinFinHub</a></${tag}>`;
}

form.addEventListener('input', (event) => {
  // Each widget's own default for top: 10 for the ticker, 5 for the list.
  if (event.target === form.widget) form.top.value = form.widget.value === 'ticker' ? '10' : '5';
  update();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
});

if (api) {
  builderApi = api;
  source.textContent = `Every widget on this page asks ${api}.`;
} else if (await liveAnswers()) {
  source.textContent = 'The builder shows live prices from www.coinfinhub.com; the other widgets show sample data.';
} else {
  builderApi = SAMPLE;
  source.textContent =
    "The live endpoint isn't answering yet, so every widget here shows sample data. Sample coins: bitcoin, ethereum, tether, bnb, xrp, usdc, quietcoin, haltcoin.";
}
update();

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
