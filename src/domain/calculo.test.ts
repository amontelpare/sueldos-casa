import { describe, expect, it } from 'vitest'
import {
  CONFIG_POR_DEFECTO,
  calcularLiquidacion,
  calcularSac,
  calcularValorBase,
  calcularVacaciones,
  diasDeVacaciones,
  generarDiasPorDefecto,
} from './calculo'
import { ESCALAS, escalaParaPeriodo } from '../data/escalas'
import { FERIADOS } from '../data/feriados'
import { TABLAS_APORTES } from '../data/aportes'
import type { Empleada, Liquidacion } from './types'

/**
 * Estos tests verifican el MOTOR de cálculo, así que necesitan datos que no se
 * muevan. Los datos oficiales los actualiza un robot todos los días: si acá
 * usara "la escala más nueva", el día que ARCA publique agosto se rompería todo
 * y el robot no podría publicar nunca más.
 *
 * Por eso congelo la ventana hasta julio 2026. Las escalas y los feriados
 * viejos ya no cambian, así que sigo probando contra los datos reales sin que
 * el tiempo los pise. Que los datos NUEVOS estén bien formados es harina de
 * otro costal: eso lo cubre `src/data/datos.test.ts`.
 */
const ESCALAS_TEST = ESCALAS.filter((e) => e.vigenciaDesde <= '2026-07')
const FERIADOS_TEST = FERIADOS.filter((f) => f.fecha < '2027-01-01')
const APORTES_TEST = TABLAS_APORTES.filter((t) => t.vigenciaDesde <= '2026-07')

const escalaJulio = ESCALAS_TEST.find((e) => e.vigenciaDesde === '2026-07')!

function empleada(over: Partial<Empleada> = {}): Empleada {
  return {
    id: 'e1',
    nombre: 'Test',
    categoria: 'generales',
    modalidad: 'con_retiro',
    formaPago: 'hora',
    jornada: [0, 4, 0, 4, 0, 4, 0], // lun, mié, vie
    fechaIngreso: '2024-03-01',
    zonaDesfavorable: true,
    valorAcordado: null,
    valorAcordadoEsFinal: false,
    adicionales: [],
    notas: '',
    color: '#0f766e',
    ...over,
  }
}

function liquidacion(emp: Empleada, periodo: string, over: Partial<Liquidacion> = {}): Liquidacion {
  return {
    id: 'l1',
    empleadaId: emp.id,
    periodo,
    dias: generarDiasPorDefecto(emp, periodo, FERIADOS_TEST),
    ajustes: [],
    sacManual: null,
    incluirSac: false,
    pagada: false,
    fechaPago: null,
    notas: '',
    ...over,
  }
}

function correr(emp: Empleada, liq: Liquidacion) {
  return calcularLiquidacion({
    empleada: emp,
    liquidacion: liq,
    escalas: ESCALAS_TEST,
    feriados: FERIADOS_TEST,
    tablasAportes: APORTES_TEST,
    config: CONFIG_POR_DEFECTO,
  })
}

describe('escalas oficiales', () => {
  it('toma la escala vigente para el período', () => {
    expect(escalaParaPeriodo(ESCALAS_TEST, '2026-08').etiqueta).toBe('Julio 2026')
    expect(escalaParaPeriodo(ESCALAS_TEST, '2026-07').etiqueta).toBe('Julio 2026')
    expect(escalaParaPeriodo(ESCALAS_TEST, '2026-05').etiqueta).toBe('Mayo 2026')
    expect(escalaParaPeriodo(ESCALAS_TEST, '2025-12').etiqueta).toBe('Enero 2026')
  })

  it('mantiene los valores oficiales de julio 2026', () => {
    expect(escalaJulio.valores.generales.horaConRetiro).toBe(3733.72)
    expect(escalaJulio.valores.cuidado.horaConRetiro).toBe(3996.45)
    expect(escalaJulio.valores.cuidado.mesSinRetiro).toBe(558972.92)
    expect(escalaJulio.valores.caseros.horaConRetiro).toBeNull()
    expect(escalaJulio.zonaDesfavorablePct).toBe(31)
  })

  it('la zona desfavorable pasó de 30% a 31% en abril 2026', () => {
    expect(escalaParaPeriodo(ESCALAS_TEST, '2026-03').zonaDesfavorablePct).toBe(30)
    expect(escalaParaPeriodo(ESCALAS_TEST, '2026-04').zonaDesfavorablePct).toBe(31)
  })
})

