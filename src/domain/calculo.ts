import type {
  Config,
  DiaLiquidacion,
  Empleada,
  Escala,
  Feriado,
  Liquidacion,
  TablaAportes,
  TramoAportes,
} from './types'
import { escalaParaPeriodo } from '../data/escalas'
import { mapaFeriados } from '../data/feriados'
import { tablaAportesParaPeriodo, tramoPorHorasSemanales } from '../data/aportes'
import {
  aniosCumplidos,
  conteoDiasSemana,
  diaSemana,
  fechasDelPeriodo,
  finDePeriodo,
} from '../lib/fechas'

export const CONFIG_POR_DEFECTO: Config = {
  // Criterio habitual para el "día extra" del feriado trabajado en mensualizadas.
  divisorJornalFeriado: 25,
  // Para descontar días no trabajados se usa el mes de 30 días.
  divisorDescuentoAusencia: 30,
  antiguedadPctPorAnio: 1,
  redondeoTotal: 0,
}

export interface Concepto {
  id: string
  label: string
  detalle?: string
  monto: number
  tipo: 'haber' | 'descuento'
}

export interface DetalleValorBase {
  /** Mínimo de la escala, sin adicionales. */
  minimoEscala: number
  /** Base sobre la que se calculan los adicionales. */
  base: number
  usaValorAcordado: boolean
  valorAcordadoEsFinal: boolean
  zonaPct: number
  montoZona: number
  antiguedadAnios: number
  antiguedadPct: number
  montoAntiguedad: number
  /** Valor final por hora o por mes, según la forma de pago. */
  valorFinal: number
  /** Piso legal con zona y antigüedad incluidas. */
  minimoLegal: number
  porDebajoDelMinimo: boolean
}

export interface ResumenHoras {
  normales: number
  feriadoTrabajado: number
  pagasSinTrabajar: number
  extra50: number
  extra100: number
  totalTrabajadas: number
}

export interface ResumenDias {
  trabajados: number
  ausentes: number
  ausentesPagos: number
  feriadosTrabajados: number
  feriadosPagos: number
  vacaciones: number
}

export interface ResultadoLiquidacion {
  periodo: string
  escala: Escala
  valorBase: DetalleValorBase
  /** Valor de la hora ya con zona y antigüedad (equivalente si es mensualizada). */
  valorHoraEfectivo: number
  horas: ResumenHoras
  dias: ResumenDias
  horasSemanales: number
  horasMensualesHabituales: number
  conceptos: Concepto[]
  /** Suma de haberes remunerativos, sin SAC ni ajustes. */
  remuneracionBruta: number
  sac: number
  totalAjustes: number
  total: number
  totalRedondeado: number
  advertencias: string[]
  aportes: { tramo: TramoAportes; tabla: TablaAportes } | null
}

/* ------------------------------------------------------------------ */
/* Días                                                                */
/* ------------------------------------------------------------------ */

export function horasHabituales(empleada: Empleada, fecha: string): number {
  return empleada.jornada[diaSemana(fecha)] ?? 0
}

export function horasDelDia(empleada: Empleada, dia: DiaLiquidacion): number {
  return dia.horas ?? horasHabituales(empleada, dia.fecha)
}

/**
 * Arma el mes con los valores más probables: vino todos sus días habituales,
 * y los feriados que caen en día de trabajo quedan pagos pero sin trabajar.
 * Después se corrigen las excepciones a mano.
 */
export function generarDiasPorDefecto(
  empleada: Empleada,
  periodo: string,
  feriados: Feriado[],
): DiaLiquidacion[] {
  const mapa = mapaFeriados(feriados)
  return fechasDelPeriodo(periodo).map((fecha) => {
    const habituales = horasHabituales(empleada, fecha)
    const esFeriado = mapa.has(fecha)
    let estado: DiaLiquidacion['estado'] = 'libre'
    if (habituales > 0) estado = esFeriado ? 'feriado_pago' : 'trabajado'
    return { fecha, estado, horas: null, extra50: 0, extra100: 0 }
  })
}

/**
 * Reconcilia los días guardados con la jornada y los feriados actuales:
 * conserva lo que el usuario tocó y completa lo que falta.
 */
