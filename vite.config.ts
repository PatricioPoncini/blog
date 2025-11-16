import { defineConfig } from 'vite'

export default defineConfig({
  preview: {
    allowedHosts: ['patricioponcini.com.ar', 'www.patricioponcini.com.ar'],
    host: true,
  },
  server: {
    allowedHosts: ['patricioponcini.com.ar', 'www.patricioponcini.com.ar'],
    host: true,
  },
})
