import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // base relativo para que ande igual en Vercel, Netlify o GitHub Pages
  base: './',
  server: { port: 5173 },
})
