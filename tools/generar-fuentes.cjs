// 🔤 Genera las fuentes propias del sitio (public/fonts/*.woff2 + public/styles/fuentes.css).
//
// Por qué: el sitio bajaba las fuentes de fonts.googleapis.com en cada visita
// (conexion a un tercero + IP del visitante filtrada). Ahora se sirven desde
// nuestro hosting y la CSP puede quedarse en font-src 'self'.
//
// Por qué variables: las cuatro familias son fuentes variables en Google Fonts,
// asi que UN archivo por familia cubre todos los pesos (Karla 200-800,
// Montserrat 100-900, Playfair Display 400-900). Antes se declaraba un @font-face
// por peso apuntando al archivo del 400: el navegador lo tomaba como la cara
// "600" de verdad y NO sintetizaba la negrita, asi que titulos y botones salian
// finos. Con el rango real eso no puede volver a pasar.
//
// Uso:  node tools/generar-fuentes.cjs
// Salida: public/fonts/*.woff2 (subset latin) y public/styles/fuentes.css
//
// Necesita red la primera vez (baja de Google Fonts). Los .woff2 quedan
// versionados en el repo, asi que no hace falta reejecutarlo para desplegar.
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DESTINO_FUENTES = path.join(RAIZ, 'public', 'fonts');
const DESTINO_CSS = path.join(RAIZ, 'public', 'styles', 'fuentes.css');

// 🎯 TODAS las familias que el CSS del sitio usa, con los pesos de verdad.
// Si agregas una familia nueva al CSS, añadela aqui y vuelve a ejecutar el
// generador: si falta, el texto cae al fallback del sistema y la pagina se ve
// distinta (paso con Space Mono, que se quedo fuera y desaparecio del QR).
//
// Variable (un archivo cubre todo el rango) o estatica (un archivo por peso).
const FAMILIAS = [
    { familia: 'Anton', query: 'Anton', caras: [{ peso: '400', archivo: 'anton-400-normal.woff2' }] },
    { familia: 'Karla', query: 'Karla:wght@200..800', caras: [{ peso: '200 800', archivo: 'karla-variable-normal.woff2' }] },
    { familia: 'Montserrat', query: 'Montserrat:wght@100..900', caras: [{ peso: '100 900', archivo: 'montserrat-variable-normal.woff2' }] },
    { familia: 'Playfair Display', query: 'Playfair+Display:wght@400..900', caras: [{ peso: '400 900', archivo: 'playfair-display-variable-normal.woff2' }] },
    { familia: 'Space Mono', query: 'Space+Mono:wght@400;700', caras: [
        { peso: '400', archivo: 'space-mono-400-normal.woff2' },
        { peso: '700', archivo: 'space-mono-700-normal.woff2' },
    ] },
];

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const CSS_API = `https://fonts.googleapis.com/css2?${FAMILIAS.map((f) => `family=${f.query}`).join('&')}&display=swap`;

/** Corta la respuesta de la API en bloques @font-face. */
function parsearBloques(css) {
    return [...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m) => {
        const cuerpo = m[1];
        const valor = (prop) => {
            const mm = cuerpo.match(new RegExp(`${prop}:\\s*([^;]+);`));
            return mm ? mm[1].trim() : null;
        };
        return {
            familia: (valor('font-family') || '').replace(/['"]/g, ''),
            peso: valor('font-weight'),
            unicodeRange: valor('unicode-range'),
            url: ((valor('src') || '').match(/url\(([^)]+)\)/) || [])[1],
        };
    });
}

