import { useState } from 'react'
import { useStore } from '../store/store'
import {
  CATEGORIAS,
  ESCALAS_ACTUALIZADAS,
  PROVINCIAS_ZONA_DESFAVORABLE,
  escalaParaPeriodo,
} from '../data/escalas'
import { APORTES_ACTUALIZADOS, tablaAportesParaPeriodo } from '../data/aportes'
import { FERIADOS_ACTUALIZADOS, ULTIMO_ANIO_CON_FERIADOS } from '../data/feriados'
import {
  Aviso,
  CampoMonto,
  Hoja,
  IconoMas,
  IconoTacho,
  Segmentado,
} from '../components/ui'
import { pesos } from '../lib/format'
import { formatearFecha, nombrePeriodo, periodoOffset } from '../lib/fechas'
import type { CategoriaId, Escala, Feriado, TablaAportes } from '../domain/types'

type Pestania = 'escalas' | 'feriados' | 'aportes'

export function Datos({ periodo }: { periodo: string }) {
  const [pestania, setPestania] = useState<Pestania>('escalas')

  return (
    <div className="contenido">
      <Segmentado<Pestania>
        valor={pestania}
        onChange={setPestania}
        opciones={[
          { valor: 'escalas', label: 'Escalas' },
          { valor: 'feriados', label: 'Feriados' },
          { valor: 'aportes', label: 'Aportes' },
        ]}
      />
      {pestania === 'escalas' && <Escalas periodo={periodo} />}
      {pestania === 'feriados' && <Feriados periodo={periodo} />}
      {pestania === 'aportes' && <Aportes periodo={periodo} />}
    </div>
  )
}

/**
 * Muestra cuándo el robot trajo los datos por última vez. Si esto se queda
 * viejo, es la señal de que el workflow de GitHub dejó de correr.
 */
function SelloActualizacion({ fecha }: { fecha: string }) {
  if (!fecha) return null
  const dias = Math.floor((Date.now() - Date.parse(`${fecha}T12:00:00Z`)) / 86400000)
  const viejo = dias > 45
  return (
    <p className="texto-mini" style={{ textAlign: 'center' }}>
      {viejo ? '⚠️ ' : ''}
      Datos verificados el {formatearFecha(fecha)}
      {dias > 1 && ` · hace ${dias} días`}
    </p>
  )
}

/* ================= Escalas ================= */

