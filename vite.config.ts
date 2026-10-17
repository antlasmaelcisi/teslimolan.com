import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Kütüphaneleri ayrı dosyalara böl: site kodu değiştiğinde ziyaretçiler
          // bunları tarayıcı önbelleğinden kullanmaya devam eder
          manualChunks(id) {
            if (id.includes('node_modules/@firebase/') || id.includes('node_modules/firebase/')) return 'firebase';
            if (id.includes('node_modules/react') || id.includes('node_modules/scheduler/')) return 'react';
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion/')) return 'motion';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
