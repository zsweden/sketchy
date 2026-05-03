import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const FRAMEWORKS_DIR = join(SRC, 'frameworks');

function walk(dir: string, accept: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      out.push(...walk(full, accept));
    } else if (accept(full)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(
  SRC,
  (path) => /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path),
);

const isInTestDir = (path: string) => /\/__tests__\//.test(path) || /\/test\//.test(path);

describe('architecture invariants', () => {
  it('src/frameworks/ contains JSON manifests and exactly one TypeScript file (registry.ts)', () => {
    const tsFiles = readdirSync(FRAMEWORKS_DIR).filter((name) => /\.(ts|tsx)$/.test(name));
    expect(tsFiles).toEqual(['registry.ts']);
  });

  it('only registry.ts imports framework JSON manifests', () => {
    const offenders: { file: string; line: number; importPath: string }[] = [];
    const importPattern = /from\s+['"](.+?\/frameworks\/[a-zA-Z0-9_-]+\.json)['"]/g;

    for (const file of sourceFiles) {
      if (file.endsWith(`${join('frameworks', 'registry.ts')}`)) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        const matches = lineText.matchAll(importPattern);
        for (const match of matches) {
          offenders.push({
            file: relative(ROOT, file),
            line: idx + 1,
            importPath: match[1],
          });
        }
      });
    }

    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  it('production code does not branch on a framework id literal', () => {
    const offenders: { file: string; line: number; snippet: string }[] = [];
    // Catches `frameworkId === 'crt'` and `'crt' === frameworkId` and !== variants,
    // but not `d.frameworkId === 'string'` (a typeof check on a property, which the
    // ESLint AST-based rule also lets through). Mirrors the ESLint selector by
    // requiring `frameworkId` to be a bare identifier (no preceding dot).
    const equalityPattern = /(?:(?<![.\w])frameworkId\s*[!=]==\s*['"][^'"]+['"])|(?:['"][^'"]+['"]\s*[!=]==\s*(?<![.\w])frameworkId)/;

    for (const file of sourceFiles) {
      if (isInTestDir(file)) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        if (equalityPattern.test(lineText)) {
          offenders.push({
            file: relative(ROOT, file),
            line: idx + 1,
            snippet: lineText.trim(),
          });
        }
      });
    }

    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  it('src/core/ does not import from store, components, or hooks', () => {
    const offenders: { file: string; line: number; importPath: string }[] = [];
    const importPattern = /from\s+['"]([^'"]+)['"]/g;
    const forbidden = /(?:^|\/)(store|components|hooks)\//;

    for (const file of sourceFiles) {
      if (!file.includes(`${join('src', 'core')}`)) continue;
      if (isInTestDir(file)) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        const matches = lineText.matchAll(importPattern);
        for (const match of matches) {
          const importPath = match[1];
          if (importPath.startsWith('.') && forbidden.test(importPath)) {
            offenders.push({
              file: relative(ROOT, file),
              line: idx + 1,
              importPath,
            });
          }
        }
      });
    }

    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});
