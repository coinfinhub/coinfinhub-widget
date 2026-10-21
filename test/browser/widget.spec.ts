import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The pages are served from localhost and the mock API from 127.0.0.1 (servers.mjs): every
// request the widgets make here is cross-origin, as on other people's sites.
const API = `http://127.0.0.1:${process.env.CFH_API_PORT ?? '4174'}`;

interface FixtureCoin {
  slug: string;
  display: { price: string };
}
const coins = (name: string): FixtureCoin[] =>
  (JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8')) as { coins: FixtureCoin[] }).coins;
const priceOf = (name: string, slug: string): string => coins(name).find((coin) => coin.slug === slug)?.display.price ?? '';
const BITCOIN = priceOf('coins-usd', 'bitcoin');
const BITCOIN_INR = priceOf('coins-inr', 'bitcoin');
// A 1×1 PNG, standing in for a logo from www.coinfinhub.com.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** A path segment of its own under the mock API: its calls are counted apart, and its first word picks a scenario. */
const unique = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/** The queries the widgets sent under one path segment. */
async function calls(request: APIRequestContext, ns: string): Promise<string[]> {
  const response = await request.get(`${API}/__calls?ns=${ns}`);
  return (await response.json()) as string[];
}

/** Adds widgets in one go, so they come on screen together. */
async function add(page: Page, widgets: [string, Record<string, string>][]): Promise<void> {
  await page.evaluate((list) => {
    for (const [tag, attributes] of list) {
      const widget = document.createElement(tag);
      for (const [name, value] of Object.entries(attributes)) widget.setAttribute(name, value);
      document.querySelector('main')?.append(widget);
    }
  }, widgets);
}

/** Fails the test on any script error or console error on the page. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // Browsers log every 4xx or 5xx answer and every refused logo; the error answers are part of these tests.
    const text = message.text();
    if (message.type() === 'error' && !text.startsWith('Failed to load resource')) errors.push(text);
  });
  page.on('dialog', (dialog) => {
    errors.push(`dialog: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return errors;
}

// No request leaves this machine: the live endpoint and the logos on www.coinfinhub.com are refused,
// unless a test answers them itself.
test.beforeEach(async ({ page }) => {
  await page.route('https://www.coinfinhub.com/**', (route) => route.abort());
});

/** Scrolls every widget into view once: they only ask for prices while on screen. */
async function showAll(page: Page): Promise<void> {
  for (const widget of await page.locator('coinfinhub-price, coinfinhub-list, coinfinhub-ticker, coinfinhub-converter').all()) {
    await widget.scrollIntoViewIfNeeded();
  }
}

test('the demo shows every widget and state from another origin, with no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`/?api=${API}`);
  await expect(page.locator('#cfh-demo-source')).toHaveText(`Every widget on this page asks ${API}.`);
  await showAll(page);
  const item = (heading: string) => page.locator('article').filter({ has: page.getByRole('heading', { name: heading }) });
  await expect(item('Price card').locator('.cfh-price')).toHaveText([BITCOIN, BITCOIN]);
  await expect(item('Price card').locator('.cfh-spark').first()).toBeVisible();
  await expect(item('List').first().locator('coinfinhub-list').first().locator('.cfh-item')).toHaveCount(5);
  await expect(item('Headline strip').locator('coinfinhub-list').first().locator('.cfh-item')).toHaveCount(4);
  await expect(item('Ticker').locator('coinfinhub-ticker').first().locator('.cfh-run').first().locator('.cfh-tick')).toHaveCount(10);
  await expect(item('Converter').locator('.cfh-sum').first()).toHaveText(`1 BTC = ${BITCOIN}`);
  const figure = (caption: string) => page.locator('figure').filter({ has: page.locator('figcaption', { hasText: caption }) });
  await expect(figure('Loading').locator('.cfh-status')).toHaveText('Loading price…');
  await expect(figure('Prices unavailable').locator('.cfh-status')).toHaveText('Prices unavailable right now.');
  await expect(figure('A failed refresh').locator('.cfh-price')).toHaveText(BITCOIN);
  await expect(figure('Another currency').locator('.cfh-price')).toHaveText(BITCOIN_INR);
  await expect(figure('Another currency').locator('.cfh-foot')).toContainText('USD rate derived from ECB data');
  await expect(figure('No rate for a currency').locator('.cfh-note')).toHaveText('Shown in US dollars: no CHF rate right now.');
  await expect(figure('Little trading').locator('.cfh-badge')).toHaveText('Little trading');
  await expect(figure('No trades').locator('.cfh-badge')).toContainText('No trades since');
  await expect(figure('No trades').locator('.cfh-chg')).toBeHidden();
  await expect(figure("A coin CoinFinHub doesn't know").locator('.cfh-name')).toHaveText(['Bitcoin', 'Ethereum']);
  await expect(figure('An unknown coin on its own').locator('.cfh-status')).toHaveText('CoinFinHub has no page for this coin.');
  expect(errors).toEqual([]);
});

