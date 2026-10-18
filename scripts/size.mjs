// The size budget: dist/coinfinhub-price.js gzipped at level 9 must stay at or under 10,240 bytes.
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const BUDGET = 10_240;
const TARGET = 6_144;

const file = await readFile(new URL('../dist/coinfinhub-price.js', import.meta.url));
const gzipped = gzipSync(file, { level: 9 }).length;
console.log(`dist/coinfinhub-price.js: ${file.length} bytes, ${gzipped} bytes gzipped (budget ${BUDGET}, target ${TARGET})`);
if (gzipped > BUDGET) {
  console.error(`Over budget by ${gzipped - BUDGET} bytes.`);
  process.exit(1);
}
if (gzipped > TARGET) console.warn(`Over the ${TARGET}-byte target by ${gzipped - TARGET} bytes.`);
