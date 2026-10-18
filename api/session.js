import {
  clearedSessionCookie,
  configuredSharedPassword,
  constantTimeEqual,
  createSessionToken,
  hasValidSession,
  isSameOriginRequest,
  sessionCookie,
} from '../server/session.js';

function respond(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    if (!configuredSharedPassword()) {
      return respond(res, 503, { error: 'Acesso não configurado: defina INTERCLASSE_SHARED_PASSWORD na Vercel.' });
    }
    if (!hasValidSession(req, configuredSharedPassword())) {
      return respond(res, 401, { authenticated: false });
    }
    return respond(res, 200, { authenticated: true });
  }

  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return respond(res, 405, { error: 'Método não permitido.' });
  }
  if (!isSameOriginRequest(req)) return respond(res, 403, { error: 'Origem da solicitação não autorizada.' });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearedSessionCookie());
    return respond(res, 200, { authenticated: false });
  }

  const sharedPassword = configuredSharedPassword();
  if (!sharedPassword) {
    return respond(res, 503, { error: 'Acesso não configurado: defina INTERCLASSE_SHARED_PASSWORD na Vercel.' });
  }
  const candidate = requestBody(req).password;
  if (typeof candidate !== 'string' || candidate.length > 256 || !constantTimeEqual(candidate, sharedPassword)) {
    return respond(res, 401, { error: 'Senha incorreta. Confira com a organização da interclasse.' });
  }

  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(sharedPassword)));
  return respond(res, 200, { authenticated: true });
}
