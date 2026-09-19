import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './src/lib/fieldApi.js'

function fieldApiPlugin() {
  return {
    name: 'field-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.end();
          return;
        }
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        try {
          handleApi(req.url, send);
        } catch (error) {
          send(500, { error: error.message || 'API error' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fieldApiPlugin()],
})
