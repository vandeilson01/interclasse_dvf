import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, Download,
  FileJson2, Footprints, LayoutDashboard, MapPin, Medal, Menu,
  KeyRound, LogOut, Pencil, Plus, Search, ShieldCheck, Shuffle, Trash2, Trophy, UserRound, Users,
  Volleyball, X, Zap, RefreshCw, Upload,
} from 'lucide-react';
import { makeBackup, normalizeData } from './lib/storage.js';
import { drawTournament, recordResult } from './lib/tournament.js';
import { useAccess } from './lib/accessContext.jsx';
import { changeOwnPassword } from './lib/auth.js';
import AccessManager from './components/AccessManager.jsx';

const SPORT_LABEL = { futsal: 'Futsal', volei: 'Vôlei' };
const NAV_ITEMS = [
  { id: 'inicio', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'alunos', label: 'Alunos', icon: UserRound },
  { id: 'equipes', label: 'Equipes', icon: Users },
  { id: 'chaves', label: 'Chaves', icon: Trophy },
  { id: 'jogos', label: 'Jogos e placares', icon: ClipboardList },
  { id: 'acessos', label: 'Acessos', icon: ShieldCheck },
];
const SPORT_COLORS = ['#12b7e8', '#7b62f4', '#f59e0b', '#f04c70', '#20b989', '#315cf3'];
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

function showRound(tournament, matchId) {
  return tournament?.rounds?.find((round) => round.matches.some((match) => match.id === matchId))?.label || '—';
}