test('the builder previews every choice live and writes only what differs from the defaults', async ({ page }) => {
  await page.goto('/');
  const form = page.locator('#cfh-demo-form');
  await expect(page.locator('#cfh-demo-source')).toContainText('sample data');
  const preview = page.locator('#cfh-demo-live');
  const snippet = page.locator('#cfh-demo-snippet');
  // Widgets only ask while on screen.
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.locator('.cfh-price')).toHaveText(BITCOIN);
  await expect(snippet).toContainText('integrity="sha384-');
  await expect(snippet).toContainText('<coinfinhub-price coin="bitcoin"><a href="https://www.coinfinhub.com/price/bitcoin"');

  // The coin box: a combobox over the top coins, filtered as you type, used with the keyboard.
  const box = page.getByRole('combobox', { name: 'Coin', exact: true });
  const listbox = page.getByRole('listbox');
  await box.fill('eth');
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  await expect(listbox.getByRole('option')).toHaveCount(1);
  await expect(listbox.getByRole('option')).toContainText('Ethereum');
  await box.press('ArrowDown');
  await expect(box).toHaveAttribute('aria-activedescendant', 'cfh-demo-option-ethereum');
  await box.press('Enter');
  await expect(box).toHaveValue('Ethereum (ETH)');
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await expect(snippet).toContainText('<coinfinhub-price coin="ethereum"><a href="https://www.coinfinhub.com/price/ethereum"');
  await expect(preview.locator('.cfh-name')).toHaveText('Ethereum');
  await box.fill('b');
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  await box.press('Escape');
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  // A slug that isn't in the list is allowed; anything else says what a slug is.
  await box.fill('Not a slug!');
  await box.press('Enter');
  await expect(page.locator('#cfh-demo-coin-error')).toContainText("That isn't a coin's slug");
  await box.fill('some-coin');
  await box.press('Enter');
  await expect(snippet).toContainText('<coinfinhub-price coin="some-coin">');
  await expect(page.locator('#cfh-demo-coin-hint')).toContainText('Find more coins on coinfinhub.com/widgets');
  await box.fill('bitcoin');
  await box.press('Enter');

  // Currency, chart, width (never under the minimum), theme, background and outline.
  await expect(form.getByLabel('Currency').locator('option').first()).toHaveText('USD — US Dollar');
  await form.getByLabel('Currency').selectOption('INR');
  await form.getByLabel('Chart').selectOption('7d');
  await form.getByLabel('Width (px)').fill('120');
  await form.getByLabel('Theme').selectOption('dark');
  await form.getByLabel('Transparent background').check();
  await form.getByLabel('Outlined').uncheck();
  await expect(snippet).toContainText(
    '<coinfinhub-price coin="bitcoin" chart="7d" currency="INR" theme="dark" width="200" background="transparent" border="none">',
  );
  await expect(preview.locator('.cfh-price')).toHaveText(BITCOIN_INR);
  await expect(preview.locator('coinfinhub-price')).toHaveAttribute('background', 'transparent');

  // A list: the top coins, the default count left out, or coins chosen one by one as chips.
  await form.getByLabel('Widget').selectOption('list');
  await expect(box).toBeHidden();
  await expect(snippet).toContainText('<coinfinhub-list currency="INR" theme="dark" width="200" background="transparent" border="none">');
  await form.getByLabel('How many (1 to 20)').fill('3');
  await expect(snippet).toContainText('<coinfinhub-list top="3" currency="INR"');
  await expect(preview.locator('coinfinhub-list .cfh-item')).toHaveCount(3);
  await form.getByLabel('Coins I choose').check();
  const adder = page.getByRole('combobox', { name: 'Add coins', exact: true });
  await adder.fill('sol');
  await adder.press('ArrowDown');
  await adder.press('Enter');
  await adder.fill('bnb');
  await adder.press('Enter');
  await expect(page.locator('#cfh-demo-chips li')).toHaveCount(2);
  await expect(snippet).toContainText('<coinfinhub-list coins="solana,bnb" currency="INR"');
  await expect(preview.locator('coinfinhub-list .cfh-name')).toHaveText(['Solana', 'BNB']);
  await page.getByRole('button', { name: 'Remove Solana' }).click();
  await expect(snippet).toContainText('<coinfinhub-list coins="bnb" currency="INR"');

  // The ticker: its own default count, and its own minimum width.
  await form.getByLabel('Widget').selectOption('ticker');
  await form.getByLabel('Top coins').check();
  await expect(snippet).toContainText('<coinfinhub-ticker currency="INR" theme="dark" width="240" background="transparent" border="none">');
});

