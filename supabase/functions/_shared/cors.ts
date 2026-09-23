// Origins allowed to call these functions from a browser. Auth is via a
// Bearer token the frontend sets explicitly (not an ambient cookie), so a
// wildcard origin isn't a CSRF hole, but allowlisting the app's real
// origin(s) is still worthwhile defense-in-depth against token exfiltration
// via XSS on an unrelated page. Comma-separated, set as an Edge Function
// secret; defaults cover local dev and the deployed Firebase Hosting site.
const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ??
  'http://localhost:5173,https://bi-tool-mvp-demo.web.app,https://bi-tool-mvp-demo.firebaseapp.com'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) })
  }
  return null
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  })
}