export function sincronizarDias(
  empleada: Empleada,
  periodo: string,
  feriados: Feriado[],
  guardados: DiaLiquidacion[],
): DiaLiquidacion[] {
  const previos = new Map(guardados.map((d) => [d.fecha, d]))
  return generarDiasPorDefecto(empleada, periodo, feriados).map(
    (d) => previos.get(d.fecha) ?? d,
  )
}

/* ------------------------------------------------------------------ */
/* Valor base                                                          */
/* ------------------------------------------------------------------ */

export function calcularValorBase(
  empleada: Empleada,
  escala: Escala,
  periodo: string,
  config: Config,
): DetalleValorBase {
  const v = escala.valores[empleada.categoria]
  const esMes = empleada.formaPago === 'mes'
  const conRetiro = empleada.modalidad === 'con_retiro'
  const minimoEscala =
    (esMes
      ? conRetiro
        ? v.mesConRetiro
        : v.mesSinRetiro
      : conRetiro
        ? v.horaConRetiro
        : v.horaSinRetiro) ?? 0

  const antiguedadAnios = aniosCumplidos(empleada.fechaIngreso, finDePeriodo(periodo))
  const antiguedadPct = antiguedadAnios * config.antiguedadPctPorAnio
  const zonaPct = empleada.zonaDesfavorable ? escala.zonaDesfavorablePct : 0
  const minimoLegal = minimoEscala * (1 + zonaPct / 100 + antiguedadPct / 100)

  const usaValorAcordado = empleada.valorAcordado != null && empleada.valorAcordado > 0

  if (usaValorAcordado && empleada.valorAcordadoEsFinal) {
    const valorFinal = empleada.valorAcordado as number
    return {
      minimoEscala,
      base: valorFinal,
      usaValorAcordado: true,
      valorAcordadoEsFinal: true,
      zonaPct,
      montoZona: 0,
      antiguedadAnios,
      antiguedadPct,
      montoAntiguedad: 0,
      valorFinal,
      minimoLegal,
      porDebajoDelMinimo: valorFinal < minimoLegal - 0.01,
    }
  }

  const base = usaValorAcordado ? (empleada.valorAcordado as number) : minimoEscala
  const montoZona = (base * zonaPct) / 100
  const montoAntiguedad = (base * antiguedadPct) / 100
  const valorFinal = base + montoZona + montoAntiguedad

  return {
    minimoEscala,
    base,
    usaValorAcordado,
    valorAcordadoEsFinal: false,
    zonaPct,
    montoZona,
    antiguedadAnios,
    antiguedadPct,
    montoAntiguedad,
    valorFinal,
    minimoLegal,
    porDebajoDelMinimo: valorFinal < minimoLegal - 0.01,
  }
}

/* ------------------------------------------------------------------ */
/* Aguinaldo                                                           */
/* ------------------------------------------------------------------ */

/** El SAC se paga en junio y en diciembre. */
export function periodoPagaSac(periodo: string): boolean {
  const mes = periodo.slice(5, 7)
  return mes === '06' || mes === '12'
}

/**
 * SAC = mejor remuneración mensual del semestre / 2, proporcional al tiempo
 * trabajado si entró con el semestre empezado.
 */
export function calcularSac(
  empleada: Empleada,
  periodo: string,
  remuneracionesDelSemestre: number[],
  remuneracionActual: number,
): number {
  const mejor = Math.max(remuneracionActual, ...remuneracionesDelSemestre, 0)
  const anio = Number(periodo.slice(0, 4))
  const primerSemestre = periodo.slice(5, 7) === '06'
  const inicioSemestre = `${anio}-${primerSemestre ? '01-01' : '07-01'}`
  const finSemestre = `${anio}-${primerSemestre ? '06-30' : '12-31'}`

  const totalDias = diasEntre(inicioSemestre, finSemestre) + 1
  const desde = empleada.fechaIngreso > inicioSemestre ? empleada.fechaIngreso : inicioSemestre
  if (desde > finSemestre) return 0
  const diasTrabajados = diasEntre(desde, finSemestre) + 1

  return (mejor / 2) * Math.min(1, diasTrabajados / totalDias)
}

function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Math.round(ms / 86400000)
}

/* ------------------------------------------------------------------ */
/* Vacaciones                                                          */
/* ------------------------------------------------------------------ */

