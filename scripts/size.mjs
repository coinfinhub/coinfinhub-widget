// The size budget: dist/coinfinhub-widget.js (all four widgets) gzipped at level 9 must stay at or under 12,288 bytes.
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const BUDGET = 12_288;

const file = await readFile(new URL('../dist/coinfinhub-widget.js', import.meta.url));
const gzipped = gzipSync(file, { level: 9 }).length;
console.log(`dist/coinfinhub-widget.js: ${file.length} bytes, ${gzipped} bytes gzipped (budget ${BUDGET})`);
if (gzipped > BUDGET) {
  console.error(`Over budget by ${gzipped - BUDGET} bytes.`);
  process.exit(1);
}
