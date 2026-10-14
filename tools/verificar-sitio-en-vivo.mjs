// Verificación post-deploy: recorre las páginas publicadas, extrae cada recurso
// local que referencian (CSS, JS, fuentes, imágenes, iconos) y comprueba que el
// hosting lo sirva con 200. Un 404 aquí es una página que se ve desfasada.
const BASE = process.argv[2] || 'https://calletano-restaurant.web.app';

const PAGINAS = ['/', '/carta.html', '/club-crear.html', '/club-consultar.html', '/club-baja.html', '/privacidad.html', '/404.html'];

// Rutas que se resuelven en CSS (@font-face, url(...)) o en JS, además del HTML.
const CSS_EXTRA = ['/styles/fuentes.css', '/styles/style-landing.css', '/styles/style-mundo.css', '/styles/style.css'];

const resueltos = new Set();
const enlaces = new Map(); // url -> páginas que lo piden

const normalizar = (crudo, desde) => {
  let u = crudo.trim().replace(/^['"]|['"]$/g, '').split(/[?#]/)[0];
  if (!u || u.startsWith('data:') || /^(https?:)?\/\//.test(u)) return null;
  const base = new URL(desde, BASE);
  return new URL(u, base).pathname;
};

async function traer(ruta) {
  const r = await fetch(new URL(ruta, BASE), { redirect: 'follow' });
  return { status: r.status, texto: r.ok ? await r.text() : '' };
}

for (const pagina of PAGINAS) {
  const { status, texto } = await traer(pagina);
  if (status !== 200) {
    console.log(`PAGINA ${pagina} -> ${status}`);
    continue;
  }
  const refs = [
    ...texto.matchAll(/(?:src|href)="([^"]+)"/g),
    ...texto.matchAll(/use href="([^"]+)"/g),
    ...texto.matchAll(/srcset="([^"]+)"/g),
  ].flatMap((m) => (m[1].includes(',') ? m[1].split(',').map((s) => s.trim().split(/\s+/)[0]) : [m[1]]));

  for (const ref of refs) {
    const ruta = normalizar(ref, pagina);
    if (!ruta) continue;
    if (!enlaces.has(ruta)) enlaces.set(ruta, new Set());
    enlaces.get(ruta).add(pagina);
  }
}

for (const hoja of CSS_EXTRA) {
  const { status, texto } = await traer(hoja);
  if (status !== 200) {
    console.log(`CSS ${hoja} -> ${status}`);
    continue;
  }
  for (const m of texto.matchAll(/url\(([^)]+)\)/g)) {
    const ruta = normalizar(m[1], hoja);
    if (!ruta) continue;
    if (!enlaces.has(ruta)) enlaces.set(ruta, new Set());
    enlaces.get(ruta).add(hoja);
  }
}

const fallos = [];
for (const [ruta, paginas] of enlaces) {
  if (resueltos.has(ruta)) continue;
  resueltos.add(ruta);
  const r = await fetch(new URL(ruta, BASE), { method: 'HEAD', redirect: 'follow' });
  if (r.status !== 200) fallos.push(`${r.status}  ${ruta}   ← ${[...paginas].join(', ')}`);
}

console.log(`\nrecursos comprobados: ${resueltos.size}`);
if (fallos.length === 0) console.log('✅ 0 recursos rotos');
else {
  console.log(`❌ ${fallos.length} recursos rotos:`);
  for (const f of fallos) console.log('   ' + f);
  process.exitCode = 1;
}