export function diasDeVacaciones(anios: number): number {
  if (anios < 5) return 14
  if (anios < 10) return 21
  if (anios < 20) return 28
  return 35
}

/**
 * Pago de vacaciones. Para mensualizadas el criterio legal es sueldo/25 por día
 * corrido; para las que cobran por hora se usa el jornal promedio de la semana.
 */
export function calcularVacaciones(
  empleada: Empleada,
  valorBase: DetalleValorBase,
  dias: number,
): number {
  if (empleada.formaPago === 'mes') {
    return (valorBase.valorFinal / 25) * dias
  }
  const horasSemanales = empleada.jornada.reduce((a, b) => a + b, 0)
  const jornalPromedio = (horasSemanales / 6) * valorBase.valorFinal
  return jornalPromedio * dias
}

/* ------------------------------------------------------------------ */
/* Liquidación                                                         */
/* ------------------------------------------------------------------ */

export interface EntradaCalculo {
  empleada: Empleada
  liquidacion: Liquidacion
  escalas: Escala[]
  feriados: Feriado[]
  tablasAportes: TablaAportes[]
  config: Config
  /** Remuneraciones brutas de los otros meses del semestre, para el SAC. */
  remuneracionesDelSemestre?: number[]
}

export function calcularLiquidacion({
  empleada,
  liquidacion,
  escalas,
  feriados,
  tablasAportes,
  config,
  remuneracionesDelSemestre = [],
}: EntradaCalculo): ResultadoLiquidacion {
  const periodo = liquidacion.periodo
  const escala = escalaParaPeriodo(escalas, periodo)
  const valorBase = calcularValorBase(empleada, escala, periodo, config)
  const dias = sincronizarDias(empleada, periodo, feriados, liquidacion.dias)
  const advertencias: string[] = []

  const h: ResumenHoras = {
    normales: 0,
    feriadoTrabajado: 0,
    pagasSinTrabajar: 0,
    extra50: 0,
    extra100: 0,
    totalTrabajadas: 0,
  }
  const d: ResumenDias = {
    trabajados: 0,
    ausentes: 0,
    ausentesPagos: 0,
    feriadosTrabajados: 0,
    feriadosPagos: 0,
    vacaciones: 0,
  }

  for (const dia of dias) {
    const hs = horasDelDia(empleada, dia)
    h.extra50 += dia.extra50
    h.extra100 += dia.extra100
    switch (dia.estado) {
      case 'trabajado':
        h.normales += hs
        d.trabajados++
        break
      case 'feriado_trabajado':
        h.feriadoTrabajado += hs
        d.feriadosTrabajados++
        break
      case 'feriado_pago':
        h.pagasSinTrabajar += horasHabituales(empleada, dia.fecha)
        d.feriadosPagos++
        break
      case 'ausente_pago':
        h.pagasSinTrabajar += horasHabituales(empleada, dia.fecha)
        d.ausentesPagos++
        break
      case 'vacaciones':
        h.pagasSinTrabajar += horasHabituales(empleada, dia.fecha)
        d.vacaciones++
        break
      case 'ausente':
        d.ausentes++
        break
      case 'libre':
        break
    }
  }
  h.totalTrabajadas = h.normales + h.feriadoTrabajado + h.extra50 + h.extra100

  const horasSemanales = empleada.jornada.reduce((a, b) => a + b, 0)
  const conteo = conteoDiasSemana(periodo)
  const horasMensualesHabituales = empleada.jornada.reduce(
    (acc, hs, dow) => acc + hs * conteo[dow],
    0,
  )

  const conceptos: Concepto[] = []
  let valorHoraEfectivo: number

  if (empleada.formaPago === 'hora') {
    valorHoraEfectivo = valorBase.valorFinal
    const vh = valorHoraEfectivo

    if (h.normales > 0) {
      conceptos.push({
        id: 'normales',
        label: 'Horas trabajadas',
        detalle: `${fmtHs(h.normales)} × ${fmtPesos(vh)}`,
        monto: h.normales * vh,
        tipo: 'haber',
      })
    }
    if (h.feriadoTrabajado > 0) {
      conceptos.push({
        id: 'feriado_trabajado',
        label: 'Feriados trabajados (doble)',
        detalle: `${fmtHs(h.feriadoTrabajado)} × ${fmtPesos(vh)} × 2`,
        monto: h.feriadoTrabajado * vh * 2,
        tipo: 'haber',
      })
    }
    if (h.pagasSinTrabajar > 0) {
      const partes: string[] = []
      if (d.feriadosPagos) partes.push(`${d.feriadosPagos} feriado${d.feriadosPagos > 1 ? 's' : ''}`)
      if (d.ausentesPagos) partes.push(`${d.ausentesPagos} día${d.ausentesPagos > 1 ? 's' : ''} con licencia`)
      if (d.vacaciones) partes.push(`${d.vacaciones} día${d.vacaciones > 1 ? 's' : ''} de vacaciones`)
      conceptos.push({
        id: 'pagas_sin_trabajar',
        label: 'Días pagos no trabajados',
        detalle: `${partes.join(' + ')} — ${fmtHs(h.pagasSinTrabajar)}`,
        monto: h.pagasSinTrabajar * vh,
        tipo: 'haber',
      })
    }
  } else {
    // Mensualizada: el sueldo es fijo y se ajusta por ausencias y feriados.
    valorHoraEfectivo =
      horasMensualesHabituales > 0
        ? valorBase.valorFinal / horasMensualesHabituales
        : valorBase.valorFinal / 200

    conceptos.push({
      id: 'sueldo',
      label: 'Sueldo mensual',
      detalle: escala.etiqueta + (valorBase.usaValorAcordado ? ' · valor acordado' : ' · mínimo de escala'),
      monto: valorBase.valorFinal,
      tipo: 'haber',
    })

    if (d.feriadosTrabajados > 0) {
      const jornal = valorBase.valorFinal / config.divisorJornalFeriado
      conceptos.push({
        id: 'feriado_trabajado',
        label: 'Feriados trabajados (día extra)',
        detalle: `${d.feriadosTrabajados} × sueldo ÷ ${config.divisorJornalFeriado}`,
        monto: d.feriadosTrabajados * jornal,
        tipo: 'haber',
      })
    }
    if (d.ausentes > 0) {
      const jornal = valorBase.valorFinal / config.divisorDescuentoAusencia
      conceptos.push({
        id: 'ausencias',
        label: 'Días no trabajados',
        detalle: `${d.ausentes} × sueldo ÷ ${config.divisorDescuentoAusencia}`,
        monto: -(d.ausentes * jornal),
        tipo: 'descuento',
      })
    }
  }

  if (h.extra50 > 0) {
    conceptos.push({
      id: 'extra50',
      label: 'Horas extra al 50%',
      detalle: `${fmtHs(h.extra50)} × ${fmtPesos(valorHoraEfectivo)} × 1,5`,
      monto: h.extra50 * valorHoraEfectivo * 1.5,
      tipo: 'haber',
    })
  }
  if (h.extra100 > 0) {
    conceptos.push({
      id: 'extra100',
      label: 'Horas extra al 100%',
      detalle: `${fmtHs(h.extra100)} × ${fmtPesos(valorHoraEfectivo)} × 2`,
      monto: h.extra100 * valorHoraEfectivo * 2,
      tipo: 'haber',
    })
  }

  for (const ad of empleada.adicionales) {
    if (!ad.monto) continue
    conceptos.push({
      id: `adicional_${ad.id}`,
      label: ad.concepto || 'Adicional',
      detalle: ad.remunerativo ? undefined : 'No remunerativo',
      monto: ad.monto,
      tipo: ad.monto >= 0 ? 'haber' : 'descuento',
    })
  }

  const remuneracionBruta = conceptos.reduce((a, c) => a + c.monto, 0)

  // Aguinaldo
  let sac = 0
  if (liquidacion.incluirSac) {
    sac =
      liquidacion.sacManual != null
        ? liquidacion.sacManual
        : calcularSac(empleada, periodo, remuneracionesDelSemestre, remuneracionBruta)
    if (sac) {
      conceptos.push({
        id: 'sac',
        label: 'Aguinaldo (SAC)',
        detalle:
          liquidacion.sacManual != null
            ? 'Importe cargado a mano'
            : 'Mejor remuneración del semestre ÷ 2',
        monto: sac,
        tipo: 'haber',
      })
    }
  }

  // Ajustes del mes
  let totalAjustes = 0
  for (const aj of liquidacion.ajustes) {
    if (!aj.monto) continue
    totalAjustes += aj.monto
    conceptos.push({
      id: `ajuste_${aj.id}`,
      label: aj.concepto || (aj.monto >= 0 ? 'Ajuste' : 'Descuento'),
      monto: aj.monto,
      tipo: aj.monto >= 0 ? 'haber' : 'descuento',
    })
  }

  const total = remuneracionBruta + sac + totalAjustes
  const totalRedondeado =
    config.redondeoTotal > 0
      ? Math.round(total / config.redondeoTotal) * config.redondeoTotal
      : total

  // Advertencias
  if (valorBase.minimoEscala === 0) {
    advertencias.push(
      `La escala de ${escala.etiqueta} no tiene valor para ${empleada.categoria} ${empleada.modalidad === 'con_retiro' ? 'con retiro' : 'sin retiro'}. Revisá la categoría.`,
    )
  }
  if (valorBase.porDebajoDelMinimo) {
    advertencias.push(
      `El valor que estás usando queda por debajo del mínimo legal (${fmtPesos(valorBase.minimoLegal)} ${empleada.formaPago === 'mes' ? 'por mes' : 'la hora'}).`,
    )
  }
  if (empleada.formaPago === 'hora' && horasSemanales >= 24) {
    advertencias.push(
      'Trabaja 24 horas semanales o más: por normativa corresponde liquidarla con sueldo mensual, no por hora.',
    )
  }
  if (empleada.formaPago === 'mes' && horasSemanales > 0 && horasSemanales < 24) {
    advertencias.push(
      'Trabaja menos de 24 horas semanales: normalmente corresponde liquidar por hora.',
    )
  }
  if (escala.vigenciaDesde < periodo.slice(0, 7) && escalaEsVieja(escala, periodo)) {
    advertencias.push(
      `La escala más nueva que tenés cargada es la de ${escala.etiqueta}. Fijate en ARCA si salió una actualización.`,
    )
  }
  if (periodo < escalaMasVieja(escalas).vigenciaDesde) {
    advertencias.push(
      `No tenés escalas cargadas de antes de ${escalaMasVieja(escalas).etiqueta}, así que este mes se está calculando con valores que todavía no regían. Para liquidar un mes viejo, cargá la escala de esa fecha.`,
    )
  }
  // Sin feriados cargados, un mes con feriados se liquidaría como si no los
  // hubiera y se pagaría de menos.
  if (!feriados.some((f) => f.fecha.startsWith(periodo.slice(0, 4)))) {
    advertencias.push(
      `No hay feriados cargados para ${periodo.slice(0, 4)}. Cargalos en Datos → Feriados o los días feriados se van a contar como días comunes.`,
    )
  }

  // Aportes y contribuciones (informativo)
  let aportes: ResultadoLiquidacion['aportes'] = null
  if (tablasAportes.length > 0 && horasSemanales > 0) {
    const tabla = tablaAportesParaPeriodo(tablasAportes, periodo)
    aportes = { tabla, tramo: tramoPorHorasSemanales(tabla, horasSemanales) }
  }

  return {
    periodo,
    escala,
    valorBase,
    valorHoraEfectivo,
    horas: h,
    dias: d,
    horasSemanales,
    horasMensualesHabituales,
    conceptos,
    remuneracionBruta,
    sac,
    totalAjustes,
    total,
    totalRedondeado,
    advertencias,
    aportes,
  }
}

/** La escala más antigua que se tenga cargada. */
function escalaMasVieja(escalas: Escala[]): Escala {
  return escalas.reduce((a, b) => (a.vigenciaDesde <= b.vigenciaDesde ? a : b))
}

/** Avisa si la escala vigente quedó a más de 2 meses del período liquidado. */
function escalaEsVieja(escala: Escala, periodo: string): boolean {
  const [ea, em] = escala.vigenciaDesde.split('-').map(Number)
  const [pa, pm] = periodo.split('-').map(Number)
  return pa * 12 + pm - (ea * 12 + em) >= 2
}

function fmtPesos(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtHs(n: number) {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)} hs`
}
