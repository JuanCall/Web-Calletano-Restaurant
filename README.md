# Web & POS System - Calletano Restaurant

## 📖 Descripción
Plataforma web oficial y Sistema de Punto de Venta (POS) diseñado y desarrollado para "Calletano Restaurant". 
El objetivo principal de este proyecto es la digitalización integral de la oferta gastronómica del establecimiento. Cuenta con dos módulos principales: una plataforma pública orientada a fortalecer la identidad digital y la experiencia del cliente (Menú QR, SEO), y un sólido sistema interno de gestión administrativa en tiempo real para el control de salón, comandas y finanzas.

## ✨ Características Principales

### Módulo Público (Cliente)
* **Menú Digital Inteligente:** Sistema de acceso rápido a la carta mediante códigos QR dinámicos, conectado a una base de datos en tiempo real.
* **Optimización SEO Técnico:** Estrategias de posicionamiento en buscadores aplicadas desde el código base para incrementar el tráfico orgánico y la visibilidad local.
* **Diseño Responsivo (Mobile-First):** Interfaz fluida y adaptable que garantiza una experiencia de navegación perfecta en cualquier dispositivo.

### Módulo de Administración y Caja (POS)
* **Gestión de Salón en Tiempo Real:** Interfaz visual de 12 mesas con actualización instantánea de estados (Libre/Ocupada) y control de comandas por mesa.
* **Sistema de Pagos Mixtos:** Procesamiento de cuentas permitiendo el pago simultáneo con múltiples métodos (Efectivo, Yape, Plin, Tarjeta) y cálculo automático de vueltos.
* **Pedidos Flexibles:** Integración rápida de platos de la carta, opciones de menú desglosadas (solo entrada/segundo), cargos extra (taper/refresco) y registro de pedidos especiales fuera de carta.
* **Control Financiero (Arqueo de Caja):** Registro de ingresos por método de pago, control de gastos operativos diarios y cálculo automático de la ganancia neta.
* **Dashboard Gerencial (BI):** Panel analítico con gráficos interactivos que muestran la curva mensual de ingresos vs. gastos, y un ranking dinámico de los platos más vendidos del restaurante.
* **Seguridad y Autenticación:** Acceso protegido a la caja y base de datos mediante credenciales de administrador encriptadas.

## 🛠️ Tecnologías Utilizadas

**Frontend & UI**
* HTML5, CSS3, JavaScript (Vanilla ES6+)
* Bootstrap 5 (Responsive UI & Modales)
* Chart.js (Visualización de datos y gráficos)
* FontAwesome (Iconografía)

**Backend & Cloud (BaaS)**
* **Firebase Firestore:** Base de datos NoSQL en tiempo real para sincronización de mesas, carta y ventas.
* **Firebase Authentication:** Gestión segura de inicio de sesión y protección de rutas.
* **Firebase Hosting:** Despliegue en producción.

**Metodologías y Control de Versiones**
* Git & GitHub
* Diseño UI/UX enfocado en operaciones rápidas (cajeros)