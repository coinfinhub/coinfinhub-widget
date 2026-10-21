/**
 * The widgets' one formatter: prices, amounts, changes and days as every widget writes them (the endpoint sends
 * numbers and codes only), and reading what a visitor types into the converter. English in v1.
 */

/** A true minus: a hyphen next to a number reads as a dash. */
const minus = (text: string): string => text.replace('-', '−');

/**
 * A typed number, or null when there is none. Spaces and grouping commas are ignored ("1,234.5",
 * "12,34,567"); a single comma that can't be grouping is the decimal mark ("0,5", "1.234,56"); a true
 * minus counts as a minus.
 */
export function parseAmount(typed: string): number | null {
  let text = typed.replace(/[\s'_]/g, '').replace(/−/g, '-');
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  const decimalComma = comma > dot && text.indexOf(',') === comma && (dot >= 0 || !/^\d{3}$/.test(text.slice(comma + 1)));
  text = decimalComma ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : null;
}

/**
 * An amount, grouped as the currency's country groups (lakh grouping for INR), with a true minus; '' for a number
 * that isn't one.
 * - `price`: money with the currency's sign as Intl writes it, "$86,091.97", "₹82,99,733.90", "¥12,941,000";
 * - `money`: the same digits without the sign, for the converter's field;
 *   both with the currency's own decimals from 1 up (2, none in yen) and 4 significant digits below 1, "$0.00000436";
 * - `coin`: an amount of a coin, up to 6 decimals, or 6 significant digits below 1.
 * Throws for a currency code Intl can't read.
 */
export function formatAmount(amount: number, currency: string, kind: 'price' | 'money' | 'coin'): string {
  if (!Number.isFinite(amount)) return '';
  const small = Math.abs(amount) < 1;
  const coin = kind === 'coin';
  const format = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    ...(coin ? {} : { style: 'currency', currency }),
    ...(small ? { maximumSignificantDigits: coin ? 6 : 4 } : coin ? { maximumFractionDigits: 6 } : {}),
  });
  const parts = format.formatToParts(amount);
  // Without the sign: the number alone, also when the sign comes with a space ("CHF 12.30").
  const shown = kind === 'money' ? parts.filter((part) => part.type !== 'currency' && part.type !== 'literal') : parts;
  return minus(shown.map((part) => part.value).join(''));
}

/** A 24h change as shown, "+2.80%", "−1.34%", or "0.00%" when it rounds to nothing, and its direction. */
export function formatChange(percent: number): [text: string, direction: 'up' | 'down' | 'flat'] {
  // Rounded as shown, so the arrow and the colour always agree with the number.
  const shown = Number(percent.toFixed(2));
  const text = new Intl.NumberFormat('en-US', {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(shown / 100);
  return [minus(text), shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat'];
}

/** A day as "1 Oct 2026", in UTC as the site writes it, or null for a time that isn't one. */
export function formatDay(time: unknown): string | null {
  const at = typeof time === 'string' ? Date.parse(time) : NaN;
  return Number.isNaN(at) ? null : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(at);
}
