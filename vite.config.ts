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
            target: 'http://localhost:8000',
            changeOrigin: true,
            rewrite: (path) => {
              if (path === '/api/flow/health' || path === '/api/flow/') {
                return path.replace(/^\/api\/flow/, '');
              }
              return path.replace(/^\/api\/flow/, '/api');
            },
          },
        },
      },
      plugins: [
        react(), 
        tailwindcss(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
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
      }
    };
});
