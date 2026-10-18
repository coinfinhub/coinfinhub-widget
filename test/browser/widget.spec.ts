import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// The pages are served from localhost and the mock API from 127.0.0.1 (servers.mjs): every
// request the widget makes here is cross-origin, as on other people's sites.
const API = 'http://127.0.0.1:4174';

const unique = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/** How many times the widget asked the mock API for a coin, by currency. */
async function asked(request: APIRequestContext, coin: string): Promise<Record<string, number>> {
  const response = await request.get(`${API}/__requests?coin=${coin}`);
  return (await response.json()) as Record<string, number>;
}

async function addWidget(page: Page, attributes: Record<string, string>, style = ''): Promise<void> {
  await page.evaluate(
    ([attrs, css]) => {
      const widget = document.createElement('coinfinhub-price');
      for (const [name, value] of Object.entries(attrs)) widget.setAttribute(name, value);
      if (css) widget.setAttribute('style', css);
      document.querySelector('main')?.append(widget);
    },
    [attributes, style] as const,
  );
}

/** Scrolls every widget into view once: they only ask for a price while on screen. */
async function showAll(page: Page): Promise<void> {
  for (const widget of await page.locator('coinfinhub-price').all()) await widget.scrollIntoViewIfNeeded();
}

/** Fails the test on any script error or console error on the page. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // Browsers log every 4xx or 5xx answer; the error answers are part of these tests.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());
  });
  page.on('dialog', (dialog) => {
    errors.push(`dialog: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return errors;
}

test('the demo shows every sample state from another origin, with no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`/?api=${API}`);
  await expect(page.locator('#cfh-demo-source')).toHaveText(`Every widget on this page asks ${API}.`);
  await expect(page.locator('#cfh-demo-live .cfh-price')).toHaveText('$86,091.97');
  await showAll(page);
  const figure = (caption: string) =>
    page
      .locator('figure')
      .filter({ has: page.locator('figcaption', { hasText: caption }) })
      .locator('coinfinhub-price');
  await expect(figure('Another currency').locator('.cfh-price')).toHaveText('₹75,86,424.40');
  await expect(figure('Another currency').locator('.cfh-foot')).toContainText('USD rate derived from ECB data');
  await expect(figure('Little trading').locator('.cfh-note')).toHaveText("Little trading: the price may be far from what you'd pay");
  await expect(figure('No rate for a currency').locator('.cfh-note')).toHaveText('Shown in US dollars: no EUR rate right now.');
  await expect(figure('Loading').locator('.cfh-status')).toHaveText('Loading price…');
  await expect(figure('Prices unavailable').locator('.cfh-status')).toHaveText('Price unavailable right now.');
  await expect(figure('An unknown coin').locator('.cfh-status')).toHaveText('CoinFinHub has no page for this coin.');
  expect(errors).toEqual([]);
});

test('the demo falls back to sample data when the live endpoint does not answer', async ({ page }) => {
  await page.route('https://www.coinfinhub.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#cfh-demo-source')).toContainText('sample data');
  await expect(page.locator('#cfh-demo-live .cfh-price')).toHaveText('$86,091.97');
  await page.locator('select[name=currency]').selectOption('INR');
  await expect(page.locator('#cfh-demo-live .cfh-price')).toHaveText('₹75,86,424.40');
  await expect(page.locator('#cfh-demo-snippet')).toContainText('<coinfinhub-price coin="bitcoin" currency="INR" theme="auto">');
});

test('has no accessibility violations (axe), in light and dark', async ({ page }) => {
  await page.goto(`/?api=${API}`);
  await expect(page.locator('#cfh-demo-live .cfh-price')).toBeVisible();
  await showAll(page);
  await expect(page.locator('.cfh-demo-grid .cfh-price').first()).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, colorScheme).toEqual([]);
  }
});

test('waits as retryAfter says', async ({ page, request }) => {
  await page.clock.install();
  await page.goto('/blank.html');
  const coin = unique('limited');
  await addWidget(page, { coin, api: API });
  await expect(page.locator('coinfinhub-price .cfh-status')).toHaveText('Price unavailable right now.');
  await page.clock.runFor(55_000);
  expect(await asked(request, coin)).toEqual({ USD: 1 });
  await page.clock.runFor(6_000);
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText('$86,091.97');
  expect(await asked(request, coin)).toEqual({ USD: 2 });
});

test('widgets showing the same coin and currency share one request', async ({ page, request }) => {
  await page.goto('/blank.html');
  const coin = unique('count');
  for (const currency of ['USD', 'USD', 'usd', 'INR']) await addWidget(page, { coin, currency, api: API });
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveCount(4);
  expect(await asked(request, coin)).toEqual({ USD: 1, INR: 1 });
});

test('pauses while the tab is hidden', async ({ page, request }) => {
  await page.clock.install();
  await page.goto('/blank.html');
  const coin = unique('count');
  await addWidget(page, { coin, api: API });
  await expect(page.locator('coinfinhub-price .cfh-price')).toBeVisible();
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await page.clock.runFor(5 * 60_000);
  expect(await asked(request, coin)).toEqual({ USD: 1 });
  await setHidden(false);
  await expect.poll(() => asked(request, coin)).toEqual({ USD: 2 });
});

test("follows the host's text size, but never below 15 px", async ({ page }) => {
  await page.goto('/blank.html');
  await page.addStyleTag({ content: 'html { font-size: 10px } main { font-size: 1rem } .big { font-size: 20px }' });
  await addWidget(page, { coin: 'bitcoin', api: API });
  await page.evaluate(() => {
    const big = document.createElement('div');
    big.className = 'big';
    big.append(document.createElement('coinfinhub-price'));
    big.firstElementChild?.setAttribute('coin', 'bitcoin');
    big.firstElementChild?.setAttribute('api', 'http://127.0.0.1:4174');
    document.querySelector('main')?.append(big);
  });
  const size = (index: number) =>
    page.locator('coinfinhub-price').nth(index).evaluate((widget) => getComputedStyle(widget).fontSize);
  expect(await size(0)).toBe('15px');
  expect(await size(1)).toBe('20px');
});

test('fits 200 px without sideways overflow, and the link target is at least 28 px tall', async ({ page }) => {
  await page.goto('/blank.html');
  await addWidget(page, { coin: 'bitcoin', currency: 'INR', api: API }, 'width: 200px');
  const card = page.locator('coinfinhub-price .cfh-card');
  await expect(card.locator('.cfh-price')).toHaveText('₹75,86,424.40');
  const fits = await card.evaluate((node) => node.scrollWidth <= node.clientWidth);
  expect(fits).toBe(true);
  const box = await card.locator('.cfh-link').boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(28);
});

test('switches theme with the attribute and the colour scheme', async ({ page }) => {
  await page.goto('/blank.html');
  await addWidget(page, { coin: 'bitcoin', api: API, theme: 'light' });
  const card = page.locator('coinfinhub-price .cfh-card');
  const background = () => card.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(await background()).toBe('rgb(255, 255, 255)');
  await page.locator('coinfinhub-price').evaluate((widget) => {
    widget.setAttribute('theme', 'dark');
  });
  expect(await background()).toBe('rgb(26, 25, 32)');
  await page.locator('coinfinhub-price').evaluate((widget) => {
    widget.setAttribute('theme', 'auto');
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
  await addWidget(page, { coin: 'bitcoin', api: API, theme: 'light' });
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText('$86,091.97');
  const background = await page.locator('coinfinhub-price .cfh-card').evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(background).toBe('rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

test('the Today tip opens on focus and hover, and Escape closes it', async ({ page }) => {
  await page.goto('/blank.html');
  await addWidget(page, { coin: 'bitcoin', api: API });
  const line = page.locator('coinfinhub-price .cfh-ctx');
  const tip = line.locator('.cfh-tip');
  await expect(line).toBeVisible();
  await expect(tip).toBeHidden();
  await line.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await line.blur();
  await line.hover();
  await expect(tip).toBeVisible();
});

test('shows hostile text as text and keeps the link on CoinFinHub', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/blank.html');
  await addWidget(page, { coin: 'hostile', api: API });
  const widget = page.locator('coinfinhub-price');
  await expect(widget.locator('.cfh-name')).toHaveText('<img src=x onerror=alert(1)>');
  expect(await widget.locator('img, script, svg, style').count()).toBe(0);
  const link = widget.locator('.cfh-link');
  await expect(link).toHaveAttribute('href', 'https://www.coinfinhub.com/price/hostile');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'nofollow noopener');
  expect(errors).toEqual([]);
});

test('is defined once when the script loads twice', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/blank.html');
  await page.addScriptTag({ url: '/dist/coinfinhub-price.js?again', type: 'module' });
  await addWidget(page, { coin: 'bitcoin', api: API });
  await expect(page.locator('coinfinhub-price .cfh-price')).toHaveText('$86,091.97');
  expect(errors).toEqual([]);
});
