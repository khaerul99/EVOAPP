import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import https from 'node:https'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cameraTarget = env.VITE_CAMERA_URL || 'http://103.194.172.70:8080'
  const hlsGatewayTarget = env.VITE_HLS_GATEWAY_URL || 'http://localhost:1984'
  const snapshotAgent = cameraTarget.startsWith('https://')
    ? new https.Agent({ keepAlive: false })
    : new http.Agent({ keepAlive: false })
  const cameraAgent = cameraTarget.startsWith('https://')
    ? new https.Agent({ keepAlive: true })
    : new http.Agent({ keepAlive: true })

  const attachDigestHeaderRewrite = (proxy) => {
    proxy.on('error', (err, req, res) => {
      const message = err?.message || 'Proxy error'
      // Prevent dev server crash when upstream camera sends malformed close frames.
      if (res && !res.writableEnded) {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
        }
        res.end(JSON.stringify({ message: 'Camera proxy failed', detail: message }))
      }
    })

    proxy.on('proxyRes', (proxyRes) => {
      const digestHeader = proxyRes.headers['www-authenticate']
      if (digestHeader) {
        proxyRes.headers['x-www-authenticate'] = digestHeader
        delete proxyRes.headers['www-authenticate']
      }
    })
  }

  return {
    plugins: [react()],
    base: '/',
    server: {
      proxy: {
        '/cgi-bin/snapshot.cgi': {
          target: cameraTarget,
          changeOrigin: true,
          secure: false,
          agent: snapshotAgent,
          // Some camera firmwares emit non-strict HTTP framing on snapshot endpoint.
          insecureHTTPParser: true,
          configure: attachDigestHeaderRewrite,
        },
        '/cgi-bin': {
          target: cameraTarget,
          changeOrigin: true,
          secure: false,
          agent: cameraAgent,
          insecureHTTPParser: true,
          configure: attachDigestHeaderRewrite,
        },
        '/RPC2': {
          target: cameraTarget,
          changeOrigin: true,
          secure: false,
          agent: cameraAgent,
          insecureHTTPParser: true,
          configure: attachDigestHeaderRewrite,
        },
        '/cam': {
          target: cameraTarget,
          changeOrigin: true,
          secure: false,
          agent: cameraAgent,
          insecureHTTPParser: true,
          configure: attachDigestHeaderRewrite,
        },
        '/go2rtc': {
          target: hlsGatewayTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/go2rtc/, ''),
        },
      },
    },
    preview: {
      allowedHosts: true,
    },
  }
})
