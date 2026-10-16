import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { ROLE_LABEL } from '../lib/accessContext.jsx';

const ROLE_OPTIONS = ['admin', 'organizer', 'scorekeeper'];

async function callUsersApi(accessToken, method, payload) {
  let response;
  try {
    response = await fetch('/api/users', {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  } catch {
    throw new Error('Não foi possível acessar a API de usuários. Confirme que o app está publicado na Vercel.');
  }
  let result;
  try { result = await response.json(); } catch {
    throw new Error('A API de gestão de acessos não está ativa neste Preview. Publique na Vercel e configure as variáveis server-side.');
  }
  if (!response.ok) throw new Error(result?.error || 'A operação não foi concluída.');
  return result;
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-';
  const values = new Uint32Array(20);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

export default function AccessManager({ accessToken, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createdCredential, setCreatedCredential] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('scorekeeper');
  const [password, setPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await callUsersApi(accessToken, 'GET');
      setUsers(result.users || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function createUser(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice(''); setCreatedCredential(null);
    try {
      const result = await callUsersApi(accessToken, 'POST', {
        display_name: displayName,
        username,
        role,
        password,
      });
      setCreatedCredential({ ...result.user, password });
      setDisplayName(''); setUsername(''); setRole('scorekeeper'); setPassword('');
      setNotice('Conta criada. Copie a senha temporária e entregue-a ao professor com segurança.');
      await loadUsers();
    } catch (createError) {
      setError(createError.message);
    } finally { setBusy(false); }
  }

  async function changeRole(user, nextRole) {
    if (nextRole === user.role) return;
    if (!window.confirm(`Alterar ${user.display_name} de “${ROLE_LABEL[user.role]}” para “${ROLE_LABEL[nextRole]}”?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await callUsersApi(accessToken, 'PATCH', { user_id: user.user_id, role: nextRole });
      setNotice(`Papel de ${user.display_name} atualizado.`);
      await loadUsers();
    } catch (updateError) {
      setError(updateError.message); await loadUsers();
    } finally { setBusy(false); }
  }

  async function resetPassword(user) {
    const nextPassword = window.prompt(`Nova senha temporária para ${user.display_name} (mínimo 8 caracteres):`);
    if (nextPassword === null) return;
    if (nextPassword.length < 8) { setError('A senha temporária deve ter pelo menos 8 caracteres.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await callUsersApi(accessToken, 'PATCH', { user_id: user.user_id, password: nextPassword });
      setNotice(`Senha de ${user.display_name} redefinida. Entregue a senha temporária em canal seguro.`);
    } catch (updateError) { setError(updateError.message); }
    finally { setBusy(false); }
  }

  async function deactivateUser(user) {
    if (!window.confirm(`Desativar ${user.display_name}? A conta de login e o acesso ao torneio serão removidos.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await callUsersApi(accessToken, 'DELETE', { user_id: user.user_id });
      setNotice(`Acesso de ${user.display_name} desativado.`);
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError.message); await loadUsers();
    } finally { setBusy(false); }
  }

  async function copyCredentials() {
    if (!createdCredential) return;
    const text = `Usuário: ${createdCredential.username}\nSenha temporária: ${createdCredential.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Usuário e senha temporária copiados. Compartilhe somente com o professor.');
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione os dados na caixa e copie manualmente.');
    }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span /> CONTROLE DE ACESSO</div><h1>Acessos dos professores</h1><p>Crie contas individuais e atribua somente as permissões necessárias.</p></div><button className="button button-quiet" onClick={loadUsers} disabled={loading || busy}><RefreshCw size={15} />Atualizar</button></div>
    <div className="access-notice"><ShieldCheck size={17} /><span>A criação e alteração de contas usa uma API server-side da Vercel; a chave administrativa não é enviada ao navegador.</span></div>
    {error && <div className="access-alert access-alert-error" role="alert">{error}</div>}
    {notice && <div className="access-alert access-alert-success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={14} /></button></div>}
    {createdCredential && <section className="created-credential"><div><strong>Credenciais temporárias — {createdCredential.display_name}</strong><code>Usuário: {createdCredential.username}</code><code>Senha: {createdCredential.password}</code><small>A senha aparece apenas nesta tela. Copie e entregue por um canal privado.</small></div><button className="button button-primary" onClick={copyCredentials}>Copiar credenciais</button></section>}

    <div className="access-layout">
      <section className="panel access-form-panel"><div className="panel-heading"><div><div className="eyebrow"><span /> NOVO ACESSO</div><h2>Criar conta</h2></div><span className="access-heading-icon"><UserPlus size={17} /></span></div>
        <form className="access-form" onSubmit={createUser}>
          <label className="form-label">Nome do professor<input autoComplete="off" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ex.: Nome Sobrenome" required /></label>
          <label className="form-label">Nome de usuário<input autoComplete="off" autoCapitalize="none" spellCheck="false" maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ex.: nome.sobrenome" required /><small>3–32 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.</small></label>
          <label className="form-label">Papel<select value={role} onChange={(event) => setRole(event.target.value)}>{ROLE_OPTIONS.map((item) => <option key={item} value={item}>{ROLE_LABEL[item]}</option>)}</select></label>
          <label className="form-label">Senha temporária<input autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 8 caracteres" required /></label>
          <button type="button" className="password-generate" onClick={() => setPassword(generatePassword())}><KeyRound size={14} />Gerar senha forte</button>
          <button className="button button-primary access-create-button" type="submit" disabled={busy}><Plus size={16} />{busy ? 'Salvando…' : 'Criar acesso'}</button>
        </form>
      </section>

      <section className="panel access-users-panel"><div className="panel-heading"><div><div className="eyebrow"><span /> CONTAS REGISTRADAS</div><h2>Professores com acesso</h2></div><span className="access-count"><Users size={14} />{users.length}</span></div>
        {loading ? <div className="access-empty"><LoaderCircle className="spin" size={20} />Carregando usuários…</div> : users.length ? <div className="access-user-list">{users.map((user) => <article className="access-user-row" key={user.user_id}><span className="access-user-avatar">{user.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div className="access-user-main"><strong>{user.display_name}{user.user_id === currentUserId && <small>VOCÊ</small>}</strong><span>@{user.username}</span></div><select aria-label={`Papel de ${user.display_name}`} value={user.role} disabled={busy || user.user_id === currentUserId} onChange={(event) => changeRole(user, event.target.value)}>{ROLE_OPTIONS.map((item) => <option key={item} value={item}>{ROLE_LABEL[item]}</option>)}</select><div className="access-user-actions"><button className="icon-button" title="Redefinir senha" aria-label={`Redefinir senha de ${user.display_name}`} disabled={busy} onClick={() => resetPassword(user)}><KeyRound size={15} /></button><button className="icon-button delete-icon" title="Desativar conta" aria-label={`Desativar ${user.display_name}`} disabled={busy || user.user_id === currentUserId} onClick={() => deactivateUser(user)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="access-empty"><Users size={22} /><strong>Nenhuma conta encontrada</strong><span>Confira se a migração e o bootstrap dos professores foram executados no Supabase.</span></div>}
        <div className="access-role-guide"><strong>Papéis desta interclasse</strong><span><b>Administrador:</b> todas as áreas e acessos.</span><span><b>Organizador:</b> alunos, equipes e placares; sem sorteios ou contas.</span><span><b>Responsável pelos placares:</b> consulta e lançamento de jogos pendentes.</span></div>
      </section>
    </div>
  </>;
}
