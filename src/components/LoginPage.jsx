import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { signInWithUsername } from '../lib/auth.js';

export default function LoginPage({ onLogin, error: externalError = '', busy: externalBusy = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLocalError('');
    setBusy(true);
    try {
      const result = await signInWithUsername(username, password);
      onLogin(result.session);
    } catch (error) {
      const message = /username|usu.rio|caracteres/i.test(error?.message || '')
        ? error.message
        : 'Usuário ou senha incorretos. Confira os dados ou peça ajuda ao administrador.';
      setLocalError(message);
    } finally {
      setBusy(false);
    }
  }

  const isBusy = busy || externalBusy;
  const visibleError = localError || externalError;

  return <main className="auth-page">
    <section className="auth-brand-panel">
      <div className="auth-brand-lockup"><img src="/logo-escola.png" alt="Logo Educa Mais" /><div><span>CENTRO EDUCA MAIS</span><strong>DOMINGOS VIEIRA FILHO</strong></div></div>
      <div className="auth-brand-copy"><span className="auth-eyebrow"><i /> PAÇO DO LUMIAR · MA</span><h1>Interclasse Técnico<br /><em>2026</em></h1><p>Esporte, gestão e profissões em ação.</p><div className="auth-sports"><span>FUTSAL</span><i /><span>VÔLEI</span><i /><span>MATA-MATA</span></div></div>
      <div className="auth-brand-foot"><ShieldCheck size={15} /><span>Área restrita aos professores autorizados.</span></div>
      <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
    </section>
    <section className="auth-form-panel">
      <div className="auth-card">
        <div className="auth-card-icon"><LockKeyhole size={22} /></div>
        <div className="auth-form-eyebrow">ACESSO DE PROFESSORES</div>
        <h2>Entre na organização.</h2>
        <p className="auth-card-description">Use o nome de usuário e a senha fornecidos pelo administrador do evento.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">Usuário<input autoFocus autoComplete="username" autoCapitalize="none" spellCheck="false" maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ex.: andreson" required /></label>
          <label className="auth-label">Senha<span className="auth-password-field"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" required /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {visibleError && <div className="auth-error" role="alert">{visibleError}</div>}
          <button className="auth-submit" type="submit" disabled={isBusy}>{isBusy ? 'Verificando acesso…' : <>Entrar no painel <ArrowRight size={17} /></>}</button>
        </form>
        <div className="auth-card-foot"><ShieldCheck size={14} /><span>Não há cadastro público. Se não tem acesso, fale com o administrador.</span></div>
      </div>
      <footer className="auth-legal">CENTRO EDUCA MAIS DOMINGOS VIEIRA FILHO <span>·</span> INTERCLASSE TÉCNICO</footer>
    </section>
  </main>;
}

export function SupabaseSetupPage() {
  return <main className="setup-page"><section className="setup-card"><img src="/logo-escola.png" alt="Logo Educa Mais" /><span className="auth-form-eyebrow">CONFIGURAÇÃO DO SISTEMA</span><h1>Falta conectar o Supabase.</h1><p>Defina a URL e a chave pública do projeto para habilitar o login e os dados compartilhados.</p><div className="setup-code"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></div><p className="setup-note">Na Vercel, adicione as variáveis nas configurações do projeto e faça um novo deploy. A chave <code>SUPABASE_SERVICE_ROLE_KEY</code> deve ficar somente no ambiente server-side.</p></section></main>;
}

export function LoadingPage({ message = 'Carregando o ambiente seguro…' }) {
  return <main className="auth-loading"><img src="/logo-escola.png" alt="" /><span className="auth-loading-spinner" /><p>{message}</p></main>;
}
