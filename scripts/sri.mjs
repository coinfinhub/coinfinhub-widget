// Prints the embed snippet's SRI hash for dist/coinfinhub-widget.js. With --check, fails unless the snippets in
// README.md and docs/index.html load the package version from cdn.coinfinhub.com and every integrity hash in them
// is this one, so a release tag's snippets always match the file cdn.coinfinhub.com/widgets/{version}/ serves
// and jsDelivr mirrors from that tag.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url));
const pkg = JSON.parse(await read('package.json'));
const integrity = `sha384-${createHash('sha384').update(await read('dist/coinfinhub-widget.js')).digest('base64')}`;
const src = `https://cdn.coinfinhub.com/widgets/${pkg.version}/coinfinhub-widget.js`;

if (!process.argv.includes('--check')) {
  console.log(`src="${src}"\nintegrity="${integrity}"`);
} else {
  const problems = [];
  for (const path of ['README.md', 'docs/index.html']) {
    const text = String(await read(path));
    if (!text.includes(`src="${src}"`)) problems.push(`${path}: the snippet should load ${src}`);
    // The mirror's snippet too: every integrity attribute must be this file's.
    const hashes = [...text.matchAll(/integrity="([^"]*)"/g)].map(([, hash]) => hash);
    if (!hashes.length || hashes.some((hash) => hash !== integrity)) {
      problems.push(`${path}: every snippet should carry integrity="${integrity}"`);
    }
  }
  if (problems.length) {
    console.error(`${problems.join('\n')}\nRun "npm run sri" and update the snippets.`);
    process.exit(1);
  }
  console.log(`snippets match dist (${integrity})`);
}
