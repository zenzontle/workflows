#!/usr/bin/env node
// Copies the shared templates into a repository, or with --check reports where it has drifted.
//
//   node scripts/sync.mjs <repo> [--package <dir>] [--check]
//
// templates/repo/ files go to the repository root and templates/package/ files to the
// folder holding package.json (--package, default the root). "prefix" files must start with
// the template and may add repository-specific lines after it. "optional" files are only
// synced where the repository already has them. Line endings are ignored when comparing.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const templates = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

const files = [
  { scope: 'repo', path: '.gitattributes', mode: 'prefix' },
  { scope: 'repo', path: '.claude/CLAUDE.md', mode: 'prefix' },
  { scope: 'repo', path: '.claude/hooks/format.mjs', mode: 'exact' },
  { scope: 'repo', path: '.claude/commands/pr-review.md', mode: 'exact', optional: true },
  { scope: 'repo', path: '.claude/commands/pr-review.LICENSE', mode: 'exact', optional: true },
  { scope: 'repo', path: '.mcp.json', mode: 'exact', optional: true },
  { scope: 'package', path: '.nvmrc', mode: 'exact' },
  { scope: 'package', path: '.prettierrc.json', mode: 'exact' },
  { scope: 'package', path: 'pnpm-workspace.yaml', mode: 'prefix' },
];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { check: { type: 'boolean' }, package: { type: 'string', default: '.' } },
});
if (positionals.length !== 1) {
  console.error('Usage: node scripts/sync.mjs <repo> [--package <dir>] [--check]');
  process.exit(2);
}
const repo = resolve(positionals[0]);
const packageDir = resolve(repo, values.package);
const lf = (text) => text.replace(/\r\n/g, '\n');

let drifted = 0;
let manual = 0;
for (const { scope, path, mode, optional } of files) {
  const template = lf(await readFile(join(templates, scope, path), 'utf8'));
  const target = join(scope === 'repo' ? repo : packageDir, path);
  const exists = existsSync(target);
  if (!exists && optional) continue;
  const current = exists ? lf(await readFile(target, 'utf8')) : null;

  let wanted;
  if (mode === 'exact' || current === null) wanted = template;
  else if (current.startsWith(template)) wanted = current;
  else {
    // Prepending could duplicate settings the file already has, so leave the merge to a person.
    drifted++;
    manual++;
    console.log(`merge by hand (must start with templates/${scope}/${path}): ${target}`);
    continue;
  }

  if (current === wanted) continue;
  drifted++;
  if (values.check) {
    console.log(`${exists ? 'differs' : 'missing'}: ${target}`);
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, wanted);
    console.log(`${exists ? 'updated' : 'created'}: ${target}`);
  }
}
if (values.check ? drifted : manual) process.exitCode = 1;
