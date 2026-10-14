# Calletano Restaurant - Sitio Web Oficial

> Restaurante: Calletano - Mancora, Talara, Piura - Peru
> URL: https://calletano-restaurant.web.app

---

## Descripcion

Sitio web publico del Restaurante Calletano. Muestra el Menu del Dia en tiempo real, la Carta completa con precios, el estado operativo del restaurante (abierto/cerrado), platos favoritos, resenas de clientes, toda la informacion de contacto y el **Club Calletano** (programa de beneficios para clientes).

Los datos se obtienen en vivo desde Firebase Firestore, por lo que cualquier cambio que el admin publique desde la Caja POS o la App Movil se refleja instantaneamente.

---

## Caracteristicas

### Landing Page (index.html)
- Estado del restaurante en tiempo real (abierto/cerrado)
- Menu del Dia dinamico con entradas, segundos y bebida incluida
- Platos Favoritos - galeria de platos destacados
- Especiales de Domingo - platos especiales de fin de semana
- Resenas de Clientes - carrusel infinito con opiniones verificadas
- Mapa de ubicacion y enlaces a redes sociales
- WhatsApp directo para pedidos
- Banner de consentimiento de cookies/privacidad (`consent.js`)

### Carta Digital (carta.html)
- Menu completo organizado por categorias
- Precios desglosados
- Navegacion sticky por categorias
- Diseno responsivo con animaciones
- Boton directo a WhatsApp para pedidos

### Club Calletano (club-crear.html / club-consultar.html / club-baja.html)
- Registro de socios con tarjeta digital y QR (`qrcode.min.js`)
- Consulta de progreso de visitas hacia el premio (10 visitas)
- Baja de socio y consulta de condiciones
- Reglas de acceso a datos en Firestore (`firestore.rules`)
- Logica compartida de validacion y tokens en `clubHelpers.js`

### Paginas Legales
- Privacidad (`privacidad.html`)
- Terminos del Club (`terminos-club.html`)
- Consentimiento de datos del usuario (`consent.js`)

### Paginas de Confianza
- Sobre nosotros (`about.html`, servida tambien en `/about`)
- Contacto y pedidos (`contact.html`, servida tambien en `/contact`)
- Privacidad en la ruta limpia `/privacy` (rewrite a `privacidad.html`)

### Para agentes IA
- `llms.txt` en la raiz del sitio (resumen, seccion *When to use this* y como consumirlo)
- 404 real (HTTP 404) para rutas inexistentes, con enlaces a `/sitemap.xml` y `/llms.txt`
- JSON-LD `Restaurant`, `WebSite` y `Organization` (contactPoint, PostalAddress, sameAs)

### Funcionalidades del Sistema
- Sincronizacion en tiempo real con Firebase Firestore
- SEO optimizado con Schema.org
- Meta tags Open Graph
- Diseno Mobile-First
- Imagenes responsivas con srcset
- Skeleton loading y scroll reveal
- Cabeceras de seguridad: CSP, Permissions-Policy, HSTS y mas (configuradas en `firebase.json`)

---

## Tecnologias

| Tecnologia        | Proposito                     |
|-------------------|-------------------------------|
| Firebase Firestore| Base de datos NoSQL en tiempo real |
| Firebase Hosting  | Hosting y deploy              |
| Firestore Rules   | Control de acceso a los datos del Club |
| Bootstrap 5       | CSS Framework responsivo (copia local en `public/vendor/`) |
| FontAwesome 6     | Iconografia, como sprite SVG local (`public/img/iconos.svg`) |
| Vanilla JS (ES6+) | Logica del frontend           |

---

## Deploy

El sitio esta hosteado en Firebase Hosting.

```bash
firebase deploy --only hosting
```

> ⚠️ **No volver a agregar el rewrite comodin** (`"source": "**" → /index.html`) en
> `firebase.json`: convertia cada ruta inexistente en un soft-404 (HTTP 200 con la portada) y
> rompia el comportamiento que esperan los agentes IA. El sitio es multipagina, no una SPA: las
> rutas que no existen deben responder 404 con `public/404.html`. Las unicas rutas reescritas son
> `/about`, `/contact` y `/privacy`.

Para desplegar tambien las reglas de Firestore:

```bash
firebase deploy --only firestore:rules
```

## Recursos locales (sin CDNs)

Bootstrap, las fuentes y los iconos se sirven desde el propio hosting. El sitio **no hace
ninguna peticion a un tercero** para pintarse: eso quita tres handshakes DNS/TLS por visita,
no filtra la IP del visitante a otras empresas y permite una CSP estricta.

| Recurso | Archivo | Como se mantiene |
|---|---|---|
| Bootstrap 5.3 | `public/vendor/bootstrap/` | Copia local; al actualizar, reemplazar ambos archivos |
| Fuentes (Anton, Karla, Montserrat, Playfair) | `public/fonts/*.woff2` + `public/styles/fuentes.css` | Solo el subset `latin` y los pesos que el sitio usa |
| Iconos | `public/img/iconos.svg` + `public/styles/iconos.css` | Generado por `tools/generar-iconos.cjs` |

Los tests de `tests/recursos-locales.test.mjs` fallan si alguien vuelve a enlazar una CDN, si
un simbolo del sprite no existe, o si queda un `<i class="fas fa-...">`.

### Regenerar el sprite de iconos

Los SVG salen del paquete `@fortawesome/fontawesome-free` ya instalado (sin red). El generador
detecta los iconos usados buscando las referencias `iconos.svg#solid-<nombre>` en `public/`.

```bash
cd calletano-web && node tools/generar-iconos.cjs
```

> ⚠️ Si el generador reporta **0 iconos**, aborta con error y **no toca el sprite**. Es a
> proposito: sobrescribirlo con un archivo vacio dejaba el sitio entero sin iconos. Si ves ese
> error, revisa las regex de `recolectarIconos()` — el sitio dejo de usar la forma esperada.

---

## Tests

Se ejecutan sin dependencias (solo Node) y fijan los comportamientos de preparacion para agentes:
404 real, jerarquia de encabezados y contenido sin JavaScript, JSON-LD de identidad, `llms.txt`,
paginas de confianza, integridad de los HTML y del `sitemap.xml`, y coherencia de horarios.

```bash
cd calletano-web
npm test        # node --test "tests/**/*.test.mjs"
```

---

## Notificaciones Push (DESACTIVADAS)

Por decision del dueno, las notificaciones push a clientes por la pagina web estan desactivadas.

El codigo de FCM se mantiene comentado para posible reactivacion futura.

---

## Estado del Proyecto

| Aspecto                       | Estado        |
|-------------------------------|---------------|
| Landing Page                  | Completada    |
| Carta Digital                 | Completada    |
| Club Calletano                | Completado    |
| Paginas Legales (privacidad/terminos) | Completadas |
| SEO Tecnico                   | Completado    |
| Seguridad (CSP + headers)     | Completado    |
| Datos en Tiempo Real          | Funcional     |
| Notificaciones Push Clientes  | Desactivadas  |
| Hosting                       | Firebase      |

---

> Desarrollado por: Juan Calle Rosales
> Contacto: juancallerosales19@gmail.com
