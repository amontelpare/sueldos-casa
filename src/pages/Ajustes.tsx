import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CONFIG_POR_DEFECTO } from '../domain/calculo'
import { Aviso, CampoMonto, IconoCheck, IconoTacho } from '../components/ui'

export function Ajustes() {
  const { config, guardarConfig, exportar, importar, borrarTodo, empleadas, liquidaciones } =
    useStore()
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)

  const descargar = () => {
    const blob = new Blob([exportar()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sueldos-casa-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const subir = async (archivo: File) => {
    const texto = await archivo.text()
    const res = importar(texto)
    setMensaje(
      res.ok
        ? { tipo: 'info', texto: 'Listo, se restauraron los datos.' }
        : { tipo: 'error', texto: res.error ?? 'No se pudo importar.' },
    )
  }

  return (
    <div className="contenido">
      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Copia de seguridad</h2>
        </div>
        <div className="tarjeta-cuerpo">
          <p className="texto-chico">
            Todo se guarda en este teléfono o computadora, no se sube a ningún lado. Bajate una
            copia de vez en cuando por las dudas.
          </p>
          <div className="texto-mini">
            {empleadas.length} {empleadas.length === 1 ? 'persona' : 'personas'} ·{' '}
            {liquidaciones.length}{' '}
            {liquidaciones.length === 1 ? 'liquidación guardada' : 'liquidaciones guardadas'}
          </div>
          {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
          <div className="acciones">
            <button className="btn" onClick={descargar}>
              Bajar copia
            </button>
            <button className="btn" onClick={() => inputArchivo.current?.click()}>
              Restaurar
            </button>
          </div>
          <input
            ref={inputArchivo}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void subir(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Criterios de cálculo</h2>
        </div>
        <div className="tarjeta-cuerpo">
          <CampoMonto
            label="Antigüedad: % por año"
            ayuda="El adicional por antigüedad del régimen es del 1% por cada año trabajado."
            valor={config.antiguedadPctPorAnio}
            onChange={(n) => guardarConfig({ ...config, antiguedadPctPorAnio: n })}
          />
          <CampoMonto
            label="Feriado trabajado: sueldo dividido"
            ayuda="Sólo para las mensualizadas. El día extra del feriado sale de dividir el sueldo por este número (lo habitual es 25)."
            valor={config.divisorJornalFeriado}
            onChange={(n) =>
              guardarConfig({ ...config, divisorJornalFeriado: n > 0 ? n : 25 })
            }
          />
          <CampoMonto
            label="Descuento por falta: sueldo dividido"
            ayuda="Sólo para las mensualizadas. Lo habitual es dividir por 30, el mes calendario."
            valor={config.divisorDescuentoAusencia}
            onChange={(n) =>
              guardarConfig({ ...config, divisorDescuentoAusencia: n > 0 ? n : 30 })
            }
          />
          <CampoMonto
            label="Redondear el total a"
            ayuda="Para no andar con monedas. Por ejemplo 1000 redondea al millar más cercano. Cero lo deja exacto."
            valor={config.redondeoTotal}
            onChange={(n) => guardarConfig({ ...config, redondeoTotal: n })}
          />
          <button
            className="btn btn-suave btn-bloque"
            onClick={() => guardarConfig(CONFIG_POR_DEFECTO)}
          >
            <IconoCheck /> Volver a los valores por defecto
          </button>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Cómo funciona</h2>
        </div>
        <div className="tarjeta-cuerpo texto-chico" style={{ gap: 10 }}>
          <p>
            <strong>Escala.</strong> Se toma el mínimo de la categoría y la modalidad según la
            escala vigente para ese mes. Si arreglaste un valor más alto, se usa ese.
          </p>
          <p>
            <strong>Zona desfavorable.</strong> Se suma el porcentaje de la resolución vigente
            (hoy 31%) sobre el valor base. Cipolletti está en Río Negro, así que corresponde.
          </p>
          <p>
            <strong>Antigüedad.</strong> 1% del básico por cada año cumplido, contado al cierre del
            mes.
          </p>
          <p>
            <strong>Feriados.</strong> Si cae en un día que trabaja y no viene, se paga igual. Si
            viene, se paga doble.
          </p>
          <p>
            <strong>Horas extra.</strong> 50% en días hábiles y sábados hasta las 13; 100% después
            de las 13 del sábado, domingos y feriados.
          </p>
          <p>
            <strong>Aguinaldo.</strong> La mitad de la mejor remuneración del semestre, prorrateada
            si entró con el semestre empezado. Se paga en junio y en diciembre.
          </p>
          <p>
            <strong>Vacaciones.</strong> 14 días corridos hasta 5 años de antigüedad, 21 hasta 10,
            28 hasta 20 y 35 de ahí en adelante.
          </p>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cuerpo">
          <button
            className="btn btn-peligro btn-bloque"
            onClick={() => {
              if (confirm('¿Borrar TODO? Se pierden las personas y todas las liquidaciones.')) {
                borrarTodo()
                setMensaje({ tipo: 'info', texto: 'Se borró todo.' })
              }
            }}
          >
            <IconoTacho /> Borrar todos los datos
          </button>
        </div>
      </div>

      <p className="texto-mini" style={{ textAlign: 'center' }}>
        Esto es una ayuda para hacer la cuenta, no un recibo de sueldo oficial ni asesoramiento
        legal. Ante una duda, consultá con un contador.
      </p>
    </div>
  )
}
