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
| Bootstrap 5       | CSS Framework responsivo      |
| FontAwesome 6     | Iconografia                   |
| Vanilla JS (ES6+) | Logica del frontend           |

---

## Deploy

El sitio esta hosteado en Firebase Hosting.

```bash
firebase deploy --only hosting
```

Para desplegar tambien las reglas de Firestore:

```bash
firebase deploy --only firestore:rules
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
