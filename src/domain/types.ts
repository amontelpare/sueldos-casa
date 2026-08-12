/** Tipos del dominio: Régimen de Personal de Casas Particulares (Ley 26.844). */

export type CategoriaId =
  | 'supervisor'
  | 'especificas'
  | 'caseros'
  | 'cuidado'
  | 'generales'

export type Modalidad = 'con_retiro' | 'sin_retiro'

/** Cómo se liquida: por hora trabajada o sueldo mensual. */
export type FormaPago = 'hora' | 'mes'

export interface CategoriaInfo {
  id: CategoriaId
  nombre: string
  descripcion: string
  /** Categorías que sólo existen "sin retiro" (caseros). */
  soloSinRetiro?: boolean
}

/** Valores mínimos de una categoría. `null` = no existe esa combinación. */
export interface ValoresCategoria {
  horaConRetiro: number | null
  horaSinRetiro: number | null
  mesConRetiro: number | null
  mesSinRetiro: number | null
}

/** Escala salarial publicada por la CNTCP, vigente desde un mes dado. */
export interface Escala {
  /** 'AAAA-MM' desde el que rige. */
  vigenciaDesde: string
  etiqueta: string
  /** Adicional por zona desfavorable, en porcentaje (ej: 31). */
  zonaDesfavorablePct: number
  valores: Record<CategoriaId, ValoresCategoria>
  fuente?: string
  /** true si la cargó el usuario a mano (no viene con la app). */
  propia?: boolean
}

export interface Feriado {
  /** 'AAAA-MM-DD' */
  fecha: string
  nombre: string
  tipo: 'inamovible' | 'trasladable' | 'turistico' | 'no_laborable'
  propio?: boolean
}

/** Adicional fijo mensual (plus por cantidad de chicos, viáticos, etc.). */
export interface AdicionalFijo {
  id: string
  concepto: string
  monto: number
  /** Si es remunerativo entra en la base del aguinaldo. */
  remunerativo: boolean
}

export interface Empleada {
  id: string
  nombre: string
  categoria: CategoriaId
  modalidad: Modalidad
  formaPago: FormaPago
  /** Horas habituales por día de semana. Índice 0 = domingo. */
  jornada: [number, number, number, number, number, number, number]
  /** 'AAAA-MM-DD'. Se usa para el adicional por antigüedad. */
  fechaIngreso: string
  zonaDesfavorable: boolean
  /** Si se paga por encima del mínimo, el valor acordado (hora o mes según formaPago). */
  valorAcordado: number | null
  /**
   * Si `valorAcordado` ya incluye zona desfavorable y antigüedad.
   * Típico cuando se arregló "te pago $X la hora" a secas.
   */
  valorAcordadoEsFinal: boolean
  adicionales: AdicionalFijo[]
  notas: string
  color: string
}

export type EstadoDia =
  /** Día habitual de trabajo, vino y trabajó. */
  | 'trabajado'
  /** Día habitual, no vino y no se paga. */
  | 'ausente'
  /** Día habitual, no vino pero se paga (enfermedad, licencia). */
  | 'ausente_pago'
  /** Feriado en el que vino a trabajar: se paga doble. */
  | 'feriado_trabajado'
  /** Feriado que cae en día habitual y no se trabaja: se paga simple. */
  | 'feriado_pago'
  /** Vacaciones. */
  | 'vacaciones'
  /** No es día de trabajo. */
  | 'libre'

export interface DiaLiquidacion {
  /** 'AAAA-MM-DD' */
  fecha: string
  estado: EstadoDia
  /** Horas efectivamente trabajadas. Si se omite, se usa la jornada habitual. */
  horas: number | null
  /** Horas extra al 50% (días hábiles y sábado hasta las 13). */
  extra50: number
  /** Horas extra al 100% (sábado después de 13, domingos y feriados). */
  extra100: number
}

export interface AjusteLiquidacion {
  id: string
  concepto: string
  /** Positivo suma, negativo resta. */
  monto: number
}

export interface Liquidacion {
  id: string
  empleadaId: string
  /** 'AAAA-MM' */
  periodo: string
  dias: DiaLiquidacion[]
  /** Ajustes puntuales del mes: adelantos, premios, reintegros. */
  ajustes: AjusteLiquidacion[]
  /** Aguinaldo (SAC) a pagar en este período. null = calcular automático. */
  sacManual: number | null
  incluirSac: boolean
  pagada: boolean
  fechaPago: string | null
  notas: string
}

export interface Config {
  /** Divisor para calcular el jornal en mensualizadas (feriado trabajado). */
  divisorJornalFeriado: number
  /** Divisor para descontar ausencias en mensualizadas. */
  divisorDescuentoAusencia: number
  /** Adicional por antigüedad, % por año cumplido. */
  antiguedadPctPorAnio: number
  /** Redondear el total final a este múltiplo. 0 = sin redondeo. */
  redondeoTotal: number
}

/** Importes de aportes y contribuciones (F.102/RT de ARCA). */
export interface TramoAportes {
  etiqueta: string
  /** Horas semanales mínimas del tramo. */
  desdeHoras: number
  /** Horas semanales máximas (exclusivo). null = sin tope. */
  hastaHoras: number | null
  total: number
  obraSocial: number
  art: number
  sipa: number
}

export interface TablaAportes {
  vigenciaDesde: string
  etiqueta: string
  tramos: TramoAportes[]
  fuente?: string
}
