// Prints the embed snippet's SRI hash for dist/coinfinhub-widget.js. With --check, fails unless README.md and
// docs/index.html load the latest of the package's major version from cdn.coinfinhub.com (the default snippet, no
// hash), README.md also pins the package version, and every integrity hash in them is this one, so a release tag's
// pinned snippets always match the file cdn.coinfinhub.com/widgets/{version}/ serves and jsDelivr mirrors from that tag.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url));
const pkg = JSON.parse(await read('package.json'));
const integrity = `sha384-${createHash('sha384').update(await read('dist/coinfinhub-widget.js')).digest('base64')}`;
const src = (version) => `https://cdn.coinfinhub.com/widgets/${version}/coinfinhub-widget.js`;
const pinned = src(pkg.version);
const latest = src(pkg.version.split('.')[0]);

if (!process.argv.includes('--check')) {
  console.log(`src="${pinned}"\nintegrity="${integrity}"`);
} else {
  const problems = [];
  for (const [path, pins] of [['README.md', true], ['docs/index.html', false]]) {
    const text = String(await read(path));
    if (!text.includes(`src="${latest}"`)) problems.push(`${path}: the default snippet should load ${latest}`);
    if (pins && !text.includes(`src="${pinned}"`)) problems.push(`${path}: the pinned snippet should load ${pinned}`);
    // The mirror's snippet too: every integrity attribute must be this file's.
    const hashes = [...text.matchAll(/integrity="([^"]*)"/g)].map(([, hash]) => hash);
    if ((pins && !hashes.length) || hashes.some((hash) => hash !== integrity)) {
      problems.push(`${path}: every pinned snippet should carry integrity="${integrity}"`);
    }
  }
  if (problems.length) {
    console.error(`${problems.join('\n')}\nRun "npm run sri" and update the snippets.`);
    process.exit(1);
  }
  console.log(`snippets match dist (${integrity})`);
}