test('has no accessibility violations (axe), in light and dark', async ({ page }) => {
  await page.goto(`/?api=${API}`);
  await showAll(page);
  await expect(page.locator('#cfh-demo-live .cfh-price')).toBeVisible();
  await expect(page.locator('.cfh-demo-grid .cfh-badge', { hasText: 'Little trading' })).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, colorScheme).toEqual([]);
  }
});

test('widgets on screen together share one call, whatever they show', async ({ page, request }) => {
  await page.goto('/blank.html');
  const ns = unique('t');
  const api = `${API}/${ns}`;
  await add(page, [
    ['coinfinhub-price', { coin: 'bitcoin', api }],
    ['coinfinhub-price', { coin: 'ethereum', api }],
    ['coinfinhub-list', { coins: 'bitcoin,tether', api }],
    ['coinfinhub-converter', { coin: 'bitcoin', api }],
    ['coinfinhub-ticker', { api }],
    ['coinfinhub-price', { coin: 'bitcoin', currency: 'INR', api }],
  ]);
  await expect(page.locator('.cfh-price').first()).toHaveText(BITCOIN);
  await expect(page.locator('coinfinhub-list .cfh-item')).toHaveCount(2);
  await expect(page.locator('coinfinhub-ticker .cfh-run').first().locator('.cfh-tick')).toHaveCount(10);
  expect((await calls(request, ns)).sort()).toEqual(
    ['?ids=bitcoin,ethereum,tether&currency=USD', '?top=20&currency=USD', '?ids=bitcoin&currency=INR'].sort(),
  );
});

test('waits as retryAfter says', async ({ page, request }) => {
  await page.clock.install();
  await page.goto('/blank.html');
  const ns = unique('limited');
  await add(page, [['coinfinhub-price', { coin: 'bitcoin', api: `${API}/${ns}` }]]);
  await expect(page.locator('coinfinhub-price .cfh-status')).toHaveText('Price unavailable right now.');
  await page.clock.runFor(55_000);
  expect(await calls(request, ns)).toHaveLength(1);
  await page.clock.runFor(6_000);
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText(BITCOIN);
  expect(await calls(request, ns)).toHaveLength(2);
});

