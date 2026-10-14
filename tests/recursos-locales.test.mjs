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

// ════════════════════════════════════════════════════════════════════════════
// Lo de abajo cubre los fallos que SI se escaparon al migrar de FontAwesome a
// iconos propios y de Google Fonts a fuentes propias. Los tests de arriba solo
// miraban bytes y enlaces, asi que no vieron ninguno de estos.
// ════════════════════════════════════════════════════════════════════════════

/** CSS de los archivos de estilo MÁS el de los bloques <style> de los HTML. */
const todoElCss = () => {
    const deHtml = paginas
        .map((f) => [...leer(f).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n'))
        .join('\n');
    const deArchivos = hojas.map((f) => leer(`styles/${f}`)).join('\n');
    return deArchivos + '\n' + deHtml;
};

/** Primer nombre de familia de una declaración de font-family ('Karla', sans-serif → Karla). */
const primeraFamilia = (valor) => {
    const m = String(valor).trim().match(/^['"]?([^'",]+)['"]?/);
    return m ? m[1].trim() : null;
};

// Un selector usa <i> como elemento si aparece una `i` suelta: ni pegada a otra
// letra (.infinite-carousel, .club-check input) ni como parte de una clase.
const SELECTOR_DE_ICONO = /(^|[\s>+~,])i(?=[\s>+~,.:#[]|$)/;

test('ninguna regla CSS apunta al viejo <i> ni carga la fuente de FontAwesome', () => {
    const css = todoElCss();

    // 1) La fuente de iconos ya no se sirve: declararla da glifos rotos.
    for (const m of css.matchAll(/font-family\s*:\s*["']([^"']+)["']/gi)) {
        assert.ok(
            !/font ?awesome/i.test(m[1]),
            `el CSS todavía usa la fuente "${m[1]}" para dibujar iconos`,
        );
    }

    // 2) Los iconos son <svg class="ico">, no <i>: un selector `i` ya no aplica
    //    a nada y deja el icono sin color ni separación.
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const huerfanos = [];
    for (const m of sinComentarios.matchAll(/([^{}]+)\{/g)) {
        for (const sel of m[1].split(',')) {
            const s = sel.trim();
            if (s && SELECTOR_DE_ICONO.test(s)) huerfanos.push(s);
        }
    }
    assert.deepEqual(huerfanos, [], `selectores que ya no aplican a ningún elemento: ${huerfanos.join(' | ')}`);
});

test('cada familia tipográfica del sitio tiene su @font-face local', () => {
    const css = todoElCss();

    // Fuentes declaradas en fuentes.css.
    const declaradas = new Set(
        [...leer('styles/fuentes.css').matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    );
    assert.ok(declaradas.size >= 4, `fuentes.css solo declara ${declaradas.size} familias`);

    // Variables del tipo --font-body: 'Montserrat', sans-serif;
    const porVariable = new Map();
    for (const m of css.matchAll(/--[a-z-]*font[a-z-]*\s*:\s*([^;}]+)/gi)) {
        porVariable.set(m[0].split(':')[0].trim(), primeraFamilia(m[1]));
    }

    const genericas = new Set([
        'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'sans-serif', 'serif',
        'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-monospace', 'ui-sans-serif',
        'ui-serif', 'ui-rounded', 'math', 'emoji', 'fangsong',
    ]);

    const usadas = new Set();
    for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
        const valor = m[1].trim();
        const variable = valor.match(/^var\(\s*(--[a-z-]+)\s*\)$/i);
        const familia = variable ? porVariable.get(variable[1]) : primeraFamilia(valor);
        if (!familia) continue;
        if (genericas.has(familia.toLowerCase())) continue;
        usadas.add(familia);
    }

    assert.ok(usadas.size >= 4, `se esperaban al menos 4 familias en uso, hay ${usadas.size}`);
    for (const familia of usadas) {
        assert.ok(
            declaradas.has(familia),
            `el CSS usa '${familia}' pero fuentes.css no la declara: el texto cae al fallback del sistema y la página se ve distinta`,
        );
    }
});

test('ningún peso se sirve con el archivo de otro peso', () => {
    const css = leer('styles/fuentes.css');
    const bloques = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => ({
        familia: (m[1].match(/font-family\s*:\s*['"]([^'"]+)['"]/) || [])[1],
        peso: (m[1].match(/font-weight\s*:\s*([^;]+);/) || [])[1]?.trim(),
        url: (m[1].match(/url\(['"]?([^'")]+)/) || [])[1],
    }));
    assert.ok(bloques.length >= 4 && bloques.every((b) => b.familia && b.peso && b.url), 'fuentes.css tiene bloques incompletos');

    const porFamilia = {};
    for (const b of bloques) (porFamilia[b.familia] = porFamilia[b.familia] || []).push(b);

    for (const [familia, lista] of Object.entries(porFamilia)) {
        const archivoPorPeso = new Map();
        for (const b of lista) {
            const pesoPrevio = archivoPorPeso.get(b.url);
            assert.ok(
                pesoPrevio === undefined || pesoPrevio === b.peso,
                `'${familia}' sirve el peso ${b.peso} y el ${pesoPrevio} con el mismo archivo (${b.url}): el navegador no sintetiza la negrita y el texto sale fino`,
            );
            archivoPorPeso.set(b.url, b.peso);
        }
    }

    // Y todo archivo declarado debe existir de verdad.
    for (const b of bloques) {
        assert.ok(existsSync(path.join(PUBLIC, 'fonts', path.basename(b.url))), `falta ${b.url}`);
    }
});

test('los iconos declaran su ancho en em y no dejan que el navegador lo invente', () => {
    // Por qué: el <svg> que lleva el <use href="iconos.svg#…"> no tiene viewBox
    // propio (el viewBox vive en el <symbol>), así que no tiene proporción
    // intrínseca. Con `width: auto` el navegador usa el ancho por defecto de un
    // elemento reemplazado, 300px, y entonces CADA icono empuja el texto de al
    // lado: el cartel de "pesca del día" se estira, los botones dejan de quedar
    // centrados y la página entera parece desfasada. Pasó en producción.
    const css = sinComentarios(leer('styles/iconos.css'));
    const bloque = css.match(/\.ico\s*\{([^}]*)\}/);
    assert.ok(bloque, 'iconos.css ya no define .ico');

    assert.ok(!/width\s*:\s*auto/.test(bloque[1]), '`width: auto` en .ico devuelve los iconos a 300px de ancho');
    assert.match(bloque[1], /width\s*:\s*1em/, '.ico debe fijar width: 1em (el ancho por defecto de un <svg> es 300px)');
    assert.match(bloque[1], /height\s*:\s*1em/, '.ico debe fijar height: 1em para escalar con el font-size del texto');
});

test('los títulos de sección se centran solos, sin depender de que el padre lo haga', () => {
    // Por qué: con `display: inline-block` la caja se encoge al ancho del texto
    // y solo se centra si el PADRE tiene text-align:center. Los títulos que
    // llevan la clase text-center en sí mismos quedaban pegados a la izquierda
    // (Nuestros Platos Favoritos, Especiales de Domingo, Opiniones de Clientes).
    for (const hoja of hojas) {
        const css = sinComentarios(leer(`styles/${hoja}`));
        for (const m of css.matchAll(/([^{}]*\.section-title)\s*\{([^}]*)\}/g)) {
            if (m[1].includes('::after')) continue;
            // Las reglas que solo retocan el color (p. ej. el título dorado sobre
            // fondo mar) no repiten el modelo de caja: no son su responsabilidad.
            if (!/display\s*:/.test(m[2])) continue;
            assert.match(m[2], /width\s*:\s*fit-content/, `${hoja}: ${m[1].trim()} debe usar width: fit-content para conservar el ancho del texto`);
            assert.match(m[2], /margin-left\s*:\s*auto/, `${hoja}: ${m[1].trim()} debe centrarse con margin-left: auto`);
            assert.match(m[2], /margin-right\s*:\s*auto/, `${hoja}: ${m[1].trim()} debe centrarse con margin-right: auto`);
            assert.ok(!/display\s*:\s*inline-block/.test(m[2]), `${hoja}: ${m[1].trim()} con inline-block solo se centra si el padre lo hace`);
        }
    }
});
