import { createClient } from '@supabase/supabase-js';
import { normalizeStudentSignup } from '../src/lib/studentRegistration.js';

const MAX_SIGNUPS_PER_WINDOW = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const requestCounts = new Map();

function respond(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isRateLimited(req) {
  const forwarded = req.headers['x-vercel-forwarded-for']
    || req.headers['x-real-ip']
    || req.headers['x-forwarded-for']
    || req.socket?.remoteAddress
    || 'unknown';
  const key = String(forwarded).split(',')[0].trim() || 'unknown';
  const now = Date.now();
  if (requestCounts.size > 2500) {
    for (const [storedKey, value] of requestCounts) {
      if (now - value.startedAt >= RATE_WINDOW_MS) requestCounts.delete(storedKey);
    }
    if (requestCounts.size > 2500) requestCounts.delete(requestCounts.keys().next().value);
  }
  const current = requestCounts.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestCounts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_SIGNUPS_PER_WINDOW;
}

async function requireRosterManager(req, admin) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: { status: 401, message: 'Entre com uma conta de professor autorizada.' } };
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) {
    return { error: { status: 401, message: 'Sessão expirada. Entre novamente.' } };
  }
  const { data: profile, error: profileError } = await admin
    .from('teacher_roles')
    .select('user_id, role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || !['admin', 'organizer'].includes(profile?.role)) {
    return { error: { status: 403, message: 'Somente administrador ou organizador pode revisar inscrições.' } };
  }
  return { actor: authData.user };
}

async function deleteSignup(admin, id) {
  const { data, error } = await admin
    .from('student_signups')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function approveSignup(admin, signup) {
  const student = {
    id: signup.id,
    name: signup.name,
    classroom: signup.classroom,
    course: signup.course,
    modalities: signup.modalities,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: state, error: readError } = await admin
      .from('interclasse_state')
      .select('students, revision')
      .eq('id', 1)
      .single();
    if (readError) throw readError;
    const students = Array.isArray(state.students) ? state.students : [];

    if (students.some((item) => item.id === student.id)) return { student };

    const nameKey = student.name.toLocaleLowerCase('pt-BR');
    const classKey = student.classroom.toLocaleLowerCase('pt-BR');
    const duplicate = students.some((item) => String(item.name || '').trim().toLocaleLowerCase('pt-BR') === nameKey
      && String(item.classroom || '').trim().toLocaleLowerCase('pt-BR') === classKey);
    if (duplicate) {
      return { error: 'Já existe um aluno com o mesmo nome e turma. Confira o elenco antes de aprovar.' };
    }

    const { data: updated, error: updateError } = await admin
      .from('interclasse_state')
      .update({ students: [...students, student] })
      .eq('id', 1)
      .eq('revision', state.revision)
      .select('revision')
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return { student };
  }
  return { error: 'Os dados mudaram durante a aprovação. Atualize a tela e tente novamente.' };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return respond(res, 405, { error: 'Método não permitido.' });
  }

  const admin = getAdminClient();
  if (!admin) {
    return respond(res, 503, { error: 'As inscrições precisam das variáveis server-side do Supabase configuradas na Vercel.' });
  }

  try {
    if (req.method === 'POST') {
      if (isRateLimited(req)) return respond(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (String(body.website || '').trim()) return respond(res, 201, { ok: true });
      if (body.confirmCorrect !== true) {
        return respond(res, 400, { error: 'Confirme que seu nome e turma estão corretos.' });
      }
      const normalized = normalizeStudentSignup(body);
      if (normalized.error) return respond(res, 400, { error: normalized.error });

      const { data, error } = await admin
        .from('student_signups')
        .insert(normalized.value)
        .select('id')
        .single();
      if (error) throw error;
      return respond(res, 201, { ok: true, id: data.id });
    }

    const authorization = await requireRosterManager(req, admin);
    if (authorization.error) {
      return respond(res, authorization.error.status, { error: authorization.error.message });
    }

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('student_signups')
        .select('id, name, classroom, course, modalities, created_at')
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return respond(res, 200, { signups: data || [] });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return respond(res, 400, { error: 'Identificador de inscrição inválido.' });
    }
    if (!['approve', 'reject'].includes(action)) return respond(res, 400, { error: 'Ação inválida.' });

    const { data: signup, error: signupError } = await admin
      .from('student_signups')
      .select('id, name, classroom, course, modalities')
      .eq('id', id)
      .maybeSingle();
    if (signupError) throw signupError;
    if (!signup) return respond(res, 404, { error: 'Inscrição não encontrada ou já revisada.' });

    if (action === 'reject') {
      await deleteSignup(admin, id);
      return respond(res, 200, { ok: true });
    }

    const result = await approveSignup(admin, signup);
    if (result.error) return respond(res, 409, { error: result.error });
    await deleteSignup(admin, id);
    return respond(res, 200, { ok: true, student_id: result.student.id });
  } catch (error) {
    return respond(res, 500, { error: error?.message || 'Não foi possível processar a inscrição.' });
  }
}
