// Nothing unused: every cfh-* class in src/styles.ts is used by the render code and every class the
// render code uses is styled; every --cfh-* token defined is used, and every token used is defined.
import { readFile } from 'node:fs/promises';
import { css, light } from '../src/styles.ts';

const render = (await readFile(new URL('../src/coinfinhub-price.ts', import.meta.url), 'utf8')).replace(
  /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  '',
);

const words = (text, pattern) => new Set(Array.from(text.matchAll(pattern), (m) => m[1]));
const styled = words(css, /\.(cfh-[a-z0-9-]+)/g);
const used = words(render, /(?<![\w-])(cfh-[a-z0-9-]+)/g);
const defined = new Set(Object.keys(light).map((name) => `cfh-${name}`));
const referenced = words(css, /var\(--(cfh-[a-z0-9-]+)\)/g);

const problems = [
  ...[...styled].filter((c) => !used.has(c)).map((c) => `.${c} is styled but never rendered`),
  ...[...used].filter((c) => !styled.has(c)).map((c) => `${c} is rendered but has no style`),
  ...[...defined].filter((t) => !referenced.has(t)).map((t) => `--${t} is defined but never used`),
  ...[...referenced].filter((t) => !defined.has(t)).map((t) => `--${t} is used but never defined`),
];

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`unused CSS: none (${styled.size} classes, ${defined.size} tokens)`);
