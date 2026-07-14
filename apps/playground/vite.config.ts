import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static site (SPEC §7). Base is './' so it deploys under any path (GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
  },
});
