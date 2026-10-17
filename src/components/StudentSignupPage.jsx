import React, { useState } from 'react';
import { Check, CheckCircle2, Footprints, ShieldCheck, Volleyball } from 'lucide-react';
import { normalizeStudentSignup, STUDENT_COURSES } from '../lib/studentRegistration.js';

const initialForm = {
  name: '',
  classroom: '',
  course: 'Não informado',
  modalities: [],
  confirmCorrect: false,
  website: '',
};

export default function StudentSignupPage() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleModality(modality) {
    setForm((current) => ({
      ...current,
      modalities: current.modalities.includes(modality)
        ? current.modalities.filter((item) => item !== modality)
        : [...current.modalities, modality],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const normalized = normalizeStudentSignup(form);
    if (normalized.error) { setError(normalized.error); return; }
    if (!form.confirmCorrect) { setError('Confirme que seu nome e turma estão corretos.'); return; }

    setBusy(true);
    try {
      const response = await fetch('/api/student-signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...normalized.value, confirmCorrect: form.confirmCorrect, website: form.website }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar sua inscrição. Tente novamente.');
      setSubmitted(true);
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message || 'Não foi possível enviar sua inscrição. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="student-signup-page">
    <div className="student-signup-shell">
      <header className="student-signup-brand">
        <img src="/logo-escola.png" alt="Logo Centro Educa Mais Domingos Vieira Filho" />
        <div><span>CENTRO EDUCA MAIS</span><strong>INTERCLASSE TÉCNICO 2026</strong></div>
      </header>
      <section className="student-signup-card">
        <div className="student-signup-eyebrow"><span /> INSCRIÇÃO DE PARTICIPANTES</div>
        <h1>Entre para o jogo.</h1>
        <p className="student-signup-intro">Preencha seus dados para participar da Interclasse. Um professor vai conferir a inscrição antes de incluir você na lista de equipes.</p>

        {submitted && <div className="student-signup-success" role="status"><CheckCircle2 size={20} /><div><strong>Inscrição enviada!</strong><span>Ela ficará aguardando a conferência de um professor.</span></div></div>}

        <form className="student-signup-form" onSubmit={submit}>
          <label className="form-label">Nome completo<input autoComplete="name" maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Ana Beatriz Silva" required /></label>
          <label className="form-label">Turma<input maxLength={30} value={form.classroom} onChange={(event) => setForm((current) => ({ ...current, classroom: event.target.value }))} placeholder="Ex.: 2º ano B" required /></label>
          <label className="form-label">Curso técnico<select value={form.course} onChange={(event) => setForm((current) => ({ ...current, course: event.target.value }))}>{STUDENT_COURSES.map((course) => <option key={course} value={course}>{course}</option>)}</select></label>

          <fieldset className="form-fieldset student-signup-sports">
            <legend>Em quais modalidades quer participar? <small>Escolha uma ou as duas.</small></legend>
            <div className="checkbox-row">
              <label className={`checkbox-card ${form.modalities.includes('futsal') ? 'checked' : ''}`}><input type="checkbox" checked={form.modalities.includes('futsal')} onChange={() => toggleModality('futsal')} /><Footprints size={18} /><span>Futsal</span>{form.modalities.includes('futsal') && <Check size={15} />}</label>
              <label className={`checkbox-card ${form.modalities.includes('volei') ? 'checked' : ''}`}><input type="checkbox" checked={form.modalities.includes('volei')} onChange={() => toggleModality('volei')} /><Volleyball size={18} /><span>Vôlei</span>{form.modalities.includes('volei') && <Check size={15} />}</label>
            </div>
          </fieldset>

          <label className="student-signup-confirm"><input type="checkbox" checked={form.confirmCorrect} onChange={(event) => setForm((current) => ({ ...current, confirmCorrect: event.target.checked }))} /><span>Confirmo que meu nome e minha turma estão corretos.</span></label>
          <div className="student-signup-privacy"><ShieldCheck size={15} /><span>Os dados serão usados somente para organizar a Interclasse e formar as equipes.</span></div>
          <label className="student-signup-honeypot" aria-hidden="true" tabIndex={-1}>Deixe este campo vazio<input autoComplete="off" name="website" tabIndex={-1} value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary student-signup-submit" type="submit" disabled={busy}>{busy ? 'Enviando inscrição…' : 'Enviar inscrição'}</button>
        </form>
      </section>
      <footer className="student-signup-footer">PAÇO DO LUMIAR · MARANHÃO <span>·</span> ESPORTE, UNIÃO E RESPEITO</footer>
    </div>
  </main>;
}
