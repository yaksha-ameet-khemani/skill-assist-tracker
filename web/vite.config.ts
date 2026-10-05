import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// In development (npm run dev), /api goes to the local Cloudflare Worker started with `npx wrangler dev` in ../cloudflare.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
