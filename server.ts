import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import net from 'net';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { GeminiService } from './server/gemini.js';

// Auto-load environment variables if .env or .env.local exists
try {
  process.loadEnvFile('.env.local');
} catch {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Ignore missing .env file
  }
}

// Google Flow Python backend URL
const FLOW_BACKEND_URL = process.env.FLOW_BACKEND_URL || 'http://127.0.0.1:8000';

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

  const headers = { ...req.headers };
  delete headers.host;

  // Handle both pre-parsed JSON bodies and raw incoming streams
  const hasParsedBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
  let bodyBuffer: Buffer | null = null;
  if (hasParsedBody) {
    const jsonStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    bodyBuffer = Buffer.from(jsonStr);
    headers['content-length'] = String(bodyBuffer.length);
    headers['content-type'] = 'application/json';
  }

  const options: http.RequestOptions = {
    hostname: backendUrl.hostname,
    port: backendUrl.port || (isHttps ? 443 : 80),
    path: backendUrl.pathname + backendUrl.search,
    method: req.method,
    headers,
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

  if (bodyBuffer) {
    proxyReq.write(bodyBuffer);
    proxyReq.end();
  } else {
    // Pipe raw request stream (supports multipart/form-data, stream JSON, etc.)
    req.pipe(proxyReq, { end: true });
  }
}

async function startServer() {
  const app = express();
  const desiredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const PORT = await findAvailablePort(desiredPort);

  if (PORT !== desiredPort) {
    console.log(`Port ${desiredPort} is in use. Falling back to port ${PORT}.`);
  }

  // ── Google Flow Proxy endpoints ───────────────────────────────────────────
  // CRITICAL: Mounted BEFORE express.json() so multipart & JSON streams aren't pre-consumed
  app.all(['/api/flow', '/api/flow/*splat'], (req, res) => {
    const flowPath = req.path.replace('/api/flow', '');
    let targetPath: string;
    if (flowPath === '/health' || flowPath === '/' || flowPath === '') {
      targetPath = flowPath || '/health';
    } else {
      targetPath = `/api${flowPath}`;
    }

    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    console.log(`[Flow Proxy] ${req.method} ${req.path} → ${FLOW_BACKEND_URL}${targetPath}${queryString}`);
    proxyToFlowBackend(req, res, `${targetPath}${queryString}`);
  });

  app.all('/media/*splat', (req, res) => {
    proxyToFlowBackend(req, res, req.url);
  });

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

  // ── Flow Backend Management ──────────────────────────────────────────────
  let flowBackendProc: ReturnType<typeof spawn> | null = null;

  async function ensureFlowBackendStarted(): Promise<boolean> {
    const isPortOpen = await checkPortAvailable(8000);
    if (!isPortOpen) {
      // Port 8000 is already running
      return true;
    }

    const backendDir = path.join(process.cwd(), 'flow-backend');
    const venvUvicorn = path.join(backendDir, '.venv', 'bin', 'uvicorn');
    const venvPython = path.join(backendDir, '.venv', 'bin', 'python3');

    let execCmd: string;
    let execArgs: string[];

    if (fs.existsSync(venvUvicorn)) {
      execCmd = venvUvicorn;
      execArgs = ['app:app', '--port', '8000', '--host', '0.0.0.0'];
    } else if (fs.existsSync(venvPython)) {
      execCmd = venvPython;
      execArgs = ['-m', 'uvicorn', 'app:app', '--port', '8000', '--host', '0.0.0.0'];
    } else {
      execCmd = 'python3';
      execArgs = ['-m', 'uvicorn', 'app:app', '--port', '8000', '--host', '0.0.0.0'];
    }

    console.log(`[Flow Backend] 🐍 Khởi động Google Flow Backend: ${execCmd} ${execArgs.join(' ')}`);

    try {
      flowBackendProc = spawn(execCmd, execArgs, {
        cwd: backendDir,
        env: { ...process.env, PYTHONPATH: path.join(backendDir, 'src') },
        stdio: 'inherit',
      });

      flowBackendProc.on('error', (err) => {
        console.warn('[Flow Backend Warning]', err.message);
      });

      // Chờ tối đa 6 giây để backend khởi động và sẵn sàng
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const healthy = await new Promise<boolean>((resolve) => {
          const testReq = http.get('http://127.0.0.1:8000/health', (r) => {
            resolve(r.statusCode === 200);
          });
          testReq.on('error', () => resolve(false));
          testReq.setTimeout(1000, () => {
            testReq.destroy();
            resolve(false);
          });
        });

        if (healthy) {
          console.log('[Flow Backend] ✅ Google Flow Backend đã sẵn sàng trên port 8000!');
          return true;
        }
      }
    } catch (err: any) {
      console.warn('[Flow Backend Start Failed]', err.message);
    }

    return !(await checkPortAvailable(8000));
  }

  const cleanup = () => {
    if (flowBackendProc && !flowBackendProc.killed) {
      try {
        flowBackendProc.kill('SIGTERM');
      } catch {
        // Ignore kill error on shutdown
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  // ── Start Local Backend endpoint ──────────────────────────────────────────
  app.post('/api/start-flow-backend', async (req, res) => {
    try {
      const ready = await ensureFlowBackendStarted();
      if (ready) {
        return res.json({ success: true, message: 'Google Flow Backend đã sẵn sàng trên port 8000!' });
      }
      res.status(500).json({ success: false, error: 'Không thể khởi động Google Flow Backend. Vui lòng kiểm tra lại môi trường Python.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
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

    // Tự động bật flow-backend trong nền để sếp không phải chạy thủ công
    if (process.env.AUTO_START_FLOW !== 'false') {
      ensureFlowBackendStarted().catch((e) => {
        console.warn('[Auto Start Flow Backend Warning]', e.message);
      });
    }
  });
}

startServer();
