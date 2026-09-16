// Bundles src/devcheck.ts for Node and runs it, shimming the browser bits the
// data layer expects (fetch over local files, import.meta.env.BASE_URL).
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();

const result = await build({
  entryPoints: ['src/devcheck.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  define: { 'import.meta.env.BASE_URL': '"/"' },
  external: [],
});

globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^\//, '');
  const file = path.join(root, 'public', rel);
  const buf = await readFile(file);
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
  };
};

const code = result.outputFiles[0].text;
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const mod = await import(dataUrl);
await mod.run();
void pathToFileURL;
