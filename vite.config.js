import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/write-in-frontend/',
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
  },
});
