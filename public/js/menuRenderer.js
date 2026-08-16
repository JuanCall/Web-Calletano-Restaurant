/**
 * menuRenderer.js — Renderizador puro del Menú del Día
 * 
 * Separa la lógica de renderizado del menú diario para poder testearla
 * sin depender de Firebase ni del módulo app_index.js.
 * 
 * Uso:
 *   import { renderMenuDiario } from './menuRenderer.js';
 *   renderMenuDiario(data, {
 *     titleEl, colEntradas, colSegundos, headerSegundos,
 *     listaEntradas, listaSegundos, refrescoEl
 *   });
 */

/**
 * Renderiza el menú del día en los elementos del DOM proporcionados.
 * @param {Object} d - Datos del menú (entradas, segundos, titulo, refresco, modoDomingo, etc.)
 * @param {Object} elements - Referencias a elementos del DOM
 * @param {HTMLElement} [elements.titleEl] - #main-menu-title
 * @param {HTMLElement} [elements.colEntradas] - #col-entradas
 * @param {HTMLElement} [elements.colSegundos] - #col-segundos
 * @param {HTMLElement} [elements.headerSegundos] - #header-segundos
 * @param {HTMLElement} [elements.listaEntradas] - #menu-entradas-list
 * @param {HTMLElement} [elements.listaSegundos] - #menu-segundos-list
 * @param {HTMLElement} [elements.refrescoEl] - #menu-refresco
 * @returns {boolean} true si se renderizó correctamente, false si hubo error
 */
// ⚠️ Hay una copia inline idéntica de esta función en tests/menuRenderer.test.js
// Si la modificas, actualiza también esa copia para que los tests sigan siendo válidos.

// 🔴 Un plato está AGOTADO si tiene stock definido (no vacío) y es <= 0.
// El stock del menú diario puede venir como número (0) o como texto ('0', '5').
function estaAgotado(item) {
    if (!item || typeof item !== 'object') return false;
    const s = item.stock;
    if (s === undefined || s === null || String(s).trim() === '') return false;
    const n = Number(s);
    return !Number.isNaN(n) && n <= 0;
}

// 🛡️ Escapa texto antes de insertarlo con innerHTML (previene XSS).
// El menú del día viene de Firestore (contenido/menuDiario): títulos, nombres
// de platos y acompañamientos podrían contener HTML malicioso o que rompa el
// layout, así que todo lo que se interpola en innerHTML pasa por aquí.
export function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 🏷️ Badge visual para los platos sin stock (Bootstrap 5.3)
const BADGE_AGOTADO = '<span class="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle rounded-pill ms-2 small fw-bold" style="vertical-align: middle;">AGOTADO</span>';