function App({ data, setData, profile, session, saveStatus, saveError, onRetrySave, onReloadData, onLogout }) {
  const access = useAccess();
  const [page, setPage] = useState('inicio');
  const [sport, setSport] = useState('futsal');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const importRef = useRef(null);
  const visibleNavItems = NAV_ITEMS.filter((item) => item.id !== 'acessos' || access.isAdmin);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleNavigate = (event) => {
      if (!NAV_ITEMS.some((item) => item.id === event.detail) || (event.detail === 'acessos' && !access.isAdmin)) return;
      setPage(event.detail);
      setSearch('');
      setMobileNavOpen(false);
    };
    window.addEventListener('interclasse-navigate', handleNavigate);
    return () => window.removeEventListener('interclasse-navigate', handleNavigate);
  }, [access.isAdmin]);

  const teamsBySport = useMemo(() => data.teams.filter((team) => team.modality === sport), [data.teams, sport]);
  const activeCompetition = data.competitions?.[sport] || null;
  const currentYear = new Date().getFullYear();

  function goTo(nextPage) {
    setPage(nextPage);
    setSearch('');
    setMobileNavOpen(false);
  }

  function saveStudent(student) {
    if (!access.canManageRoster) return;
    setData((previous) => {
      const exists = previous.students.some((item) => item.id === student.id);
      return {
        ...previous,
        students: exists
          ? previous.students.map((item) => item.id === student.id ? student : item)
          : [...previous.students, student],
      };
    });
    setModal(null);
    setToast('Cadastro de aluno salvo.');
  }

  function removeStudent(student) {
    if (!access.canManageRoster) return;
    if (!window.confirm(`Excluir o cadastro de ${student.name}?`)) return;
    setData((previous) => ({
      ...previous,
      students: previous.students.filter((item) => item.id !== student.id),
      teams: previous.teams.map((team) => ({ ...team, studentIds: team.studentIds.filter((id) => id !== student.id) })),
    }));
    setToast('Aluno removido.');
  }

  function saveTeam(team) {
    if (!access.canManageRoster) return;
    setData((previous) => {
      const exists = previous.teams.some((item) => item.id === team.id);
      return {
        ...previous,
        teams: exists
          ? previous.teams.map((item) => item.id === team.id ? team : item)
          : [...previous.teams, team],
      };
    });
    setModal(null);
    setToast('Equipe salva.');
  }

  function removeTeam(team) {
    if (!access.canManageRoster) return;
    const inCompetition = Object.values(data.competitions || {}).some((competition) => competition?.teamIds?.includes(team.id));
    if (inCompetition) {
      window.alert('Esta equipe já está em uma chave sorteada. Apague ou refaça o sorteio da modalidade antes de removê-la.');
      return;
    }
    if (!window.confirm(`Excluir a equipe ${team.name}?`)) return;
    setData((previous) => ({ ...previous, teams: previous.teams.filter((item) => item.id !== team.id) }));
    setToast('Equipe removida.');
  }

  function createDraw() {
    if (!access.canManageDraw) return;
    try {
      const next = drawTournament(sport, teamsBySport);
      setData((previous) => ({ ...previous, competitions: { ...previous.competitions, [sport]: next } }));
      setToast(`Sorteio de ${SPORT_LABEL[sport]} realizado.`);
    } catch (error) {
      window.alert(error.message);
    }
  }

  function resetDraw() {
    if (!access.canManageDraw) return;
    if (!window.confirm(`Refazer o sorteio de ${SPORT_LABEL[sport]}? A chave e os resultados atuais desta modalidade serão apagados.`)) return;
    setData((previous) => ({ ...previous, competitions: { ...previous.competitions, [sport]: null } }));
    setToast('Chave removida. Você pode realizar um novo sorteio.');
  }

  function saveScore(match, values) {
    const currentMatch = data.competitions?.[sport]?.rounds?.flatMap((round) => round.matches).find((item) => item.id === match.id);
    const scoreAllowed = currentMatch?.status === 'pending' && access.canEnterPendingScores;
    const editAllowed = currentMatch?.status === 'complete' && access.canEditScores;
    if (!scoreAllowed && !editAllowed) return;
    try {
      const updated = recordResult(data.competitions[sport], match.id, values);
      setData((previous) => ({ ...previous, competitions: { ...previous.competitions, [sport]: updated } }));
      setModal(null);
      setToast('Placar salvo e vencedor encaminhado para a próxima fase.');
    } catch (error) {
      window.alert(error.message);
    }
  }

  function exportJson() {
    const content = JSON.stringify(makeBackup(data), null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `interclasse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    setToast('Cópia JSON baixada. Guarde o arquivo em local seguro.');
  }

  async function importJson(event) {
    if (!access.isAdmin) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = normalizeData(JSON.parse(await file.text()));
      if (!window.confirm(`Importar ${parsed.students.length} aluno(s) e ${parsed.teams.length} equipe(s)? Isso substituirá os dados compartilhados atuais de toda a interclasse.`)) return;
      setData(parsed);
      setToast('Dados JSON importados.');
    } catch (error) {
      window.alert(error.message || 'Não foi possível ler o arquivo JSON.');
    }
  }

  const pageTitle = NAV_ITEMS.find((item) => item.id === page)?.label || 'Visão geral';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-logo"><img src="/logo-escola.png" alt="Logo Centro Educa Mais" /></div>
          <div className="brand-copy"><span className="brand-overline">CENTRO EDUCA MAIS</span><strong>INTERCLASSE TÉCNICO</strong></div>
          <button className="mobile-close icon-button" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <div className="nav-section-label">MENU PRINCIPAL</div>
        <nav className="primary-nav" aria-label="Navegação principal">
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => goTo(id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{page === id && <span className="nav-active-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-season">
          <div className="season-icon"><Zap size={17} fill="currentColor" /></div>
          <div><span>EDIÇÃO</span><strong>{currentYear}</strong></div>
          <span className="season-live"><i /> ATIVA</span>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-school"><MapPin size={15} /><span>Paço do Lumiar · MA</span></div>
          <div className="sidebar-bottom-line" />
          <span className="sidebar-footnote">ESPORTE, UNIÃO E RESPEITO</span>
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <div className="breadcrumb"><span>Interclasse Técnico {currentYear}</span><ChevronRight size={14} /><strong>{pageTitle}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className={`save-indicator ${saveStatus === 'error' ? 'save-error' : ''}`} title={saveError || 'Estado compartilhado no Supabase'}>
              <span className="save-dot" />{saveStatus === 'saving' ? 'Sincronizando' : saveStatus === 'error' ? 'Falha ao salvar' : 'Sincronizado'}
            </div>
            <button className="button button-quiet button-export" onClick={exportJson}><Download size={16} /><span>Exportar JSON</span></button>
            {access.isAdmin && <><button className="button button-primary button-import" onClick={() => importRef.current?.click()}><Upload size={16} /><span>Importar</span></button><input ref={importRef} type="file" accept=".json,application/json" className="visually-hidden" onChange={importJson} /></>}
            <div className="account-tools"><div className="account-chip" title={access.roleLabel}><span className="account-avatar">{initials(profile.display_name)}</span><div className="account-copy"><strong>{profile.display_name}</strong><small>{access.roleLabel}</small></div></div><button className="logout-button" title="Alterar minha senha" aria-label="Alterar minha senha" onClick={() => setModal({ type: 'password' })}><KeyRound size={15} /></button><button className="logout-button" title="Sair" aria-label="Sair" onClick={onLogout}><LogOut size={15} /></button></div>
          </div>
        </header>

        {saveStatus === 'error' && <div className="sync-warning" role="alert"><span>{saveError || 'O último salvamento não foi confirmado.'}</span><button onClick={onRetrySave}>Tentar salvar novamente</button><button onClick={() => { if (window.confirm('Recarregar descarta alterações locais ainda não sincronizadas. Exporte um JSON antes, se quiser preservá-las. Continuar?')) onReloadData(); }}>Recarregar banco</button></div>}
        <section className="page-content">
          {page === 'inicio' && <><Dashboard data={data} onNavigate={goTo} /><ProjectCourseBand students={data.students} /></>}
          {page === 'alunos' && <StudentsPage data={data} search={search} setSearch={setSearch} canManage={access.canManageRoster} onAdd={() => setModal({ type: 'student' })} onEdit={(student) => setModal({ type: 'student', item: student })} onDelete={removeStudent} />}
          {page === 'equipes' && <TeamsPage data={data} sport={sport} setSport={setSport} teams={teamsBySport} canManage={access.canManageRoster} onAdd={() => setModal({ type: 'team' })} onEdit={(team) => setModal({ type: 'team', item: team })} onDelete={removeTeam} />}
          {page === 'chaves' && <BracketPage data={data} sport={sport} setSport={setSport} teams={teamsBySport} competition={activeCompetition} canDraw={access.canManageDraw} canEditScores={access.canEditScores} canEnterPendingScores={access.canEnterPendingScores} onDraw={createDraw} onReset={resetDraw} onScore={(match) => setModal({ type: 'score', item: match })} />}
          {page === 'jogos' && <GamesPage data={data} sport={sport} setSport={setSport} competition={activeCompetition} canEditScores={access.canEditScores} canEnterPendingScores={access.canEnterPendingScores} onScore={(match) => setModal({ type: 'score', item: match })} />}
          {page === 'acessos' && access.isAdmin && <AccessManager accessToken={session.access_token} currentUserId={profile.user_id} />}
        </section>
        <footer className="page-footer"><span>INTERCLASSE TÉCNICO {currentYear} <b>·</b> CENTRO EDUCA MAIS DOMINGOS VIEIRA FILHO</span><span>{saveStatus === 'error' ? 'O estado compartilhado precisa ser sincronizado.' : 'Dados compartilhados com a equipe pelo Supabase.'}</span></footer>
      </main>

      {modal && <Modal title={modal.type === 'student' ? (modal.item ? 'Editar aluno' : 'Novo aluno') : modal.type === 'team' ? (modal.item ? 'Editar equipe' : 'Nova equipe') : modal.type === 'password' ? 'Alterar senha' : 'Lançar placar'} onClose={() => setModal(null)}>
        {modal.type === 'student' && <StudentForm initial={modal.item} onSave={saveStudent} onCancel={() => setModal(null)} />}
        {modal.type === 'team' && <TeamForm initial={modal.item} students={data.students} currentSport={sport} onSave={saveTeam} onCancel={() => setModal(null)} />}
        {modal.type === 'score' && <ScoreForm match={modal.item} competition={activeCompetition} teams={data.teams} sport={sport} onSave={(values) => saveScore(modal.item, values)} onCancel={() => setModal(null)} />}
        {modal.type === 'password' && <PasswordForm onSave={async (password) => { await changeOwnPassword(password); setModal(null); setToast('Sua senha foi atualizada.'); }} onCancel={() => setModal(null)} />}
      </Modal>}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

function Dashboard({ data, onNavigate }) {
  const competitions = Object.entries(data.competitions || {}).filter(([, item]) => item);
  const allMatches = competitions.flatMap(([modality, competition]) => competition.rounds.flatMap((round) => round.matches.map((match) => ({ ...match, modality, round: round.label }))));
  const completed = allMatches.filter((match) => match.status === 'complete').length;
  const champions = competitions.filter(([, competition]) => competition.rounds.at(-1)?.matches?.[0]?.winnerId).length;
  const upcoming = allMatches.filter((match) => match.status === 'pending').slice(0, 4);
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  return <>
    <div className="welcome-banner">
      <div className="welcome-text"><div className="banner-kicker"><span className="banner-star">✦</span> INTERCLASSE TÉCNICO {new Date().getFullYear()}</div><h1>Esporte, gestão e profissões em ação.</h1><p>Futsal e vôlei como experiência prática de organização, trabalho em equipe e aprendizagem para a Feira das Profissões.</p><button className="banner-link" onClick={() => onNavigate('chaves')}>Acessar as chaves <ArrowRight size={16} /></button></div>
      <div className="welcome-year"><span>EDIÇÃO</span><strong>{new Date().getFullYear()}</strong><div className="welcome-ball"><Activity size={31} /></div></div>
      <div className="banner-stripe stripe-one"/><div className="banner-stripe stripe-two"/>
    </div>

    <div className="dashboard-section-head"><div><div className="eyebrow"><span /> A INTERCLASSE EM NÚMEROS</div><h2>Resumo da competição</h2></div><button className="text-action" onClick={() => onNavigate('jogos')}>Ver resultados <ArrowUpRight size={15} /></button></div>
    <div className="stats-grid">
      <StatCard icon={UserRound} label="Alunos inscritos" value={data.students.length} caption="Participantes cadastrados" accent="cyan" />
      <StatCard icon={ShieldCheck} label="Equipes" value={data.teams.length} caption="Nas duas modalidades" accent="violet" />
      <StatCard icon={ClipboardList} label="Jogos finalizados" value={completed} caption={`${allMatches.length} confronto(s) sorteado(s)`} accent="amber" />
      <StatCard icon={Trophy} label="Campeões definidos" value={champions} caption="Futsal e vôlei" accent="green" />
    </div>

    <div className="dashboard-columns">
      <section className="panel upcoming-panel">
        <div className="panel-heading"><div><div className="eyebrow"><span /> AGENDA</div><h2>Próximos confrontos</h2></div><span className="panel-badge"><Clock3 size={13} /> EM BREVE</span></div>
        {upcoming.length ? <div className="upcoming-list">{upcoming.map((match) => {
          const team1 = teamById.get(match.team1Id); const team2 = teamById.get(match.team2Id);
          return <div className="upcoming-row" key={match.id}><div className={`sport-mini ${match.modality}`}>{match.modality === 'futsal' ? <Footprints size={15} /> : <Volleyball size={15} />}</div><div className="upcoming-info"><div className="upcoming-meta">{SPORT_LABEL[match.modality]} <span>·</span> {match.round}</div><strong>{team1?.name || 'Equipe'} <i>vs</i> {team2?.name || 'Equipe'}</strong></div><span className="match-status status-pending">A definir</span></div>;
        })}</div> : <div className="empty-inline"><div className="empty-mark"><CalendarDays size={20} /></div><strong>Nenhum jogo marcado ainda</strong><span>Cadastre equipes e faça o sorteio para ver os confrontos por aqui.</span><button className="text-action" onClick={() => onNavigate('equipes')}>Organizar equipes <ArrowRight size={14} /></button></div>}
        <button className="panel-footer-action" onClick={() => onNavigate('jogos')}>Abrir tabela de jogos <ArrowRight size={15} /></button>
      </section>
      <section className="panel quick-panel">
        <div className="panel-heading"><div><div className="eyebrow"><span /> ORGANIZAÇÃO</div><h2>Comece por aqui</h2></div><div className="quick-spark"><Zap size={18} fill="currentColor" /></div></div>
        <div className="quick-steps">
          <button className="quick-step" onClick={() => onNavigate('alunos')}><span className="quick-step-number">01</span><span className="quick-step-icon"><UserRound size={17} /></span><span className="quick-step-copy"><strong>Cadastre os alunos</strong><small>Nome, turma e modalidade</small></span><ChevronRight size={17} /></button>
          <button className="quick-step" onClick={() => onNavigate('equipes')}><span className="quick-step-number">02</span><span className="quick-step-icon"><Users size={17} /></span><span className="quick-step-copy"><strong>Monte as equipes</strong><small>Selecione os participantes</small></span><ChevronRight size={17} /></button>
          <button className="quick-step" onClick={() => onNavigate('chaves')}><span className="quick-step-number">03</span><span className="quick-step-icon"><Shuffle size={17} /></span><span className="quick-step-copy"><strong>Sorteie os confrontos</strong><small>Chave única, só mata-mata</small></span><ChevronRight size={17} /></button>
        </div>
        <div className="quick-note"><CircleHelp size={16} /><span>Faça uma cópia JSON para guardar seus cadastros.</span></div>
      </section>
    </div>
    <div className="dashboard-sport-strip"><div className="sport-strip-title"><span className="eyebrow"><span /> DUAS MODALIDADES</span><strong>Uma escola. Grandes partidas.</strong></div><div className="sport-strip-card futsal-card"><div className="sport-strip-icon"><Footprints size={20} /></div><div><span>QUADRA</span><strong>Futsal</strong></div><span className="sport-strip-count">{data.teams.filter((team) => team.modality === 'futsal').length} equipes</span><button onClick={() => { onNavigate('chaves'); }} aria-label="Ver chave de futsal"><ArrowUpRight size={17} /></button></div><div className="sport-strip-card volei-card"><div className="sport-strip-icon"><Volleyball size={20} /></div><div><span>REDE</span><strong>Vôlei</strong></div><span className="sport-strip-count">{data.teams.filter((team) => team.modality === 'volei').length} equipes</span><button onClick={() => { onNavigate('chaves'); }} aria-label="Ver chave de vôlei"><ArrowUpRight size={17} /></button></div></div>
  </>;
}

function ProjectCourseBand({ students }) {
  const courseCount = (course) => students.filter((student) => student.course === course).length;
  return <section className="project-course-band"><div className="course-band-heading"><div className="eyebrow"><span /> PROJETO INTEGRADOR · FEIRA DAS PROFISSÕES</div><h2>Conhecimento técnico em ação.</h2><p>Cada curso faz parte do jogo — dentro e fora da quadra.</p></div><div className="course-collab-grid"><article className="course-collab-card marketing"><span className="course-collab-icon"><Zap size={17} /></span><div><span>CURSO TÉCNICO · {courseCount('Marketing')} ALUNO(S)</span><strong>Marketing</strong><small>Identidade visual, divulgação e conexão com a comunidade.</small></div></article><article className="course-collab-card administration"><span className="course-collab-icon"><CalendarDays size={17} /></span><div><span>CURSO TÉCNICO · {courseCount('Administração')} ALUNO(S)</span><strong>Administração</strong><small>Planejamento, organização de recursos e gestão do evento.</small></div></article><article className="course-collab-card informatics"><span className="course-collab-icon"><FileJson2 size={17} /></span><div><span>CURSO TÉCNICO · {courseCount('Informática')} ALUNO(S)</span><strong>Informática</strong><small>Inscrições, chaveamento e acompanhamento digital dos resultados.</small></div></article></div></section>;
}

function StatCard({ icon: Icon, label, value, caption, accent }) {
  return <div className={`stat-card stat-${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18} /></span></div><strong className="stat-value">{value}</strong><span className="stat-caption">{caption}</span><div className="stat-underline" /></div>;
}

function SportTabs({ sport, setSport }) {
  return <div className="sport-tabs" role="tablist" aria-label="Modalidade"><button role="tab" aria-selected={sport === 'futsal'} className={sport === 'futsal' ? 'selected' : ''} onClick={() => setSport('futsal')}><Footprints size={15} />Futsal</button><button role="tab" aria-selected={sport === 'volei'} className={sport === 'volei' ? 'selected' : ''} onClick={() => setSport('volei')}><Volleyball size={15} />Vôlei</button></div>;
}

function StudentsPage({ data, search, setSearch, canManage, onAdd, onEdit, onDelete }) {
  const normalized = search.trim().toLocaleLowerCase('pt-BR');
  const students = data.students.filter((student) => `${student.name} ${student.classroom}`.toLocaleLowerCase('pt-BR').includes(normalized)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const teamCount = (studentId) => data.teams.filter((team) => team.studentIds.includes(studentId)).length;
  return <>
    <PageHeading eyebrow="CADASTROS" title="Alunos" description="Mantenha os participantes organizados antes de formar os times.">{canManage && <button className="button button-primary" onClick={onAdd}><Plus size={17} />Novo aluno</button>}</PageHeading>
    <div className="list-toolbar"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou turma..." /><kbd>⌘ K</kbd></div><span className="toolbar-count"><b>{data.students.length}</b> cadastrado(s)</span></div>
    <section className="panel data-panel">
      {students.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>ALUNO</th><th>TURMA / CURSO</th><th>MODALIDADES</th><th>EQUIPES</th>{canManage && <th className="action-cell">AÇÕES</th>}</tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><div className="person-cell"><span className="avatar" style={{ '--avatar-color': avatarColor(student.name) }}>{initials(student.name)}</span><span className="person-name">{student.name}</span></div></td><td><span className="class-chip">{student.classroom}</span><small className="student-course">{student.course || 'Curso não informado'}</small></td><td><div className="inline-sports">{(student.modalities || []).map((modality) => <SportBadge key={modality} sport={modality} />)}</div></td><td>{teamCount(student.id) ? <span className="team-count">{teamCount(student.id)} equipe(s)</span> : <span className="muted">Sem equipe</span>}</td>{canManage && <td className="action-cell"><div className="row-actions"><button className="icon-button edit-icon" onClick={() => onEdit(student)} aria-label={`Editar ${student.name}`}><Pencil size={16} /></button><button className="icon-button delete-icon" onClick={() => onDelete(student)} aria-label={`Excluir ${student.name}`}><Trash2 size={16} /></button></div></td>}</tr>)}</tbody></table></div> : <EmptyState icon={UserRound} title={search ? 'Nenhum aluno encontrado' : 'Ainda não há alunos'} description={search ? 'Tente outro nome ou turma.' : 'Cadastre os estudantes que vão participar da interclasse.'} action={!search && canManage && <button className="button button-primary" onClick={onAdd}><Plus size={16} />Cadastrar primeiro aluno</button>} />}
    </section>
  </>;
}

