import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split heavy vendor libraries into separate chunks so the main bundle
          // stays small (it was >1 MB in a single chunk). A function keyed on the
          // resolved module id is used instead of the object form because several
          // packages (e.g. firebase) expose only subpath exports and cannot be
          // referenced by their bare package name.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/') || id.includes('@firebase/')) return 'vendor-firebase';
            if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-')) return 'vendor-charts';
            if (id.includes('/lucide-react/')) return 'vendor-icons';
            if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'vendor-motion';
            if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/mdast') || id.includes('/micromark')) return 'vendor-markdown';
            if (id.includes('/jspdf/')) return 'vendor-pdf';
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
  };
});
