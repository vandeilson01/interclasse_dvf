import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, LoaderCircle, QrCode, RefreshCw, ShieldCheck, Trash2, UserCheck, Users } from 'lucide-react';

const modalityLabel = { futsal: 'Futsal', volei: 'Vôlei' };

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}

export default function StudentRegistrationManager({ accessToken, onReloadData, saveStatus }) {
  const [signupUrl, setSignupUrl] = useState('');
  const [qrData, setQrData] = useState('');
  const [copied, setCopied] = useState(false);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const url = new URL('/inscricao', window.location.origin).toString();
    setSignupUrl(url);
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#102b45', light: '#ffffff' },
    }).then(setQrData).catch(() => setError('Não foi possível gerar o QR Code neste navegador.'));
  }, []);

  async function loadSignups() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/student-signups', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await readResponse(response);
      setSignups(result.signups || []);
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar as inscrições pendentes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSignups(); }, [accessToken]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Não foi possível copiar o link. Selecione e copie o endereço exibido.');
    }
  }

  async function reviewSignup(signup, action) {
    if (action === 'approve' && saveStatus !== 'saved') {
      setError('Aguarde a sincronização dos dados do painel antes de aprovar.');
      return;
    }
    if (action === 'reject' && !window.confirm(`Excluir a inscrição de ${signup.name}?`)) return;
    setBusyId(signup.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/student-signups', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: signup.id, action }),
      });
      await readResponse(response);
      setSignups((current) => current.filter((item) => item.id !== signup.id));
      if (action === 'approve') {
        await onReloadData?.();
        setNotice(`${signup.name} foi incluído(a) na lista de alunos. Agora pode ser vinculado(a) a uma equipe.`);
      } else {
        setNotice('Inscrição removida.');
      }
    } catch (reviewError) {
      setError(reviewError.message || 'Não foi possível revisar a inscrição.');
    } finally {
      setBusyId('');
    }
  }

  return <div className="student-registration-tools">
    <section className="panel signup-qr-panel">
      <div className="signup-qr-copy">
        <div className="eyebrow"><span /> INSCRIÇÃO PELO CELULAR</div>
        <h2>Compartilhe o QR Code</h2>
        <p>Os alunos podem se inscrever pelo próprio celular. As inscrições ficam pendentes até um professor conferir os dados.</p>
        <label className="form-label signup-link-label">Link público<input readOnly value={signupUrl} onFocus={(event) => event.target.select()} /></label>
        <div className="signup-qr-actions"><button className="button button-primary" onClick={copyLink}><Copy size={15} />{copied ? 'Link copiado' : 'Copiar link'}</button><a className="button button-quiet" href={signupUrl || '/inscricao'} target="_blank" rel="noreferrer"><ExternalLink size={15} />Abrir formulário</a></div>
        <div className="signup-privacy-note"><ShieldCheck size={15} /><span>O formulário não dá acesso ao painel ou aos dados dos times.</span></div>
      </div>
      <div className="signup-qr-image-wrap">{qrData ? <img className="signup-qr-image" src={qrData} alt={`QR Code para ${signupUrl}`} /> : <span className="signup-qr-loading"><LoaderCircle size={20} /></span>}<span>APONTE A CÂMERA PARA SE INSCREVER</span></div>
    </section>

    <section className="panel pending-signups-panel">
      <div className="pending-signups-heading"><div><div className="eyebrow"><span /> REVISÃO DO ELENCO</div><h2>Inscrições pendentes <span>{signups.length}</span></h2></div><button className="button button-quiet pending-refresh" onClick={loadSignups} disabled={loading || !!busyId}><RefreshCw size={15} />Atualizar</button></div>
      {error && <div className="access-alert access-alert-error" role="alert">{error}</div>}
      {notice && <div className="access-alert access-alert-success" role="status">{notice}</div>}
      {loading ? <div className="pending-signups-empty"><LoaderCircle className="spin" size={20} />Carregando inscrições…</div>
        : signups.length ? <div className="pending-signups-list">{signups.map((signup) => <article className="pending-signup-card" key={signup.id}>
          <div className="pending-signup-person"><span className="pending-signup-avatar">{signup.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><strong>{signup.name}</strong><span>{signup.classroom} · {signup.course || 'Curso não informado'}</span><small>{(signup.modalities || []).map((item) => modalityLabel[item] || item).join(' e ')}</small></div></div>
          <div className="pending-signup-actions"><button className="button button-primary" onClick={() => reviewSignup(signup, 'approve')} disabled={!!busyId || saveStatus !== 'saved'}><UserCheck size={15} />{busyId === signup.id ? 'Salvando…' : 'Aprovar'}</button><button className="button button-quiet pending-reject" onClick={() => reviewSignup(signup, 'reject')} disabled={!!busyId}><Trash2 size={15} />Excluir</button></div>
        </article>)}</div> : <div className="pending-signups-empty"><Users size={20} /><span>Nenhuma inscrição aguardando revisão.</span></div>}
      {signups.length > 0 && saveStatus !== 'saved' && <p className="pending-save-warning">Aguarde os dados atuais do painel sincronizarem antes de aprovar inscrições.</p>}
    </section>
  </div>;
}