function TeamsPage({ data, sport, setSport, teams, canManage, onAdd, onEdit, onDelete }) {
  return <>
    <PageHeading eyebrow="ORGANIZAÇÃO DAS EQUIPES" title="Equipes" description="Monte os times e vincule os alunos participantes.">{canManage && <button className="button button-primary" onClick={onAdd}><Plus size={17} />Nova equipe</button>}</PageHeading>
    <div className="teams-toolbar"><SportTabs sport={sport} setSport={setSport} /><div className="toolbar-count"><b>{teams.length}</b> equipe(s) em {SPORT_LABEL[sport]}</div></div>
    {teams.length ? <div className="team-grid">{teams.map((team) => {
      const roster = team.studentIds.map((id) => data.students.find((student) => student.id === id)).filter(Boolean);
      return <article className="team-card" key={team.id} style={{ '--team-color': team.color || '#12b7e8' }}><div className="team-card-top"><div className="team-emblem">{initials(team.name)}</div>{canManage && <div className="team-actions"><button className="icon-button" onClick={() => onEdit(team)} aria-label={`Editar equipe ${team.name}`}><Pencil size={15} /></button><button className="icon-button delete-icon" onClick={() => onDelete(team)} aria-label={`Excluir equipe ${team.name}`}><Trash2 size={15} /></button></div>}</div><div className="team-kind">{sport === 'futsal' ? <Footprints size={13} /> : <Volleyball size={13} />}{SPORT_LABEL[sport].toUpperCase()}</div><h3>{team.name}</h3><div className="team-members-label"><Users size={14} /> ELENCO <span>{roster.length}</span></div><div className="team-roster">{roster.length ? roster.slice(0, 4).map((student) => <div className="roster-person" key={student.id}><span className="roster-avatar" style={{ '--avatar-color': avatarColor(student.name) }}>{initials(student.name)}</span><span>{student.name}</span><small>{student.classroom}</small></div>) : <div className="roster-empty">Nenhum aluno vinculado</div>}{roster.length > 4 && <div className="roster-more">+{roster.length - 4} participantes</div>}</div><div className="team-card-foot"><span className="team-color-dot" />{team.colorName || 'Cor da equipe'}<span className="team-foot-count">{roster.length} atleta(s)</span></div></article>;
    })}{canManage && <button className="team-add-card" onClick={onAdd}><span className="team-add-icon"><Plus size={20} /></span><strong>Adicionar outra equipe</strong><span>Monte o próximo time de {SPORT_LABEL[sport].toLowerCase()}.</span></button>}</div> : <section className="panel"><EmptyState icon={Users} title={`Nenhuma equipe de ${SPORT_LABEL[sport].toLowerCase()} cadastrada`} description={data.students.length ? 'Crie a primeira equipe e escolha seus participantes.' : 'Cadastre alunos antes de montar o elenco das equipes.'} action={canManage && <button className="button button-primary" onClick={onAdd}><Plus size={16} />Criar equipe</button>} /></section>}
    <div className="info-callout"><CircleHelp size={17} /><span>As equipes de vôlei e futsal ficam em torneios separados. Equipes adicionadas após o sorteio só entram em uma nova chave.</span></div>
  </>;
}

