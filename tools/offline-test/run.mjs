/**
 * Runner de secours : exécute les fichiers `lib/**\/*.test.ts` avec le
 * type-stripping natif de Node, en résolvant l'import `vitest` vers le shim
 * local. À utiliser uniquement quand npm est injoignable ; sinon `npm test`.
 *
 *   node --experimental-strip-types tools/offline-test/run.mjs
 */

import { readdir } from 'node:fs/promises';
import module from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const shimUrl = pathToFileURL(
  path.join(root, 'tools/offline-test/vitest-shim.mjs'),
).href;

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'vitest') return { url: shimUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { suites } = await import(shimUrl);

async function collect(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(full)));
    else if (entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out.sort();
}

const files = await collect(path.join(root, 'lib'));
for (const file of files) await import(pathToFileURL(file).href);

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

async function runSuite(suite, trail, hooks) {
  const label = [...trail, suite.name];
  if (suite.skip) {
    skipped += suite.tests.length;
    return;
  }
  const chain = [...hooks, suite];
  for (const t of suite.tests) {
    if (t.skip) {
      skipped += 1;
      continue;
    }
    try {
      for (const s of chain) for (const fn of s.before) await fn();
      await t.fn();
      for (const s of [...chain].reverse()) for (const fn of s.after) await fn();
      passed += 1;
    } catch (error) {
      failed += 1;
      failures.push({ name: [...label, t.name].join(' › '), error });
    }
  }
  for (const child of suite.children) await runSuite(child, label, chain);
}

const started = process.hrtime.bigint();
for (const suite of suites) {
  await runSuite(suite, [], []);
  const own = countTests(suite);
  console.log(`${DIM}▸${RESET} ${suite.name} ${DIM}(${own})${RESET}`);
}

function countTests(suite) {
  return (
    suite.tests.length +
    suite.children.reduce((n, c) => n + countTests(c), 0)
  );
}

const ms = Number(process.hrtime.bigint() - started) / 1e6;

if (failures.length) {
  console.log('');
  for (const f of failures) {
    console.log(`${RED}✗ ${f.name}${RESET}`);
    console.log(`  ${f.error?.message ?? f.error}`);
    if (f.error?.stack && !(f.error instanceof Error && f.error.name === 'AssertionError')) {
      console.log(
        `${DIM}${String(f.error.stack).split('\n').slice(1, 4).join('\n')}${RESET}`,
      );
    }
  }
}

console.log('');
console.log(
  `${failed ? RED : GREEN}${passed} passés, ${failed} échoués${skipped ? `, ${skipped} ignorés` : ''}${RESET} ${DIM}(${ms.toFixed(0)} ms, ${files.length} fichiers)${RESET}`,
);
process.exit(failed ? 1 : 0);
