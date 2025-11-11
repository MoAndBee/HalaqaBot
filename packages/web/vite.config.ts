import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  server: {
    port: 3000,
  },
  envDir: path.resolve(__dirname, '../..'),
  plugins: [
    viteReact(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
})
