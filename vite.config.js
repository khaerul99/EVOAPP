import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cameraTarget = env.VITE_CAMERA_URL || 'http://103.194.172.70:8080'

  return {
    plugins: [react()],
    base: '/',
    server: {
      proxy: {
        '/cgi-bin': {
          target: cameraTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              const digestHeader = proxyRes.headers['www-authenticate']
              if (digestHeader) {
                proxyRes.headers['x-www-authenticate'] = digestHeader
                delete proxyRes.headers['www-authenticate']
              }
            })
          },
        },
        '/RPC2': {
          target: cameraTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              const digestHeader = proxyRes.headers['www-authenticate']
              if (digestHeader) {
                proxyRes.headers['x-www-authenticate'] = digestHeader
                delete proxyRes.headers['www-authenticate']
              }
            })
          },
        },
      },
    },
    preview: {
      allowedHosts: true,
    },
  }
})
