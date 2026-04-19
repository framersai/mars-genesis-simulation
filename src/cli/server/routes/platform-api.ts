import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RunHistoryStore } from '../run-history-store.js';
import type { ParacosmServerMode } from '../server-mode.js';

export async function handlePlatformApiRoute(
  mode: ParacosmServerMode,
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    runHistoryStore: RunHistoryStore;
    corsHeaders: Record<string, string>;
  },
): Promise<boolean> {
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  if (!url || !url.pathname.startsWith('/api/v1/')) return false;
  if (url.pathname === '/api/v1/demo/status') return false;

  if (mode !== 'platform_api') {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      ...options.corsHeaders,
    });
    res.end(JSON.stringify({ error: 'platform_api_only', mode }));
    return true;
  }

  try {
    if (url.pathname === '/api/v1/runs' && req.method === 'GET') {
      const runs = await options.runHistoryStore.listRuns();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...options.corsHeaders,
      });
      res.end(JSON.stringify({ runs }));
      return true;
    }
  } catch (error) {
    res.writeHead(500, {
      'Content-Type': 'application/json',
      ...options.corsHeaders,
    });
    res.end(JSON.stringify({ error: String(error) }));
    return true;
  }

  res.writeHead(404, {
    'Content-Type': 'application/json',
    ...options.corsHeaders,
  });
  res.end(JSON.stringify({ error: 'unknown_platform_route', path: url.pathname }));
  return true;
}