function BracketPage({ data, sport, setSport, teams, competition, canDraw, canEditScores, canEnterPendingScores, onDraw, onReset, onScore }) {
  const champion = competition?.rounds?.at(-1)?.matches?.[0]?.winnerId;
  const championTeam = data.teams.find((team) => team.id === champion);
  const matchCount = competition?.rounds?.reduce((sum, round) => sum + round.matches.length, 0) || 0;
  if (!competition && !canDraw) return <><PageHeading eyebrow="SORTEIO E CHAVEAMENTO" title="Chave eliminatória" description="Sorteio aleatório, avanço de vencedores e disputa até a final."><SportTabs sport={sport} setSport={setSport} /></PageHeading><section className="panel"><EmptyState icon={ShieldCheck} title="Sorteio reservado ao administrador" description="Você poderá consultar a chave assim que o administrador realizar o sorteio." /></section></>;
  return <>
    <PageHeading eyebrow="SORTEIO E CHAVEAMENTO" title="Chave eliminatória" description="Sorteio aleatório, avanço de vencedores e disputa até a final."><SportTabs sport={sport} setSport={setSport} /></PageHeading>
    {competition ? <>
      <div className="bracket-toolbar"><div className="bracket-summary"><span className={`sport-summary-icon ${sport}`}>{sport === 'futsal' ? <Footprints size={17} /> : <Volleyball size={17} />}</span><div><strong>{SPORT_LABEL[sport]}</strong><span>{competition.teamIds.length} equipes · {matchCount} jogos na chave</span></div><span className="drawn-label"><Check size={13} /> SORTEADO</span></div>{canDraw && <button className="button button-quiet reset-button" onClick={onReset}><RefreshCw size={15} />Refazer sorteio</button>}</div>
      {championTeam && <div className="champion-banner"><div className="champion-icon"><Trophy size={22} /></div><div><span>CAMPEÃ(O) DE {SPORT_LABEL[sport].toUpperCase()}</span><strong>{championTeam.name}</strong></div><span className="champion-seal"><Medal size={18} /> CAMPEÃO</span></div>}
      <div className="bracket-disclaimer"><Shuffle size={15} /><span>Chave montada por sorteio. Partidas de vaga direta avançam automaticamente; lance os placares para atualizar os próximos confrontos.</span></div>
      <div className="bracket-scroll"><div className="bracket-board">{competition.rounds.map((round, index) => <div className="bracket-round" key={index}><div className="round-heading"><span className="round-index">0{index + 1}</span><div><strong>{round.label}</strong><small>{round.matches.filter((match) => match.status === 'complete').length} de {round.matches.filter((match) => match.team1Id && match.team2Id).length} finalizado(s)</small></div></div><div className={`round-matches round-count-${round.matches.length}`}>{round.matches.map((match) => <BracketMatch key={match.id} match={match} teams={data.teams} sport={sport} canEditScores={canEditScores} canEnterPendingScores={canEnterPendingScores} onScore={() => onScore(match)} />)}</div></div>)}</div></div>
      <div className="bracket-legend"><span><i className="legend-dot legend-win" />Vencedor classificado</span><span><i className="legend-dot legend-pending" />Aguardando partida</span><span><i className="legend-dot legend-bye" />Avanço direto</span></div>
    </> : <div className="draw-layout"><section className="panel draw-card"><div className="draw-art"><div className="draw-art-ring ring-a"/><div className="draw-art-ring ring-b"/><div className="draw-art-ball">{sport === 'futsal' ? <Footprints size={31} /> : <Volleyball size={31} />}</div><span className="draw-art-spark spark-a">✦</span><span className="draw-art-spark spark-b">✧</span></div><div className="eyebrow centered"><span /> SORTEIO DE {SPORT_LABEL[sport].toUpperCase()}</div><h2>A competição vai começar.</h2><p>Cadastre no mínimo duas equipes de {SPORT_LABEL[sport].toLowerCase()} para sortear os confrontos e montar a chave eliminatória.</p><div className="draw-stats"><div><strong>{teams.length}</strong><span>equipe(s) inscrita(s)</span></div><div><strong>{teams.length >= 2 ? Math.ceil(Math.log2(teams.length)) : '—'}</strong><span>fase(s) até a final</span></div></div><button className="button button-primary button-draw" disabled={teams.length < 2} onClick={onDraw}><Shuffle size={17} />Sortear confrontos</button>{teams.length < 2 && <small className="draw-hint">Faltam {2 - teams.length} equipe(s) para liberar o sorteio.</small>}<button className="text-action draw-team-link" onClick={() => window.dispatchEvent(new CustomEvent('interclasse-navigate', { detail: 'equipes' }))}>Gerenciar equipes <ArrowRight size={14} /></button></section><aside className="draw-side"><div className="draw-side-kicker"><Zap size={15} /> COMO FUNCIONA</div><h3>Uma chance.<br/>Um caminho até a final.</h3><div className="draw-flow"><div><span>01</span><p><strong>Embaralhar</strong><small>Equipes sorteadas de forma aleatória.</small></p></div><div><span>02</span><p><strong>Disputar</strong><small>Perdeu, está fora. Venceu, avançou.</small></p></div><div><span>03</span><p><strong>Decidir</strong><small>Quem vencer a final leva o título.</small></p></div></div><div className="draw-side-foot"><ShieldCheck size={16} />Formato: mata-mata</div></aside></div>}
  </>;
}

