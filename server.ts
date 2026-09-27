import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import net from 'net';
import http from 'http';
import https from 'https';
import { GeminiService } from './server/gemini.js';

// Auto-load environment variables if .env or .env.local exists
try {
  process.loadEnvFile('.env.local');
} catch {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

// Google Flow Python backend URL
const FLOW_BACKEND_URL = process.env.FLOW_BACKEND_URL || 'http://localhost:8000';

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await checkPortAvailable(port))) {
    port++;
  }
  return port;
}

/**
 * Proxy a request to the Google Flow Python backend.
 * Forwards method, headers (except host), and body as-is.
 */
function proxyToFlowBackend(
  req: express.Request,
  res: express.Response,
  targetPath: string,
): void {
  const backendUrl = new URL(targetPath, FLOW_BACKEND_URL);
  const isHttps = backendUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options: http.RequestOptions = {
    hostname: backendUrl.hostname,
    port: backendUrl.port || (isHttps ? 443 : 80),
    path: backendUrl.pathname + backendUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: backendUrl.host,
    },
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[Flow Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Google Flow backend không khả dụng.',
        detail: 'Vui lòng khởi động flow-backend: cd flow-backend && uvicorn app:app --port 8000',
        hint: err.message,
      });
    }
  });

  // Pipe request body (supports multipart/form-data, JSON, etc.)
  req.pipe(proxyReq, { end: true });
}

async function startServer() {
  const app = express();
  const desiredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const PORT = await findAvailablePort(desiredPort);

  if (PORT !== desiredPort) {
    console.log(`Port ${desiredPort} is in use. Falling back to port ${PORT}.`);
  }

  app.use(express.json({ limit: '50mb' }));

  // ── Gemini API endpoints ──────────────────────────────────────────────────
  app.post('/api/gemini/:method', async (req, res) => {
    try {
      const { args = [], context = {} } = req.body;
      const method = req.params.method as keyof GeminiService;
      
      const geminiService = new GeminiService(context.customKey, context.vertexConfig);
      
      if (typeof geminiService[method] === 'function') {
        const result = await (geminiService[method] as any).apply(geminiService, args);
        res.json({ success: true, result });
      } else {
        res.status(404).json({ success: false, error: 'Method not found' });
      }
    } catch (error: any) {
      console.error('[GeminiService API Error]', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Google Flow Proxy endpoints ───────────────────────────────────────────
  // All /api/flow/* requests are forwarded to Python FastAPI backend on port 8000
  app.all('/api/flow/*splat', (req, res) => {
    // Strip /api/flow prefix → map to backend /api/* or root endpoints
    const flowPath = req.path.replace('/api/flow', '');
    
    // Map paths: /api/flow/session-status → /api/session-status
    //            /api/flow/generate-image → /api/generate-image
    //            /api/flow/health         → /health
    //            /api/flow/job/:id        → /api/job/:id
    let targetPath: string;
    if (flowPath === '/health' || flowPath === '/') {
      targetPath = flowPath;
    } else {
      targetPath = `/api${flowPath}`;
    }

    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    
    console.log(`[Flow Proxy] ${req.method} ${req.path} → ${FLOW_BACKEND_URL}${targetPath}${queryString}`);
    proxyToFlowBackend(req, res, `${targetPath}${queryString}`);
  });

  // ── Vite / static serving ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 AI Creative Studio running on http://localhost:${PORT}`);
    console.log(`📡 Google Flow proxy → ${FLOW_BACKEND_URL}`);
    console.log(`   Start flow-backend: cd flow-backend && uvicorn app:app --port 8000\n`);
  });
}

startServer();
