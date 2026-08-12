import { useMemo, useState } from 'react'
import { useStore, nuevoId } from '../store/store'
import {
  calcularLiquidacion,
  calcularVacaciones,
  calcularValorBase,
  diasDeVacaciones,
  generarDiasPorDefecto,
  periodoPagaSac,
  sincronizarDias,
} from '../domain/calculo'
import { escalaParaPeriodo, CATEGORIA_POR_ID } from '../data/escalas'
import { Calendario } from '../components/Calendario'
import {
  Aviso,
  CampoMonto,
  Hoja,
  IconoCheck,
  IconoCompartir,
  IconoDer,
  IconoIzq,
  IconoMas,
  IconoTacho,
  Monto,
  Switch,
} from '../components/ui'
import { horas as fmtHoras, num, pesos } from '../lib/format'
import { nombrePeriodo, periodoOffset } from '../lib/fechas'
import type { Empleada, Liquidacion } from '../domain/types'

export function DetalleLiquidacion({
  empleada,
  periodo,
  onCambiarPeriodo,
}: {
  empleada: Empleada
  periodo: string
  onCambiarPeriodo: (p: string) => void
}) {
  const store = useStore()
  const {
    escalas,
    feriados,
    tablasAportes,
    config,
    liquidaciones,
    obtenerLiquidacion,
    guardarLiquidacion,
  } = store

  const [hojaVacaciones, setHojaVacaciones] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const liq = obtenerLiquidacion(empleada.id, periodo)

  const remuneracionesDelSemestre = useMemo(() => {
    const anio = periodo.slice(0, 4)
    const primerSemestre = periodo.slice(5, 7) === '06'
    const meses = primerSemestre
      ? ['01', '02', '03', '04', '05']
      : ['07', '08', '09', '10', '11']
    return liquidaciones
      .filter(
        (l) =>
          l.empleadaId === empleada.id &&
          l.periodo.startsWith(anio) &&
          meses.includes(l.periodo.slice(5, 7)),
      )
      .map(
        (l) =>
          calcularLiquidacion({
            empleada,
            liquidacion: { ...l, incluirSac: false, ajustes: [] },
            escalas,
            feriados,
            tablasAportes,
            config,
          }).remuneracionBruta,
      )
  }, [liquidaciones, empleada, periodo, escalas, feriados, tablasAportes, config])

  const r = calcularLiquidacion({
    empleada,
    liquidacion: liq,
    escalas,
    feriados,
    tablasAportes,
    config,
    remuneracionesDelSemestre,
  })

  const dias = sincronizarDias(empleada, periodo, feriados, liq.dias)
  const actualizar = (cambios: Partial<Liquidacion>) =>
    guardarLiquidacion({ ...liq, dias, ...cambios })

  const categoria = CATEGORIA_POR_ID[empleada.categoria]

  const textoParaCompartir = armarTexto(empleada, r, periodo)
  const compartir = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: textoParaCompartir })
        return
      } catch {
        // El usuario canceló: caemos al portapapeles.
      }
    }
    try {
      await navigator.clipboard.writeText(textoParaCompartir)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2200)
    } catch {
      /* nada que hacer */
    }
  }

  return (
    <div className="contenido">
      <div className="solo-imprimir">
        <h1>{empleada.nombre || 'Sin nombre'}</h1>
        <p className="texto-mini">
          {categoria.nombre} ·{' '}
          {empleada.modalidad === 'con_retiro' ? 'Con retiro' : 'Sin retiro'} ·{' '}
          {nombrePeriodo(periodo)}
        </p>
      </div>

      <div className="periodo no-imprimir">
        <button
          className="btn-icono"
          onClick={() => onCambiarPeriodo(periodoOffset(periodo, -1))}
          aria-label="Mes anterior"
        >
          <IconoIzq />
        </button>
        <span className="periodo-label">{nombrePeriodo(periodo)}</span>
        <button
          className="btn-icono"
          onClick={() => onCambiarPeriodo(periodoOffset(periodo, 1))}
          aria-label="Mes siguiente"
        >
          <IconoDer />
        </button>
      </div>

      {r.advertencias.map((a) => (
        <Aviso key={a}>{a}</Aviso>
      ))}

      {/* -------- Total -------- */}
      <div className="tarjeta">
        <div className="total">
          <div>
            <div className="total-label">Total a pagar</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{nombrePeriodo(periodo)}</div>
          </div>
          <div className="total-monto">{pesos(r.totalRedondeado)}</div>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="resumen-grilla">
            <div className="resumen-item">
              <div className="resumen-valor">{num(r.dias.trabajados + r.dias.feriadosTrabajados)}</div>
              <div className="resumen-label">Días que vino</div>
            </div>
            <div className="resumen-item">
              <div className="resumen-valor">{num(r.horas.totalTrabajadas)}</div>
              <div className="resumen-label">Horas trabajadas</div>
            </div>
            <div className="resumen-item">
              <div className="resumen-valor">
                {num(r.dias.feriadosTrabajados + r.dias.feriadosPagos)}
              </div>
              <div className="resumen-label">Feriados</div>
            </div>
            <div className="resumen-item">
              <div className="resumen-valor">{num(r.dias.ausentes)}</div>
              <div className="resumen-label">Faltas</div>
            </div>
          </div>

          <div className="acciones no-imprimir">
            <button className="btn btn-primario" onClick={compartir}>
              {copiado ? <IconoCheck /> : <IconoCompartir />}
              {copiado ? 'Copiado' : 'Compartir'}
            </button>
            <button className="btn" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>

          <Switch
            label="Ya se lo pagué"
            checked={liq.pagada}
            onChange={(v) =>
              actualizar({ pagada: v, fechaPago: v ? new Date().toISOString().slice(0, 10) : null })
            }
          />
        </div>
      </div>

      {/* -------- Calendario -------- */}
      <div className="tarjeta no-imprimir">
        <div className="tarjeta-titulo">
          <h2>¿Qué días vino?</h2>
          <button
            className="btn btn-chico btn-suave"
            onClick={() => actualizar({ dias: generarDiasPorDefecto(empleada, periodo, feriados) })}
          >
            Reiniciar
          </button>
        </div>
        <div className="tarjeta-cuerpo">
          <p className="texto-mini">
            Arranca con los días que trabaja habitualmente. Tocá un día para marcar que faltó, que
            vino en un feriado o para cargarle horas extra.
          </p>
          <Calendario
            empleada={empleada}
            dias={dias}
            feriados={feriados}
            onCambiar={(nuevos) => guardarLiquidacion({ ...liq, dias: nuevos })}
          />
        </div>
      </div>

      {/* -------- Detalle del cálculo -------- */}
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Cómo se llega a ese número</h2>
        </div>
        <div className="tarjeta-cuerpo">
          <DetalleValorHora empleada={empleada} resultado={r} />

          <div>
            {r.conceptos.map((c) => (
              <div className="concepto" key={c.id}>
                <div className="concepto-texto">
                  <div className="concepto-label">{c.label}</div>
                  {c.detalle && <div className="concepto-detalle">{c.detalle}</div>}
                </div>
                <Monto valor={c.monto} />
              </div>
            ))}
            <div className="concepto" style={{ borderTop: '2px solid var(--border-fuerte)', paddingTop: 12 }}>
              <div className="concepto-texto">
                <div className="concepto-label" style={{ fontWeight: 700 }}>
                  Total
                </div>
                {config.redondeoTotal > 0 && r.totalRedondeado !== r.total && (
                  <div className="concepto-detalle">
                    Redondeado desde {pesos(r.total)}
                  </div>
                )}
              </div>
              <span className="concepto-monto" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                {pesos(r.totalRedondeado)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* -------- Ajustes del mes -------- */}
      <div className="tarjeta no-imprimir">
        <div className="tarjeta-titulo">
          <h2>Adelantos y extras del mes</h2>
          <button
            className="btn btn-chico btn-suave"
            onClick={() =>
              actualizar({
                ajustes: [...liq.ajustes, { id: nuevoId(), concepto: '', monto: 0 }],
              })
            }
          >
            <IconoMas /> Agregar
          </button>
        </div>
        <div className="tarjeta-cuerpo">
          {liq.ajustes.length === 0 && (
            <p className="texto-mini">
              Sirve para adelantos que ya le diste (con signo negativo), un premio, o el pago de
              vacaciones.
            </p>
          )}
          {liq.ajustes.map((aj) => (
            <div key={aj.id} className="fila">
              <div className="campo" style={{ flex: 1.6 }}>
                <label>Concepto</label>
                <input
                  type="text"
                  value={aj.concepto}
                  placeholder="Adelanto, premio…"
                  onChange={(e) =>
                    actualizar({
                      ajustes: liq.ajustes.map((x) =>
                        x.id === aj.id ? { ...x, concepto: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
              <CampoMonto
                label="Monto"
                valor={aj.monto}
                onChange={(n) =>
                  actualizar({
                    ajustes: liq.ajustes.map((x) => (x.id === aj.id ? { ...x, monto: n } : x)),
                  })
                }
              />
              <button
                className="btn-icono"
                style={{ flex: '0 0 auto', color: 'var(--error)' }}
                aria-label="Borrar"
                onClick={() =>
                  actualizar({ ajustes: liq.ajustes.filter((x) => x.id !== aj.id) })
                }
              >
                <IconoTacho />
              </button>
            </div>
          ))}

          <button className="btn btn-suave btn-bloque" onClick={() => setHojaVacaciones(true)}>
            Calcular vacaciones
          </button>
        </div>
      </div>

      {/* -------- Aguinaldo -------- */}
      <div className="tarjeta no-imprimir">
        <div className="tarjeta-cuerpo">
          <Switch
            label="Incluir aguinaldo (SAC)"
            ayuda={
              periodoPagaSac(periodo)
                ? 'El aguinaldo se paga con el sueldo de junio y de diciembre.'
                : 'Normalmente el aguinaldo va en junio y en diciembre.'
            }
            checked={liq.incluirSac}
            onChange={(v) => actualizar({ incluirSac: v })}
          />
          {liq.incluirSac && (
            <>
              <CampoMonto
                label="Importe del aguinaldo"
                ayuda="Dejalo en cero para que lo calcule solo: la mitad de la mejor remuneración del semestre."
                valor={liq.sacManual ?? 0}
                placeholder={String(Math.round(r.sac))}
                onChange={(n) => actualizar({ sacManual: n > 0 ? n : null })}
              />
              <p className="texto-mini">Calculado automáticamente: {pesos(r.sac)}</p>
            </>
          )}
        </div>
      </div>

      {/* -------- Aportes ARCA -------- */}
      {r.aportes && (
        <div className="tarjeta">
          <div className="tarjeta-titulo">
            <h2>Aparte: aportes en ARCA</h2>
          </div>
          <div className="tarjeta-cuerpo">
            <div className="concepto">
              <div className="concepto-texto">
                <div className="concepto-label">{r.aportes.tramo.etiqueta}</div>
                <div className="concepto-detalle">
                  Trabaja {fmtHoras(r.horasSemanales)} por semana · {r.aportes.tabla.etiqueta}
                </div>
              </div>
              <Monto valor={r.aportes.tramo.total} />
            </div>
            <p className="texto-mini">
              Esto no es parte del sueldo: es el F.102/RT que se paga todos los meses en ARCA
              (obra social {pesos(r.aportes.tramo.obraSocial)} + ART {pesos(r.aportes.tramo.art)} +
              jubilación {pesos(r.aportes.tramo.sipa)}).
            </p>
          </div>
        </div>
      )}

      {/* -------- Notas -------- */}
      <div className="tarjeta no-imprimir">
        <div className="tarjeta-cuerpo">
          <div className="campo">
            <label>Notas del mes</label>
            <textarea
              value={liq.notas}
              placeholder="Lo que quieras acordarte…"
              onChange={(e) => actualizar({ notas: e.target.value })}
            />
          </div>
        </div>
      </div>

      {hojaVacaciones && (
        <HojaVacaciones
          empleada={empleada}
          periodo={periodo}
          onCerrar={() => setHojaVacaciones(false)}
          onAgregar={(monto, dias) => {
            actualizar({
              ajustes: [
                ...liq.ajustes,
                { id: nuevoId(), concepto: `Vacaciones (${dias} días)`, monto },
              ],
            })
            setHojaVacaciones(false)
          }}
        />
      )}
    </div>
  )
}

function DetalleValorHora({
  empleada,
  resultado,
}: {
  empleada: Empleada
  resultado: ReturnType<typeof calcularLiquidacion>
}) {
  const vb = resultado.valorBase
  const unidad = empleada.formaPago === 'hora' ? 'la hora' : 'por mes'

  if (vb.valorAcordadoEsFinal) {
    return (
      <div className="aviso aviso-info">
        <div>
          Estás usando un valor cerrado de <strong>{pesos(vb.valorFinal)}</strong> {unidad}, que ya
          incluye todo. El mínimo legal con zona y antigüedad es {pesos(vb.minimoLegal)}.
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radio-sm)', padding: '11px 12px' }}>
      <div className="seccion-label" style={{ marginBottom: 6 }}>
        Valor {unidad}
      </div>
      <div className="concepto" style={{ padding: '5px 0' }}>
        <div className="concepto-texto">
          <div className="concepto-label">
            {vb.usaValorAcordado ? 'Valor acordado' : `Mínimo ${resultado.escala.etiqueta}`}
          </div>
          {vb.usaValorAcordado && (
            <div className="concepto-detalle">
              Mínimo de escala: {pesos(vb.minimoEscala)}
            </div>
          )}
        </div>
        <Monto valor={vb.base} />
      </div>
      {vb.zonaPct > 0 && (
        <div className="concepto" style={{ padding: '5px 0' }}>
          <div className="concepto-texto">
            <div className="concepto-label">Zona desfavorable {vb.zonaPct}%</div>
            <div className="concepto-detalle">Patagonia — Río Negro</div>
          </div>
          <Monto valor={vb.montoZona} />
        </div>
      )}
      {vb.antiguedadPct > 0 && (
        <div className="concepto" style={{ padding: '5px 0' }}>
          <div className="concepto-texto">
            <div className="concepto-label">Antigüedad {vb.antiguedadPct}%</div>
            <div className="concepto-detalle">
              {vb.antiguedadAnios} {vb.antiguedadAnios === 1 ? 'año' : 'años'} · 1% por año
            </div>
          </div>
          <Monto valor={vb.montoAntiguedad} />
        </div>
      )}
      <div className="concepto" style={{ padding: '7px 0 0', borderTop: '1px solid var(--border-fuerte)' }}>
        <div className="concepto-label" style={{ fontWeight: 700 }}>
          Valor final {unidad}
        </div>
        <span className="concepto-monto" style={{ fontWeight: 700 }}>
          {pesos(vb.valorFinal)}
        </span>
      </div>
    </div>
  )
}

function HojaVacaciones({
  empleada,
  periodo,
  onCerrar,
  onAgregar,
}: {
  empleada: Empleada
  periodo: string
  onCerrar: () => void
  onAgregar: (monto: number, dias: number) => void
}) {
  const { escalas, config } = useStore()
  const escala = escalaParaPeriodo(escalas, periodo)
  const vb = calcularValorBase(empleada, escala, periodo, config)
  const sugeridos = diasDeVacaciones(vb.antiguedadAnios)
  const [dias, setDias] = useState(sugeridos)
  const monto = calcularVacaciones(empleada, vb, dias)

  return (
    <Hoja titulo="Vacaciones" onCerrar={onCerrar}>
      <p className="texto-chico">
        Con {vb.antiguedadAnios} {vb.antiguedadAnios === 1 ? 'año' : 'años'} de antigüedad le
        corresponden <strong>{sugeridos} días corridos</strong>.
      </p>
      <CampoMonto label="Días de vacaciones" valor={dias} onChange={setDias} />
      <div className="tarjeta">
        <div className="total">
          <div className="total-label">A pagar por vacaciones</div>
          <div className="total-monto" style={{ fontSize: '1.2rem' }}>
            {pesos(monto)}
          </div>
        </div>
      </div>
      <p className="texto-mini">
        {empleada.formaPago === 'mes'
          ? 'Se calcula como sueldo ÷ 25 por cada día corrido de vacaciones.'
          : 'Se calcula con el jornal promedio de la semana por cada día corrido.'}
      </p>
      <button className="btn btn-primario btn-bloque" onClick={() => onAgregar(monto, dias)}>
        Agregar al mes
      </button>
    </Hoja>
  )
}

function armarTexto(
  empleada: Empleada,
  r: ReturnType<typeof calcularLiquidacion>,
  periodo: string,
): string {
  const lineas: string[] = []
  lineas.push(`*${empleada.nombre || 'Liquidación'} — ${nombrePeriodo(periodo)}*`)
  lineas.push('')
  for (const c of r.conceptos) {
    lineas.push(`${c.label}: ${pesos(c.monto)}`)
    if (c.detalle) lineas.push(`  (${c.detalle})`)
  }
  lineas.push('')
  lineas.push(`*TOTAL: ${pesos(r.totalRedondeado)}*`)
  return lineas.join('\n')
}
