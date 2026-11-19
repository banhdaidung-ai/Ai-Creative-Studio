import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/flow': {
            target: 'http://127.0.0.1:8000',
            changeOrigin: true,
            rewrite: (path) => {
              if (path === '/api/flow/health' || path === '/api/flow/' || path === '/api/flow') {
                return path.replace(/^\/api\/flow/, '') || '/health';
              }
              return path.replace(/^\/api\/flow/, '/api');
            },
          },
          '/media': {
            target: 'http://127.0.0.1:8000',
            changeOrigin: true,
          },
          '/api/muse': {
            target: 'http://127.0.0.1:18610',
            changeOrigin: true,
            rewrite: (p) => {
              const stripped = p.replace(/^\/api\/muse/, '');
              if (!stripped || stripped === '/' || stripped === '/health') return '/healthz';
              return stripped;
            },
          },
          '/v1/media': {
            target: 'http://127.0.0.1:18610',
            changeOrigin: true,
          },
        },
      },
      plugins: [
        react(), 
        tailwindcss(),
      ],
      define: {
        // Never leak server GEMINI_API_KEY into the client bundle; server.ts handles Gemini RPC securely
        'process.env.API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY': JSON.stringify(''),
        'process.env.VERTEX_PROJECT_ID': JSON.stringify(''),
        'process.env.VERTEX_LOCATION': JSON.stringify('us-central1'),
        'process.env.VERTEX_ACCESS_TOKEN': JSON.stringify(''),
        'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY || ''),
        'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN || ''),
        'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID || ''),
        'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET || ''),
        'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
        'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID || ''),
        'import.meta.env.VITE_FLOW_BACKEND_URL': JSON.stringify(env.VITE_FLOW_BACKEND_URL || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
                  return 'vendor-react';
                }
                if (id.includes('/firebase/') || id.includes('/@firebase/')) {
                  return 'vendor-firebase';
                }
                if (id.includes('/motion/') || id.includes('/framer-motion/')) {
                  return 'vendor-motion';
                }
                if (id.includes('/konva/') || id.includes('/react-konva/')) {
                  return 'vendor-konva';
                }
                if (id.includes('/@google/genai/')) {
                  return 'vendor-genai';
                }
                if (id.includes('/lucide-react/')) {
                  return 'vendor-icons';
                }
              }
              return undefined;
            },
          },
        },
      },
    };
});
