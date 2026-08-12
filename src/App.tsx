import { useState } from 'react'
import { StoreProvider, useStore } from './store/store'
import { Mes } from './pages/Mes'
import { Empleadas } from './pages/Empleadas'
import { Datos } from './pages/Datos'
import { Ajustes } from './pages/Ajustes'
import { DetalleLiquidacion } from './pages/DetalleLiquidacion'
import {
  Avatar,
  IconoAjustes,
  IconoCalendario,
  IconoIzq,
  IconoPersonas,
  IconoTabla,
} from './components/ui'
import { CATEGORIA_POR_ID } from './data/escalas'
import { periodoActual } from './lib/fechas'

type Tab = 'mes' | 'empleadas' | 'datos' | 'ajustes'

const TABS: { id: Tab; label: string; Icono: (p: { className?: string }) => React.ReactElement }[] = [
  { id: 'mes', label: 'Mes', Icono: IconoCalendario },
  { id: 'empleadas', label: 'Personas', Icono: IconoPersonas },
  { id: 'datos', label: 'Datos', Icono: IconoTabla },
  { id: 'ajustes', label: 'Ajustes', Icono: IconoAjustes },
]

const TITULOS: Record<Tab, string> = {
  mes: 'Sueldos de casa',
  empleadas: 'Personas',
  datos: 'Escalas y feriados',
  ajustes: 'Ajustes',
}

function Contenido() {
  const { empleadas } = useStore()
  const [tab, setTab] = useState<Tab>('mes')
  const [periodo, setPeriodo] = useState(periodoActual())
  const [abierta, setAbierta] = useState<string | null>(null)

  const empleadaAbierta = abierta ? empleadas.find((e) => e.id === abierta) : null

  return (
    <div className="app">
      <header className="encabezado">
        <div className="encabezado-inner">
          {empleadaAbierta ? (
            <>
              <button
                className="btn-icono"
                onClick={() => setAbierta(null)}
                aria-label="Volver"
              >
                <IconoIzq />
              </button>
              <Avatar nombre={empleadaAbierta.nombre} color={empleadaAbierta.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-titulo">{empleadaAbierta.nombre || 'Sin nombre'}</div>
                <div className="item-sub">
                  {CATEGORIA_POR_ID[empleadaAbierta.categoria].nombre} ·{' '}
                  {empleadaAbierta.formaPago === 'hora' ? 'Por hora' : 'Mensual'}
                </div>
              </div>
            </>
          ) : (
            <h1>{TITULOS[tab]}</h1>
          )}
        </div>
      </header>

      {empleadaAbierta ? (
        <DetalleLiquidacion
          empleada={empleadaAbierta}
          periodo={periodo}
          onCambiarPeriodo={setPeriodo}
        />
      ) : (
        <>
          {tab === 'mes' && (
            <Mes
              periodo={periodo}
              onCambiarPeriodo={setPeriodo}
              onAbrir={setAbierta}
              onIrAEmpleadas={() => setTab('empleadas')}
            />
          )}
          {tab === 'empleadas' && <Empleadas periodo={periodo} />}
          {tab === 'datos' && <Datos periodo={periodo} />}
          {tab === 'ajustes' && <Ajustes />}
        </>
      )}

      <nav className="nav">
        {TABS.map(({ id, label, Icono }) => (
          <button
            key={id}
            className={tab === id && !empleadaAbierta ? 'activo' : ''}
            onClick={() => {
              setAbierta(null)
              setTab(id)
            }}
          >
            <Icono />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Contenido />
    </StoreProvider>
  )
}