export function renderMenuDiario(d, elements) {
    try {
        if (!d || typeof d !== 'object') {
            console.error('renderMenuDiario: datos inválidos', d);
            return false;
        }

        const { titleEl, colEntradas, colSegundos, headerSegundos, listaEntradas, listaSegundos, refrescoEl } = elements;

        // Refresco
        if (refrescoEl) {
            refrescoEl.innerText = (d.refresco && typeof d.refresco === 'string') ? d.refresco : 'No disponible';
        }

        // Título
        if (titleEl) {
            titleEl.innerHTML = (d.titulo && typeof d.titulo === 'string')
                ? esc(d.titulo)
                : '<i class="fas fa-utensils me-2" aria-hidden="true"></i> Menú del Día';
        }

        // Entradas
        if (listaEntradas) {
            try {
                if (Array.isArray(d.entradas) && d.entradas.length > 0) {
                    const html = d.entradas
                        .filter(e => e && e.nombre)
                        .map(e => {
                            const agotado = estaAgotado(e);
                            const iconoClase = agotado ? 'fa-circle-xmark text-danger' : 'fa-check text-warning';
                            const nombreClase = agotado ? 'text-decoration-line-through text-muted' : '';
                            return `<li class="fs-5 fw-bold text-dark border-bottom border-warning-subtle py-2"><i class="fas ${iconoClase} me-2 small" aria-hidden="true"></i><span class="${nombreClase}">${esc(e.nombre)}</span>${agotado ? BADGE_AGOTADO : ''}</li>`;
                        })
                        .join('');
                    listaEntradas.innerHTML = html || '<li class="fs-5 fw-bold text-dark text-center">Por definir</li>';
                } else {
                    listaEntradas.innerHTML = `<li class="fs-5 fw-bold text-dark text-center">${(d.entrada && typeof d.entrada === 'string') ? esc(d.entrada) : 'Por definir'}</li>`;
                }
            } catch (e) {
                console.warn('renderMenuDiario: error en entradas', e);
                listaEntradas.innerHTML = '<li class="fs-5 fw-bold text-dark text-center">Por definir</li>';
            }
        }

        // Segundos
        if (listaSegundos) {
            try {
                if (Array.isArray(d.segundos) && d.segundos.length > 0) {
                    let htmlSegundos = '';
                    const gruposAcomp = {};

                    d.segundos.forEach(s => {
                        if (!s || !s.nombre) return;
                        const acomp = (s.acomp || '').trim();
                        if (!gruposAcomp[acomp]) gruposAcomp[acomp] = [];
                        gruposAcomp[acomp].push({ nombre: s.nombre, agotado: estaAgotado(s) });
                    });

                    const gruposKeys = Object.keys(gruposAcomp);
                    gruposKeys.forEach(acomp => {
                        const platos = gruposAcomp[acomp];
                        if (!platos || platos.length === 0) return;

                        platos.forEach(({ nombre, agotado }, idx) => {
                            const isLast = (idx === platos.length - 1);
                            const hasAcomp = (acomp !== '');
                            const borderClass = (isLast && hasAcomp) ? '' : 'border-bottom border-danger-subtle pb-2';
                            const iconoClase = agotado ? 'fa-circle-xmark text-danger opacity-50' : 'fa-check text-danger';
                            const nombreClase = agotado ? 'text-decoration-line-through text-muted' : '';
                            htmlSegundos += `<li class="pt-2 ${borderClass}"><div class="fs-5 fw-bold text-dark"><i class="fas ${iconoClase} me-2 small" aria-hidden="true"></i><span class="${nombreClase}">${esc(nombre)}</span>${agotado ? BADGE_AGOTADO : ''}</div></li>`;
                        });

                        if (acomp !== '' && platos.length > 0) {
                            let textoPrefijo = 'Con:';
                            if (gruposKeys.length === 1 && platos.length > 1) textoPrefijo = 'Todos salen con:';
                            else if (platos.length > 1) textoPrefijo = 'Salen con:';
                            htmlSegundos += `<li class="pb-2 mb-2 border-bottom border-danger-subtle"><div class="d-inline-block bg-danger bg-opacity-10 rounded px-2 py-1 mt-1 ms-4 border border-danger-subtle shadow-sm"><span class="small text-danger fw-bold fst-italic"><i class="fas fa-utensils me-1" aria-hidden="true"></i>${textoPrefijo} ${esc(acomp)}</span></div></li>`;
                        }
                    });

                    listaSegundos.innerHTML = htmlSegundos || '<li class="fs-5 fw-bold text-dark text-center">Por definir</li>';
                } else {
                    listaSegundos.innerHTML = `<li class="fs-5 fw-bold text-dark text-center">${(d.segundo && typeof d.segundo === 'string') ? esc(d.segundo) : 'Por definir'}</li>`;
                }
            } catch (e) {
                console.warn('renderMenuDiario: error en segundos', e);
                listaSegundos.innerHTML = '<li class="fs-5 fw-bold text-dark text-center">Por definir</li>';
            }
        }

        // Modo domingo
        // 🛡️ DEFENSIVO: Solo ocultar entradas si modoDomingo está activo Y hay segundos que mostrar.
        // Si segundos está vacío, NO ocultamos entradas para evitar que la página quede en blanco.
        const haySegundos = Array.isArray(d.segundos) && d.segundos.length > 0;
        const modoDomingoReal = d.modoDomingo === true && haySegundos;
        if (d.modoDomingo === true && !haySegundos) {
            console.warn('renderMenuDiario: modoDomingo activo pero no hay segundos. Se mantendrán visibles las entradas.');
        }
        // 🛡️ IMPORTANTE: nunca reasignar colSegundos.className completo, porque eso borra la clase
        // 'revealed' que agrega el IntersectionObserver (scroll reveal) y el cuadro de SEGUNDOS
        // se desvanece tras cargar Firebase. Solo reemplazamos las clases de grid de Bootstrap.
        const clasesGrid = (col) => (col.className || '').split(/\s+/)
            .filter(c => c && c !== 'mx-auto' && c !== 'mb-4' && !/^col-(sm|md|lg|xl|xxl)-\d+$/.test(c));
        try {
            if (modoDomingoReal) {
                if (colEntradas) colEntradas.style.display = 'none';
                if (colSegundos) {
                    colSegundos.className = [...new Set([...clasesGrid(colSegundos), 'col-md-8', 'mb-4', 'mx-auto'])].join(' ');
                    if (headerSegundos) headerSegundos.innerHTML = '<h3>ALMUERZOS</h3>';
                }
            } else {
                if (colEntradas) colEntradas.style.display = 'block';
                if (colSegundos) {
                    colSegundos.className = [...new Set([...clasesGrid(colSegundos), 'col-md-5', 'mb-4'])].join(' ');
                    if (headerSegundos) headerSegundos.innerHTML = '<h3>SEGUNDOS</h3>';
                }
            }
        } catch (e) {
            console.warn('renderMenuDiario: error en modo domingo', e);
        }

        return true;
    } catch (e) {
        console.error('renderMenuDiario: error crítico', e);
        return false;
    }
}
