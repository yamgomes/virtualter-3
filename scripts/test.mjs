import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';

const output = await mkdtemp(join(tmpdir(), 'virtualter-tests-'));
try {
  const tests = (await readdir('tests')).filter((file) =>
    file.endsWith('.test.ts')
  );
  await build({
    entryPoints: tests.map((file) => join('tests', file)),
    outdir: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    loader: { '.css': 'empty' },
    logLevel: 'warning',
  });
  const result = spawnSync(
    process.execPath,
    [
      '--test',
      ...tests.map((file) => join(output, file.replace(/\.ts$/, '.js'))),
    ],
    { stdio: 'inherit' }
  );
  process.exitCode = result.status ?? 1;
} finally {
  const target = resolve(output),
    child = relative(resolve(tmpdir()), target);
  if (
    !child ||
    child.startsWith('..') ||
    isAbsolute(child) ||
    !child.startsWith('virtualter-tests-')
  )
    throw new Error('Diretório temporário inesperado');
  await rm(target, { recursive: true, force: true });
}
