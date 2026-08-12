/**
 * Helpers de fecha. Todo se maneja como string 'AAAA-MM-DD' para evitar
 * los líos de zona horaria de Date (que en Argentina corren el día).
 */

export const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const DIAS_SEMANA_LARGO = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]
export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export function hoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function periodoActual(): string {
  return hoy().slice(0, 7)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Día de la semana (0 = domingo) de una fecha 'AAAA-MM-DD'. */
export function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export function diasEnMes(periodo: string): number {
  const [a, m] = periodo.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/** Todas las fechas 'AAAA-MM-DD' de un período 'AAAA-MM'. */
export function fechasDelPeriodo(periodo: string): string[] {
  const total = diasEnMes(periodo)
  return Array.from({ length: total }, (_, i) => `${periodo}-${pad(i + 1)}`)
}

export function nombrePeriodo(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

export function periodoOffset(periodo: string, meses: number): string {
  const [a, m] = periodo.split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

export function formatearFecha(fecha: string): string {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}

export function formatearFechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${d}/${m}`
}

/** Años completos entre dos fechas. */
export function aniosCumplidos(desde: string, hasta: string): number {
  if (!desde || desde > hasta) return 0
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  let anios = a2 - a1
  if (m2 < m1 || (m2 === m1 && d2 < d1)) anios--
  return Math.max(0, anios)
}

/** Último día del período, para medir antigüedad al cierre del mes. */
export function finDePeriodo(periodo: string): string {
  return `${periodo}-${pad(diasEnMes(periodo))}`
}

/** Cuántas veces cae cada día de semana dentro del período. */
export function conteoDiasSemana(periodo: string): number[] {
  const conteo = [0, 0, 0, 0, 0, 0, 0]
  for (const f of fechasDelPeriodo(periodo)) conteo[diaSemana(f)]++
  return conteo
}