function BracketMatch({ match, teams, sport, canEditScores, canEnterPendingScores, onScore }) {
  const team1 = teams.find((team) => team.id === match.team1Id);
  const team2 = teams.find((team) => team.id === match.team2Id);
  const isBye = match.status === 'bye';
  const canEdit = match.team1Id && match.team2Id;
  const canOpenScore = (match.status === 'pending' && canEnterPendingScores) || (match.status === 'complete' && canEditScores);
  return <article className={`bracket-match ${match.status === 'complete' ? 'match-complete' : ''} ${isBye ? 'match-bye' : ''}`}>
    <div className="match-card-top"><span>JOGO {String(match.number).padStart(2, '0')}</span>{isBye ? <span className="bye-status">DIRETO</span> : match.status === 'complete' ? <span className="completed-status"><Check size={11} /> FINAL</span> : null}</div>
    <TeamMatchRow team={team1} fallback="Aguardando equipe" winner={match.winnerId === match.team1Id && !!match.winnerId} score={match.score1} />
    <div className="match-divider"><span>VS</span></div>
    <TeamMatchRow team={team2} fallback={isBye ? 'Vaga direta' : 'Aguardando equipe'} winner={match.winnerId === match.team2Id && !!match.winnerId} score={match.score2} />
    {isBye ? <div className="match-bye-note">Avança sem jogar</div> : canEdit && canOpenScore ? <button className={`match-edit ${match.status === 'complete' ? 'match-edit-done' : ''}`} onClick={onScore}>{match.status === 'complete' ? <><Pencil size={12} />Editar placar</> : <>Lançar placar <ArrowRight size={13} /></>}</button> : match.status === 'complete' ? <div className="match-wait-note">Placar finalizado</div> : <div className="match-wait-note">{canEdit ? 'Aguardando autorização para lançar' : 'Aguardando classificação'}</div>}
  </article>;
}