test('pauses while the tab is hidden', async ({ page, request }) => {
  await page.clock.install();
  await page.goto('/blank.html');
  const ns = unique('t');
  await add(page, [['coinfinhub-list', { top: '3', api: `${API}/${ns}` }]]);
  await expect(page.locator('coinfinhub-list .cfh-item').first()).toBeVisible();
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await page.clock.runFor(5 * 60_000);
  expect(await calls(request, ns)).toHaveLength(1);
  await setHidden(false);
  await expect.poll(async () => (await calls(request, ns)).length).toBe(2);
});

test("follows the host's text size, but never below 15 px", async ({ page }) => {
  await page.goto('/blank.html');
  await page.addStyleTag({ content: 'html { font-size: 10px } main { font-size: 1rem } .big { font-size: 20px }' });
  await add(page, [['coinfinhub-list', { coins: 'bitcoin', api: API }]]);
  await page.evaluate((api) => {
    const big = document.createElement('div');
    big.className = 'big';
    const widget = document.createElement('coinfinhub-converter');
    widget.setAttribute('coin', 'bitcoin');
    widget.setAttribute('api', api);
    big.append(widget);
    document.querySelector('main')?.append(big);
  }, API);
  const size = (selector: string) => page.locator(selector).evaluate((widget) => getComputedStyle(widget).fontSize);
  expect(await size('coinfinhub-list')).toBe('15px');
  expect(await size('coinfinhub-converter')).toBe('20px');
});

test('every widget fits 200 px without sideways overflow, with link targets at least 28 px tall', async ({ page }) => {
  await page.goto('/blank.html');
  const api = API;
  const style = 'width: 200px';
  await add(page, [
    ['coinfinhub-price', { coin: 'bitcoin', currency: 'INR', chart: '7d', api, style }],
    ['coinfinhub-list', { top: '5', api, style }],
    ['coinfinhub-list', { top: '5', layout: 'strip', api, style }],
    ['coinfinhub-ticker', { api, style }],
    ['coinfinhub-converter', { coin: 'bitcoin', currency: 'INR', api, style }],
  ]);
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText(BITCOIN_INR);
  await expect(page.locator('coinfinhub-converter .cfh-sum')).toBeVisible();
  await expect(page.locator('coinfinhub-ticker .cfh-tick').first()).toBeVisible();
  for (const card of await page.locator('.cfh-card').all()) {
    expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const box = await card.locator('.cfh-link').boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(28);
  }
  for (const field of await page.locator('coinfinhub-converter .cfh-in').all()) {
    expect((await field.boundingBox())?.height).toBeGreaterThanOrEqual(32);
  }
});

test('takes width, a transparent background and no outline, without asking again', async ({ page, request }) => {
  await page.goto('/blank.html');
  const ns = unique('t');
  const api = `${API}/${ns}`;
  await add(page, [
    ['coinfinhub-price', { coin: 'bitcoin', width: '320', api }],
    ['coinfinhub-ticker', { width: '100', api }],
  ]);
  const price = page.locator('coinfinhub-price');
  await expect(price.locator('.cfh-price')).toHaveText(BITCOIN);
  await expect(page.locator('coinfinhub-ticker .cfh-tick').first()).toBeVisible();
  const asked = (await calls(request, ns)).length;
  expect((await price.boundingBox())?.width).toBe(320);
  expect((await page.locator('coinfinhub-ticker').boundingBox())?.width).toBe(240);
  const card = price.locator('.cfh-card');
  const look = () => card.evaluate((node) => [getComputedStyle(node).backgroundColor, getComputedStyle(node).borderTopColor]);
  expect(await look()).toEqual(['rgb(255, 255, 255)', 'rgb(232, 232, 239)']);
  await price.evaluate((node) => {
    node.setAttribute('background', 'transparent');
    node.setAttribute('border', 'none');
    node.setAttribute('width', '');
  });
  expect(await look()).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
  expect((await price.boundingBox())?.width).toBeGreaterThan(320);
  // The text keeps its theme's colour on the page's own background.
  expect(await price.locator('.cfh-name').evaluate((node) => getComputedStyle(node).color)).toBe('rgb(19, 24, 64)');
  expect(await calls(request, ns)).toHaveLength(asked);
  expect(await price.getAttribute('style')).toBeNull();
});

