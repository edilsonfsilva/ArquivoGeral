/**
 * Script para converter TypeScript para JavaScript
 * Usa esbuild para strip de tipos, preservando JSX
 */
import { transform } from 'esbuild';
import { readFile, writeFile, unlink, readdir, stat } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function* walkDir(dir, ignore = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (ignore.some(ig => entry.name === ig || fullPath.includes(ig))) continue;
    if (entry.isDirectory()) {
      yield* walkDir(fullPath, ignore);
    } else {
      yield fullPath;
    }
  }
}

const ignore = ['node_modules', 'dist', '\\.git\\', 'convert-to-js.mjs'];

const tsFiles = [];
for await (const file of walkDir(__dirname, ignore)) {
  const ext = extname(file);
  if (ext === '.ts' || ext === '.tsx') {
    // Skip the tsconfig and drizzle.config - we'll handle those manually
    if (file.includes('tsconfig') || file.includes('components.json')) continue;
    tsFiles.push(file);
  }
}

console.log(`\nEncontrados ${tsFiles.length} arquivos TypeScript para converter:\n`);
tsFiles.forEach(f => console.log(' -', f.replace(__dirname, '.')));

console.log('\nConvertendo...\n');

let converted = 0;
let failed = 0;

for (const file of tsFiles) {
  const ext = extname(file);
  const isJSX = ext === '.tsx';
  const outExt = isJSX ? '.jsx' : '.js';
  const outFile = file.slice(0, -ext.length) + outExt;

  try {
    const content = await readFile(file, 'utf-8');

    const result = await transform(content, {
      loader: isJSX ? 'tsx' : 'ts',
      format: 'esm',
      jsx: 'preserve', // Manter JSX como está (não compilar para React.createElement)
      target: 'esnext',
      minifySyntax: false,
      minifyWhitespace: false,
      minifyIdentifiers: false,
    });

    await writeFile(outFile, result.code);

    // Remover arquivo TypeScript original
    if (outFile !== file) {
      await unlink(file);
    }

    console.log(`✓ ${file.replace(__dirname, '.')} -> ${outExt}`);
    converted++;
  } catch (err) {
    console.error(`✗ ERRO em ${file.replace(__dirname, '.')}:`, err.message);
    failed++;
  }
}

console.log(`\n✅ Conversão concluída: ${converted} convertidos, ${failed} falhas`);