function TeamMatchRow({ team, fallback, winner, score }) {
  return <div className={`match-team-row ${winner ? 'winner-row' : ''} ${!team ? 'team-not-set' : ''}`}><span className="match-team-mark" style={{ '--team-color': team?.color || '#dfe7ee' }}>{team ? initials(team.name).slice(0, 1) : '·'}</span><span className="match-team-name">{team?.name || fallback}</span>{winner && <Check size={13} className="winner-check" />}{score !== null && score !== undefined && <strong className="match-score">{score}</strong>}</div>;
}

function GamesPage({ data, sport, setSport, competition, canEditScores, canEnterPendingScores, onScore }) {
  const teamsById = new Map(data.teams.map((team) => [team.id, team]));
  const matches = competition?.rounds?.flatMap((round) => round.matches.map((match) => ({ ...match, phase: round.label }))) || [];
  const champion = competition?.rounds?.at(-1)?.matches?.[0]?.winnerId;
  return <>
    <PageHeading eyebrow="ACOMPANHAMENTO" title="Jogos e placares" description="Consulte confrontos, fases, resultados e classificação por modalidade."><SportTabs sport={sport} setSport={setSport} /></PageHeading>
    {!competition ? <section className="panel"><EmptyState icon={ClipboardList} title={`A chave de ${SPORT_LABEL[sport].toLowerCase()} ainda não foi sorteada`} description="Depois de cadastrar pelo menos duas equipes, faça o sorteio para montar a tabela de jogos." action={<button className="button button-primary" onClick={() => window.dispatchEvent(new CustomEvent('interclasse-navigate', { detail: 'chaves' }))}><Shuffle size={16} />Ir para o sorteio</button>} /></section> : <>
      <div className="results-overview"><div className="result-overview-icon">{sport === 'futsal' ? <Footprints size={20} /> : <Volleyball size={20} />}</div><div className="result-overview-copy"><span>COMPETIÇÃO</span><strong>{SPORT_LABEL[sport]} · Mata-mata</strong></div><div className="result-overview-stat"><strong>{matches.filter((match) => match.status === 'complete').length}<small>/{matches.filter((match) => match.team1Id && match.team2Id).length}</small></strong><span>jogos concluídos</span></div><div className="result-overview-stat"><strong>{competition.teamIds.length}</strong><span>equipes sorteadas</span></div>{champion && <div className="result-champion"><Trophy size={16} /><span>CAMPEÃ(O)</span><strong>{teamsById.get(champion)?.name || '—'}</strong></div>}</div>
      <section className="panel results-panel"><div className="results-heading"><div><div className="eyebrow"><span /> TABELA DE JOGOS</div><h2>Todos os confrontos</h2></div><span className="results-count"><span className="results-count-dot" />{matches.length} jogos</span></div>
        <div className="table-scroll"><table className="data-table results-table"><thead><tr><th>FASE</th><th>CONFRONTO</th><th>PLACAR</th><th>VENCEDOR / SITUAÇÃO</th><th className="action-cell">AÇÃO</th></tr></thead><tbody>{matches.map((match) => {
          const team1 = teamsById.get(match.team1Id); const team2 = teamsById.get(match.team2Id); const winner = teamsById.get(match.winnerId);
          const statusText = match.status === 'complete' ? 'Finalizado' : match.status === 'bye' ? 'Avanço direto' : match.status === 'waiting' ? 'Aguardando equipes' : 'A definir';
          const canOpenScore = (match.status === 'pending' && canEnterPendingScores) || (match.status === 'complete' && canEditScores);
          return <tr key={match.id}><td><span className="phase-chip">{match.phase}</span></td><td><div className="result-matchup"><span className={winner?.id === team1?.id ? 'result-winner' : ''}>{team1?.name || 'Aguardando'}</span><i>×</i><span className={winner?.id === team2?.id ? 'result-winner' : ''}>{team2?.name || (match.status === 'bye' ? 'Vaga direta' : 'Aguardando')}</span></div><small className="result-game-number">Jogo {String(match.number).padStart(2, '0')}</small></td><td><span className={`result-score ${match.status === 'complete' ? 'score-final' : ''}`}>{match.status === 'complete' ? `${match.score1} × ${match.score2}` : match.status === 'bye' ? '—' : '— × —'}</span></td><td>{match.status === 'complete' ? <span className="result-winner-label"><Trophy size={13} />{winner?.name || '—'}</span> : <span className={`match-status ${match.status === 'bye' ? 'status-bye' : match.status === 'waiting' ? 'status-waiting' : 'status-pending'}`}><i />{statusText}</span>}</td><td className="action-cell">{match.status === 'bye' ? <span className="muted">—</span> : canOpenScore ? <button className="table-action" onClick={() => onScore(match)}>{match.status === 'complete' ? 'Editar' : 'Lançar'} <ChevronRight size={14} /></button> : <span className="muted">{match.status === 'complete' ? 'Finalizado' : '—'}</span>}</td></tr>;
        })}</tbody></table></div>
        <div className="results-footer"><span><span className="results-count-dot" /> Equipes classificadas avançam automaticamente na chave.</span><button className="text-action" onClick={() => window.dispatchEvent(new CustomEvent('interclasse-navigate', { detail: 'chaves' }))}>Ver chave completa <ArrowRight size={14} /></button></div>
      </section>
    </>}
  </>;
}