function Escalas({ periodo }: { periodo: string }) {
  const { escalas, borrarEscala } = useStore()
  const [editando, setEditando] = useState<Escala | null>(null)
  const vigente = escalaParaPeriodo(escalas, periodo)

  const nueva = (): Escala => {
    const ultima = escalas[0]
    return {
      ...ultima,
      vigenciaDesde: periodoOffset(ultima.vigenciaDesde, 1),
      etiqueta: nombrePeriodo(periodoOffset(ultima.vigenciaDesde, 1)),
      fuente: 'Cargada a mano',
      propia: true,
      valores: JSON.parse(JSON.stringify(ultima.valores)),
    }
  }

  if (editando) {
    return <EditorEscala escala={editando} onCerrar={() => setEditando(null)} />
  }

  return (
    <>
      <Aviso tipo="info">
        Los valores se actualizan solos todos los días desde{' '}
        <a
          href="https://www.afip.gob.ar/casasparticulares/categorias-y-remuneraciones/"
          target="_blank"
          rel="noreferrer"
        >
          ARCA → Casas particulares
        </a>
        . Si alguna vez falla, podés cargar la escala a mano con "Nueva".
      </Aviso>

      <SelloActualizacion fecha={ESCALAS_ACTUALIZADAS} />

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <div>
            <h2>Vigente: {vigente.etiqueta}</h2>
            <span className="texto-mini">Zona desfavorable {vigente.zonaDesfavorablePct}%</span>
          </div>
          <button className="btn btn-chico btn-primario" onClick={() => setEditando(nueva())}>
            <IconoMas /> Nueva
          </button>
        </div>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Hora c/retiro</th>
                <th>Hora s/retiro</th>
                <th>Mes c/retiro</th>
                <th>Mes s/retiro</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIAS.map((c) => {
                const v = vigente.valores[c.id]
                return (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{v.horaConRetiro ? pesos(v.horaConRetiro) : '—'}</td>
                    <td>{v.horaSinRetiro ? pesos(v.horaSinRetiro) : '—'}</td>
                    <td>{v.mesConRetiro ? pesos(v.mesConRetiro) : '—'}</td>
                    <td>{v.mesSinRetiro ? pesos(v.mesSinRetiro) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Historial</h2>
        </div>
        <div>
          {escalas.map((e) => (
            <div key={e.vigenciaDesde} className="item">
              <div className="item-texto">
                <div className="item-titulo">
                  {e.etiqueta}{' '}
                  {e.vigenciaDesde === vigente.vigenciaDesde && (
                    <span className="chip chip-acento">Vigente</span>
                  )}
                  {e.propia && <span className="chip">Tuya</span>}
                </div>
                <div className="item-sub">
                  Desde {e.vigenciaDesde} · zona {e.zonaDesfavorablePct}% · {e.fuente ?? ''}
                </div>
              </div>
              <button className="btn btn-chico btn-suave" onClick={() => setEditando(e)}>
                Ver
              </button>
              {e.propia && (
                <button
                  className="btn-icono"
                  style={{ color: 'var(--error)' }}
                  aria-label="Borrar escala"
                  onClick={() => {
                    if (confirm(`¿Borrar la escala ${e.etiqueta}?`)) borrarEscala(e.vigenciaDesde)
                  }}
                >
                  <IconoTacho />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="texto-mini">
        Zona desfavorable: {PROVINCIAS_ZONA_DESFAVORABLE.join(', ')}.
      </p>
    </>
  )
}

function EditorEscala({ escala, onCerrar }: { escala: Escala; onCerrar: () => void }) {
  const { guardarEscala } = useStore()
  const [e, setE] = useState<Escala>(escala)

  const setValor = (cat: CategoriaId, campo: keyof Escala['valores'][CategoriaId], n: number) => {
    setE((prev) => ({
      ...prev,
      valores: { ...prev.valores, [cat]: { ...prev.valores[cat], [campo]: n > 0 ? n : null } },
    }))
  }

  return (
    <>
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>{e.propia ? 'Editar escala' : e.etiqueta}</h2>
          <button className="btn btn-chico btn-suave" onClick={onCerrar}>
            Volver
          </button>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="grilla-2">
            <div className="campo">
              <label htmlFor="vigencia">Rige desde</label>
              <input
                id="vigencia"
                type="month"
                value={e.vigenciaDesde}
                onChange={(ev) =>
                  setE({
                    ...e,
                    vigenciaDesde: ev.target.value,
                    etiqueta: nombrePeriodo(ev.target.value),
                  })
                }
              />
            </div>
            <CampoMonto
              label="Zona desfavorable %"
              valor={e.zonaDesfavorablePct}
              onChange={(n) => setE({ ...e, zonaDesfavorablePct: n })}
            />
          </div>

          {CATEGORIAS.map((c) => (
            <div key={c.id}>
              <div className="seccion-label" style={{ marginBottom: 6 }}>
                {c.nombre}
              </div>
              <div className="grilla-2">
                {!c.soloSinRetiro && (
                  <CampoMonto
                    label="Hora con retiro"
                    valor={e.valores[c.id].horaConRetiro ?? 0}
                    onChange={(n) => setValor(c.id, 'horaConRetiro', n)}
                  />
                )}
                <CampoMonto
                  label="Hora sin retiro"
                  valor={e.valores[c.id].horaSinRetiro ?? 0}
                  onChange={(n) => setValor(c.id, 'horaSinRetiro', n)}
                />
                {!c.soloSinRetiro && (
                  <CampoMonto
                    label="Mes con retiro"
                    valor={e.valores[c.id].mesConRetiro ?? 0}
                    onChange={(n) => setValor(c.id, 'mesConRetiro', n)}
                  />
                )}
                <CampoMonto
                  label="Mes sin retiro"
                  valor={e.valores[c.id].mesSinRetiro ?? 0}
                  onChange={(n) => setValor(c.id, 'mesSinRetiro', n)}
                />
              </div>
            </div>
          ))}

          <button
            className="btn btn-primario btn-bloque"
            onClick={() => {
              guardarEscala(e)
              onCerrar()
            }}
          >
            Guardar escala
          </button>
        </div>
      </div>
    </>
  )
}

/* ================= Feriados ================= */

function Feriados({ periodo }: { periodo: string }) {
  const { feriados, guardarFeriado, borrarFeriado } = useStore()
  const [anio, setAnio] = useState(periodo.slice(0, 4))
  const [agregando, setAgregando] = useState(false)

  // Incluyo el año del período aunque todavía no tenga feriados cargados, para
  // que se pueda entrar a agregarlos a mano.
  const anios = Array.from(
    new Set([...feriados.map((f) => f.fecha.slice(0, 4)), periodo.slice(0, 4), anio]),
  ).sort()
  const delAnio = feriados.filter((f) => f.fecha.startsWith(anio))

  return (
    <>
      <Aviso tipo="info">
        Los feriados que caen en un día que trabaja se pagan igual aunque no venga. Si viene, se
        paga doble. El calendario oficial está en{' '}
        <a href="https://www.argentina.gob.ar/interior/feriados" target="_blank" rel="noreferrer">
          argentina.gob.ar
        </a>
        , y se actualizan solos.
      </Aviso>

      {anio > ULTIMO_ANIO_CON_FERIADOS && (
        <Aviso>
          Todavía no salió el calendario de {anio}. Cargá los feriados a mano o esperá: se van a
          actualizar solos cuando se publique el decreto.
        </Aviso>
      )}

      <SelloActualizacion fecha={FERIADOS_ACTUALIZADOS} />

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <select value={anio} onChange={(e) => setAnio(e.target.value)} style={{ width: 'auto' }}>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button className="btn btn-chico btn-primario" onClick={() => setAgregando(true)}>
            <IconoMas /> Agregar
          </button>
        </div>
        <div>
          {delAnio.length === 0 && (
            <p className="texto-mini" style={{ padding: 16 }}>
              No hay feriados cargados para {anio}.
            </p>
          )}
          {delAnio.map((f) => (
            <div key={f.fecha} className="item">
              <div className="item-texto">
                <div className="item-titulo">{f.nombre}</div>
                <div className="item-sub">
                  {formatearFecha(f.fecha)} · {etiquetaTipo(f.tipo)}
                  {f.propio && ' · tuyo'}
                </div>
              </div>
              <button
                className="btn-icono"
                style={{ color: 'var(--error)' }}
                aria-label="Borrar feriado"
                onClick={() => borrarFeriado(f.fecha)}
              >
                <IconoTacho />
              </button>
            </div>
          ))}
        </div>
      </div>

      {agregando && (
        <NuevoFeriado
          anio={anio}
          onCerrar={() => setAgregando(false)}
          onGuardar={(f) => {
            guardarFeriado(f)
            setAgregando(false)
          }}
        />
      )}
    </>
  )
}

function etiquetaTipo(t: Feriado['tipo']) {
  return {
    inamovible: 'Inamovible',
    trasladable: 'Trasladable',
    turistico: 'Con fines turísticos',
    no_laborable: 'No laborable',
  }[t]
}

function NuevoFeriado({
  anio,
  onCerrar,
  onGuardar,
}: {
  anio: string
  onCerrar: () => void
  onGuardar: (f: Feriado) => void
}) {
  const [fecha, setFecha] = useState(`${anio}-01-01`)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<Feriado['tipo']>('inamovible')

  return (
    <Hoja titulo="Nuevo feriado" onCerrar={onCerrar}>
      <div className="campo">
        <label htmlFor="ffecha">Fecha</label>
        <input id="ffecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="fnombre">Nombre</label>
        <input
          id="fnombre"
          type="text"
          value={nombre}
          placeholder="Ej: Feriado provincial"
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="ftipo">Tipo</label>
        <select
          id="ftipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Feriado['tipo'])}
        >
          <option value="inamovible">Inamovible</option>
          <option value="trasladable">Trasladable</option>
          <option value="turistico">Con fines turísticos</option>
        </select>
      </div>
      <button
        className="btn btn-primario btn-bloque"
        disabled={!nombre.trim()}
        onClick={() => onGuardar({ fecha, nombre: nombre.trim(), tipo })}
      >
        Guardar
      </button>
    </Hoja>
  )
}

/* ================= Aportes ================= */

function Aportes({ periodo }: { periodo: string }) {
  const { tablasAportes, guardarTablaAportes } = useStore()
  const vigente = tablaAportesParaPeriodo(tablasAportes, periodo)
  const [editando, setEditando] = useState<TablaAportes | null>(null)

  const actualizarTramo = (i: number, cambios: Partial<TablaAportes['tramos'][number]>) => {
    setEditando((prev) =>
      prev
        ? { ...prev, tramos: prev.tramos.map((t, j) => (j === i ? { ...t, ...cambios } : t)) }
        : prev,
    )
  }

  if (editando) {
    return (
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Editar aportes</h2>
          <button className="btn btn-chico btn-suave" onClick={() => setEditando(null)}>
            Volver
          </button>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="campo">
            <label htmlFor="apvig">Rige desde</label>
            <input
              id="apvig"
              type="month"
              value={editando.vigenciaDesde}
              onChange={(e) =>
                setEditando({
                  ...editando,
                  vigenciaDesde: e.target.value,
                  etiqueta: nombrePeriodo(e.target.value),
                })
              }
            />
          </div>
          {editando.tramos.map((t, i) => (
            <div key={t.etiqueta}>
              <div className="seccion-label" style={{ marginBottom: 6 }}>
                {t.etiqueta}
              </div>
              <div className="grilla-2">
                <CampoMonto
                  label="Total a pagar"
                  valor={t.total}
                  onChange={(n) => actualizarTramo(i, { total: n })}
                />
                <CampoMonto
                  label="Obra social"
                  valor={t.obraSocial}
                  onChange={(n) => actualizarTramo(i, { obraSocial: n })}
                />
                <CampoMonto
                  label="ART"
                  valor={t.art}
                  onChange={(n) => actualizarTramo(i, { art: n })}
                />
                <CampoMonto
                  label="Jubilación (SIPA)"
                  valor={t.sipa}
                  onChange={(n) => actualizarTramo(i, { sipa: n })}
                />
              </div>
            </div>
          ))}
          <button
            className="btn btn-primario btn-bloque"
            onClick={() => {
              guardarTablaAportes(editando)
              setEditando(null)
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Aviso tipo="info">
        Esto se paga aparte del sueldo, con el formulario F.102/RT. Los importes salen de{' '}
        <a
          href="https://www.afip.gob.ar/casasparticulares/aportes-contribuciones-ART/"
          target="_blank"
          rel="noreferrer"
        >
          ARCA → Aportes y contribuciones
        </a>
        , y se actualizan solos.
      </Aviso>

      <SelloActualizacion fecha={APORTES_ACTUALIZADOS} />

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>{vigente.etiqueta}</h2>
          <button
            className="btn btn-chico btn-suave"
            onClick={() =>
              setEditando({
                ...vigente,
                vigenciaDesde: periodoOffset(vigente.vigenciaDesde, 1),
                etiqueta: nombrePeriodo(periodoOffset(vigente.vigenciaDesde, 1)),
                tramos: vigente.tramos.map((t) => ({ ...t })),
              })
            }
          >
            <IconoMas /> Actualizar
          </button>
        </div>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Horas semanales</th>
                <th>Total</th>
                <th>Obra social</th>
                <th>ART</th>
                <th>Jubilación</th>
              </tr>
            </thead>
            <tbody>
              {vigente.tramos.map((t) => (
                <tr key={t.etiqueta}>
                  <td>{t.etiqueta}</td>
                  <td>
                    <strong>{pesos(t.total)}</strong>
                  </td>
                  <td>{pesos(t.obraSocial)}</td>
                  <td>{pesos(t.art)}</td>
                  <td>{pesos(t.sipa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="texto-mini">
        Valores para trabajador activo mayor de 18 años. Si está jubilada o es menor, los importes
        cambian: fijate en la página de ARCA.
      </p>
    </>
  )
}
