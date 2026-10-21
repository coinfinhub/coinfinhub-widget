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

// The builder: the live endpoint if it answers, otherwise sample data, and the page says which. Every
// change shows in the preview at once, and the snippet has only what differs from the defaults.
const slot = document.querySelector('#cfh-demo-live');
const source = document.querySelector('#cfh-demo-source');
const form = document.querySelector('#cfh-demo-form');
const snippet = document.querySelector('#cfh-demo-snippet');
const combo = document.querySelector('#cfh-demo-coin');
const options = document.querySelector('#cfh-demo-options');
const chips = document.querySelector('#cfh-demo-chips');
const coinLabel = document.querySelector('#cfh-demo-coin-label');
const coinError = document.querySelector('#cfh-demo-coin-error');

const SLUG = /^(?=.{1,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_TOP = { list: 5, ticker: 10 };
const LEAST_WIDTH = { ticker: 240 };
let builderApi = null;
/** The coins to choose from: CoinFinHub's top 20, once the API answers. */
let offered = [];
/** The coin of a price card or converter. */
let single = { slug: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', logo: null };
/** The coins chosen for a list or ticker, in order. */
const picked = [];
/** The options showing, and the one the arrow keys are on. */
let showing = [];
let active = -1;

const many = () => form.widget.value === 'list' || form.widget.value === 'ticker';
const labelOf = (coin) => (coin.symbol ? `${coin.name} (${coin.symbol})` : coin.name);

async function liveAnswers() {
  try {
    const response = await realFetch(`${LIVE}/api/widget/v1/coins?ids=bitcoin`, { credentials: 'omit' });
    return response.ok;
  } catch {
    return false;
  }
}

/** The top 20 coins to offer, from the same API as the preview (cross-origin, as the widgets ask). */
async function loadOffered() {
  try {
    const response = await window.fetch(`${builderApi ?? LIVE}/api/widget/v1/coins?top=20`, { credentials: 'omit' });
    const body = await response.json();
    offered = (Array.isArray(body.coins) ? body.coins : [])
      .filter((coin) => typeof coin.slug === 'string' && SLUG.test(coin.slug) && typeof coin.name === 'string')
      .map(({ slug, name, symbol, logo }) => ({
        slug,
        name,
        symbol: typeof symbol === 'string' ? symbol : '',
        logo: typeof logo === 'string' && logo.startsWith('https://www.coinfinhub.com/coin-logos/') ? logo : null,
      }));
  } catch {
    offered = [];
  }
  single = offered.find((coin) => coin.slug === single.slug) ?? single;
  if (!many()) combo.value = labelOf(single);
}

/** A coin's logo for the list, or its first letter when it has none or it fails. */
function logoOf(coin) {
  const letter = document.createElement('span');
  letter.className = 'cfh-demo-letter';
  letter.textContent = (coin.symbol || coin.name).charAt(0).toUpperCase();
  letter.setAttribute('aria-hidden', 'true');
  if (!coin.logo) return letter;
  const image = document.createElement('img');
  image.src = coin.logo;
  image.alt = '';
  image.width = 20;
  image.height = 20;
  image.addEventListener('error', () => image.replaceWith(letter));
  return image;
}

function showOptions() {
  const query = combo.value.trim().toLowerCase();
  // In a price card the box shows the chosen coin: offer them all until the visitor types something else.
  const filter = many() || query !== labelOf(single).toLowerCase() ? query : '';
  showing = offered.filter((coin) => !filter || [coin.name, coin.symbol, coin.slug].some((text) => text.toLowerCase().includes(filter)));
  active = Math.min(active, showing.length - 1);
  options.replaceChildren(
    ...showing.map((coin, index) => {
      const option = document.createElement('li');
      option.id = `cfh-demo-option-${coin.slug}`;
      option.setAttribute('role', 'option');
      const chosen = many() ? picked.some((each) => each.slug === coin.slug) : coin.slug === single.slug;
      option.setAttribute('aria-selected', String(chosen));
      const name = document.createElement('span');
      name.textContent = coin.name;
      const symbol = document.createElement('span');
      symbol.className = 'cfh-demo-symbol';
      symbol.textContent = coin.symbol;
      option.append(logoOf(coin), name, ' ', symbol);
      option.addEventListener('click', () => {
        choose(coin);
      });
      if (index === active) option.classList.add('cfh-demo-active');
      return option;
    }),
  );
  options.hidden = !showing.length;
  combo.setAttribute('aria-expanded', String(!options.hidden));
  if (active >= 0 && showing[active]) combo.setAttribute('aria-activedescendant', `cfh-demo-option-${showing[active].slug}`);
  else combo.removeAttribute('aria-activedescendant');
}

function closeOptions() {
  options.hidden = true;
  active = -1;
  combo.setAttribute('aria-expanded', 'false');
  combo.removeAttribute('aria-activedescendant');
}

function moveTo(index) {
  if (options.hidden) showOptions();
  if (!showing.length) return;
  active = (index + showing.length) % showing.length;
  showOptions();
  options.querySelector('.cfh-demo-active')?.scrollIntoView({ block: 'nearest' });
}

function choose(coin) {
  coinError.textContent = '';
  if (many()) {
    if (!picked.some((each) => each.slug === coin.slug) && picked.length < 20) picked.push(coin);
    combo.value = '';
    showChips();
  } else {
    single = coin;
    combo.value = labelOf(coin);
  }
  closeOptions();
  update();
}

/** Enter with no option chosen: a coin of the list by its slug, symbol or name, or any well-formed slug. */
function chooseTyped() {
  const typed = combo.value.trim().toLowerCase();
  if (!typed || (!many() && typed === labelOf(single).toLowerCase())) return;
  const known = offered.find((coin) => [coin.slug, coin.symbol.toLowerCase(), coin.name.toLowerCase()].includes(typed));
  if (known) choose(known);
  else if (SLUG.test(typed)) choose({ slug: typed, name: typed, symbol: '', logo: null });
  else coinError.textContent = "That isn't a coin's slug: lower-case letters, digits and hyphens, such as bitcoin.";
}

function showChips() {
  chips.replaceChildren(
    ...picked.map((coin, index) => {
      const chip = document.createElement('li');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${coin.name}`);
      remove.addEventListener('click', () => {
        picked.splice(index, 1);
        showChips();
        update();
        combo.focus();
      });
      chip.append(coin.symbol || coin.name, remove);
      return chip;
    }),
  );
}

combo.addEventListener('input', () => {
  active = -1;
  coinError.textContent = '';
  showOptions();
});
combo.addEventListener('click', showOptions);
combo.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveTo(active + (event.key === 'ArrowDown' ? 1 : options.hidden || active < 0 ? 0 : -1));
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (!options.hidden && showing[active]) choose(showing[active]);
    else chooseTyped();
  } else if (event.key === 'Escape') {
    if (!options.hidden) {
      event.preventDefault();
      closeOptions();
    } else if (!many()) {
      combo.value = labelOf(single);
    }
  } else if (event.key === 'Backspace' && many() && !combo.value && picked.length) {
    picked.pop();
    showChips();
    update();
  }
});
combo.addEventListener('blur', () => {
  closeOptions();
  if (!many()) combo.value = labelOf(single);
});
// A click on an option must not take the focus from the box first.
options.addEventListener('mousedown', (event) => {
  event.preventDefault();
});

/** Shows the fields that apply to this widget and this choice of coins. */
function showFields() {
  const widget = form.widget.value;
  const pick = !many() || form.mode.value === 'pick';
  for (const field of document.querySelectorAll('#cfh-demo-form [data-for]')) {
    field.hidden = !field.dataset.for.split(' ').includes(widget);
  }
  for (const field of document.querySelectorAll('#cfh-demo-form [data-mode]')) {
    field.hidden = field.dataset.mode === 'pick' ? !pick : !many() || pick;
  }
  coinLabel.textContent = many() ? 'Add coins' : 'Coin';
}

/** The attributes the builder's choices give, defaults left out, in the order the snippet shows them. */
function attributesFor(widget) {
  const attributes = [];
  if (!many()) attributes.push(['coin', single.slug]);
  else if (form.mode.value === 'pick' && picked.length) attributes.push(['coins', picked.map((coin) => coin.slug).join(',')]);
  else {
    const top = Math.min(20, Math.max(1, Math.round(Number(form.top.value)) || DEFAULT_TOP[widget]));
    if (top !== DEFAULT_TOP[widget]) attributes.push(['top', String(top)]);
  }
  if (widget === 'list' && form.layout.value === 'strip') attributes.push(['layout', 'strip']);
  if (widget === 'price' && form.chart.value === '7d') attributes.push(['chart', '7d']);
  if (form.currency.value !== 'USD') attributes.push(['currency', form.currency.value]);
  if (form.theme.value !== 'auto') attributes.push(['theme', form.theme.value]);
  const width = Math.round(Number(form.width.value));
  if (width > 0) attributes.push(['width', String(Math.max(LEAST_WIDTH[widget] ?? 200, width))]);
  if (form.transparent.checked) attributes.push(['background', 'transparent']);
  if (!form.outlined.checked) attributes.push(['border', 'none']);
  return attributes;
}

function update() {
  const widget = form.widget.value;
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
  if (event.target === combo) return;
  if (event.target === form.widget) {
    // Each widget's own default for top, and the box shows what this widget needs.
    form.top.value = String(DEFAULT_TOP[form.widget.value] ?? 5);
    combo.value = many() ? '' : labelOf(single);
    coinError.textContent = '';
    closeOptions();
  }
  showFields();
  update();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
});

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

if (api) {
  builderApi = api;
  source.textContent = `Every widget on this page asks ${api}.`;
} else if (await liveAnswers()) {
  source.textContent = 'The builder shows live prices from www.coinfinhub.com; the other widgets show sample data.';
} else {
  builderApi = SAMPLE;
  source.textContent =
    "The live endpoint isn't answering yet, so every widget here shows sample data. Sample coins: the top 10, tether, quietcoin and haltcoin.";
}
combo.value = labelOf(single);
showFields();
update();
await loadOffered();
