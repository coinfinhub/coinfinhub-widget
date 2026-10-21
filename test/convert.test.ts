import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount } from '../src/convert';
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

describe('writing amounts', () => {
  it('gives money 2 decimals from 1 up, grouped as the currency’s country groups', () => {
    expect(formatAmount(172_183.94, 'USD', false)).toBe('172,183.94');
    expect(formatAmount(8_299_733.9, 'INR', false)).toBe('82,99,733.90');
    expect(formatAmount(1_234_567.891, 'INR', false)).toBe('12,34,567.89');
    expect(formatAmount(12.3, 'EUR', false)).toBe('12.30');
  });

  it('gives money below 1 four significant digits', () => {
    expect(formatAmount(0.00615, 'USD', false)).toBe('0.00615');
    expect(formatAmount(0.123456, 'USD', false)).toBe('0.1235');
    expect(formatAmount(0, 'USD', false)).toBe('0');
  });

  it('gives coin amounts up to 6 decimals, or 6 significant digits below 1', () => {
    expect(formatAmount(81.300813008, 'USD', true)).toBe('81.300813');
    expect(formatAmount(1_234_567.891234, 'USD', true)).toBe('1,234,567.891234');
    expect(formatAmount(1000 / 86_091.97, 'USD', true)).toBe('0.0116155');
    expect(formatAmount(2, 'USD', true)).toBe('2');
  });

  it('writes a true minus, and nothing for a number that isn’t one', () => {
    expect(formatAmount(-3.5, 'USD', false)).toBe('−3.50');
    expect(formatAmount(Number.NaN, 'USD', false)).toBe('');
    expect(formatAmount(Infinity, 'USD', true)).toBe('');
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
