import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
