import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * `base` sale de la variable BASE_PATH.
 *
 *   - Sin variable: './' (rutas relativas). Sirve para GitHub Pages y para
 *     cualquier hosting donde la app viva en la raíz o en una subcarpeta que
 *     termine en barra.
 *   - Con BASE_PATH=/sueldos-casa/: rutas absolutas. Hace falta cuando el
 *     hosting sirve la página SIN barra final (jobinnovation.com.ar tiene
 *     `trailingSlash: false`), porque ahí './assets/x.js' resolvería contra la
 *     raíz del dominio y no cargaría nada.
 */
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || './',
  server: { port: 5173 },
})
