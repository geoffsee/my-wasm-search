import { transformFile } from '@swc/core';
import { mkdir, rm, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = scriptDir;
const outDir = path.resolve(serverDir, '..', 'dist', 'server');

const swcOptions = {
  sourceMaps: true,
  jsc: {
    target: 'es2022',
    parser: {
      syntax: 'typescript',
      decorators: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
    },
  },
  module: {
    type: 'es6',
  },
};

const shouldCompile = (name) =>
  name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts');

async function collectFiles(dir, acc) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile() && shouldCompile(entry.name)) {
      acc.push(fullPath);
    }
  }
}

async function build() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files = [];
  await collectFiles(serverDir, files);

  await Promise.all(
    files.map(async (file) => {
      const rel = path.relative(serverDir, file);
      const outFile = path.join(outDir, rel.replace(/\.ts$/, '.js'));
      const outDirForFile = path.dirname(outFile);
      await mkdir(outDirForFile, { recursive: true });

      const result = await transformFile(file, swcOptions);
      await writeFile(outFile, result.code, 'utf8');
      if (result.map) {
        await writeFile(`${outFile}.map`, result.map, 'utf8');
      }
    }),
  );
}

build().catch((err) => {
  console.error('SWC build failed:', err);
  process.exitCode = 1;
});
