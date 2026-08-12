import type { TablaAportes } from '../domain/types'
import datos from './aportes.json'

/**
 * Aportes y contribuciones obligatorios (F.102/RT de ARCA).
 * Esto NO es el sueldo: es lo que el empleador paga aparte, todos los meses.
 *
 * Los datos viven en `aportes.json`, que genera `scripts/actualizar-datos.py`
 * bajando los PDF de ARCA. Son los valores para trabajador activo mayor de 18.
 *
 * Fuente: https://www.afip.gob.ar/casasparticulares/aportes-contribuciones-ART/
 */
export const TABLAS_APORTES: TablaAportes[] = (datos.tablas as TablaAportes[])
  .slice()
  .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))

/** Fecha en que el robot trajo estos datos por última vez ('AAAA-MM-DD'). */
export const APORTES_ACTUALIZADOS: string = datos.actualizado

export function tablaAportesParaPeriodo(
  tablas: TablaAportes[],
  periodo: string,
): TablaAportes {
  const ordenadas = [...tablas].sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))
  return ordenadas.find((t) => t.vigenciaDesde <= periodo) ?? ordenadas[ordenadas.length - 1]
}

export function tramoPorHorasSemanales(tabla: TablaAportes, horas: number) {
  return (
    tabla.tramos.find(
      (t) => horas >= t.desdeHoras && (t.hastaHoras === null || horas < t.hastaHoras),
    ) ?? tabla.tramos[tabla.tramos.length - 1]
  )
}
