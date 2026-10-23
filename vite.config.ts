import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Note: API routes are now served by Supabase Edge Functions.
// Remove the mock API middleware that was used for local demo mode.
// To run locally with real Supabase, use the Supabase CLI:
//   supabase start          # local Supabase stack
//   supabase functions serve # serve edge functions locally
// Then point VITE_SUPABASE_URL at http://localhost:54321

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
