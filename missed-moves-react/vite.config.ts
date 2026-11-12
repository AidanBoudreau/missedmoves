import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 8 defaults to Safari 16.4+; older iPhones/Macs then get a blank page.
    target: ['es2020', 'safari14', 'ios14', 'chrome87', 'firefox78', 'edge88'],
    cssTarget: ['safari14', 'ios14', 'chrome87', 'firefox78', 'edge88'],
  },
});
