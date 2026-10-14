// 🎨 Genera el sprite SVG local del sitio (public/img/iconos.svg) a partir de los
// iconos de FontAwesome que realmente usan las páginas.
//
// Por qué: el sitio cargaba FontAwesome desde una CDN (all.min.css 89 KB +
// fa-solid-900.woff2 127 KB + fa-brands-400.woff2 105 KB ≈ 321 KB) solo para
// mostrar 31 iconos. Con este sprite son ~30 KB servidos desde nuestro hosting,
// sin peticiones a terceros.
//
// Los SVG se leen del paquete @fortawesome/fontawesome-free ya instalado (sin
// red). Si no se encuentra, se bajan del tag de jsDelivr con reintentos.
//
// Uso:  node tools/generar-iconos.cjs
// Salida: public/img/iconos.svg
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PUBLIC = path.join(RAIZ, 'public');
const SALIDA = path.join(PUBLIC, 'img', 'iconos.svg');
const CDN = 'https://cdn.jsdelivr.net/gh/FortAwesome/Font-Awesome@6.7.2/svgs';

// Nombres de FontAwesome 5 → nombres actuales (el HTML usa los antiguos y la CDN
// los servía como alias; los archivos .svg se llaman ya con el nombre nuevo).
const ALIAS = {
    'map-marker-alt': 'location-dot',
    'shield-alt': 'shield-halved',
    'exclamation-triangle': 'triangle-exclamation',
    'times-circle': 'circle-xmark',
    'info-circle': 'circle-info',
    'home': 'house',
    'search': 'magnifying-glass',
};

const ESTILO_CLASE = { fas: 'solid', fab: 'brands', far: 'regular' };

function paqueteFontAwesome() {
    try {
        const pkg = require.resolve('@fortawesome/fontawesome-free/package.json', {
            paths: [RAIZ, path.join(RAIZ, '..')],
        });
        return path.join(path.dirname(pkg), 'svgs');
    } catch {
        return null;
    }
}

function archivosFuente() {
    const archivos = fs
        .readdirSync(PUBLIC)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(PUBLIC, f));
    const js = path.join(PUBLIC, 'js');
    for (const f of fs.readdirSync(js)) {
        if (f.endsWith('.js')) archivos.push(path.join(js, f));
    }
    return archivos;
}

/**
 * Recolecta los pares (estilo, nombre) que usa el sitio. Detecta las dos formas:
 *   - la actual:  <use href="img/iconos.svg#solid-check">
 *   - la heredada: <i class="fas fa-check">  (por si vuelve a aparecer)
 * Sin la primera, el generador ve 0 iconos y sobrescribe el sprite con un
 * archivo vacío (pasó una vez: el sitio se quedaba sin ningún icono).
 */
function recolectarIconos() {
    const encontrados = new Map();
    const anotar = (estilo, clase) => {
        const nombre = ALIAS[clase] || clase;
        encontrados.set(`${estilo}/${nombre}`, { estilo, nombre, clase });
    };

    for (const archivo of archivosFuente()) {
        const texto = fs.readFileSync(archivo, 'utf8');
        // Forma actual: referencia directa al símbolo del sprite.
        for (const m of texto.matchAll(/iconos\.svg#(solid|brands|regular)-([a-z0-9-]+)/g)) {
            anotar(m[1], m[2]);
        }
        // Forma heredada: clases de FontAwesome.
        for (const m of texto.matchAll(/\b(fas|fab|far)\s+fa-([a-z0-9-]+)/g)) {
            anotar(ESTILO_CLASE[m[1]], m[2]);
        }
    }
    return [...encontrados.values()].sort((a, b) =>
        `${a.estilo}/${a.nombre}`.localeCompare(`${b.estilo}/${b.nombre}`)
    );
}

async function bajarSvg(estilo, nombre, intentos = 5) {
    const url = `${CDN}/${estilo}/${nombre}.svg`;
    let ultimo = 'sin respuesta';
    for (let i = 1; i <= intentos; i++) {
        try {
            const res = await fetch(url);
            if (res.status === 404) throw new Error(`no existe ${estilo}/${nombre} (revisa ALIAS)`);
            if (res.ok) return res.text();
            ultimo = `HTTP ${res.status}`;
        } catch (e) {
            if (/no existe/.test(e.message)) throw e;
            ultimo = e.message;
        }
        await new Promise((r) => setTimeout(r, 900 * i));
    }
    throw new Error(`No se pudo obtener ${estilo}/${nombre}: ${ultimo}`);
}

async function leerSvg(estilo, nombre, raizPaquete) {
    if (raizPaquete) {
        const local = path.join(raizPaquete, estilo, `${nombre}.svg`);
        if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
    }
    return bajarSvg(estilo, nombre);
}

function extraer(svg, estilo, nombre) {
    const apertura = svg.match(/<svg[^>]*>/);
    const viewBox = apertura && apertura[0].match(/viewBox="([^"]+)"/);
    const cuerpo = svg
        .replace(/<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!viewBox || !cuerpo) throw new Error(`SVG con formato inesperado: ${estilo}/${nombre}`);
    return { viewBox: viewBox[1], cuerpo };
}

(async () => {
    const raizPaquete = paqueteFontAwesome();
    const iconos = recolectarIconos();
    console.log(`🎯 ${iconos.length} iconos usados por el sitio`);
    console.log(`   fuente: ${raizPaquete ? `paquete local (${path.relative(RAIZ, raizPaquete)})` : `CDN ${CDN}`}`);

    // 🛑 Nunca clobber: si la detección falla (p. ej. cambió la forma de
    // referenciar los iconos), abortar SIN escribir deja el sprite bueno intacto.
    if (iconos.length === 0) {
        console.error('\n❌ No se detectó ningún icono. El sprite NO se ha tocado.');
        console.error('   Revisa las regex de recolectarIconos(): el sitio dejó de usar la forma esperada.');
        process.exit(1);
    }

    const simbolos = [];
    for (const { estilo, nombre, clase } of iconos) {
        const { viewBox, cuerpo } = extraer(await leerSvg(estilo, nombre, raizPaquete), estilo, nombre);
        // El id conserva el estilo porque hay nombres repetidos (fa-star existe
        // en solid y en regular).
        simbolos.push(`  <symbol id="${estilo}-${nombre}" viewBox="${viewBox}">\n    ${cuerpo}\n  </symbol>`);
        console.log(`   ✔ ${estilo}/${nombre} (fa-${clase})`);
    }

    const cabecera = [
        '<!--',
        '  Sprite de iconos del sitio — generado por tools/generar-iconos.cjs',
        `  Iconos: FontAwesome 6.7.2 (MIT). ${simbolos.length} símbolos.`,
        '',
        '  Motivo: el sitio cargaba FontAwesome desde una CDN (all.min.css + 2 woff2 ≈ 321 KB)',
        '  solo para mostrar estos iconos. Aquí van embebidos una vez y se sirven desde',
        '  nuestro propio hosting (cero peticiones a terceros).',
        '',
        '  Uso:  <svg class="ico fa-check" aria-hidden="true"><use href="img/iconos.svg#solid-check"></use></svg>',
        '  La clase `fa-<nombre>` se conserva porque el CSS del sitio la usa para dar color.',
        '-->',
    ].join('\n');

    const svg = `${cabecera}\n<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n  <defs>\n${simbolos.join('\n')}\n  </defs>\n</svg>\n`;

    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, svg, 'utf8');
    console.log(`\n✅ ${path.relative(RAIZ, SALIDA)} — ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB, ${simbolos.length} iconos`);
})();
