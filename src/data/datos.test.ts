import { describe, expect, it } from 'vitest'
import { CATEGORIAS, ESCALAS, ESCALAS_ACTUALIZADAS } from './escalas'
import { FERIADOS, FERIADOS_ACTUALIZADOS } from './feriados'
import { APORTES_ACTUALIZADOS, TABLAS_APORTES } from './aportes'
import type { CategoriaId } from '../domain/types'

/**
 * Red de seguridad del actualizador automático.
 *
 * El workflow de GitHub corre estos tests ANTES de commitear lo que bajó de
 * ARCA. Si el PDF cambia de formato y el parser saca cualquier cosa, esto se
 * pone en rojo y no se publica nada roto.
 */

const CLAVES: CategoriaId[] = CATEGORIAS.map((c) => c.id)
const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/
const RE_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

describe('escalas.json', () => {
  it('tiene escalas y un sello de actualización válido', () => {
    expect(ESCALAS.length).toBeGreaterThan(0)
    expect(ESCALAS_ACTUALIZADAS).toMatch(RE_FECHA)
  })

  it('viene ordenado de más nuevo a más viejo, sin períodos repetidos', () => {
    const periodos = ESCALAS.map((e) => e.vigenciaDesde)
    expect(periodos).toEqual([...periodos].sort().reverse())
    expect(new Set(periodos).size).toBe(periodos.length)
  })

  it.each(ESCALAS.map((e) => [e.vigenciaDesde, e] as const))(
    'la escala %s está bien formada',
    (_periodo, escala) => {
      expect(escala.vigenciaDesde).toMatch(RE_PERIODO)
      expect(escala.etiqueta).toBeTruthy()
      expect(escala.zonaDesfavorablePct).toBeGreaterThan(0)
      expect(escala.zonaDesfavorablePct).toBeLessThan(100)

      for (const clave of CLAVES) {
        const v = escala.valores[clave]
        expect(v, `falta la categoría ${clave}`).toBeDefined()

        // Caseros existe sólo sin retiro.
        if (clave === 'caseros') {
          expect(v.horaConRetiro).toBeNull()
          expect(v.mesConRetiro).toBeNull()
        } else {
          expect(v.horaConRetiro).toBeGreaterThan(0)
          expect(v.mesConRetiro).toBeGreaterThan(0)
        }
        expect(v.horaSinRetiro).toBeGreaterThan(0)
        expect(v.mesSinRetiro).toBeGreaterThan(0)

        // El mes siempre es bastante más que la hora: si se mezclaron las
        // columnas del PDF, esto lo caza.
        expect(v.mesSinRetiro!).toBeGreaterThan(v.horaSinRetiro! * 20)
        // Sin retiro siempre paga más que con retiro.
        if (v.horaConRetiro !== null) {
          expect(v.horaSinRetiro!).toBeGreaterThanOrEqual(v.horaConRetiro)
        }
      }

      // Tareas generales con retiro es el piso de toda la escala.
      const piso = escala.valores.generales.horaConRetiro!
      for (const clave of CLAVES) {
        const h = escala.valores[clave].horaConRetiro
        if (h !== null) expect(h).toBeGreaterThanOrEqual(piso)
      }
    },
  )

  it('los mínimos nunca bajan de un mes al siguiente', () => {
    const viejaANueva = [...ESCALAS].reverse()
    for (let i = 1; i < viejaANueva.length; i++) {
      const previa = viejaANueva[i - 1]
      const actual = viejaANueva[i]
      for (const clave of CLAVES) {
        const a = previa.valores[clave].horaSinRetiro!
        const b = actual.valores[clave].horaSinRetiro!
        expect(
          b,
          `${clave} bajó de ${previa.vigenciaDesde} (${a}) a ${actual.vigenciaDesde} (${b})`,
        ).toBeGreaterThanOrEqual(a)
      }
    }
  })
})

