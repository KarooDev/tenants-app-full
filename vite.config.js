import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// simplified config (no proxy needed now)
export default defineConfig({
  plugins: [react()],
});