describe('valor base', () => {
  it('aplica zona desfavorable y antigüedad sobre el mínimo', () => {
    const emp = empleada({ fechaIngreso: '2024-03-01' }) // 2 años al 31/08/2026
    const vb = calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO)
    expect(vb.minimoEscala).toBe(3733.72)
    expect(vb.antiguedadAnios).toBe(2)
    expect(vb.montoZona).toBeCloseTo(3733.72 * 0.31, 4)
    expect(vb.montoAntiguedad).toBeCloseTo(3733.72 * 0.02, 4)
    expect(vb.valorFinal).toBeCloseTo(3733.72 * 1.33, 4)
    expect(vb.porDebajoDelMinimo).toBe(false)
  })

  it('sin zona desfavorable no suma el 31%', () => {
    const emp = empleada({ zonaDesfavorable: false, fechaIngreso: '2026-08-01' })
    const vb = calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO)
    expect(vb.valorFinal).toBeCloseTo(3733.72, 4)
  })

  it('un valor acordado más alto se toma como base y también recibe los adicionales', () => {
    const emp = empleada({ valorAcordado: 5000, fechaIngreso: '2026-08-01' })
    const vb = calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO)
    expect(vb.usaValorAcordado).toBe(true)
    expect(vb.valorFinal).toBeCloseTo(5000 * 1.31, 4)
  })

  it('un valor acordado "final" se usa tal cual', () => {
    const emp = empleada({ valorAcordado: 6000, valorAcordadoEsFinal: true })
    const vb = calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO)
    expect(vb.valorFinal).toBe(6000)
    expect(vb.montoZona).toBe(0)
  })

  it('detecta cuando se paga por debajo del mínimo legal', () => {
    const emp = empleada({ valorAcordado: 4000, valorAcordadoEsFinal: true, fechaIngreso: '2026-08-01' })
    const vb = calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO)
    expect(vb.minimoLegal).toBeCloseTo(3733.72 * 1.31, 4)
    expect(vb.porDebajoDelMinimo).toBe(true)
  })

  it('cuenta bien los años de antigüedad al cierre del período', () => {
    const emp = empleada({ fechaIngreso: '2020-09-15' })
    // Al 31/08/2026 todavía no cumplió el sexto año.
    expect(calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO).antiguedadAnios).toBe(5)
    expect(calcularValorBase(emp, escalaJulio, '2026-09', CONFIG_POR_DEFECTO).antiguedadAnios).toBe(6)
  })
})

describe('armado del mes por defecto', () => {
  it('marca como trabajados los días de la jornada y libres el resto', () => {
    const emp = empleada()
    const dias = generarDiasPorDefecto(emp, '2026-08', FERIADOS_TEST)
    expect(dias).toHaveLength(31)
    // 2026-08-03 es lunes
    expect(dias.find((d) => d.fecha === '2026-08-03')!.estado).toBe('trabajado')
    // 2026-08-04 es martes: no trabaja
    expect(dias.find((d) => d.fecha === '2026-08-04')!.estado).toBe('libre')
  })

  it('marca el feriado que cae en día habitual como pago sin trabajar', () => {
    const emp = empleada()
    const dias = generarDiasPorDefecto(emp, '2026-08', FERIADOS_TEST)
    // 17/08/2026 (San Martín) es lunes, día habitual
    expect(dias.find((d) => d.fecha === '2026-08-17')!.estado).toBe('feriado_pago')
  })

  it('el feriado que cae en día no habitual queda libre', () => {
    const emp = empleada({ jornada: [0, 0, 4, 0, 4, 0, 0] }) // martes y jueves
    const dias = generarDiasPorDefecto(emp, '2026-08', FERIADOS_TEST)
    expect(dias.find((d) => d.fecha === '2026-08-17')!.estado).toBe('libre')
  })
})

