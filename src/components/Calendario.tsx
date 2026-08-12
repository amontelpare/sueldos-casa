import { useState } from 'react'
import type { DiaLiquidacion, Empleada, EstadoDia, Feriado } from '../domain/types'
import { horasDelDia, horasHabituales } from '../domain/calculo'
import { DIAS_SEMANA, diaSemana, formatearFecha, DIAS_SEMANA_LARGO } from '../lib/fechas'
import { mapaFeriados } from '../data/feriados'
import { CampoMonto, Hoja, IconoCheck } from './ui'
import { num } from '../lib/format'

interface OpcionEstado {
  valor: EstadoDia
  titulo: string
  sub: string
  color: string
}

const OPCIONES_TRABAJO: OpcionEstado[] = [
  { valor: 'trabajado', titulo: 'Vino a trabajar', sub: 'Se paga normal', color: 'var(--acento)' },
  { valor: 'ausente', titulo: 'No vino', sub: 'No se paga el día', color: 'var(--border-fuerte)' },
  {
    valor: 'ausente_pago',
    titulo: 'Faltó con aviso / licencia',
    sub: 'Se paga igual (enfermedad, examen, licencia)',
    color: 'var(--texto-3)',
  },
  { valor: 'vacaciones', titulo: 'Vacaciones', sub: 'Se paga el día', color: 'var(--ok)' },
  { valor: 'libre', titulo: 'Día libre', sub: 'No trabaja ese día', color: 'transparent' },
]

const OPCIONES_FERIADO: OpcionEstado[] = [
  {
    valor: 'feriado_trabajado',
    titulo: 'Feriado: vino a trabajar',
    sub: 'Se paga el doble',
    color: 'var(--alerta)',
  },
  {
    valor: 'feriado_pago',
    titulo: 'Feriado: no vino',
    sub: 'Se paga igual, como día normal',
    color: 'var(--alerta-suave)',
  },
  { valor: 'libre', titulo: 'Día libre', sub: 'No corresponde pagarlo', color: 'transparent' },
]

export function Calendario({
  empleada,
  dias,
  feriados,
  onCambiar,
}: {
  empleada: Empleada
  dias: DiaLiquidacion[]
  feriados: Feriado[]
  onCambiar: (dias: DiaLiquidacion[]) => void
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const mapa = mapaFeriados(feriados)

  if (dias.length === 0) return null

  const primerDow = diaSemana(dias[0].fecha)
  const dia = editando ? dias.find((d) => d.fecha === editando) : null

  const actualizar = (fecha: string, cambios: Partial<DiaLiquidacion>) => {
    onCambiar(dias.map((d) => (d.fecha === fecha ? { ...d, ...cambios } : d)))
  }

  return (
    <>
      <div className="calendario">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="calendario-cabecera">
            {d}
          </div>
        ))}
        {Array.from({ length: primerDow }, (_, i) => (
          <div key={`hueco-${i}`} />
        ))}
        {dias.map((d) => {
          const feriado = mapa.get(d.fecha)
          const hs = horasDelDia(empleada, d)
          const muestraHoras =
            d.estado === 'trabajado' || d.estado === 'feriado_trabajado'
          const tieneExtra = d.extra50 > 0 || d.extra100 > 0
          return (
            <button
              key={d.fecha}
              className="dia"
              data-estado={d.estado}
              onClick={() => setEditando(d.fecha)}
              title={feriado ? feriado.nombre : undefined}
              aria-label={`${formatearFecha(d.fecha)}${feriado ? ` — ${feriado.nombre}` : ''}`}
            >
              {feriado && (
                <span
                  className="dia-punto"
                  style={{ background: 'var(--alerta)' }}
                  aria-hidden="true"
                />
              )}
              <span className="dia-num">{Number(d.fecha.slice(8))}</span>
              {muestraHoras && hs > 0 && <span className="dia-hs">{num(hs)}h</span>}
              {tieneExtra && <span className="dia-extra">+</span>}
            </button>
          )
        })}
      </div>

      <div className="leyenda">
        <span>
          <i style={{ background: 'var(--acento-suave)', borderColor: 'var(--acento)' }} />
          Trabajó
        </span>
        <span>
          <i style={{ background: 'var(--alerta-suave)', borderColor: 'var(--alerta)' }} />
          Feriado pago
        </span>
        <span>
          <i style={{ background: 'var(--alerta)', borderColor: 'var(--alerta)' }} />
          Feriado trabajado
        </span>
        <span>
          <i style={{ background: 'var(--surface-2)' }} />
          No vino
        </span>
        <span>
          <i style={{ background: 'var(--ok-suave)', borderColor: 'var(--ok)' }} />
          Vacaciones
        </span>
      </div>

      {dia && (
        <EditorDia
          empleada={empleada}
          dia={dia}
          feriado={mapa.get(dia.fecha) ?? null}
          onCerrar={() => setEditando(null)}
          onCambiar={(cambios) => actualizar(dia.fecha, cambios)}
        />
      )}
    </>
  )
}

function EditorDia({
  empleada,
  dia,
  feriado,
  onCerrar,
  onCambiar,
}: {
  empleada: Empleada
  dia: DiaLiquidacion
  feriado: Feriado | null
  onCerrar: () => void
  onCambiar: (cambios: Partial<DiaLiquidacion>) => void
}) {
  const habituales = horasHabituales(empleada, dia.fecha)
  const opciones = feriado ? OPCIONES_FERIADO : OPCIONES_TRABAJO
  const dow = DIAS_SEMANA_LARGO[diaSemana(dia.fecha)]

  return (
    <Hoja titulo={`${dow} ${formatearFecha(dia.fecha)}`} onCerrar={onCerrar}>
      {feriado && (
        <div className="chip" style={{ alignSelf: 'flex-start' }}>
          🗓 {feriado.nombre}
        </div>
      )}

      <div className="opciones">
        {opciones.map((o) => (
          <button
            key={o.valor}
            className={`opcion ${dia.estado === o.valor ? 'activa' : ''}`}
            onClick={() => onCambiar({ estado: o.valor })}
          >
            <i style={{ background: o.color }} />
            <span className="opcion-texto">
              <span className="opcion-titulo">{o.titulo}</span>
              <span className="opcion-sub">{o.sub}</span>
            </span>
            {dia.estado === o.valor && <IconoCheck className="check" />}
          </button>
        ))}
      </div>

      {(dia.estado === 'trabajado' || dia.estado === 'feriado_trabajado') && (
        <>
          <CampoMonto
            label="Horas trabajadas ese día"
            ayuda={
              habituales > 0
                ? `Su jornada habitual de los ${dow.toLowerCase()} es de ${num(habituales)} hs. Dejalo vacío para usar ese valor.`
                : 'Cargá cuántas horas hizo.'
            }
            valor={dia.horas ?? 0}
            placeholder={habituales > 0 ? String(habituales) : '0'}
            onChange={(n) => onCambiar({ horas: n > 0 ? n : null })}
          />

          <div className="grilla-2">
            <CampoMonto
              label="Horas extra al 50%"
              valor={dia.extra50}
              onChange={(n) => onCambiar({ extra50: n })}
            />
            <CampoMonto
              label="Horas extra al 100%"
              valor={dia.extra100}
              onChange={(n) => onCambiar({ extra100: n })}
            />
          </div>
          <p className="texto-mini">
            Las extras van al 50% en días hábiles y sábados hasta las 13, y al 100% después de
            las 13 del sábado, domingos y feriados.
          </p>
        </>
      )}

      <button className="btn btn-primario btn-bloque" onClick={onCerrar}>
        Listo
      </button>
    </Hoja>
  )
}
