import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isCapacitor = env.VITE_CAPACITOR === 'true'

  return {
    base: isCapacitor ? './' : '/web/',
    plugins: [react()],
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      port: 8866,
      proxy: {
        '/api': {
          target: 'http://localhost:3303',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules/echarts') || id.includes('node_modules/echarts-for-react')) return 'echarts';
            if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design/icons')) return 'antd';
            if (id.includes('node_modules/react-markdown') || id.includes('node_modules/rehype-raw') || id.includes('node_modules/remark-gfm')) return 'markdown';
            if (id.includes('node_modules/gsap')) return 'gsap';
          },
        },
      },
    },
  }
})
