import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ParacosmServerMode } from '../server-mode.js';

export function handlePublicDemoRoute(
  mode: ParacosmServerMode,
  req: IncomingMessage,
  res: ServerResponse,
  corsHeaders: Record<string, string>,
): boolean {
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  if (!url || url.pathname !== '/api/v1/demo/status' || req.method !== 'GET') return false;

  res.writeHead(200, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  res.end(JSON.stringify({
    mode,
    replayAvailable: mode !== 'platform_api',
    authenticatedApiAvailable: mode === 'platform_api',
  }));
  return true;
}
