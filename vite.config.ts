import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isCapacitor = env.VITE_CAPACITOR === 'true'

  return {
    base: isCapacitor ? './' : '/web/',
    plugins: [react()],
    server: {
      port: 8866,
      proxy: {
        '/api': {
          target: 'http://localhost:3003',
          changeOrigin: true,
        },
      },
    },
  }
})