describe('liquidación por hora', () => {
  it('suma las horas del mes al valor con zona y antigüedad', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' }) // sin antigüedad
    const r = correr(emp, liquidacion(emp, '2026-08'))
    const vh = 3733.72 * 1.31

    // Agosto 2026: lunes 3,10,17,24,31 / miércoles 5,12,19,26 / viernes 7,14,21,28
    // El lunes 17 es feriado -> pago sin trabajar.
    expect(r.dias.trabajados).toBe(12)
    expect(r.dias.feriadosPagos).toBe(1)
    expect(r.horas.normales).toBe(48)
    expect(r.horas.pagasSinTrabajar).toBe(4)
    expect(r.total).toBeCloseTo(52 * vh, 2)
  })

  it('paga doble el feriado trabajado', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' })
    const liq = liquidacion(emp, '2026-08')
    const dia = liq.dias.find((d) => d.fecha === '2026-08-17')!
    dia.estado = 'feriado_trabajado'
    const r = correr(emp, liq)
    const vh = 3733.72 * 1.31

    expect(r.horas.feriadoTrabajado).toBe(4)
    expect(r.horas.pagasSinTrabajar).toBe(0)
    // 48 horas normales + 4 horas de feriado pagas al doble
    expect(r.total).toBeCloseTo(48 * vh + 4 * vh * 2, 2)
  })

  it('no paga el día que faltó sin justificar', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' })
    const liq = liquidacion(emp, '2026-08')
    liq.dias.find((d) => d.fecha === '2026-08-05')!.estado = 'ausente'
    const r = correr(emp, liq)
    const vh = 3733.72 * 1.31

    expect(r.dias.ausentes).toBe(1)
    expect(r.horas.normales).toBe(44)
    expect(r.total).toBeCloseTo(48 * vh, 2) // 44 trabajadas + 4 del feriado
  })

  it('paga el día de licencia justificada', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' })
    const liq = liquidacion(emp, '2026-08')
    liq.dias.find((d) => d.fecha === '2026-08-05')!.estado = 'ausente_pago'
    const r = correr(emp, liq)
    const vh = 3733.72 * 1.31
    expect(r.total).toBeCloseTo(52 * vh, 2)
  })

  it('respeta las horas cargadas a mano cuando trabajó de más o de menos', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' })
    const liq = liquidacion(emp, '2026-08')
    liq.dias.find((d) => d.fecha === '2026-08-03')!.horas = 6
    const r = correr(emp, liq)
    expect(r.horas.normales).toBe(50)
  })

  it('liquida horas extra al 50 y al 100', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' })
    const liq = liquidacion(emp, '2026-08')
    liq.dias.find((d) => d.fecha === '2026-08-03')!.extra50 = 2
    liq.dias.find((d) => d.fecha === '2026-08-05')!.extra100 = 1
    const r = correr(emp, liq)
    const vh = 3733.72 * 1.31
    expect(r.total).toBeCloseTo(52 * vh + 2 * vh * 1.5 + 1 * vh * 2, 2)
  })

  it('suma los adicionales fijos', () => {
    const emp = empleada({
      fechaIngreso: '2026-08-01',
      adicionales: [
        { id: 'a1', concepto: 'Plus por dos chicos', monto: 30000, remunerativo: true },
        { id: 'a2', concepto: 'Viáticos', monto: 15000, remunerativo: false },
      ],
    })
    const r = correr(emp, liquidacion(emp, '2026-08'))
    const vh = 3733.72 * 1.31
    expect(r.total).toBeCloseTo(52 * vh + 45000, 2)
  })

  it('aplica adelantos y descuentos del mes', () => {
    const emp = empleada({ fechaIngreso: '2026-08-01' })
    const liq = liquidacion(emp, '2026-08', {
      ajustes: [{ id: 'x', concepto: 'Adelanto', monto: -50000 }],
    })
    const r = correr(emp, liq)
    const vh = 3733.72 * 1.31
    expect(r.total).toBeCloseTo(52 * vh - 50000, 2)
  })
})

