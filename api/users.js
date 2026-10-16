import { createClient } from '@supabase/supabase-js';
import { validateUsername, usernameToAuthEmail } from '../src/lib/usernames.js';

const ALLOWED_ROLES = new Set(['admin', 'organizer', 'scorekeeper']);
const MIN_PASSWORD_LENGTH = 8;

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

async function requireAdministrator(req, admin) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: { status: 401, message: 'Sessão necessária.' } };
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) return { error: { status: 401, message: 'Sessão expirada. Entre novamente.' } };
  const { data: profile, error: profileError } = await admin
    .from('teacher_roles')
    .select('user_id, role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'admin') {
    return { error: { status: 403, message: 'Somente o administrador pode gerenciar acessos.' } };
  }
  return { actor: authData.user };
}

async function adminCount(admin) {
  const { count, error } = await admin
    .from('teacher_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'admin');
  if (error) throw error;
  return count || 0;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return respond(res, 405, { error: 'Método não permitido.' });
  }

  const admin = getAdminClient();
  if (!admin) return respond(res, 503, { error: 'Gestão de acessos requer as variáveis server-side do Supabase na Vercel.' });

  try {
    const auth = await requireAdministrator(req, admin);
    if (auth.error) return respond(res, auth.error.status, { error: auth.error.message });

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('teacher_roles')
        .select('user_id, username, display_name, role, created_at')
        .order('display_name');
      if (error) throw error;
      return respond(res, 200, { users: data || [] });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (req.method === 'POST') {
      const username = validateUsername(body.username);
      const displayName = String(body.display_name || '').trim();
      const role = String(body.role || 'scorekeeper');
      const password = String(body.password || '');
      if (displayName.length < 2 || displayName.length > 80) {
        return respond(res, 400, { error: 'Informe um nome de exibição entre 2 e 80 caracteres.' });
      }
      if (!ALLOWED_ROLES.has(role)) return respond(res, 400, { error: 'Papel inválido.' });
      if (password.length < MIN_PASSWORD_LENGTH) {
        return respond(res, 400, { error: `A senha temporária deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: usernameToAuthEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      });
      if (createError) return respond(res, 400, { error: createError.message });

      const { error: roleError } = await admin.from('teacher_roles').insert({
        user_id: created.user.id,
        username,
        display_name: displayName,
        role,
      });
      if (roleError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return respond(res, 400, { error: roleError.message });
      }
      return respond(res, 201, { user: { user_id: created.user.id, username, display_name: displayName, role } });
    }

    const userId = String(body.user_id || '').trim();
    if (!userId) return respond(res, 400, { error: 'Identificador de usuário ausente.' });
    const { data: target, error: targetError } = await admin
      .from('teacher_roles')
      .select('user_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return respond(res, 404, { error: 'Conta não encontrada.' });

    if (req.method === 'PATCH') {
      const hasRole = Object.hasOwn(body, 'role');
      const hasPassword = Object.hasOwn(body, 'password');
      if (hasRole === hasPassword) return respond(res, 400, { error: 'Envie somente uma alteração: papel ou senha.' });

      if (hasRole) {
        const nextRole = String(body.role || '');
        if (!ALLOWED_ROLES.has(nextRole)) return respond(res, 400, { error: 'Papel inválido.' });
        if (userId === auth.actor.id && nextRole !== 'admin') {
          return respond(res, 400, { error: 'Não é possível remover seu próprio acesso de administrador.' });
        }
        if (target.role === 'admin' && nextRole !== 'admin' && await adminCount(admin) <= 1) {
          return respond(res, 400, { error: 'A interclasse precisa manter pelo menos um administrador.' });
        }
        const { error } = await admin.from('teacher_roles').update({ role: nextRole }).eq('user_id', userId);
        if (error) throw error;
        return respond(res, 200, { ok: true });
      }

      const password = String(body.password || '');
      if (password.length < MIN_PASSWORD_LENGTH) {
        return respond(res, 400, { error: `A senha temporária deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return respond(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      if (userId === auth.actor.id) return respond(res, 400, { error: 'Não é possível desativar a própria conta em uso.' });
      if (target.role === 'admin' && await adminCount(admin) <= 1) {
        return respond(res, 400, { error: 'A interclasse precisa manter pelo menos um administrador.' });
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return respond(res, 200, { ok: true });
    }
  } catch (error) {
    return respond(res, 500, { error: error?.message || 'Não foi possível concluir a operação.' });
  }
}
