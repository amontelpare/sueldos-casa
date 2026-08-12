import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Sólo en el build: en desarrollo molestaría con el cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    const sw = `${base}sw.js`

    // jobinnovation.com.ar sirve la app en /sueldos-casa, SIN barra final. El
    // scope que sale por defecto es /sueldos-casa/, que no cubre esa misma URL
    // y dejaría la página sin service worker (o sea, sin modo offline). Por eso
    // pido el scope sin la barra, que el hosting habilita con el header
    // Service-Worker-Allowed. Donde el base es relativo (GitHub Pages) el
    // default ya está bien.
    const scope = base.startsWith('/') && base.length > 1 ? base.replace(/\/$/, '') : null

    const registrar = (opciones?: RegistrationOptions) =>
      navigator.serviceWorker.register(sw, opciones)

    const intento = scope ? registrar({ scope }) : registrar()

    intento.catch(() => {
      // Si el hosting no manda el header, el scope ancho se rechaza: vuelvo al
      // default. Y si tampoco anda, la app funciona igual, sólo que necesita
      // internet para abrir.
      if (scope) registrar().catch(() => {})
    })
  })
}
