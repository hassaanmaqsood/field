import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative base path ensures compatibility with GitHub Pages (e.g. https://<user>.github.io/<repo>/)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
