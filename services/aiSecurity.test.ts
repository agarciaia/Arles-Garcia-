import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const FRONTEND_ROOT_FILES = ['App.tsx', 'index.tsx', 'firebase.ts'];
const FRONTEND_DIRS = ['components', 'services'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const secretEnvNames = [
  'GROQ',
  'OPENROUTER',
  'GEMINI',
  'CARVECTOR',
  'CEREBRAS',
  'MISTRAL',
  'NVIDIA',
  'HF_TOKEN',
  'COHERE',
  'AI_GATEWAY',
  'CLOUDFLARE',
];

function extension(path: string) {
  const match = path.match(/(\.tsx?|\.jsx?)$/);
  return match?.[1] || '';
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) return listSourceFiles(full);
    return SOURCE_EXTENSIONS.has(extension(full)) && !full.endsWith('.test.ts') && !full.endsWith('.test.tsx') ? [full] : [];
  });
}

const frontendFiles = [
  ...FRONTEND_ROOT_FILES.map((file) => join(ROOT, file)),
  ...FRONTEND_DIRS.flatMap((dir) => listSourceFiles(join(ROOT, dir))),
];

describe('AI secret isolation', () => {
  it('does not read server process.env from browser code', () => {
    const offenders = frontendFiles
      .filter((file) => readFileSync(file, 'utf8').includes('process.env.'))
      .map((file) => relative(ROOT, file));

    expect(offenders, `process.env encontrado en frontend: ${offenders.join(', ')}`).toEqual([]);
  });

  it('does not expose private AI credentials through VITE_* variables', () => {
    const secretPattern = new RegExp(
      `import\\.meta\\.env\\.VITE_(?:${secretEnvNames.join('|')})`,
      'i',
    );
    const offenders = frontendFiles
      .filter((file) => secretPattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));

    expect(offenders, `Credencial privada expuesta mediante VITE_*: ${offenders.join(', ')}`).toEqual([]);
  });
});
