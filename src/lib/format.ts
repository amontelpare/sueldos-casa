const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyCorto = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const numero = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function pesos(n: number): string {
  return money.format(n ?? 0)
}

export function pesosCorto(n: number): string {
  return moneyCorto.format(n ?? 0)
}

export function num(n: number): string {
  return numero.format(n ?? 0)
}

export function horas(n: number): string {
  if (n === 0) return '0 hs'
  return `${numero.format(n)} ${n === 1 ? 'hora' : 'hs'}`
}

export function pct(n: number): string {
  return `${numero.format(n)}%`
}

/** Convierte texto tipeado por el usuario a número, tolerando "1.234,56" y "1234.56". */
export function parsearNumero(texto: string): number {
  if (!texto) return 0
  let t = texto.replace(/[^\d.,-]/g, '').trim()
  const tieneComa = t.includes(',')
  const tienePunto = t.includes('.')
  if (tieneComa && tienePunto) {
    // El último separador que aparece es el decimal.
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  } else if (tieneComa) {
    t = t.replace(',', '.')
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}
