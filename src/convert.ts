/** The converter's numbers: reading what a visitor types, and writing amounts for the fields. */

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
 * An amount for a field: grouped as the currency's country groups (lakh grouping for INR), with a true minus.
 * Money gets 2 decimals from 1 up and 4 significant digits below; coin amounts up to 6 decimals, or 6
 * significant digits below 1.
 */
export function formatAmount(amount: number, currency: string, coin: boolean): string {
  if (!Number.isFinite(amount)) return '';
  const big = Math.abs(amount) >= 1;
  const options: Intl.NumberFormatOptions = big
    ? coin
      ? { maximumFractionDigits: 6 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumSignificantDigits: coin ? 6 : 4 };
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', options).format(amount).replace('-', '−');
}
