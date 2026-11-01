import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// 前端源码位于 frontend/，构建产物输出到仓库根目录的 dist/，
// 由 wrangler 的 [assets] 配置作为 Static Assets 提供给同一个 Worker。
export default defineConfig({
  root: resolve(__dirname, 'frontend'),
  plugins: [react()],
  resolve: {
    alias: {
      '@frontend': resolve(__dirname, 'frontend/src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // 本地开发时把 /api 代理到 wrangler dev 默认端口，避免跨域
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
