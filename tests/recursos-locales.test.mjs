// 🔌 Tests de independencia de terceros.
//
// Motivo: el sitio cargaba Bootstrap, FontAwesome y las fuentes desde tres CDNs
// (jsDelivr, cdnjs y Google Fonts). Ahora todo se sirve desde el propio hosting:
// menos bytes, menos conexiones y ninguna IP de visitante filtrada a terceros.
//
// Uso:  cd calletano-web && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(raiz, 'public');
const leer = (rel) => readFileSync(path.join(PUBLIC, rel), 'utf8');

const paginas = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
const scripts = readdirSync(path.join(PUBLIC, 'js')).filter((f) => f.endsWith('.js'));
const hojas = readdirSync(path.join(PUBLIC, 'styles')).filter((f) => f.endsWith('.css'));

// Dominios que sí pueden aparecer: los servicios que el sitio realmente usa
// (Firebase, Analytics, el mapa de Google, WhatsApp, redes y la ficha de Google).
const PERMITIDOS = [
    'calletano-restaurant.web.app',
    'googleapis.com',
    'firebaseio.com',
    'firebaseapp.com',
    'google-analytics.com',
    'googletagmanager.com',
    'gstatic.com',
    'google.com',
    'maps.app.goo.gl',
    'g.page',
    'wa.me',
    'facebook.com',
    'instagram.com',
    'schema.org',
    'w3.org',
    'sitemaps.org',
    'github.com',
];

const PROHIBIDOS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

const archivosDelSitio = () => [
    ...paginas.map((f) => ({ nombre: f, ruta: path.join(PUBLIC, f) })),
    ...scripts.map((f) => ({ nombre: `js/${f}`, ruta: path.join(PUBLIC, 'js', f) })),
    ...hojas.map((f) => ({ nombre: `styles/${f}`, ruta: path.join(PUBLIC, 'styles', f) })),
];

// Los comentarios no generan peticiones: un comentario que documenta de dónde
// se quitó un recurso no debe contar como una referencia viva a esa CDN.
const sinComentarios = (contenido) =>
    contenido.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('ninguna página, script o CSS pide recursos a las CDNs que se retiraron', () => {
    for (const { nombre, ruta } of archivosDelSitio()) {
        const contenido = sinComentarios(readFileSync(ruta, 'utf8'));
        for (const dominio of PROHIBIDOS) {
            assert.ok(
                !contenido.includes(dominio),
                `${nombre} todavía referencia ${dominio}`
            );
        }
    }
});

test('las URLs externas del sitio son solo de servicios que se usan de verdad', () => {
    for (const { nombre, ruta } of archivosDelSitio()) {
        const contenido = readFileSync(ruta, 'utf8');
        for (const m of contenido.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
            const dominio = m[1].toLowerCase();
            const permitido = PERMITIDOS.some((p) => dominio === p || dominio.endsWith(`.${p}`));
            assert.ok(permitido, `${nombre} referencia un dominio nuevo: ${dominio}`);
        }
    }
});

test('la CSP ya no autoriza las CDNs retiradas y sí lo local', () => {
    const csp = JSON.parse(readFileSync(path.join(raiz, 'firebase.json'), 'utf8'))
        .hosting.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

    for (const dominio of PROHIBIDOS) {
        assert.ok(!csp.includes(dominio), `la CSP todavía autoriza ${dominio}`);
    }
    assert.match(csp, /style-src 'self' 'unsafe-inline'/, 'la CSP debería permitir solo estilos propios');
    assert.match(csp, /font-src 'self' data:/, 'las fuentes ya son propias: font-src debe ser self');
});

