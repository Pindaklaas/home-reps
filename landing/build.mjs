// Copia src/ a dist/ e inyecta los IDs de los píxeles desde variables de entorno.
// Sin dependencias: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

const env = { ...process.env };
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const values = {
  __META_PIXEL_ID__: (env.META_PIXEL_ID || '').trim(),
  __TIKTOK_PIXEL_ID__: (env.TIKTOK_PIXEL_ID || '').trim(),
  __SITE_URL__: (env.SITE_URL || env.URL || '').trim().replace(/\/$/, ''),
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const name of readdirSync(src)) {
  const from = join(src, name);
  const to = join(dist, name);
  if (['.html', '.js'].includes(extname(name))) {
    let text = readFileSync(from, 'utf8');
    // Sin dirección pública no se pueden escribir URLs absolutas: se quitan esas etiquetas.
    if (!values.__SITE_URL__) text = text.split('\n').filter((l) => !l.includes('__SITE_URL__')).join('\n');
    for (const [token, value] of Object.entries(values)) text = text.split(token).join(value);
    writeFileSync(to, text);
  } else {
    copyFileSync(from, to);
  }
}
console.log('Listo: dist/');
console.log('  Meta Pixel:   ' + (values.__META_PIXEL_ID__ ? 'configurado' : 'sin ID (no se carga)'));
console.log('  TikTok Pixel: ' + (values.__TIKTOK_PIXEL_ID__ ? 'configurado' : 'sin ID (no se carga)'));