describe('liquidación mensualizada', () => {
  const mensual = () =>
    empleada({
      categoria: 'cuidado',
      formaPago: 'mes',
      jornada: [0, 8, 8, 8, 8, 8, 0], // 40 hs semanales
      fechaIngreso: '2026-08-01',
    })

  it('paga el sueldo de la escala con zona desfavorable', () => {
    const emp = mensual()
    const r = correr(emp, liquidacion(emp, '2026-08'))
    expect(r.total).toBeCloseTo(505302.76 * 1.31, 2)
  })

  it('suma un día extra por feriado trabajado', () => {
    const emp = mensual()
    const liq = liquidacion(emp, '2026-08')
    liq.dias.find((d) => d.fecha === '2026-08-17')!.estado = 'feriado_trabajado'
    const r = correr(emp, liq)
    const sueldo = 505302.76 * 1.31
    expect(r.total).toBeCloseTo(sueldo + sueldo / 25, 2)
  })

  it('descuenta el día que faltó usando el mes de 30 días', () => {
    const emp = mensual()
    const liq = liquidacion(emp, '2026-08')
    liq.dias.find((d) => d.fecha === '2026-08-04')!.estado = 'ausente'
    const r = correr(emp, liq)
    const sueldo = 505302.76 * 1.31
    expect(r.total).toBeCloseTo(sueldo - sueldo / 30, 2)
  })

  it('calcula el valor hora equivalente con las horas reales del mes', () => {
    const emp = mensual()
    const r = correr(emp, liquidacion(emp, '2026-08'))
    // Agosto 2026 tiene 21 días hábiles de lunes a viernes → 168 hs
    expect(r.horasMensualesHabituales).toBe(168)
    expect(r.valorHoraEfectivo).toBeCloseTo((505302.76 * 1.31) / 168, 4)
  })
})

describe('aguinaldo', () => {
  it('es la mitad de la mejor remuneración del semestre', () => {
    const emp = empleada({ fechaIngreso: '2020-01-01' })
    expect(calcularSac(emp, '2026-12', [300000, 420000], 400000)).toBeCloseTo(210000, 2)
  })

  it('se prorratea si entró con el semestre empezado', () => {
    const emp = empleada({ fechaIngreso: '2026-10-01' })
    // Del 1/10 al 31/12 son 92 días sobre 184 del semestre.
    expect(calcularSac(emp, '2026-12', [], 400000)).toBeCloseTo(200000 * (92 / 184), 2)
  })

  it('se incluye en el total cuando corresponde', () => {
    const emp = empleada({ fechaIngreso: '2020-01-01' })
    const liq = liquidacion(emp, '2026-12', { incluirSac: true })
    const r = correr(emp, liq)
    expect(r.sac).toBeCloseTo(r.remuneracionBruta / 2, 2)
    expect(r.total).toBeCloseTo(r.remuneracionBruta * 1.5, 2)
  })

  it('un importe cargado a mano pisa el cálculo automático', () => {
    const emp = empleada({ fechaIngreso: '2020-01-01' })
    const liq = liquidacion(emp, '2026-12', { incluirSac: true, sacManual: 123456 })
    expect(correr(emp, liq).sac).toBe(123456)
  })
})

describe('vacaciones', () => {
  it('asigna los días según la antigüedad', () => {
    expect(diasDeVacaciones(2)).toBe(14)
    expect(diasDeVacaciones(5)).toBe(21)
    expect(diasDeVacaciones(12)).toBe(28)
    expect(diasDeVacaciones(25)).toBe(35)
  })

  it('paga sueldo sobre 25 por día en mensualizadas', () => {
    const emp = empleada({ formaPago: 'mes', categoria: 'cuidado', fechaIngreso: '2026-01-01' })
    const vb = calcularValorBase(emp, escalaJulio, '2026-08', CONFIG_POR_DEFECTO)
    expect(calcularVacaciones(emp, vb, 14)).toBeCloseTo((vb.valorFinal / 25) * 14, 2)
  })
})

