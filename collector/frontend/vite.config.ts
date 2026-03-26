import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'configure-response-headers',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // 强制为所有JS/TSX/TS文件设置正确的MIME类型
            const url = req.url || '';
            if (url.includes('.tsx') || url.includes('.ts') || url.includes('.jsx') || url.includes('.js')) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            }
            // 设置CORS头
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 9083,
      host: '0.0.0.0',
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      // 代理API请求到Collector后端 (端口9082)
      proxy: {
        '/api': {
          target: 'http://localhost:9082',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 9083,
    },
    esbuild: {
      target: 'es2020',
      loader: 'tsx',
      include: [/\.tsx?$/, /\.jsx?$/],
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.tsx': 'tsx',
          '.ts': 'ts',
        },
      },
    },
  };
});
