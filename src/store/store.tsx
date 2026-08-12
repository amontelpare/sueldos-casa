import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Config,
  Empleada,
  Escala,
  Feriado,
  Liquidacion,
  TablaAportes,
} from '../domain/types'
import { CONFIG_POR_DEFECTO, generarDiasPorDefecto, periodoPagaSac } from '../domain/calculo'
import { ESCALAS } from '../data/escalas'
import { FERIADOS } from '../data/feriados'
import { TABLAS_APORTES } from '../data/aportes'

const CLAVE = 'sueldos-casa/v1'

interface Guardado {
  empleadas: Empleada[]
  liquidaciones: Liquidacion[]
  escalasPropias: Escala[]
  feriadosPropios: Feriado[]
  feriadosEliminados: string[]
  tablasAportesPropias: TablaAportes[]
  config: Config
}

const VACIO: Guardado = {
  empleadas: [],
  liquidaciones: [],
  escalasPropias: [],
  feriadosPropios: [],
  feriadosEliminados: [],
  tablasAportesPropias: [],
  config: CONFIG_POR_DEFECTO,
}

function leer(): Guardado {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return VACIO
    const parsed = JSON.parse(raw) as Partial<Guardado>
    return {
      ...VACIO,
      ...parsed,
      config: { ...CONFIG_POR_DEFECTO, ...(parsed.config ?? {}) },
    }
  } catch {
    return VACIO
  }
}

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

interface Store extends Guardado {
  /** Escalas de la app + las cargadas por el usuario. */
  escalas: Escala[]
  feriados: Feriado[]
  tablasAportes: TablaAportes[]

  guardarEmpleada: (e: Empleada) => void
  borrarEmpleada: (id: string) => void

  /** Devuelve la liquidación del período, creándola si no existe. */
  obtenerLiquidacion: (empleadaId: string, periodo: string) => Liquidacion
  guardarLiquidacion: (l: Liquidacion) => void
  borrarLiquidacion: (id: string) => void

  guardarEscala: (e: Escala) => void
  borrarEscala: (vigenciaDesde: string) => void

  guardarFeriado: (f: Feriado) => void
  borrarFeriado: (fecha: string) => void

  guardarTablaAportes: (t: TablaAportes) => void

  guardarConfig: (c: Config) => void

