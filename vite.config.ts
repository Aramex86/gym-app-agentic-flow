import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* FSAA Vite template — plain React SPA.
   The FSAA layers live in src/ identical to the Next.js template;
   only the pages layer differs (see src/pages). */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': '/src/app',
      '@pages': '/src/pages',
      '@features': '/src/features',
      '@entities': '/src/entities',
      '@shared': '/src/shared',
    },
  },
});