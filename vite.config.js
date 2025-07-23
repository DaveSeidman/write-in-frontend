import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cocktail-generator/',
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
  },
});