describe('advertencias', () => {
  it('avisa si cobra por hora trabajando 24 hs semanales o más', () => {
    const emp = empleada({ jornada: [0, 5, 5, 5, 5, 5, 0] })
    const r = correr(emp, liquidacion(emp, '2026-08'))
    expect(r.advertencias.some((a) => a.includes('sueldo mensual'))).toBe(true)
  })

  it('avisa si el valor queda por debajo del mínimo', () => {
    const emp = empleada({ valorAcordado: 2000, valorAcordadoEsFinal: true })
    const r = correr(emp, liquidacion(emp, '2026-08'))
    expect(r.advertencias.some((a) => a.includes('mínimo legal'))).toBe(true)
  })

  it('avisa cuando la escala cargada quedó vieja', () => {
    const emp = empleada()
    const r = correr(emp, liquidacion(emp, '2026-11'))
    expect(r.advertencias.some((a) => a.includes('ARCA'))).toBe(true)
  })

  it('avisa si el mes es anterior a la escala más vieja que hay cargada', () => {
    const emp = empleada({ fechaIngreso: '2024-01-01' })
    const r = correr(emp, liquidacion(emp, '2025-11'))
    expect(r.advertencias.some((a) => a.includes('todavía no regían'))).toBe(true)
  })

  it('avisa si el año no tiene feriados cargados', () => {
    const emp = empleada({ fechaIngreso: '2024-01-01' })
    const liq = liquidacion(emp, '2030-03')
    const r = calcularLiquidacion({
      empleada: emp,
      liquidacion: liq,
      escalas: ESCALAS_TEST,
      feriados: FERIADOS_TEST,
      tablasAportes: APORTES_TEST,
      config: CONFIG_POR_DEFECTO,
    })
    expect(r.advertencias.some((a) => a.includes('No hay feriados cargados para 2030'))).toBe(true)
  })

  it('no avisa nada raro en el caso normal', () => {
    const emp = empleada({ fechaIngreso: '2024-01-01' })
    const r = correr(emp, liquidacion(emp, '2026-08'))
    expect(r.advertencias).toEqual([])
  })
})

describe('aportes y contribuciones', () => {
  it('elige el tramo según las horas semanales', () => {
    const emp = empleada({ jornada: [0, 4, 0, 4, 0, 4, 0] }) // 12 hs
    expect(correr(emp, liquidacion(emp, '2026-08')).aportes!.tramo.total).toBe(15857.96)

    const emp2 = empleada({ jornada: [0, 8, 8, 8, 8, 8, 0] }) // 40 hs
    expect(correr(emp2, liquidacion(emp2, '2026-08')).aportes!.tramo.total).toBe(43082.7)

    const emp3 = empleada({ jornada: [0, 3, 0, 3, 0, 0, 0] }) // 6 hs
    expect(correr(emp3, liquidacion(emp3, '2026-08')).aportes!.tramo.total).toBe(10088.64)
  })
})

describe('caso real: la niñera y la de limpieza en Cipolletti', () => {
  it('liquida agosto 2026 completo', () => {
    // Niñera mensualizada, cuidado de personas, con retiro, 40 hs semanales.
    const ninera = empleada({
      id: 'n',
      nombre: 'Niñera',
      categoria: 'cuidado',
      formaPago: 'mes',
      jornada: [0, 8, 8, 8, 8, 8, 0],
      fechaIngreso: '2023-03-01',
    })
    const rn = correr(ninera, liquidacion(ninera, '2026-08'))
    const sueldoNinera = 505302.76 * (1 + 0.31 + 0.03) // 3 años de antigüedad
    expect(rn.total).toBeCloseTo(sueldoNinera, 2)
    expect(rn.aportes!.tramo.total).toBe(43082.7)

    // Empleada doméstica por hora, tareas generales, con retiro, 12 hs semanales.
    const domestica = empleada({
      id: 'd',
      nombre: 'Doméstica',
      categoria: 'generales',
      formaPago: 'hora',
      jornada: [0, 4, 0, 4, 0, 4, 0],
      fechaIngreso: '2025-06-10',
    })
    const rd = correr(domestica, liquidacion(domestica, '2026-08'))
    const vh = 3733.72 * (1 + 0.31 + 0.01) // 1 año de antigüedad
    expect(rd.total).toBeCloseTo(52 * vh, 2)
    expect(rd.aportes!.tramo.total).toBe(15857.96)
  })
})
