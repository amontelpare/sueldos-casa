import type { CategoriaId, CategoriaInfo, Escala } from '../domain/types'
import datos from './escalas.json'

/**
 * Escalas salariales oficiales del Personal de Casas Particulares.
 *
 * Los valores NO se escriben a mano acá: viven en `escalas.json`, que genera
 * `scripts/actualizar-datos.py` bajando los PDF de ARCA. Un workflow de GitHub
 * lo corre todos los meses, así que la app se actualiza sola.
 *
 * Fuente: https://www.afip.gob.ar/casasparticulares/categorias-y-remuneraciones/
 */

export const CATEGORIAS: CategoriaInfo[] = [
  {
    id: 'supervisor',
    nombre: 'Supervisor/a',
    descripcion: 'Coordina y controla el trabajo de otro personal de la casa.',
  },
  {
    id: 'especificas',
    nombre: 'Tareas específicas',
    descripcion: 'Cocineros/as y otras tareas puntuales con formación específica.',
  },
  {
    id: 'caseros',
    nombre: 'Caseros',
    descripcion: 'Cuidado y mantenimiento de la vivienda donde también viven.',
    soloSinRetiro: true,
  },
  {
    id: 'cuidado',
    nombre: 'Cuidado de personas',
    descripcion: 'Niñeras, acompañantes de adultos mayores, cuidado de enfermos.',
  },
  {
    id: 'generales',
    nombre: 'Tareas generales',
    descripcion: 'Limpieza, lavado, planchado y mantenimiento general de la casa.',
  },
]

export const CATEGORIA_POR_ID = Object.fromEntries(
  CATEGORIAS.map((c) => [c.id, c]),
) as Record<CategoriaId, CategoriaInfo>

/** Ordenadas de más nueva a más vieja. */
export const ESCALAS: Escala[] = (datos.escalas as Escala[])
  .slice()
  .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))

/** Fecha en que el robot trajo estos datos por última vez ('AAAA-MM-DD'). */
export const ESCALAS_ACTUALIZADAS: string = datos.actualizado

/**
 * Provincias con adicional por zona desfavorable, según la resolución vigente.
 * Cipolletti y toda Río Negro entran.
 */
export const PROVINCIAS_ZONA_DESFAVORABLE = [
  'La Pampa',
  'Río Negro',
  'Chubut',
  'Neuquén',
  'Santa Cruz',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
  'Partido de Patagones (Buenos Aires)',
]

/** Devuelve la escala que corresponde a un período 'AAAA-MM'. */
export function escalaParaPeriodo(escalas: Escala[], periodo: string): Escala {
  const ordenadas = [...escalas].sort((a, b) =>
    b.vigenciaDesde.localeCompare(a.vigenciaDesde),
  )
  return ordenadas.find((e) => e.vigenciaDesde <= periodo) ?? ordenadas[ordenadas.length - 1]
}