(async () => {
    console.log(`🎯 Pidiendo ${FAMILIAS.length} familias a Google Fonts (fuentes variables)…`);
    const res = await fetch(CSS_API, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Google Fonts respondio HTTP ${res.status}`);
    const bloques = parsearBloques(await res.text());
    console.log(`   ${bloques.length} bloques @font-face recibidos`);

    fs.mkdirSync(DESTINO_FUENTES, { recursive: true });

    const caras = [];
    for (const { familia, caras: pedidas } of FAMILIAS) {
        // El subset `latin` es el unico cuyo rango incluye U+0000-00FF.
        // Los demas (latin-ext, cyrillic…) no los usa el sitio y solo pesarian.
        const delLatin = bloques.filter(
            (b) => b.familia === familia && b.unicodeRange && b.unicodeRange.includes('U+0000-00FF'),
        );
        if (delLatin.length === 0) throw new Error(`No encontre el subset latin de ${familia}`);

        for (const cara of pedidas) {
            // Variable: un solo bloque con el rango. Estatica: un bloque por peso.
            const bloque = delLatin.length === 1
                ? delLatin[0]
                : delLatin.find((b) => b.peso === cara.peso);
            if (!bloque) {
                throw new Error(`No encontre el peso ${cara.peso} de ${familia} (disponibles: ${delLatin.map((b) => b.peso).join(', ')})`);
            }
            if (!bloque.url) throw new Error(`El bloque de ${familia} no trae url()`);

            const binario = Buffer.from(await (await fetch(bloque.url, { headers: { 'User-Agent': UA } })).arrayBuffer());
            // Un .woff2 de verdad empieza con la firma "wOF2".
            if (binario.subarray(0, 4).toString('latin1') !== 'wOF2') {
                throw new Error(`${familia}: lo descargado no es un woff2 (firma incorrecta)`);
            }
            if (binario.length < 5_000) throw new Error(`${familia}: el archivo pesa ${binario.length} bytes, sospechoso`);

            fs.writeFileSync(path.join(DESTINO_FUENTES, cara.archivo), binario);
            caras.push({ familia, peso: bloque.peso, archivo: cara.archivo, unicodeRange: bloque.unicodeRange });
            console.log(`   ✔ ${familia.padEnd(17)} peso ${String(bloque.peso).padEnd(9)} ${(binario.length / 1024).toFixed(1)} KB → ${cara.archivo}`);
        }
    }

    // 🛑 Dos pesos distintos de la misma familia NO pueden apuntar al mismo
    // archivo sin rango: el navegador lo toma como la cara real de ese peso y no
    // sintetiza la negrita (titulos finos). Con fuentes variables es al reves:
    // cada familia trae UNA cara con su rango completo.
    const porFamilia = {};
    for (const c of caras) {
        porFamilia[c.familia] = porFamilia[c.familia] || [];
        porFamilia[c.familia].push({ peso: c.peso, archivo: c.archivo, unicodeRange: c.unicodeRange });
    }
    for (const [familia, lista] of Object.entries(porFamilia)) {
        if (lista.length === 1) continue; // una sola cara (variable o peso unico)
        const archivos = new Set(lista.map((c) => c.archivo));
        if (archivos.size !== lista.length) {
            throw new Error(`${familia}: pesos distintos compartiendo archivo (${[...archivos].join(', ')})`);
        }
    }

    const css = [
        '/* 🔤 Fuentes propias (antes se bajaban de fonts.googleapis.com).',
        '   Solo el subset `latin` y fuentes VARIABLES: un archivo por familia cubre',
        '   todos los pesos, asi que ningun peso puede quedar "falso" (un @font-face',
        '   de 700 apuntando al archivo de 400 hace que el navegador no sintetice la',
        '   negrita y los titulos salgan finos).',
        '',
        '   Generado por tools/generar-fuentes.cjs — no editar a mano. */',
        '',
        ...caras.map((c) =>
            [
                '@font-face {',
                `    font-family: '${c.familia}';`,
                '    font-style: normal;',
                `    font-weight: ${c.peso};`,
                '    font-display: swap;',
                `    src: url('../fonts/${c.archivo}') format('woff2');`,
                `    unicode-range: ${c.unicodeRange};`,
                '}',
                '',
            ].join('\n'),
        ),
    ].join('\n');

    fs.writeFileSync(DESTINO_CSS, css, 'utf8');
    const total = caras.reduce((s, c) => s + fs.statSync(path.join(DESTINO_FUENTES, c.archivo)).size, 0);
    console.log(`\n✅ ${caras.length} familias, ${(total / 1024).toFixed(1)} KB en total`);
    console.log(`✅ ${path.relative(RAIZ, DESTINO_CSS)}`);
})().catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
});
