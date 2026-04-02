import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      tailwindcss(),
      react(),
    ],
    server: {
      host: true,
      port: 4000,
      proxy: {
        '/api/directions': {
          target: 'https://maps.apigw.ntruss.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/directions/, '/map-direction/v1/driving'),
          headers: {
            'x-ncp-apigw-api-key-id': env.VITE_NAVER_API_KEY_ID,
            'x-ncp-apigw-api-key': env.VITE_NAVER_API_KEY,
          },
        },
        '/api/geocode': {
          target: 'https://maps.apigw.ntruss.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/geocode/, '/map-geocode/v2/geocode'),
          headers: {
            'x-ncp-apigw-api-key-id': env.VITE_NAVER_API_KEY_ID,
            'x-ncp-apigw-api-key': env.VITE_NAVER_API_KEY,
          },
        },
      '/api/odsay': {
          target: 'https://api.odsay.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/odsay/, '/v1/api'),
        },
      },
    },
  }
})
