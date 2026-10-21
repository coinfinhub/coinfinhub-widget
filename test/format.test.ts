import { describe, expect, it } from 'vitest';
import { formatAmount, formatChange, formatDay, parseAmount } from '../src/format';
import { points, trend } from '../src/spark';

describe('reading what a visitor types', () => {
  it.each([
    ['1', 1],
    ['2.5', 2.5],
    ['.5', 0.5],
    ['3.', 3],
    ['1,000', 1000],
    ['1,234.5', 1234.5],
    ['12,34,567.89', 1234567.89],
    ['1 000 000', 1_000_000],
    [' 1 000 ', 1000],
    ['0,5', 0.5],
    ['1,25', 1.25],
    ['1.234,56', 1234.56],
    ['1.234.567,8', 1234567.8],
    ['-3', -3],
    ['−3.5', -3.5],
  ])('reads %j as %s', (typed, value) => {
    expect(parseAmount(typed)).toBe(value);
  });

  it.each(['', '   ', 'abc', '1e3', '1.2.3', '--1', '$5', '1-2', ',', '.'])('reads %j as nothing', (typed) => {
    expect(parseAmount(typed)).toBeNull();
  });
});

describe('writing prices', () => {
  it.each([
    ['BTC in USD', 86_091.97, 'USD', '$86,091.97'],
    ['BTC in INR, lakh grouping', 8_299_733.9, 'INR', '₹82,99,733.90'],
    ['BTC in JPY, no decimals as Intl writes yen', 12_941_000.5, 'JPY', '¥12,941,001'],
    ['BTC in EUR', 73_810.42, 'EUR', '€73,810.42'],
    ['BTC in GBP', 64_235.6, 'GBP', '£64,235.60'],
    ['BTC in CNY', 613_272.1, 'CNY', 'CN¥613,272.10'],
    ['BTC in AUD', 130_621.3, 'AUD', 'A$130,621.30'],
    // Intl keeps the code and the number together with a no-break space.
    ['BTC in CHF', 68_444.91, 'CHF', 'CHF\u00a068,444.91'],
    ['two decimals from 1 up', 1.0001, 'USD', '$1.00'],
    ['a sub-dollar coin, 4 decimals', 0.6512, 'USD', '$0.6512'],
    ['a sub-dollar coin, padded to 4 decimals', 0.456, 'USD', '$0.4560'],
    ['a sub-dollar coin, rounded to 4 decimals', 0.123456, 'USD', '$0.1235'],
    ['a tiny coin', 0.00000436, 'USD', '$0.00000436'],
    ['a tiny coin, rounded', 0.0000043617, 'USD', '$0.000004362'],
    ['a sub-rupee coin', 0.0123, 'INR', '₹0.0123'],
    ['below one yen', 0.6512, 'JPY', '¥0.6512'],
  ])('%s: %s %s is %s', (_, amount, currency, text) => {
    expect(formatAmount(amount, currency, 'price')).toBe(text);
  });

  // The site's rule (cfh-web-app shared/utils/format.ts), with the site's test values: 2 decimals from 1 unit up
  // (none in yen), 4 decimals from 0.01 up to 1, 4 significant digits below 0.01, by the size as shown: one that
  // rounds up into the next tier takes that tier's digits.
  it.each([
    [1, 'USD', '$1.00'],
    [0.99995, 'USD', '$1.00'],
    [0.99994, 'USD', '$0.9999'],
    [0.5, 'USD', '$0.5000'],
    [0.01, 'USD', '$0.0100'],
    [0.0099996, 'USD', '$0.0100'],
    [0.0099994, 'USD', '$0.009999'],
    [0.00999, 'USD', '$0.00999'],
    [0.0000043, 'USD', '$0.0000043'],
    [-0.5, 'USD', '−$0.5000'],
    [-0.99995, 'USD', '−$1.00'],
    [-0.0099996, 'USD', '−$0.0100'],
    [-0.00999, 'USD', '−$0.00999'],
    [1, 'JPY', '¥1'],
    [0.99995, 'JPY', '¥1'],
    [0.99994, 'JPY', '¥0.9999'],
    [0.5, 'JPY', '¥0.5000'],
    [0.01, 'JPY', '¥0.0100'],
    [0.0099996, 'JPY', '¥0.0100'],
    [0.00999, 'JPY', '¥0.00999'],
    [0.0000043, 'JPY', '¥0.0000043'],
    [1, 'INR', '₹1.00'],
    [0.99995, 'INR', '₹1.00'],
    [123_456.789, 'INR', '₹1,23,456.79'],
    [0.5, 'INR', '₹0.5000'],
    [0.01, 'INR', '₹0.0100'],
    [0.0099996, 'INR', '₹0.0100'],
    [0.00999, 'INR', '₹0.00999'],
    [0.0000043, 'INR', '₹0.0000043'],
    [0.5, 'CHF', 'CHF 0.5000'],
    [0.99995, 'CHF', 'CHF 1.00'],
  ])('writes %s %s as the site does: %s', (amount, currency, text) => {
    expect(formatAmount(amount, currency, 'price')).toBe(text);
  });

  it('writes a true minus, and nothing for a number that isn’t one', () => {
    expect(formatAmount(-3.5, 'USD', 'price')).toBe('−$3.50');
    expect(formatAmount(Number.NaN, 'USD', 'price')).toBe('');
  });

  it('throws for a currency code Intl can’t read', () => {
    expect(() => formatAmount(1, 'U$D', 'price')).toThrow(RangeError);
  });
});

