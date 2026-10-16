import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessContext, permissionsFor } from '../lib/accessContext.jsx';
import { getTeacherProfile, signOut } from '../lib/auth.js';
import { emptyData } from '../lib/storage.js';
import { loadCloudState, RevisionConflictError, saveCloudState } from '../lib/cloudStore.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import LoginPage, { LoadingPage, SupabaseSetupPage } from './LoginPage.jsx';

const jsonOf = (value) => JSON.stringify(value);

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [data, setData] = useState(emptyData);
  const [loginError, setLoginError] = useState('');
  const [systemError, setSystemError] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [saveError, setSaveError] = useState('');
  const [retrySequence, setRetrySequence] = useState(0);
  const [loadSequence, setLoadSequence] = useState(0);
  const revisionRef = useRef(null);
  const lastSavedJsonRef = useRef('');
  const dataRef = useRef(data);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSessionReady(true);
      return undefined;
    }
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setDataReady(false);
        setData(emptyData());
        revisionRef.current = null;
        lastSavedJsonRef.current = '';
      }
      setLoginError('');
    });
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active) return;
      if (error) setLoginError('Não foi possível verificar a sessão. Entre novamente.');
      setSession(sessionData?.session || null);
      setSessionReady(true);
    }).catch(() => {
      if (!active) return;
      setLoginError('Não foi possível verificar a sessão. Entre novamente.');
      setSessionReady(true);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      setDataReady(false);
      return undefined;
    }
    let active = true;
    setProfileLoading(true);
    setSystemError('');
    setDataReady(false);
    (async () => {
      try {
        const teacher = await getTeacherProfile(session.user.id);
        if (!teacher) {
          await signOut();
          if (active) setLoginError('Esta conta ainda não recebeu um papel na interclasse. Peça ao administrador para conferir seu acesso.');
          return;
        }
        const loaded = await loadCloudState();
        if (!active) return;
        setProfile(teacher);
        dataRef.current = loaded.data;
        setData(loaded.data);
        revisionRef.current = loaded.revision;
        lastSavedJsonRef.current = jsonOf(loaded.data);
        setSaveStatus('saved');
        setSaveError('');
        setDataReady(true);
      } catch (error) {
        if (active) setSystemError(error?.message || 'Não foi possível conectar ao banco do torneio.');
      } finally {
        if (active) setProfileLoading(false);
      }
    })();
    return () => { active = false; };
  }, [session, loadSequence]);

  useEffect(() => {
    if (!profile || !dataReady) return undefined;
    const snapshot = jsonOf(data);
    if (snapshot === lastSavedJsonRef.current) return undefined;
    let active = true;
    const snapshotData = JSON.parse(snapshot);
    const timer = window.setTimeout(() => {
      const queued = saveQueueRef.current.catch(() => undefined).then(async () => {
        if (jsonOf(snapshotData) === lastSavedJsonRef.current) return;
        setSaveStatus('saving');
        try {
          const nextRevision = await saveCloudState(snapshotData, revisionRef.current);
          revisionRef.current = nextRevision;
          lastSavedJsonRef.current = snapshot;
          if (active) {
            setSaveStatus('saved');
            setSaveError('');
          }
        } catch (error) {
          if (!active) return;
          setSaveStatus('error');
          setSaveError(error instanceof RevisionConflictError
            ? error.message
            : 'Não foi possível salvar no Supabase. Confira a conexão e tente novamente.');
        }
      });
      saveQueueRef.current = queued;
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [data, profile, dataReady, retrySequence]);

  const reloadData = useCallback(async () => {
    if (!profile) return;
    setSaveStatus('saving');
    try {
      const loaded = await loadCloudState();
      dataRef.current = loaded.data;
      setData(loaded.data);
      revisionRef.current = loaded.revision;
      lastSavedJsonRef.current = jsonOf(loaded.data);
      setSaveStatus('saved');
      setSaveError('');
    } catch {
      setSaveStatus('error');
      setSaveError('Não foi possível recarregar os dados compartilhados.');
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || !dataReady) return undefined;
    let active = true;
    const refreshIfClean = async () => {
      if (document.visibilityState === 'hidden' || jsonOf(dataRef.current) !== lastSavedJsonRef.current) return;
      try {
        const latest = await loadCloudState();
        if (!active || latest.revision === revisionRef.current) return;
        const latestJson = jsonOf(latest.data);
        dataRef.current = latest.data;
        setData(latest.data);
        revisionRef.current = latest.revision;
        lastSavedJsonRef.current = latestJson;
        setSaveStatus('saved');
        setSaveError('');
      } catch {
        // Falha temporária de leitura não descarta o estado local ainda não alterado.
      }
    };
    const timer = window.setInterval(refreshIfClean, 20000);
    window.addEventListener('focus', refreshIfClean);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfClean);
    };
  }, [profile, dataReady]);

  async function handleLogout() {
    try { await signOut(); } catch { setSession(null); }
  }

  if (!isSupabaseConfigured) return <SupabaseSetupPage />;
  if (!sessionReady) return <LoadingPage />;
  if (!session) return <LoginPage onLogin={setSession} error={loginError} />;
  if (profileLoading) return <LoadingPage message="Validando seu papel e carregando a competição…" />;
  if (systemError) return <main className="system-error-page"><section className="setup-card"><span className="auth-form-eyebrow">NÃO FOI POSSÍVEL CARREGAR</span><h1>O painel continua protegido.</h1><p>{systemError}</p><div className="system-error-actions"><button className="button button-primary" onClick={() => setLoadSequence((value) => value + 1)}>Tentar novamente</button><button className="button button-quiet" onClick={handleLogout}>Sair</button></div></section></main>;
  if (!profile || !dataReady) return <LoadingPage message="Preparando os dados compartilhados…" />;

  const access = {
    ...permissionsFor(profile.role),
    profile,
    session,
    saveStatus,
    saveError,
    onRetrySave: () => setRetrySequence((value) => value + 1),
    onReloadData: reloadData,
    onLogout: handleLogout,
  };
  return <AccessContext.Provider value={access}>
    {React.cloneElement(children, {
      data,
      setData,
      profile,
      session,
      saveStatus,
      saveError,
      onRetrySave: access.onRetrySave,
      onReloadData: reloadData,
      onLogout: handleLogout,
    })}
  </AccessContext.Provider>;
}
