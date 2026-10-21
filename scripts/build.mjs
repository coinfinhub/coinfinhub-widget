// Builds dist/coinfinhub-widget.js: one minified ES module, the same bytes on every machine,
// so CI can check that the committed file matches a fresh build and SRI hashes stay valid.
import { readFile } from 'node:fs/promises';
import { build, transform } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const target = ['chrome111', 'edge111', 'firefox115', 'safari16.4'];

/** Minifies the CSS template in src/styles.ts (the one marked with a css comment). */
const minifyCss = {
  name: 'minify-css',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]styles\.ts$/ }, async (args) => {
      const source = (await readFile(args.path, 'utf8')).replace(/\r\n/g, '\n');
      const match = /\/\* css \*\/ `([^`$]*)`/.exec(source);
      if (!match) throw new Error('src/styles.ts: no /* css */ template found');
      const { code } = await transform(match[1], { loader: 'css', minify: true, target });
      // A function, so a "$" in the CSS can never act as a replacement pattern.
      return { contents: source.replace(match[0], () => JSON.stringify(code.trim())), loader: 'ts' };
    });
  },
};

await build({
  entryPoints: ['src/coinfinhub-widget.ts'],
  outfile: 'dist/coinfinhub-widget.js',
  bundle: true,
  format: 'esm',
  minify: true,
  target,
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: `/*! coinfinhub-widget ${pkg.version} | MIT | (c) 2026 Rudranx Digital Labs | github.com/coinfinhub/coinfinhub-widget */` },
  plugins: [minifyCss],
  logLevel: 'warning',
});
console.log(`built dist/coinfinhub-widget.js (${pkg.version})`);