  exportar: () => string
  importar: (json: string) => { ok: boolean; error?: string }
  borrarTodo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Guardado>(() => leer())

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos))
    } catch {
      // Sin espacio o modo privado: la app sigue andando en memoria.
    }
  }, [datos])

  const escalas = useMemo(() => {
    const propias = new Map(datos.escalasPropias.map((e) => [e.vigenciaDesde, e]))
    const base = ESCALAS.filter((e) => !propias.has(e.vigenciaDesde))
    return [...datos.escalasPropias, ...base].sort((a, b) =>
      b.vigenciaDesde.localeCompare(a.vigenciaDesde),
    )
  }, [datos.escalasPropias])

  const feriados = useMemo(() => {
    const propios = new Map(datos.feriadosPropios.map((f) => [f.fecha, f]))
    const eliminados = new Set(datos.feriadosEliminados)
    const base = FERIADOS.filter((f) => !propios.has(f.fecha) && !eliminados.has(f.fecha))
    return [...datos.feriadosPropios, ...base].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [datos.feriadosPropios, datos.feriadosEliminados])

  const tablasAportes = useMemo(() => {
    const propias = new Map(datos.tablasAportesPropias.map((t) => [t.vigenciaDesde, t]))
    const base = TABLAS_APORTES.filter((t) => !propias.has(t.vigenciaDesde))
    return [...datos.tablasAportesPropias, ...base].sort((a, b) =>
      b.vigenciaDesde.localeCompare(a.vigenciaDesde),
    )
  }, [datos.tablasAportesPropias])

  const guardarEmpleada = useCallback((e: Empleada) => {
    setDatos((d) => ({
      ...d,
      empleadas: d.empleadas.some((x) => x.id === e.id)
        ? d.empleadas.map((x) => (x.id === e.id ? e : x))
        : [...d.empleadas, e],
    }))
  }, [])

  const borrarEmpleada = useCallback((id: string) => {
    setDatos((d) => ({
      ...d,
      empleadas: d.empleadas.filter((e) => e.id !== id),
      liquidaciones: d.liquidaciones.filter((l) => l.empleadaId !== id),
    }))
  }, [])

  const obtenerLiquidacion = useCallback(
    (empleadaId: string, periodo: string): Liquidacion => {
      const existente = datos.liquidaciones.find(
        (l) => l.empleadaId === empleadaId && l.periodo === periodo,
      )
      if (existente) return existente
      const empleada = datos.empleadas.find((e) => e.id === empleadaId)
      return {
        id: nuevoId(),
        empleadaId,
        periodo,
        dias: empleada ? generarDiasPorDefecto(empleada, periodo, feriados) : [],
        ajustes: [],
        sacManual: null,
        incluirSac: periodoPagaSac(periodo),
        pagada: false,
        fechaPago: null,
        notas: '',
      }
    },
    [datos.liquidaciones, datos.empleadas, feriados],
  )

  const guardarLiquidacion = useCallback((l: Liquidacion) => {
    setDatos((d) => ({
      ...d,
      liquidaciones: d.liquidaciones.some((x) => x.id === l.id)
        ? d.liquidaciones.map((x) => (x.id === l.id ? l : x))
        : [...d.liquidaciones, l],
    }))
  }, [])

  const borrarLiquidacion = useCallback((id: string) => {
    setDatos((d) => ({ ...d, liquidaciones: d.liquidaciones.filter((l) => l.id !== id) }))
  }, [])

  const guardarEscala = useCallback((e: Escala) => {
    const marcada = { ...e, propia: true }
    setDatos((d) => ({
      ...d,
      escalasPropias: d.escalasPropias.some((x) => x.vigenciaDesde === e.vigenciaDesde)
        ? d.escalasPropias.map((x) => (x.vigenciaDesde === e.vigenciaDesde ? marcada : x))
        : [...d.escalasPropias, marcada],
    }))
  }, [])

  const borrarEscala = useCallback((vigenciaDesde: string) => {
    setDatos((d) => ({
      ...d,
      escalasPropias: d.escalasPropias.filter((e) => e.vigenciaDesde !== vigenciaDesde),
    }))
  }, [])

  const guardarFeriado = useCallback((f: Feriado) => {
    const marcado = { ...f, propio: true }
    setDatos((d) => ({
      ...d,
      feriadosEliminados: d.feriadosEliminados.filter((x) => x !== f.fecha),
      feriadosPropios: d.feriadosPropios.some((x) => x.fecha === f.fecha)
        ? d.feriadosPropios.map((x) => (x.fecha === f.fecha ? marcado : x))
        : [...d.feriadosPropios, marcado],
    }))
  }, [])

  const borrarFeriado = useCallback((fecha: string) => {
    setDatos((d) => ({
      ...d,
      feriadosPropios: d.feriadosPropios.filter((f) => f.fecha !== fecha),
      feriadosEliminados: d.feriadosEliminados.includes(fecha)
        ? d.feriadosEliminados
        : [...d.feriadosEliminados, fecha],
    }))
  }, [])

  const guardarTablaAportes = useCallback((t: TablaAportes) => {
    setDatos((d) => ({
      ...d,
      tablasAportesPropias: d.tablasAportesPropias.some(
        (x) => x.vigenciaDesde === t.vigenciaDesde,
      )
        ? d.tablasAportesPropias.map((x) => (x.vigenciaDesde === t.vigenciaDesde ? t : x))
        : [...d.tablasAportesPropias, t],
    }))
  }, [])

  const guardarConfig = useCallback((c: Config) => {
    setDatos((d) => ({ ...d, config: c }))
  }, [])

  const exportar = useCallback(() => JSON.stringify(datos, null, 2), [datos])

  const importar = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as Partial<Guardado>
      if (!Array.isArray(parsed.empleadas)) {
        return { ok: false, error: 'El archivo no tiene el formato esperado.' }
      }
      setDatos({
        ...VACIO,
        ...parsed,
        config: { ...CONFIG_POR_DEFECTO, ...(parsed.config ?? {}) },
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer el archivo.' }
    }
  }, [])

  const borrarTodo = useCallback(() => setDatos(VACIO), [])

  const value: Store = {
    ...datos,
    escalas,
    feriados,
    tablasAportes,
    guardarEmpleada,
    borrarEmpleada,
    obtenerLiquidacion,
    guardarLiquidacion,
    borrarLiquidacion,
    guardarEscala,
    borrarEscala,
    guardarFeriado,
    borrarFeriado,
    guardarTablaAportes,
    guardarConfig,
    exportar,
    importar,
    borrarTodo,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore fuera del StoreProvider')
  return ctx
}

export const COLORES = [
  '#0f766e',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#1d4ed8',
  '#4d7c0f',
  '#c2410c',
  '#0e7490',
]

export function empleadaNueva(indice = 0): Empleada {
  return {
    id: nuevoId(),
    nombre: '',
    categoria: 'generales',
    modalidad: 'con_retiro',
    formaPago: 'hora',
    jornada: [0, 0, 0, 0, 0, 0, 0],
    fechaIngreso: new Date().toISOString().slice(0, 10),
    // Cipolletti está en Río Negro: entra en zona desfavorable.
    zonaDesfavorable: true,
    valorAcordado: null,
    valorAcordadoEsFinal: false,
    adicionales: [],
    notas: '',
    color: COLORES[indice % COLORES.length],
  }
}