describe('writing amounts for the converter', () => {
  it('gives money the price’s digits without the sign, grouped as the currency’s country groups', () => {
    expect(formatAmount(172_183.94, 'USD', 'money')).toBe('172,183.94');
    expect(formatAmount(8_299_733.9, 'INR', 'money')).toBe('82,99,733.90');
    expect(formatAmount(1_234_567.891, 'INR', 'money')).toBe('12,34,567.89');
    expect(formatAmount(12.3, 'EUR', 'money')).toBe('12.30');
    expect(formatAmount(12.3, 'CHF', 'money')).toBe('12.30');
    expect(formatAmount(12_941_000.5, 'JPY', 'money')).toBe('12,941,001');
  });

  it('gives money below 1 the price’s digits: 4 decimals from 0.01, 4 significant digits below, by the size as shown', () => {
    expect(formatAmount(1, 'USD', 'money')).toBe('1.00');
    expect(formatAmount(0.99995, 'USD', 'money')).toBe('1.00');
    expect(formatAmount(0.99994, 'USD', 'money')).toBe('0.9999');
    expect(formatAmount(0.5, 'USD', 'money')).toBe('0.5000');
    expect(formatAmount(0.123456, 'USD', 'money')).toBe('0.1235');
    expect(formatAmount(0.01, 'USD', 'money')).toBe('0.0100');
    expect(formatAmount(0.0099996, 'USD', 'money')).toBe('0.0100');
    expect(formatAmount(0.00999, 'USD', 'money')).toBe('0.00999');
    expect(formatAmount(0.00615, 'USD', 'money')).toBe('0.00615');
    expect(formatAmount(0.0000043, 'USD', 'money')).toBe('0.0000043');
    expect(formatAmount(0.5, 'JPY', 'money')).toBe('0.5000');
    expect(formatAmount(1, 'JPY', 'money')).toBe('1');
    expect(formatAmount(0.99995, 'JPY', 'money')).toBe('1');
    expect(formatAmount(0.5, 'INR', 'money')).toBe('0.5000');
    expect(formatAmount(0.5, 'CHF', 'money')).toBe('0.5000');
    expect(formatAmount(0, 'USD', 'money')).toBe('0');
  });

  it('gives coin amounts up to 6 decimals, or 6 significant digits below 1', () => {
    expect(formatAmount(81.300813008, 'USD', 'coin')).toBe('81.300813');
    expect(formatAmount(1_234_567.891234, 'USD', 'coin')).toBe('1,234,567.891234');
    expect(formatAmount(1_234_567.891234, 'INR', 'coin')).toBe('12,34,567.891234');
    expect(formatAmount(1000 / 86_091.97, 'USD', 'coin')).toBe('0.0116155');
    expect(formatAmount(2, 'USD', 'coin')).toBe('2');
  });

  it('writes a true minus, and nothing for a number that isn’t one', () => {
    expect(formatAmount(-3.5, 'USD', 'money')).toBe('−3.50');
    expect(formatAmount(Infinity, 'USD', 'coin')).toBe('');
  });
});

describe('writing changes', () => {
  it.each([
    [2.8, '+2.80%', 'up'],
    [-1.3421, '−1.34%', 'down'],
    [-0.009326364692217, '−0.01%', 'down'],
    [0.004, '0.00%', 'flat'],
    [-0.004, '0.00%', 'flat'],
    [0, '0.00%', 'flat'],
    [12_345.678, '+12,345.68%', 'up'],
  ])('writes %s as %s, %s', (percent, text, direction) => {
    expect(formatChange(percent)).toEqual([text, direction]);
  });
});

describe('writing days', () => {
  it('writes a day as the site does, in UTC', () => {
    expect(formatDay('2026-10-01T14:20:00.000Z')).toBe('1 Oct 2026');
    expect(formatDay('2026-10-12T23:59:59Z')).toBe('12 Oct 2026');
    expect(formatDay('2026-10-12T23:30:00-05:00')).toBe('13 Oct 2026');
  });

  it.each(['soon', '', null, 1_760_000_000_000])('has no day for %j', (time) => {
    expect(formatDay(time)).toBeNull();
  });
});

describe('the 7-day line', () => {
  it('spreads the points across the width, highest at the top, inside the padding', () => {
    expect(points([1, 3, 2], 100, 30, 2)).toBe('0,28 50,2 100,15');
  });

  it('keeps a line that never moves in the middle', () => {
    expect(points([5, 5, 5, 5], 120, 32, 2)).toBe('0,16 40,16 80,16 120,16');
  });

  it('rounds to two decimals', () => {
    expect(points([0, 1, 0.5], 10, 10, 1)).toBe('0,9 5,1 10,5');
    expect(points([1, 2, 3, 4, 5, 6, 7], 100, 32, 2).split(' ')[1]).toBe('16.67,25.33');
  });

  it('says which way the week went, from the first point to the last', () => {
    expect(trend([84_027.3, 86_664, 85_990])).toBe('up');
    expect(trend([3, 1, 2])).toBe('down');
    expect(trend([2, 9, 2])).toBe('flat');
  });
});
