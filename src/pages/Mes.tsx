import { useStore } from '../store/store'
import { calcularLiquidacion } from '../domain/calculo'
import { CATEGORIA_POR_ID } from '../data/escalas'
import { Avatar, IconoCalendario, IconoDer, IconoIzq, Vacio } from '../components/ui'
import { pesos } from '../lib/format'
import { nombrePeriodo, periodoOffset } from '../lib/fechas'

export function Mes({
  periodo,
  onCambiarPeriodo,
  onAbrir,
  onIrAEmpleadas,
}: {
  periodo: string
  onCambiarPeriodo: (p: string) => void
  onAbrir: (empleadaId: string) => void
  onIrAEmpleadas: () => void
}) {
  const store = useStore()
  const { empleadas, escalas, feriados, tablasAportes, config, obtenerLiquidacion } = store

  const filas = empleadas.map((empleada) => {
    const liquidacion = obtenerLiquidacion(empleada.id, periodo)
    const r = calcularLiquidacion({
      empleada,
      liquidacion,
      escalas,
      feriados,
      tablasAportes,
      config,
    })
    return { empleada, liquidacion, r }
  })

  const totalSueldos = filas.reduce((a, f) => a + f.r.totalRedondeado, 0)
  const totalAportes = filas.reduce((a, f) => a + (f.r.aportes?.tramo.total ?? 0), 0)
  const hayAdvertencias = filas.some((f) => f.r.advertencias.length > 0)

  return (
    <div className="contenido">
      <div className="periodo">
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

      {empleadas.length === 0 ? (
        <div className="tarjeta">
          <Vacio
            icono={<IconoCalendario />}
            titulo="Todavía no cargaste a nadie"
            texto="Empezá dando de alta a la niñera y a la empleada, con su categoría y sus días."
            accion={
              <button className="btn btn-primario" onClick={onIrAEmpleadas}>
                Cargar la primera
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="tarjeta">
            <div className="total">
              <div>
                <div className="total-label">Total del mes</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                  {filas.length} {filas.length === 1 ? 'persona' : 'personas'}
                </div>
              </div>
              <div className="total-monto">{pesos(totalSueldos)}</div>
            </div>
            <div>
              {filas.map(({ empleada, liquidacion, r }) => (
                <button key={empleada.id} className="item" onClick={() => onAbrir(empleada.id)}>
                  <Avatar nombre={empleada.nombre} color={empleada.color} />
                  <div className="item-texto">
                    <div className="item-titulo">
                      {empleada.nombre || 'Sin nombre'}{' '}
                      {liquidacion.pagada && <span className="chip chip-ok">Pagado</span>}
                    </div>
                    <div className="item-sub">
                      {CATEGORIA_POR_ID[empleada.categoria].nombre} ·{' '}
                      {r.dias.trabajados + r.dias.feriadosTrabajados} días
                      {r.dias.ausentes > 0 && ` · ${r.dias.ausentes} falta${r.dias.ausentes > 1 ? 's' : ''}`}
                      {r.advertencias.length > 0 && ' · ⚠️'}
                    </div>
                  </div>
                  <span className="item-monto">{pesos(r.totalRedondeado)}</span>
                </button>
              ))}
            </div>
          </div>

          {totalAportes > 0 && (
            <div className="tarjeta">
              <div className="tarjeta-cuerpo">
                <div className="concepto" style={{ padding: 0 }}>
                  <div className="concepto-texto">
                    <div className="concepto-label">Aportes en ARCA (F.102)</div>
                    <div className="concepto-detalle">
                      Se paga aparte del sueldo, al mes siguiente
                    </div>
                  </div>
                  <span className="concepto-monto">{pesos(totalAportes)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="tarjeta">
            <div className="tarjeta-cuerpo">
              <div className="concepto" style={{ padding: 0, borderBottom: 'none' }}>
                <div className="concepto-texto">
                  <div className="concepto-label" style={{ fontWeight: 700 }}>
                    Sale del bolsillo en total
                  </div>
                  <div className="concepto-detalle">Sueldos + aportes</div>
                </div>
                <span className="concepto-monto" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {pesos(totalSueldos + totalAportes)}
                </span>
              </div>
            </div>
          </div>

          {hayAdvertencias && (
            <p className="texto-mini" style={{ textAlign: 'center' }}>
              ⚠️ Hay avisos en alguna liquidación. Entrá para verlos.
            </p>
          )}
        </>
      )}
    </div>
  )
}