test('switches theme with the attribute and the colour scheme', async ({ page }) => {
  await page.goto('/blank.html');
  await add(page, [['coinfinhub-ticker', { api: API, theme: 'light' }]]);
  const widget = page.locator('coinfinhub-ticker');
  const background = () => widget.locator('.cfh-card').evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(await background()).toBe('rgb(255, 255, 255)');
  await widget.evaluate((node) => {
    node.setAttribute('theme', 'dark');
  });
  expect(await background()).toBe('rgb(26, 25, 32)');
  await widget.evaluate((node) => {
    node.setAttribute('theme', 'auto');
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await background()).toBe('rgb(26, 25, 32)');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await background()).toBe('rgb(255, 255, 255)');
});

test("works under a strict CSP with no 'unsafe-inline'", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/csp.html');
  await page.evaluate(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP: ${event.violatedDirective}`);
    });
  });
  await add(page, [
    ['coinfinhub-price', { coin: 'bitcoin', chart: '7d', api: API, theme: 'light' }],
    ['coinfinhub-ticker', { api: API }],
    ['coinfinhub-converter', { coin: 'bitcoin', api: API }],
  ]);
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText(BITCOIN);
  await expect(page.locator('coinfinhub-ticker .cfh-tick').first()).toBeVisible();
  await expect(page.locator('coinfinhub-converter .cfh-sum')).toBeVisible();
  const background = await page.locator('coinfinhub-price .cfh-card').evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(background).toBe('rgb(255, 255, 255)');
  expect(await page.locator('coinfinhub-ticker .cfh-track').evaluate((node) => getComputedStyle(node).animationName)).toBe('cfh-roll');
  expect(errors).toEqual([]);
});

test('the ticker loops, pauses on hover and focus, and stands still with reduced motion', async ({ page }) => {
  await page.goto('/blank.html');
  await add(page, [['coinfinhub-ticker', { api: API, style: 'width: 400px' }]]);
  const ticker = page.locator('coinfinhub-ticker');
  const track = ticker.locator('.cfh-track');
  const copy = ticker.locator('.cfh-run').nth(1);
  await expect(ticker.locator('.cfh-tick').first()).toBeVisible();
  const motion = () => track.evaluate((node) => [getComputedStyle(node).animationName, getComputedStyle(node).animationPlayState]);
  expect(await motion()).toEqual(['cfh-roll', 'running']);
  await expect(copy).toHaveAttribute('aria-hidden', 'true');
  expect(await copy.evaluate((node) => (node as HTMLElement).inert)).toBe(true);
  await ticker.locator('.cfh-view').hover();
  expect(await motion()).toEqual(['cfh-roll', 'paused']);
  await page.mouse.move(0, 0);
  await ticker.locator('.cfh-view').focus();
  expect(await motion()).toEqual(['cfh-roll', 'paused']);
  await ticker.locator('.cfh-view').blur();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await motion())[0]).toBe('none');
  await expect(copy).toBeHidden();
  const view = ticker.locator('.cfh-view');
  expect(await view.evaluate((node) => getComputedStyle(node).overflowX)).toBe('auto');
  expect(await view.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await view.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => view.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
});

test('the ticker repeats its coins to fill a wide view, at the same speed as a narrow one', async ({ page }) => {
  await page.goto('/blank.html');
  await add(page, [
    ['coinfinhub-ticker', { coins: 'bitcoin', api: API, style: 'width: 1200px' }],
    ['coinfinhub-ticker', { coins: 'bitcoin', api: API, style: 'width: 300px' }],
  ]);
  const tickers = page.locator('coinfinhub-ticker');
  await expect(tickers.nth(1).locator('.cfh-tick').first()).toBeVisible();
  const measure = (index: number) =>
    tickers.nth(index).evaluate((ticker) => {
      const root = ticker.shadowRoot;
      const view = root?.querySelector<HTMLElement>('.cfh-view');
      const track = root?.querySelector<HTMLElement>('.cfh-track');
      const runs = [...(root?.querySelectorAll<HTMLElement>('.cfh-run') ?? [])];
      return {
        view: view?.clientWidth ?? 0,
        track: track?.scrollWidth ?? 0,
        run: runs[0]?.offsetWidth ?? 0,
        runs: runs.length,
        hidden: runs.slice(1).every((run) => run.getAttribute('aria-hidden') === 'true' && run.inert),
        seconds: parseFloat(track ? getComputedStyle(track).animationDuration : '0'),
      };
    });
  await expect.poll(async () => (await measure(0)).runs).toBeGreaterThan(2);
  const wide = await measure(0);
  const narrow = await measure(1);
  // Half the track always covers the view, so no blank band scrolls through.
  expect(wide.track / 2).toBeGreaterThanOrEqual(wide.view);
  expect(narrow.track / 2).toBeGreaterThanOrEqual(narrow.view);
  expect(wide.hidden && narrow.hidden).toBe(true);
  // The same speed in both: the half-track's width over the loop's duration.
  const speed = ({ track, seconds }: { track: number; seconds: number }) => track / 2 / seconds;
  expect(Math.abs(speed(wide) - speed(narrow))).toBeLessThan(speed(narrow) / 5);
});

test('the converter works out either field as the visitor types, and changes currency', async ({ page }) => {
  await page.goto('/blank.html');
  await add(page, [['coinfinhub-converter', { coin: 'bitcoin', api: API }]]);
  const converter = page.locator('coinfinhub-converter');
  const amount = converter.getByLabel('Amount (BTC)');
  const value = converter.getByLabel('Value (USD)');
  await expect(value).toHaveValue(BITCOIN.slice(1));
  await amount.fill('2');
  await expect(value).not.toHaveValue(BITCOIN.slice(1));
  await value.fill('');
  await expect(amount).toHaveValue('');
  await amount.fill('1');
  // Focus stays on the picker while the price in the new currency loads.
  await converter.getByLabel('Currency').focus();
  await converter.getByLabel('Currency').selectOption('INR');
  await expect(converter.getByLabel('Value (INR)')).toHaveValue(BITCOIN_INR.slice(1));
  await expect(converter.getByLabel('Currency')).toBeFocused();
  await expect(converter).toHaveAttribute('currency', 'INR');
});

test('shows logos from CoinFinHub, and the letter when one fails', async ({ page }) => {
  await page.route('https://www.coinfinhub.com/coin-logos/**', (route) =>
    route.request().url().includes('/bitcoin.') ? route.fulfill({ contentType: 'image/png', body: PIXEL }) : route.abort(),
  );
  await page.goto('/blank.html');
  await add(page, [['coinfinhub-list', { coins: 'bitcoin,ethereum', api: API }]]);
  const logos = page.locator('coinfinhub-list .cfh-logo');
  await expect(logos.nth(0).locator('img')).toHaveJSProperty('complete', true);
  expect(await logos.nth(0).locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
  await expect(logos.nth(1)).toHaveText('E');
});

test('shows hostile text as text and keeps the link on CoinFinHub', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/blank.html');
  await add(page, [['coinfinhub-price', { coin: 'hostile', chart: '7d', api: API }]]);
  const widget = page.locator('coinfinhub-price');
  await expect(widget.locator('.cfh-name')).toHaveText('<img src=x onerror=alert(1)>');
  expect(await widget.locator('img, script, style').count()).toBe(0);
  const link = widget.locator('.cfh-link');
  await expect(link).toHaveAttribute('href', 'https://www.coinfinhub.com/price/hostile');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'nofollow noopener');
  expect(errors).toEqual([]);
});

test('defines each widget once when the script loads twice', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/blank.html');
  await page.addScriptTag({ url: '/dist/coinfinhub-widget.js?again', type: 'module' });
  await add(page, [['coinfinhub-price', { coin: 'bitcoin', api: API }]]);
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText(BITCOIN);
  expect(errors).toEqual([]);
});
