import { useEffect, useState, type ReactNode } from 'react'
import { parsearNumero, pesos } from '../lib/format'

/* ---------------- Iconos ---------------- */

const svg = (d: ReactNode) => (p: { className?: string }) => (
  <svg
    className={p.className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
)

export const IconoCalendario = svg(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </>,
)
export const IconoPersonas = svg(
  <>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.2a4 4 0 0 1 0 7.6" />
  </>,
)
export const IconoTabla = svg(
  <>
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <path d="M3 9.5h18M9 9.5V21M3 15.2h18" />
  </>,
)
export const IconoAjustes = svg(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.11A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.33-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 8.87 4.7 1.6 1.6 0 0 0 9.87 3.23V3a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.47 1z" />
  </>,
)
export const IconoAlerta = svg(
  <>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4.5M12 17.2h.01" />
  </>,
)
export const IconoInfo = svg(
  <>
    <circle cx="12" cy="12" r="9.3" />
    <path d="M12 16v-4.5M12 8h.01" />
  </>,
)
export const IconoMas = svg(<path d="M12 5v14M5 12h14" />)
export const IconoIzq = svg(<path d="m15 18-6-6 6-6" />)
export const IconoDer = svg(<path d="m9 18 6-6-6-6" />)
export const IconoCerrar = svg(<path d="M18 6 6 18M6 6l12 12" />)
export const IconoCompartir = svg(
  <>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="M16 6l-4-4-4 4M12 2.5V15" />
  </>,
)
export const IconoTacho = svg(
  <>
    <path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </>,
)
export const IconoCheck = svg(<path d="m4.5 12.5 5 5 10-11" />)
export const IconoCopiar = svg(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>,
)

/* ---------------- Componentes ---------------- */

export function Aviso({
  tipo = 'alerta',
  children,
}: {
  tipo?: 'alerta' | 'info' | 'error'
  children: ReactNode
}) {
  const Icono = tipo === 'info' ? IconoInfo : IconoAlerta
  return (
    <div className={`aviso ${tipo === 'info' ? 'aviso-info' : tipo === 'error' ? 'aviso-error' : ''}`}>
      <Icono />
      <div>{children}</div>
    </div>
  )
}

export function Switch({
  label,
  ayuda,
  checked,
  onChange,
}: {
  label: string
  ayuda?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="switch">
      <span className="switch-texto">
        <span className="campo-label">{label}</span>
        {ayuda && <span className="campo-ayuda">{ayuda}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function Segmentado<T extends string>({
  valor,
  opciones,
  onChange,
}: {
  valor: T
  opciones: { valor: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmentado" role="tablist">
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={o.valor === valor}
          className={o.valor === valor ? 'activo' : ''}
          onClick={() => onChange(o.valor)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Hoja({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="hoja-titulo">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Input de dinero que deja tipear con coma y sólo formatea al salir. */
export function CampoMonto({
  label,
  ayuda,
  valor,
  onChange,
  placeholder,
}: {
  label?: string
  ayuda?: string
  valor: number
  onChange: (n: number) => void
  placeholder?: string
}) {
  const [texto, setTexto] = useState(() => (valor ? String(valor).replace('.', ',') : ''))
  const [enFoco, setEnFoco] = useState(false)

  useEffect(() => {
    if (!enFoco) setTexto(valor ? String(valor).replace('.', ',') : '')
  }, [valor, enFoco])

  return (
    <div className="campo">
      {label && <label>{label}</label>}
      <input
        type="text"
        inputMode="decimal"
        value={texto}
        placeholder={placeholder ?? '0'}
        onFocus={() => setEnFoco(true)}
        onChange={(e) => {
          setTexto(e.target.value)
          onChange(parsearNumero(e.target.value))
        }}
        onBlur={() => {
          setEnFoco(false)
          const n = parsearNumero(texto)
          onChange(n)
          setTexto(n ? String(n).replace('.', ',') : '')
        }}
      />
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </div>
  )
}

export function Monto({ valor }: { valor: number }) {
  return (
    <span className="concepto-monto" data-negativo={valor < 0}>
      {pesos(valor)}
    </span>
  )
}

export function Avatar({ nombre, color }: { nombre: string; color: string }) {
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <div className="avatar" style={{ background: color }}>
      {iniciales || '?'}
    </div>
  )
}

export function Vacio({
  icono,
  titulo,
  texto,
  accion,
}: {
  icono?: ReactNode
  titulo: string
  texto?: string
  accion?: ReactNode
}) {
  return (
    <div className="vacio">
      {icono}
      <div>
        <div style={{ fontWeight: 600, color: 'var(--texto-2)' }}>{titulo}</div>
        {texto && <div className="texto-mini" style={{ marginTop: 4 }}>{texto}</div>}
      </div>
      {accion}
    </div>
  )
}
