// 🤖 Tests de "agent readiness" del sitio público (Firebase Hosting).
//
// Cubren los comportamientos que se cambiaron en la auditoría de is-agentic.com:
//   1. 404 real (sin rewrite comodín que convierta rutas inexistentes en la portada)
//   2. Contenido y jerarquía de encabezados de la portada sin JavaScript
//   4. llms.txt con sección "when to use this"
//   5/7. JSON-LD de identidad (Organization con contactPoint + address)
//   6. Páginas de confianza (/about, /contact, /privacy) con contenido real
//
// Uso:  cd calletano-web && npm test      (o: node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const publicFile = (rel) => path.join(publicDir, rel);
const readPublic = (rel) => readFileSync(publicFile(rel), 'utf8');

const firebaseConfig = JSON.parse(readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const hosting = firebaseConfig.hosting || {};
const rewrites = hosting.rewrites || [];

/** Quita comentarios, <script> y <style> para mirar sólo el HTML de contenido. */
const sinScripts = (html) => String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

/** Texto visible (sin etiquetas) — lo que ve un agente que no ejecuta JavaScript. */
const textoVisible = (html) => sinScripts(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const nivelesDeEncabezados = (html) =>
    [...sinScripts(html).matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));

const bloquesJsonLd = (html) =>
    [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
        .map((m) => JSON.parse(m[1]));

const tipos = (nodo) => [].concat(nodo['@type'] || []);

const ETIQUETAS_VACIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// El HTML permite omitir el cierre de estas etiquetas; el XML no.
const CIERRE_OPCIONAL = new Set(['li', 'p', 'td', 'th', 'tr', 'tbody', 'thead', 'option']);

/**
 * Comprueba el balance de etiquetas de un documento (HTML o XML) sin dependencias.
 * Devuelve la lista de problemas; vacía cuando el documento está bien formado.
 */
const etiquetasDesbalanceadas = (documento, { estricto = false } = {}) => {
    const limpio = String(documento)
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const pila = [];
    const problemas = [];

    for (const m of limpio.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
        const [, cierre, etiqueta, autocierre] = m;
        const nombre = etiqueta.toLowerCase();
        if (ETIQUETAS_VACIAS.has(nombre) || autocierre === '/') continue;

        if (!cierre) {
            pila.push(nombre);
            continue;
        }
        if (pila.length === 0) {
            problemas.push(`</${nombre}> sin apertura`);
            continue;
        }
        if (pila[pila.length - 1] === nombre) {
            pila.pop();
            continue;
        }
        const posicion = pila.lastIndexOf(nombre);
        if (posicion === -1) {
            problemas.push(`</${nombre}> sin apertura`);
            continue;
        }
        const sinCerrar = pila.splice(posicion).slice(1);
        const graves = sinCerrar.filter((t) => estricto || !CIERRE_OPCIONAL.has(t));
        if (graves.length > 0) {
            problemas.push(`</${nombre}> cierra sobre ${graves.map((t) => `<${t}>`).join(' ')}`);
        }
    }

    for (const abierta of pila) problemas.push(`<${abierta}> sin cerrar`);
    return problemas;
};

/** Traduce una URL del dominio del sitio a la ruta del archivo que la sirve. */
const archivoQueSirve = (url) => {
    const ruta = url.replace('https://calletano-restaurant.web.app', '').split(/[#?]/)[0] || '/';
    if (ruta === '/') return 'index.html';
    const rewrite = rewrites.find((r) => r.source === ruta);
    return (rewrite ? rewrite.destination : ruta).replace(/^\//, '');
};

// ─────────────────────────────────────────────────────────────
// 1. Agent-friendly 404s
// ─────────────────────────────────────────────────────────────
test('firebase.json no tiene rewrite comodín a index.html (evita soft-404)', () => {
    const comodines = rewrites.filter((r) => /\/index\.html$/.test(r.destination || ''));
    assert.deepEqual(
        comodines,
        [],
        'un rewrite que manda todo a /index.html hace que cada ruta inexistente responda HTTP 200'
    );
});

test('la página 404 explica el error y apunta a /llms.txt y /sitemap.xml', () => {
    assert.ok(existsSync(publicFile('404.html')), 'falta public/404.html');
    const html = readPublic('404.html');
    const texto = textoVisible(html);

    assert.match(texto, /404/, 'la página de error no menciona el 404');
    assert.ok(
        texto.length >= 200,
        `la explicación del error es demasiado corta (${texto.length} caracteres)`
    );
    assert.match(html, /href="\/llms\.txt"/, 'la página 404 no enlaza /llms.txt');
    assert.match(html, /href="\/sitemap\.xml"/, 'la página 404 no enlaza /sitemap.xml');
});

// ─────────────────────────────────────────────────────────────
// 2. Contenido estático y jerarquía de encabezados
// ─────────────────────────────────────────────────────────────
test('index.html tiene un solo h1 y la jerarquía de encabezados no salta niveles', () => {
    const niveles = nivelesDeEncabezados(readPublic('index.html'));

    assert.ok(niveles.length >= 10, `se esperaban encabezados en la portada, hay ${niveles.length}`);
    assert.equal(niveles.filter((n) => n === 1).length, 1, 'debe haber exactamente un h1');
    assert.equal(niveles[0], 1, 'el primer encabezado de la portada debe ser el h1');

    let previo = 1;
    for (const nivel of niveles.slice(1)) {
        assert.ok(nivel <= previo + 1, `salto de nivel: de h${previo} a h${nivel}`);
        previo = nivel;
    }
});

test('la portada sirve contenido real sin JavaScript (>=500 caracteres de texto)', () => {
    const texto = textoVisible(readPublic('index.html'));
    assert.ok(texto.length >= 500, `la portada sólo tiene ${texto.length} caracteres de texto`);
});

test('los títulos de plato conservan su estilo tras el cambio de h5 a h3', () => {
    for (const hoja of ['style.css', 'style-landing.css']) {
        const css = readPublic(`styles/${hoja}`);
        assert.match(
            css,
            /\.dish-card \.card-body h3,/,
            `${hoja} no incluye h3 en la regla del título de plato (.dish-card .card-body)`
        );
    }
    assert.match(
        readPublic('styles/style-landing.css'),
        /#menu-dia \.bebida-label\s*\{\s*font-family: inherit;/,
        "el rótulo 'Bebida Incluida' (h4) no conserva la tipografía que tenía como h5"
    );
});

// ─────────────────────────────────────────────────────────────
// 5 y 7. JSON-LD: identidad, contacto y dirección
// ─────────────────────────────────────────────────────────────
test('index.html publica un Organization con contactPoint y PostalAddress', () => {
    const bloques = bloquesJsonLd(readPublic('index.html'));
    assert.ok(bloques.length >= 3, `se esperaban 3 bloques JSON-LD, hay ${bloques.length}`);

    const org = bloques.find((b) => tipos(b).includes('Organization'));
    assert.ok(org, 'no hay ningún bloque JSON-LD con @type Organization');

    assert.equal(org.address?.['@type'], 'PostalAddress', 'falta la dirección postal');
    assert.ok(org.address.addressLocality, 'la dirección no indica la ciudad');

    const contactos = [].concat(org.contactPoint || []);
    assert.ok(contactos.length >= 1, 'falta contactPoint');
    const cp = contactos[0];
    assert.equal(cp['@type'], 'ContactPoint');
    assert.ok(cp.contactType, 'el contactPoint no indica contactType');
    assert.ok(cp.telephone, 'el contactPoint no tiene teléfono');
    assert.ok(cp.email, 'el contactPoint no tiene correo');

    assert.ok(org.name && org.description && org.url, 'Organization sin name/description/url');
    assert.ok(Array.isArray(org.sameAs) && org.sameAs.length > 0, 'Organization sin sameAs');
});

test('index.html mantiene el Restaurant con dirección, horario y menú', () => {
    const bloques = bloquesJsonLd(readPublic('index.html'));
    const restaurante = bloques.find((b) => tipos(b).includes('Restaurant'));

    assert.ok(restaurante, 'desapareció el bloque Restaurant');
    assert.equal(restaurante.address?.['@type'], 'PostalAddress');
    assert.ok(restaurante.openingHoursSpecification?.length, 'el Restaurant perdió el horario');
    assert.ok(restaurante.hasMenu?.url, 'el Restaurant perdió el enlace a la carta');
});

test('el horario sin JavaScript es el mismo en la portada, /about, /contact y llms.txt', () => {
    const restaurante = bloquesJsonLd(readPublic('index.html')).find((b) => tipos(b).includes('Restaurant'));
    const horario = restaurante.openingHoursSpecification[0];
    assert.equal(horario.opens, '11:00', 'el JSON-LD de la portada (sin JS) debe decir 11:00');
    assert.equal(horario.closes, '18:00', 'el JSON-LD de la portada (sin JS) debe decir 18:00');

    for (const archivo of ['contact.html', 'about.html']) {
        assert.match(
            textoVisible(readPublic(archivo)),
            /11:00 a 18:00/,
            `${archivo} publica un horario distinto al del JSON-LD`
        );
    }
    assert.match(readPublic('llms.txt'), /Horario: todos los días, 11:00 a 18:00/, 'llms.txt con otro horario');
    assert.doesNotMatch(
        readPublic('contact.html').replace(/11:00 a 18:00/g, 'HORARIO_OK'),
        /\b(12:00|22:00)\b/,
        'contact.html todavía menciona el horario viejo (12:00/22:00) en algún texto o meta'
    );
});

test('las páginas de confianza publican el mismo Organization (mismo @id)', () => {
    const idPortada = bloquesJsonLd(readPublic('index.html'))
        .find((b) => tipos(b).includes('Organization'))?.['@id'];
    assert.ok(idPortada, 'la portada no define @id para el Organization');

    for (const pagina of ['about.html', 'contact.html']) {
        const org = bloquesJsonLd(readPublic(pagina)).find((b) => tipos(b).includes('Organization'));
        assert.ok(org, `${pagina} no publica datos estructurados del negocio`);
        assert.equal(org['@id'], idPortada, `${pagina} usa un @id distinto para el negocio`);
    }
});

// ─────────────────────────────────────────────────────────────
// 4. llms.txt con guía de uso
// ─────────────────────────────────────────────────────────────
test('llms.txt cumple el formato y tiene una sección "when to use this"', () => {
    const md = readPublic('llms.txt');

    assert.match(md, /^# .+\S/m, 'llms.txt no empieza con un título H1');
    assert.match(md, /^> .+\S/m, 'llms.txt no tiene el resumen en blockquote');
    assert.match(md, /^## .*when to use this/im, 'llms.txt no tiene la sección "When to use this"');
    assert.match(md, /^## /m, 'llms.txt no tiene secciones');
    assert.ok(md.length >= 1000, `llms.txt es demasiado corto (${md.length} caracteres)`);
});

test('todos los enlaces internos de llms.txt existen o tienen rewrite', () => {
    const md = readPublic('llms.txt');
    const enlaces = [...md.matchAll(/\((https:\/\/calletano-restaurant\.web\.app[^)\s]*)\)/g)]
        .map((m) => m[1]);

    assert.ok(enlaces.length >= 5, `se esperaban enlaces a páginas del sitio, hay ${enlaces.length}`);

    for (const url of enlaces) {
        const ruta = url.replace('https://calletano-restaurant.web.app', '').split(/[#?]/)[0];
        if (!ruta || ruta === '/') {
            assert.ok(existsSync(publicFile('index.html')), 'falta la portada');
            continue;
        }
        const rewrite = rewrites.find((r) => r.source === ruta);
        const destino = (rewrite ? rewrite.destination : ruta).replace(/^\//, '');
        assert.ok(existsSync(publicFile(destino)), `llms.txt enlaza ${url} pero no existe public/${destino}`);
    }
});

// ─────────────────────────────────────────────────────────────
// 6. Páginas de confianza
// ─────────────────────────────────────────────────────────────
test('las páginas de confianza tienen contenido real (>=500 caracteres)', () => {
    for (const pagina of ['about.html', 'contact.html', 'privacidad.html']) {
        assert.ok(existsSync(publicFile(pagina)), `no existe public/${pagina}`);
        const texto = textoVisible(readPublic(pagina));
        assert.ok(texto.length >= 500, `${pagina} sólo tiene ${texto.length} caracteres de contenido`);
    }
});

test('los rewrites /about, /contact y /privacy sirven páginas existentes', () => {
    const esperados = {
        '/about': '/about.html',
        '/contact': '/contact.html',
        '/privacy': '/privacidad.html',
    };

    for (const [source, destination] of Object.entries(esperados)) {
        const rewrite = rewrites.find((r) => r.source === source);
        assert.ok(rewrite, `falta el rewrite ${source} (el auditor pide esa ruta)`);
        assert.equal(rewrite.destination, destination, `el rewrite ${source} apunta a otro sitio`);
        assert.ok(
            existsSync(publicFile(destination.replace(/^\//, ''))),
            `${destination} no existe`
        );
    }
});

test('about.html y contact.html traen su metadata completa', () => {
    const esperado = {
        'about.html': 'https://calletano-restaurant.web.app/about',
        'contact.html': 'https://calletano-restaurant.web.app/contact',
    };

    for (const [pagina, canonical] of Object.entries(esperado)) {
        const html = readPublic(pagina);
        assert.match(html, /<title>[^<]{10,}<\/title>/, `${pagina} sin título`);
        assert.match(html, /<meta name="description" content="[^"]{50,}"/, `${pagina} sin description`);
        assert.ok(
            html.includes(`<link rel="canonical" href="${canonical}">`),
            `${pagina} sin canonical a ${canonical}`
        );
        const niveles = nivelesDeEncabezados(html);
        assert.equal(niveles.filter((n) => n === 1).length, 1, `${pagina} debe tener un solo h1`);
    }
});

test('la portada enlaza las páginas de confianza y el sitemap las incluye', () => {
    const portada = readPublic('index.html');
    assert.ok(portada.includes('href="/about"'), 'la portada no enlaza /about');
    assert.ok(portada.includes('href="/contact"'), 'la portada no enlaza /contact');

    const sitemap = readPublic('sitemap.xml');
    for (const url of [
        'https://calletano-restaurant.web.app/about',
        'https://calletano-restaurant.web.app/contact',
    ]) {
        assert.ok(sitemap.includes(`<loc>${url}</loc>`), `el sitemap no incluye ${url}`);
    }
});

// ─────────────────────────────────────────────────────────────
// Integridad de los archivos publicados (sin build step)
// ─────────────────────────────────────────────────────────────
test('las páginas HTML de la portada y de confianza tienen las etiquetas balanceadas', () => {
    for (const pagina of ['index.html', '404.html', 'about.html', 'contact.html']) {
        assert.deepEqual(
            etiquetasDesbalanceadas(readPublic(pagina)),
            [],
            `${pagina} tiene etiquetas desbalanceadas (puede romper el layout)`
        );
    }
});

test('sitemap.xml es XML bien formado y cada URL la sirve un archivo real', () => {
    const xml = readPublic('sitemap.xml');
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/, 'sitemap sin declaración XML');
    assert.deepEqual(
        etiquetasDesbalanceadas(xml, { estricto: true }),
        [],
        'sitemap.xml no está bien formado'
    );

    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(urls.length >= 8, `el sitemap sólo lista ${urls.length} URLs`);

    for (const url of urls) {
        assert.ok(url.startsWith('https://calletano-restaurant.web.app/'), `URL ajena al sitio: ${url}`);
        const destino = archivoQueSirve(url);
        assert.ok(existsSync(publicFile(destino)), `el sitemap lista ${url} pero no existe public/${destino}`);
    }
});

test('todos los enlaces internos de las páginas nuevas apuntan a algo que existe', () => {
    const internos = new Set(['about.html', 'contact.html', 'index.html']);
    for (const pagina of internos) {
        const html = readPublic(pagina);
        const enlaces = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
            .map((m) => m[1])
            .filter((h) => !/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(h));

        for (const enlace of enlaces) {
            const destino = archivoQueSirve(`https://calletano-restaurant.web.app/${enlace.replace(/^\//, '')}`);
            assert.ok(existsSync(publicFile(destino)), `${pagina} enlaza ${enlace} y no existe public/${destino}`);
        }
    }
});