function SportBadge({ sport }) {
  return <span className={`sport-badge ${sport}`}>{sport === 'futsal' ? <Footprints size={12} /> : <Volleyball size={12} />}{SPORT_LABEL[sport]}</span>;
}

function avatarColor(name) {
  const colors = ['#d9f5fc', '#e8e2ff', '#feebd7', '#ffe0e8', '#dbf6ec', '#dce6ff'];
  const sum = [...name].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return colors[sum % colors.length];
}

function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state"><div className="empty-state-icon"><Icon size={23} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><span className="modal-kicker">INTERCLASSE · CADASTRO</span><h2>{title}</h2></div><button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>{children}</section></div>;
}

function StudentForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [classroom, setClassroom] = useState(initial?.classroom || '');
  const [course, setCourse] = useState(initial?.course || 'Não informado');
  const [modalities, setModalities] = useState(initial?.modalities || ['futsal', 'volei']);
  const [error, setError] = useState('');
  function toggle(modality) { setModalities((current) => current.includes(modality) ? current.filter((item) => item !== modality) : [...current, modality]); }
  function submit(event) {
    event.preventDefault();
    if (!name.trim() || !classroom.trim() || modalities.length === 0) { setError('Preencha o nome, a turma e pelo menos uma modalidade.'); return; }
    onSave({ id: initial?.id || uid(), name: name.trim(), classroom: classroom.trim(), course, modalities });
  }
  return <form className="form-body" onSubmit={submit}><label className="form-label">Nome completo<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Ana Beatriz Silva" /></label><label className="form-label">Turma<input maxLength={30} value={classroom} onChange={(event) => setClassroom(event.target.value)} placeholder="Ex.: 2º ano B" /></label><label className="form-label">Curso técnico<select value={course} onChange={(event) => setCourse(event.target.value)}><option>Não informado</option><option>Informática</option><option>Administração</option><option>Marketing</option><option>Outro</option></select></label><fieldset className="form-fieldset"><legend>Modalidades em que vai participar</legend><div className="checkbox-row"><label className={`checkbox-card ${modalities.includes('futsal') ? 'checked' : ''}`}><input type="checkbox" checked={modalities.includes('futsal')} onChange={() => toggle('futsal')} /><Footprints size={18} /><span>Futsal</span>{modalities.includes('futsal') && <Check size={15} />}</label><label className={`checkbox-card ${modalities.includes('volei') ? 'checked' : ''}`}><input type="checkbox" checked={modalities.includes('volei')} onChange={() => toggle('volei')} /><Volleyball size={18} /><span>Vôlei</span>{modalities.includes('volei') && <Check size={15} />}</label></div></fieldset>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit"><Check size={16} />Salvar aluno</button></div><p className="privacy-note"><ShieldCheck size={14} />Cadastre somente os dados necessários para organizar os jogos.</p></form>;
}

