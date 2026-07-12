import {spawn, type ChildProcess} from 'node:child_process';
import type {Plugin, ViteDevServer} from 'vite';

const START_PATH = '/api/web3dlab/rubiks/start';
const STOP_PATH = '/api/web3dlab/rubiks/stop';
const HEALTH_URL = 'http://127.0.0.1:3213/api/web3dlab/rubiks/health';

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const isBackendReady = async () => {
  try {
    const response = await fetch(HEALTH_URL, {signal: AbortSignal.timeout(250)});
    return response.ok;
  } catch {
    return false;
  }
};

export const demo21RubiksSolverDevPlugin = (repoRoot: string): Plugin => {
  let child: ChildProcess | null = null;
  let startup: Promise<void> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  const stopOwnedBackend = () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
    child = null;
    startup = null;
  };

  const ensureBackend = async () => {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    if (await isBackendReady()) return;
    if (startup) return startup;

    startup = new Promise<void>((resolve, reject) => {
      const process = spawn(
        'uv',
        ['run', 'python', 'backend/web3dlab-rubiks-solver/server.py'],
        {cwd: repoRoot, stdio: 'inherit'},
      );
      child = process;
      process.once('error', reject);
      process.once('exit', () => {
        if (child === process) child = null;
        startup = null;
      });

      void (async () => {
        for (let attempt = 0; attempt < 60; attempt += 1) {
          if (await isBackendReady()) {
            resolve();
            return;
          }
          await delay(50);
        }
        reject(new Error('Demo21 Rubik solver did not become ready'));
      })();
    }).catch((error) => {
      stopOwnedBackend();
      throw error;
    });
    return startup;
  };

  const configureServer = (server: ViteDevServer) => {
    server.middlewares.use(async (request, response, next) => {
      if (request.url !== START_PATH && request.url !== STOP_PATH) {
        next();
        return;
      }

      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (request.method !== 'POST') {
        response.statusCode = 405;
        response.end(JSON.stringify({ok: false, error: 'Method not allowed'}));
        return;
      }

      if (request.url === STOP_PATH) {
        if (stopTimer) clearTimeout(stopTimer);
        stopTimer = setTimeout(stopOwnedBackend, 300);
        response.end(JSON.stringify({ok: true}));
        return;
      }

      try {
        await ensureBackend();
        response.end(JSON.stringify({ok: true}));
      } catch (error) {
        response.statusCode = 503;
        response.end(JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to start Rubik solver',
        }));
      }
    });

    server.httpServer?.once('close', stopOwnedBackend);
  };

  return {
    name: 'demo21-rubiks-solver-dev-bridge',
    apply: 'serve',
    configureServer,
  };
};
