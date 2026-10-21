// Prints the embed snippet's SRI hash for dist/coinfinhub-widget.js. With --check, fails unless the
// snippets in README.md and docs/index.html carry this hash and the package version, so the snippet
// on a release tag always matches the file jsDelivr serves from that tag.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url));
const pkg = JSON.parse(await read('package.json'));
const integrity = `sha384-${createHash('sha384').update(await read('dist/coinfinhub-widget.js')).digest('base64')}`;
const src = `https://cdn.jsdelivr.net/gh/coinfinhub/coinfinhub-widget@${pkg.version}/dist/coinfinhub-widget.js`;

if (!process.argv.includes('--check')) {
  console.log(`src="${src}"\nintegrity="${integrity}"`);
} else {
  const problems = [];
  for (const path of ['README.md', 'docs/index.html']) {
    const text = String(await read(path));
    if (!text.includes(`src="${src}"`)) problems.push(`${path}: the snippet should load ${src}`);
    if (!text.includes(`integrity="${integrity}"`)) problems.push(`${path}: the snippet should carry integrity="${integrity}"`);
  }
  if (problems.length) {
    console.error(`${problems.join('\n')}\nRun "npm run sri" and update the snippets.`);
    process.exit(1);
  }
  console.log(`snippets match dist (${integrity})`);
}