test('todos los recursos locales referenciados existen en public/', () => {
    const prefijos = ['vendor/', 'styles/', 'js/', 'img/', 'fonts/'];
    for (const { nombre, ruta } of archivosDelSitio()) {
        const contenido = readFileSync(ruta, 'utf8');
        const referencias = [
            ...[...contenido.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
            ...[...contenido.matchAll(/url\(['"]?(\.\.\/)?([^'")]+)['"]?\)/g)].map((m) => m[1] + (m[2] || '')),
        ];
        for (const ref of referencias) {
            const limpio = ref.split(/[?#]/)[0];
            if (!limpio || /^(https?:|mailto:|tel:|data:|#|\/\/)/.test(limpio)) continue;
            if (!prefijos.some((p) => limpio.startsWith(p) || limpio.includes(`/${p}`))) continue;
            const candidato = limpio.includes('/') && limpio.startsWith('.')
                ? path.join(PUBLIC, 'styles', limpio)
                : path.join(PUBLIC, limpio.replace(/^\.\.\//, ''));
            assert.ok(
                existsSync(candidato) || existsSync(path.join(PUBLIC, path.basename(limpio))),
                `${nombre} referencia ${ref} y no existe en public/`
            );
        }
    }
});

test('el sprite tiene los iconos que usa el código y ya no queda ningún <i class="fa-…">', () => {
    const sprite = leer('img/iconos.svg');
    const ids = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(ids.size >= 25, `el sprite solo tiene ${ids.size} símbolos`);

    let referencias = 0;
    for (const { nombre, ruta } of archivosDelSitio()) {
        const contenido = readFileSync(ruta, 'utf8');
        for (const m of contenido.matchAll(/iconos\.svg#([a-z0-9-]+)/g)) {
            referencias++;
            assert.ok(ids.has(m[1]), `${nombre} usa el símbolo ${m[1]}, que no está en el sprite`);
        }
        assert.ok(
            !/<i class="(?:fas|fab|far)\b/.test(contenido),
            `${nombre} todavía usa la fuente de iconos de FontAwesome`
        );
    }
    assert.ok(referencias >= 30, `se esperaban referencias al sprite, hay ${referencias}`);
});

test('Bootstrap, las fuentes y el sprite se sirven desde el propio hosting', () => {
    for (const archivo of [
        'vendor/bootstrap/bootstrap.min.css',
        'vendor/bootstrap/bootstrap.bundle.min.js',
        'styles/fuentes.css',
        'styles/iconos.css',
        'img/iconos.svg',
    ]) {
        assert.ok(existsSync(path.join(PUBLIC, archivo)), `falta ${archivo}`);
    }

    const bootstrap = statSync(path.join(PUBLIC, 'vendor/bootstrap/bootstrap.min.css')).size;
    assert.ok(bootstrap > 100_000, 'el CSS de Bootstrap local parece incompleto');

    const fuentes = readdirSync(path.join(PUBLIC, 'fonts')).filter((f) => f.endsWith('.woff2'));
    assert.ok(fuentes.length >= 4, `se esperaban las fuentes locales, hay ${fuentes.length}`);
    for (const fuente of fuentes) {
        assert.ok(statSync(path.join(PUBLIC, 'fonts', fuente)).size > 5_000, `${fuente} parece vacía`);
    }

    // Cada archivo de fuente declarado en el CSS debe existir.
    const cssFuentes = leer('styles/fuentes.css');
    const declaradas = [...cssFuentes.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(declaradas.length >= 4, 'fuentes.css no declara las caras esperadas');
    for (const archivo of declaradas) {
        assert.ok(existsSync(path.join(PUBLIC, 'fonts', archivo)), `fuentes.css apunta a ${archivo}, que no existe`);
    }
});

test('cada página enlaza Bootstrap, las fuentes y los iconos locales', () => {
    for (const pagina of paginas) {
        const html = leer(pagina);
        if (!/<html/i.test(html)) continue; // saltar archivos de verificación sueltos
        assert.ok(html.includes('vendor/bootstrap/bootstrap.min.css'), `${pagina} sin Bootstrap local`);
        assert.ok(html.includes('styles/fuentes.css'), `${pagina} sin las fuentes locales`);
        assert.ok(html.includes('styles/iconos.css'), `${pagina} sin los iconos locales`);
    }
});
