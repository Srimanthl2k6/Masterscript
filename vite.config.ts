import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export const productionSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ipc: http://ipc.localhost wss://signaling.yjs.dev",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  base: './',
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**'],
  },
  plugins: [
    react(),
    {
      name: 'masterscript-production-csp',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: () => [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: productionSecurityPolicy,
            },
            injectTo: 'head-prepend',
          },
        ],
      },
    },
  ],
})
