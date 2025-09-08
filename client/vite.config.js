import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'embedded-backend-api',
      async configureServer(server) {
        const { initData, createApiRouter } = require('../sharedApi.js');
        await initData();
        server.middlewares.use('/api', createApiRouter());
        console.log('[vite] Embedded API mounted at /api');
      }
    }
  ],
  server: {
    port: 5173
  }
});
