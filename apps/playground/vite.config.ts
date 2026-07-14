import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static site (SPEC §7). Base is './' so it deploys under any path (GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    // Bind all interfaces so the container's port maps through to the host.
    // (Must live here, not as a CLI arg: the compose→root→workspace npm chain
    // drops the `--` separator, so `--host` never reaches Vite intact.)
    host: true,
  },
});
