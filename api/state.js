import { configuredSharedPassword, hasValidSession, isSameOriginRequest } from '../server/session.js';
import { createSupabaseAdmin } from '../server/supabaseAdmin.js';

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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT');
    return respond(res, 405, { error: 'Método não permitido.' });
  }

  const sharedPassword = configuredSharedPassword();
  if (!sharedPassword) {
    return respond(res, 503, { error: 'Acesso não configurado na Vercel.' });
  }
  if (!hasValidSession(req, sharedPassword)) {
    return respond(res, 401, { error: 'Sessão encerrada. Entre novamente com a senha compartilhada.' });
  }
  if (req.headers.origin && !isSameOriginRequest(req)) {
    return respond(res, 403, { error: 'Origem da solicitação não autorizada.' });
  }
  if (req.method === 'PUT' && !isSameOriginRequest(req)) {
    return respond(res, 403, { error: 'Origem da solicitação não autorizada.' });
  }

  let client;
  try {
    client = createSupabaseAdmin();
  } catch (error) {
    return respond(res, 503, { error: error.message });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await client
        .from('interclasse_state')
        .select('students, teams, draws, results, revision')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return respond(res, 200, { row: data });
    }

    const body = requestBody(req);
    const expectedRevision = Number(body.expectedRevision);
    const payload = body.payload;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      return respond(res, 400, { error: 'Revisão de dados inválida; recarregue o painel.' });
    }
    if (!Array.isArray(payload?.students) || !Array.isArray(payload?.teams)
        || !isRecord(payload?.draws) || !isRecord(payload?.results)) {
      return respond(res, 400, { error: 'O estado enviado não tem o formato esperado.' });
    }
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 3_500_000) {
      return respond(res, 413, { error: 'O arquivo de dados excede o limite permitido.' });
    }

    const { data, error } = await client
      .from('interclasse_state')
      .update({
        students: payload.students,
        teams: payload.teams,
        draws: payload.draws,
        results: payload.results,
      })
      .eq('id', 1)
      .eq('revision', expectedRevision)
      .select('revision')
      .maybeSingle();
    if (error) throw error;
    if (typeof data?.revision !== 'number') {
      return respond(res, 409, { error: 'Outra pessoa salvou dados enquanto você editava. Recarregue o painel antes de continuar.' });
    }
    return respond(res, 200, { revision: data.revision });
  } catch (error) {
    return respond(res, 500, { error: error?.message || 'Não foi possível acessar os dados compartilhados.' });
  }
}