describe('feriados.json', () => {
  it('tiene feriados y un sello de actualización válido', () => {
    expect(FERIADOS.length).toBeGreaterThan(0)
    expect(FERIADOS_ACTUALIZADOS).toMatch(RE_FECHA)
  })

  it('todas las fechas son válidas, únicas y ordenadas', () => {
    const fechas = FERIADOS.map((f) => f.fecha)
    expect(fechas).toEqual([...fechas].sort())
    expect(new Set(fechas).size).toBe(fechas.length)
    for (const f of FERIADOS) {
      expect(f.fecha).toMatch(RE_FECHA)
      // La fecha existe de verdad (no un 31 de febrero).
      expect(new Date(`${f.fecha}T00:00:00Z`).toISOString().slice(0, 10)).toBe(f.fecha)
      expect(f.nombre).toBeTruthy()
      expect(['inamovible', 'trasladable', 'turistico', 'no_laborable']).toContain(f.tipo)
    }
  })

  it('cada año cargado tiene una cantidad razonable de feriados', () => {
    const porAnio = new Map<string, number>()
    for (const f of FERIADOS) {
      const a = f.fecha.slice(0, 4)
      porAnio.set(a, (porAnio.get(a) ?? 0) + 1)
    }
    for (const [anio, cantidad] of porAnio) {
      expect(cantidad, `${anio} tiene ${cantidad} feriados`).toBeGreaterThanOrEqual(12)
      expect(cantidad, `${anio} tiene ${cantidad} feriados`).toBeLessThanOrEqual(25)
    }
  })

  it('están los feriados que no pueden faltar', () => {
    const anios = [...new Set(FERIADOS.map((f) => f.fecha.slice(0, 4)))]
    for (const a of anios) {
      const delAnio = FERIADOS.filter((f) => f.fecha.startsWith(a)).map((f) => f.fecha)
      expect(delAnio, `falta Año Nuevo en ${a}`).toContain(`${a}-01-01`)
      expect(delAnio, `falta el 1 de mayo en ${a}`).toContain(`${a}-05-01`)
      expect(delAnio, `falta el 9 de julio en ${a}`).toContain(`${a}-07-09`)
      expect(delAnio, `falta Navidad en ${a}`).toContain(`${a}-12-25`)
    }
  })
})

describe('aportes.json', () => {
  it('tiene tablas y un sello de actualización válido', () => {
    expect(TABLAS_APORTES.length).toBeGreaterThan(0)
    expect(APORTES_ACTUALIZADOS).toMatch(RE_FECHA)
  })

  it.each(TABLAS_APORTES.map((t) => [t.vigenciaDesde, t] as const))(
    'la tabla %s cierra y cubre todos los tramos',
    (_periodo, tabla) => {
      expect(tabla.vigenciaDesde).toMatch(RE_PERIODO)
      expect(tabla.tramos).toHaveLength(3)

      for (const tr of tabla.tramos) {
        expect(tr.total).toBeGreaterThan(0)
        // Los tres conceptos tienen que sumar el total.
        expect(tr.obraSocial + tr.art + tr.sipa).toBeCloseTo(tr.total, 1)
      }

      // Los tramos arrancan en 0, encadenan sin huecos y el último no tiene tope.
      expect(tabla.tramos[0].desdeHoras).toBe(0)
      expect(tabla.tramos[0].hastaHoras).toBe(tabla.tramos[1].desdeHoras)
      expect(tabla.tramos[1].hastaHoras).toBe(tabla.tramos[2].desdeHoras)
      expect(tabla.tramos[2].hastaHoras).toBeNull()

      // A más horas, más se paga.
      expect(tabla.tramos[1].total).toBeGreaterThan(tabla.tramos[0].total)
      expect(tabla.tramos[2].total).toBeGreaterThan(tabla.tramos[1].total)
    },
  )
})

describe('coherencia entre archivos', () => {
  it('hay una escala vigente para cada mes desde que arrancan los datos', () => {
    const primera = [...ESCALAS].reverse()[0].vigenciaDesde
    const ultima = ESCALAS[0].vigenciaDesde
    const [a1, m1] = primera.split('-').map(Number)
    const [a2, m2] = ultima.split('-').map(Number)
    const esperados = a2 * 12 + m2 - (a1 * 12 + m1) + 1
    expect(ESCALAS.length).toBe(esperados)
  })
})
