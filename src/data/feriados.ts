import type { Feriado } from '../domain/types'
import datos from './feriados.json'

/**
 * Feriados nacionales.
 *
 * Los datos viven en `feriados.json`, que genera `scripts/actualizar-datos.py`
 * desde api.argentinadatos.com. Vienen con los traslados ya aplicados: por
 * ejemplo el Día de la Soberanía de 2026 cae lunes 23/11, no el 20.
 *
 * Ojo con los años futuros: los feriados trasladables y los puentes turísticos
 * se fijan por decreto, así que hasta que salga quedan en su fecha nominal y
 * sin puentes. El robot los corrige solo cuando el decreto se publica.
 */
export const FERIADOS: Feriado[] = (datos.feriados as Feriado[])
  .slice()
  .sort((a, b) => a.fecha.localeCompare(b.fecha))

/** Fecha en que el robot trajo estos datos por última vez ('AAAA-MM-DD'). */
export const FERIADOS_ACTUALIZADOS: string = datos.actualizado

/** Último año con calendario cargado. */
export const ULTIMO_ANIO_CON_FERIADOS: string =
  FERIADOS.length > 0 ? FERIADOS[FERIADOS.length - 1].fecha.slice(0, 4) : ''

/** Los "no laborables" no se pagan doble: son de trabajo optativo. */
export function esFeriadoPago(f: Feriado) {
  return f.tipo !== 'no_laborable'
}

export function feriadosDelPeriodo(feriados: Feriado[], periodo: string) {
  return feriados.filter((f) => f.fecha.startsWith(periodo))
}

export function mapaFeriados(feriados: Feriado[]) {
  const m = new Map<string, Feriado>()
  for (const f of feriados) if (esFeriadoPago(f)) m.set(f.fecha, f)
  return m
}
