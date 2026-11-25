import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Permite acesso de qualquer PC na rede local
    proxy: apiProxy,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    proxy: apiProxy,
  },
});
