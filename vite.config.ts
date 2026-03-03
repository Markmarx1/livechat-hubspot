import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Use HTTP for local dev to avoid ERR_SSL_VERSION_OR_CIPHER_MISMATCH.
    // For LiveChat testing, deploy to a host with HTTPS or use ngrok.
    https: false,
  },
});
