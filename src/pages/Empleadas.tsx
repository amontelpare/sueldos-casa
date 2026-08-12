import { useState } from 'react'
import { COLORES, empleadaNueva, nuevoId, useStore } from '../store/store'
import { CATEGORIAS, CATEGORIA_POR_ID, escalaParaPeriodo } from '../data/escalas'
import { calcularValorBase } from '../domain/calculo'
import {
  Avatar,
  Aviso,
  CampoMonto,
  IconoIzq,
  IconoMas,
  IconoPersonas,
  IconoTacho,
  Segmentado,
  Switch,
  Vacio,
} from '../components/ui'
import { DIAS_SEMANA } from '../lib/fechas'
import { num, pesos } from '../lib/format'
import type { Empleada, FormaPago, Modalidad } from '../domain/types'

export function Empleadas({ periodo }: { periodo: string }) {
  const { empleadas } = useStore()
  const [editando, setEditando] = useState<Empleada | null>(null)

  if (editando) {
    return (
      <EditorEmpleada
        empleada={editando}
        periodo={periodo}
        onCerrar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="contenido">
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Las chicas</h2>
          <button
            className="btn btn-chico btn-primario"
            onClick={() => setEditando(empleadaNueva(empleadas.length))}
          >
            <IconoMas /> Agregar
          </button>
        </div>
        {empleadas.length === 0 ? (
          <Vacio
            icono={<IconoPersonas />}
            titulo="No hay nadie cargado"
            texto="Cargá a cada persona con su categoría, sus días y sus horas. Después no hay que tocarlo más."
          />
        ) : (
          <div>
            {empleadas.map((e) => (
              <button key={e.id} className="item" onClick={() => setEditando(e)}>
                <Avatar nombre={e.nombre} color={e.color} />
                <div className="item-texto">
                  <div className="item-titulo">{e.nombre || 'Sin nombre'}</div>
                  <div className="item-sub">
                    {CATEGORIA_POR_ID[e.categoria].nombre} ·{' '}
                    {num(e.jornada.reduce((a, b) => a + b, 0))} hs semanales
                  </div>
                </div>
                <IconoDerChico />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function IconoDerChico() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="var(--texto-3)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function EditorEmpleada({
  empleada: inicial,
  periodo,
  onCerrar,
}: {
  empleada: Empleada
  periodo: string
  onCerrar: () => void
}) {
  const { guardarEmpleada, borrarEmpleada, escalas, config, empleadas } = useStore()
  const [e, setE] = useState<Empleada>(inicial)
  const esNueva = !empleadas.some((x) => x.id === inicial.id)

  const set = (cambios: Partial<Empleada>) => setE((prev) => ({ ...prev, ...cambios }))

  const categoria = CATEGORIA_POR_ID[e.categoria]
  const escala = escalaParaPeriodo(escalas, periodo)
  const vb = calcularValorBase(e, escala, periodo, config)
  const horasSemanales = e.jornada.reduce((a, b) => a + b, 0)

  const guardar = () => {
    guardarEmpleada({ ...e, nombre: e.nombre.trim() })
    onCerrar()
  }

  return (
    <div className="contenido">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn-icono" onClick={onCerrar} aria-label="Volver">
          <IconoIzq />
        </button>
        <h1 style={{ flex: 1 }}>{esNueva ? 'Nueva persona' : e.nombre || 'Editar'}</h1>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cuerpo">
          <div className="campo">
            <label>Nombre</label>
            <input
              type="text"
              value={e.nombre}
              placeholder="Ej: Mariana"
              autoFocus={esNueva}
              onChange={(ev) => set({ nombre: ev.target.value })}
            />
          </div>

          <div className="campo">
            <span className="campo-label">Color</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORES.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => set({ color: c })}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: c,
                    border: e.color === c ? '3px solid var(--texto)' : '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="campo">
            <label htmlFor="categoria">Categoría</label>
            <select
              id="categoria"
              value={e.categoria}
              onChange={(ev) => {
                const cat = ev.target.value as Empleada['categoria']
                const info = CATEGORIA_POR_ID[cat]
                set({
                  categoria: cat,
                  modalidad: info.soloSinRetiro ? 'sin_retiro' : e.modalidad,
                })
              }}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <span className="campo-ayuda">{categoria.descripcion}</span>
          </div>

          {!categoria.soloSinRetiro && (
            <div className="campo">
              <span className="campo-label">Modalidad</span>
              <Segmentado<Modalidad>
                valor={e.modalidad}
                onChange={(v) => set({ modalidad: v })}
                opciones={[
                  { valor: 'con_retiro', label: 'Con retiro' },
                  { valor: 'sin_retiro', label: 'Sin retiro' },
                ]}
              />
              <span className="campo-ayuda">
                "Sin retiro" es cuando vive en la casa. Si se va a su casa todos los días, es con
                retiro.
              </span>
            </div>
          )}

          <div className="campo">
            <span className="campo-label">Cómo se le paga</span>
            <Segmentado<FormaPago>
              valor={e.formaPago}
              onChange={(v) => set({ formaPago: v })}
              opciones={[
                { valor: 'hora', label: 'Por hora' },
                { valor: 'mes', label: 'Sueldo mensual' },
              ]}
            />
            <span className="campo-ayuda">
              Desde 24 horas semanales corresponde el sueldo mensual; por debajo, se paga por hora.
            </span>
          </div>

          <div className="campo">
            <label htmlFor="ingreso">Desde cuándo trabaja</label>
            <input
              id="ingreso"
              type="date"
              value={e.fechaIngreso}
              onChange={(ev) => set({ fechaIngreso: ev.target.value })}
            />
            <span className="campo-ayuda">
              Se usa para el adicional por antigüedad ({config.antiguedadPctPorAnio}% por año).
            </span>
          </div>
        </div>
      </div>

      {/* -------- Jornada -------- */}
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Horas por día</h2>
          <span className="chip">{num(horasSemanales)} hs semanales</span>
        </div>
        <div className="tarjeta-cuerpo">
          <p className="texto-mini">
            Cuántas horas hace habitualmente cada día. Dejá en cero los días que no viene.
          </p>
          <div className="jornada">
            {DIAS_SEMANA.map((d, i) => (
              <label key={d} className="jornada-dia">
                <span>{d}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.5}
                  value={e.jornada[i] || ''}
                  placeholder="0"
                  data-cero={!e.jornada[i]}
                  onChange={(ev) => {
                    const v = Number(ev.target.value) || 0
                    const j = [...e.jornada] as Empleada['jornada']
                    j[i] = Math.max(0, Math.min(24, v))
                    set({ jornada: j })
                  }}
                />
              </label>
            ))}
          </div>

          {e.formaPago === 'hora' && horasSemanales >= 24 && (
            <Aviso>
              Con {num(horasSemanales)} horas semanales corresponde liquidar con sueldo mensual.
            </Aviso>
          )}
          {e.formaPago === 'mes' && horasSemanales > 0 && horasSemanales < 24 && (
            <Aviso>
              Con menos de 24 horas semanales normalmente se liquida por hora.
            </Aviso>
          )}
        </div>
      </div>

      {/* -------- Cuánto se le paga -------- */}
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Cuánto se le paga</h2>
        </div>
        <div className="tarjeta-cuerpo">
          <Switch
            label="Zona desfavorable"
            ayuda={`+${escala.zonaDesfavorablePct}% por Patagonia. Cipolletti y toda Río Negro entran.`}
            checked={e.zonaDesfavorable}
            onChange={(v) => set({ zonaDesfavorable: v })}
          />

          <div className="campo">
            <span className="campo-label">
              Mínimo de escala ({escala.etiqueta}):{' '}
              <strong>
                {pesos(vb.minimoEscala)} {e.formaPago === 'hora' ? 'la hora' : 'por mes'}
              </strong>
            </span>
          </div>

          <CampoMonto
            label={`Valor acordado ${e.formaPago === 'hora' ? 'por hora' : 'por mes'} (opcional)`}
            ayuda="Si le pagás más que el mínimo, poné acá lo que arreglaste. Dejalo en cero para usar la escala."
            valor={e.valorAcordado ?? 0}
            placeholder={String(Math.round(vb.minimoEscala))}
            onChange={(n) => set({ valorAcordado: n > 0 ? n : null })}
          />

          {e.valorAcordado != null && e.valorAcordado > 0 && (
            <Switch
              label="Ese valor ya incluye todo"
              ayuda="Activalo si el número que pusiste es el final, con zona desfavorable y antigüedad adentro."
              checked={e.valorAcordadoEsFinal}
              onChange={(v) => set({ valorAcordadoEsFinal: v })}
            />
          )}

          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radio-sm)', padding: 12 }}>
            <div className="seccion-label" style={{ marginBottom: 5 }}>
              Queda en
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {pesos(vb.valorFinal)}{' '}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--texto-3)' }}>
                {e.formaPago === 'hora' ? 'la hora' : 'por mes'}
              </span>
            </div>
            {!vb.valorAcordadoEsFinal && (vb.zonaPct > 0 || vb.antiguedadPct > 0) && (
              <div className="texto-mini" style={{ marginTop: 3 }}>
                {pesos(vb.base)}
                {vb.zonaPct > 0 && ` + ${vb.zonaPct}% zona`}
                {vb.antiguedadPct > 0 &&
                  ` + ${vb.antiguedadPct}% antigüedad (${vb.antiguedadAnios} ${vb.antiguedadAnios === 1 ? 'año' : 'años'})`}
              </div>
            )}
          </div>

          {vb.porDebajoDelMinimo && (
            <Aviso>
              Queda por debajo del mínimo legal de {pesos(vb.minimoLegal)}.
            </Aviso>
          )}
        </div>
      </div>

      {/* -------- Adicionales fijos -------- */}
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Adicionales fijos</h2>
          <button
            className="btn btn-chico btn-suave"
            onClick={() =>
              set({
                adicionales: [
                  ...e.adicionales,
                  { id: nuevoId(), concepto: '', monto: 0, remunerativo: true },
                ],
              })
            }
          >
            <IconoMas /> Agregar
          </button>
        </div>
        <div className="tarjeta-cuerpo">
          {e.adicionales.length === 0 && (
            <p className="texto-mini">
              Plus por cantidad de chicos, viáticos, plus por tareas extra… Se suman todos los
              meses.
            </p>
          )}
          {e.adicionales.map((ad) => (
            <div key={ad.id} className="fila">
              <div className="campo" style={{ flex: 1.6 }}>
                <label>Concepto</label>
                <input
                  type="text"
                  value={ad.concepto}
                  placeholder="Plus por dos chicos"
                  onChange={(ev) =>
                    set({
                      adicionales: e.adicionales.map((x) =>
                        x.id === ad.id ? { ...x, concepto: ev.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
              <CampoMonto
                label="Monto"
                valor={ad.monto}
                onChange={(n) =>
                  set({
                    adicionales: e.adicionales.map((x) =>
                      x.id === ad.id ? { ...x, monto: n } : x,
                    ),
                  })
                }
              />
              <button
                className="btn-icono"
                style={{ flex: '0 0 auto', color: 'var(--error)' }}
                aria-label="Borrar adicional"
                onClick={() =>
                  set({ adicionales: e.adicionales.filter((x) => x.id !== ad.id) })
                }
              >
                <IconoTacho />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cuerpo">
          <div className="campo">
            <label>Notas</label>
            <textarea
              value={e.notas}
              placeholder="Teléfono, CUIL, obra social…"
              onChange={(ev) => set({ notas: ev.target.value })}
            />
          </div>
        </div>
      </div>

      <button className="btn btn-primario btn-bloque" onClick={guardar} disabled={!e.nombre.trim()}>
        Guardar
      </button>

      {!esNueva && (
        <button
          className="btn btn-peligro btn-bloque"
          onClick={() => {
            if (confirm(`¿Borrar a ${e.nombre} y todas sus liquidaciones?`)) {
              borrarEmpleada(e.id)
              onCerrar()
            }
          }}
        >
          <IconoTacho /> Borrar
        </button>
      )}
    </div>
  )
}
