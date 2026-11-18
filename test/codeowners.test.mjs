// Tests the CODEOWNERS matcher embedded in .github/workflows/auto-merge.yml.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(
  new URL('../.github/workflows/auto-merge.yml', import.meta.url),
  'utf8',
);
const source = /\/\/ BEGIN codeowners\r?\n([\s\S]*?)\/\/ END codeowners/.exec(workflow)[1];
const { ownedPatterns } = new Function(`${source}; return { ownedPatterns };`)();

const owned = (codeowners, path) => ownedPatterns(codeowners).some((re) => re.test(path));

test('anchored directories match everything below them', () => {
  assert.ok(owned('/.github/ @me', '.github/workflows/ci.yml'));
  assert.ok(owned('/src/app/(garage)/auth/ @me', 'src/app/(garage)/auth/page.tsx'));
  assert.ok(!owned('/.github/ @me', 'docs/.github/x'));
  assert.ok(!owned('/supabase/ @me', 'supabase-notes.md'));
});

test('anchored files match only that path', () => {
  assert.ok(owned('/package.json @me', 'package.json'));
  assert.ok(!owned('/package.json @me', 'e2e/package.json'));
  assert.ok(owned('/REVIEW.md @me', 'REVIEW.md'));
  assert.ok(!owned('/REVIEW.md @me', 'docs/REVIEW.md'));
});

test('a single star stays within one segment', () => {
  const codeowners = '/src/lib/drive*.ts @me\n/.claude/commands/pr-review.* @me';
  assert.ok(owned(codeowners, 'src/lib/driveSync.ts'));
  assert.ok(owned(codeowners, 'src/lib/drive.ts'));
  assert.ok(!owned(codeowners, 'src/lib/drive/sync.ts'));
  assert.ok(owned(codeowners, '.claude/commands/pr-review.md'));
  assert.ok(owned(codeowners, '.claude/commands/pr-review.LICENSE'));
  assert.ok(!owned(codeowners, '.claude/settings.local.json'));
});

test('a star in the last segment matches files there, not nested directories', () => {
  assert.ok(owned('docs/* @me', 'docs/getting-started.md'));
  assert.ok(!owned('docs/* @me', 'docs/build-app/troubleshooting.md'));
  assert.ok(owned('/docs/ @me', 'docs/build-app/troubleshooting.md'));
  assert.ok(owned('/docs/** @me', 'docs/build-app/troubleshooting.md'));
  // Other globs in the last segment also cover directories they match.
  assert.ok(owned('/config* @me', 'config-prod/secrets.json'));
});

test('unanchored patterns match at any depth, and ** crosses segments', () => {
  assert.ok(owned('*.sql @me', 'supabase/migrations/0001.sql'));
  assert.ok(owned('/docs/**/secret.md @me', 'docs/a/b/secret.md'));
  assert.ok(owned('/docs/**/secret.md @me', 'docs/secret.md'));
  assert.ok(!owned('/docs/**/secret.md @me', 'other/secret.md'));
});

test('comments, blank lines and CRLF are ignored', () => {
  const codeowners = '# Paths that need a human\r\n\r\n/api/   @me # auth\r\n';
  assert.ok(owned(codeowners, 'api/drive-auth/[action].ts'));
  assert.ok(!owned(codeowners, 'src/api.ts'));
});

test('regex characters in paths are literal', () => {
  assert.ok(owned('/src/app/api/[id]/ @me', 'src/app/api/[id]/route.ts'));
  assert.ok(!owned('/a.b @me', 'axb'));
});