function TeamForm({ initial, students, currentSport, onSave, onCancel }) {
  const existingSport = initial?.modality || currentSport;
  const eligibleStudents = students.filter((student) => (student.modalities || []).includes(existingSport));
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || SPORT_COLORS[0]);
  const [colorName, setColorName] = useState(initial?.colorName || 'Azul céu');
  const [studentIds, setStudentIds] = useState(initial?.studentIds || []);
  const [error, setError] = useState('');
  function toggleStudent(id) { setStudentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function submit(event) {
    event.preventDefault();
    if (!name.trim()) { setError('Informe o nome da equipe.'); return; }
    if (!studentIds.length) { setError('Selecione pelo menos um aluno para o elenco.'); return; }
    onSave({ id: initial?.id || uid(), name: name.trim(), modality: existingSport, color, colorName, studentIds });
  }
  return <form className="form-body" onSubmit={submit}><label className="form-label">Nome da equipe<input autoFocus maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Os Invencíveis" /></label><div className="form-label">Modalidade<div className="readonly-sport"><SportBadge sport={existingSport} /><span>{initial ? 'Modalidade da equipe não pode ser alterada após o cadastro.' : SPORT_LABEL[existingSport]}</span></div></div><fieldset className="form-fieldset"><legend>Cor da equipe</legend><div className="color-palette">{SPORT_COLORS.map((value, index) => { const label = ['Azul céu', 'Roxo', 'Laranja', 'Rosa', 'Verde', 'Azul royal'][index]; return <button type="button" key={value} aria-label={label} className={`color-option ${color === value ? 'color-selected' : ''}`} style={{ '--swatch': value }} onClick={() => { setColor(value); setColorName(label); }} />; })}</div></fieldset><fieldset className="form-fieldset roster-select-field"><legend>Alunos do elenco <span className="legend-count">{studentIds.length} selecionado(s)</span></legend>{eligibleStudents.length ? <div className="roster-select">{eligibleStudents.map((student) => <label className={`roster-select-row ${studentIds.includes(student.id) ? 'selected' : ''}`} key={student.id}><input type="checkbox" checked={studentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><span className="avatar roster-form-avatar" style={{ '--avatar-color': avatarColor(student.name) }}>{initials(student.name)}</span><span className="roster-select-copy"><strong>{student.name}</strong><small>{student.classroom}</small></span>{studentIds.includes(student.id) && <Check size={16} />}</label>)}</div> : <div className="no-eligible-students"><Users size={17} /><span>Nenhum aluno cadastrado para {SPORT_LABEL[existingSport].toLowerCase()}. Cadastre alunos primeiro.</span></div>}</fieldset>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit"><Check size={16} />Salvar equipe</button></div></form>;
}

function ScoreForm({ match, competition, teams, sport, onSave, onCancel }) {
  const original = competition?.rounds?.flatMap((round) => round.matches).find((item) => item.id === match.id) || match;
  const [score1, setScore1] = useState(original.score1 ?? '');
  const [score2, setScore2] = useState(original.score2 ?? '');
  const [winnerId, setWinnerId] = useState(original.winnerId || '');
  const [decision, setDecision] = useState(original.decision || (sport === 'futsal' ? 'Pênaltis' : 'Ponto decisivo'));
  const [error, setError] = useState('');
  const team1 = teams.find((team) => team.id === original.team1Id);
  const team2 = teams.find((team) => team.id === original.team2Id);
  const tied = score1 !== '' && score2 !== '' && Number(score1) === Number(score2);
  function submit(event) {
    event.preventDefault();
    const first = Number(score1); const second = Number(score2);
    if (score1 === '' || score2 === '' || !Number.isFinite(first) || !Number.isFinite(second) || first < 0 || second < 0) { setError('Preencha os dois placares com números iguais ou maiores que zero.'); return; }
    if (first === second && !winnerId) { setError('Empate no placar: escolha o vencedor da decisão.'); return; }
    onSave({ score1: first, score2: second, winnerId, decision });
  }
  return <form className="form-body score-form" onSubmit={submit}><div className="score-phase"><span className="phase-chip">{showRound(competition, match.id)}</span><span>JOGO {String(match.number).padStart(2, '0')}</span></div><div className="score-versus"><div className="score-team"><span className="score-team-logo" style={{ '--team-color': team1?.color }}>{initials(team1?.name)}</span><strong>{team1?.name}</strong></div><span className="score-vs">VS</span><div className="score-team"><span className="score-team-logo" style={{ '--team-color': team2?.color }}>{initials(team2?.name)}</span><strong>{team2?.name}</strong></div></div><div className="score-inputs"><label className="score-input"><span>{team1?.name}</span><input aria-label={`Placar de ${team1?.name}`} type="number" min="0" step="1" value={score1} onChange={(event) => setScore1(event.target.value)} /></label><span className="score-colon">×</span><label className="score-input"><span>{team2?.name}</span><input aria-label={`Placar de ${team2?.name}`} type="number" min="0" step="1" value={score2} onChange={(event) => setScore2(event.target.value)} /></label></div>{tied && <div className="decision-panel"><div className="decision-title">PLACAR EMPATADO <span>DEFINIR VENCEDOR</span></div><p>Selecione quem venceu a decisão de desempate.</p><div className="decision-options"><label className={winnerId === team1?.id ? 'decision-selected' : ''}><input type="radio" name="winner" checked={winnerId === team1?.id} onChange={() => setWinnerId(team1?.id || '')} /><span>{team1?.name}</span></label><label className={winnerId === team2?.id ? 'decision-selected' : ''}><input type="radio" name="winner" checked={winnerId === team2?.id} onChange={() => setWinnerId(team2?.id || '')} /><span>{team2?.name}</span></label></div><label className="form-label decision-method">Critério de desempate<input maxLength={35} value={decision} onChange={(event) => setDecision(event.target.value)} placeholder={sport === 'futsal' ? 'Ex.: Pênaltis' : 'Ex.: Ponto decisivo'} /></label></div>}{error && <div className="form-error">{error}</div>}<div className="score-info"><Zap size={15} />O vencedor avança automaticamente para a próxima fase.</div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit"><Check size={16} />Salvar placar</button></div></form>;
}

function PasswordForm({ onSave, onCancel }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError('');
    if (password.length < 12) { setError('Use pelo menos 12 caracteres.'); return; }
    if (password !== confirmation) { setError('As senhas não coincidem.'); return; }
    setBusy(true);
    try { await onSave(password); }
    catch (saveError) { setError(saveError?.message || 'Não foi possível atualizar a senha.'); }
    finally { setBusy(false); }
  }
  return <form className="form-body" onSubmit={submit}><p className="auth-card-description">Escolha uma senha forte e não a compartilhe. O administrador pode redefini-la se necessário.</p><label className="form-label">Nova senha<input autoFocus type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="form-label">Confirme a nova senha<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy}><KeyRound size={15} />{busy ? 'Atualizando…' : 'Atualizar senha'}</button></div></form>;
}

export default App;
