import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { signInWithSharedPassword } from '../lib/auth.js';

export default function LoginPage({ onLogin, error: externalError = '', busy: externalBusy = false }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLocalError('');
    setBusy(true);
    try {
      await signInWithSharedPassword(password);
      setPassword('');
      await onLogin();
    } catch (error) {
      setLocalError(error?.message || 'Não foi possível validar a senha compartilhada.');
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
      <div className="auth-brand-foot"><ShieldCheck size={15} /><span>Acesso restrito à organização da interclasse.</span></div>
      <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
    </section>
    <section className="auth-form-panel">
      <div className="auth-card">
        <div className="auth-card-icon"><LockKeyhole size={22} /></div>
        <div className="auth-form-eyebrow">ACESSO DA EQUIPE</div>
        <h2>Entre no sistema.</h2>
        <p className="auth-card-description">Informe a senha compartilhada com a equipe responsável pelo evento.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">Senha de acesso<span className="auth-password-field"><input autoFocus autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite a senha compartilhada" required /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {visibleError && <div className="auth-error" role="alert">{visibleError}</div>}
          <button className="auth-submit" type="submit" disabled={isBusy}>{isBusy ? 'Verificando acesso…' : <>Entrar no painel <ArrowRight size={17} /></>}</button>
        </form>
        <div className="auth-card-foot"><ShieldCheck size={14} /><span>Todos que têm a senha compartilhada usam as mesmas permissões.</span></div>
      </div>
      <footer className="auth-legal">CENTRO EDUCA MAIS DOMINGOS VIEIRA FILHO <span>·</span> INTERCLASSE TÉCNICO</footer>
    </section>
  </main>;
}

export function SetupPage({ message = 'Configure as variáveis server-side na Vercel e publique novamente.' }) {
  return <main className="setup-page"><section className="setup-card"><img src="/logo-escola.png" alt="Logo Educa Mais" /><span className="auth-form-eyebrow">CONFIGURAÇÃO DO SISTEMA</span><h1>Falta configurar o acesso.</h1><p>{message}</p><div className="setup-code"><code>INTERCLASSE_SHARED_PASSWORD</code><code>SUPABASE_URL</code><code>SUPABASE_SERVICE_ROLE_KEY</code></div><p className="setup-note">Cadastre as três variáveis somente no ambiente server-side da Vercel. Não coloque a senha nem a chave de serviço no código do navegador.</p></section></main>;
}

export function LoadingPage({ message = 'Carregando o ambiente seguro…' }) {
  return <main className="auth-loading"><img src="/logo-escola.png" alt="" /><span className="auth-loading-spinner" /><p>{message}</p></main>;
}
