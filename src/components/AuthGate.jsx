import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkSession, signOut } from '../lib/auth.js';
import { emptyData } from '../lib/storage.js';
import { loadCloudState, RevisionConflictError, saveCloudState } from '../lib/cloudStore.js';
import LoginPage, { LoadingPage, SetupPage } from './LoginPage.jsx';

const jsonOf = (value) => JSON.stringify(value);

export default function AuthGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
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
    let active = true;
    checkSession()
      .then((valid) => { if (active) setAuthenticated(valid); })
      .catch((error) => { if (active) setLoginError(error?.message || 'Não foi possível verificar a configuração do acesso.'); })
      .finally(() => { if (active) setSessionReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionReady || !authenticated) return undefined;
    let active = true;
    setDataReady(false);
    setSystemError('');
    (async () => {
      try {
        const loaded = await loadCloudState();
        if (!active) return;
        dataRef.current = loaded.data;
        setData(loaded.data);
        revisionRef.current = loaded.revision;
        lastSavedJsonRef.current = jsonOf(loaded.data);
        setSaveStatus('saved');
        setSaveError('');
        setDataReady(true);
      } catch (error) {
        if (!active) return;
        if (error?.status === 401) {
          setAuthenticated(false);
          setLoginError('Sua sessão expirou. Entre novamente com a senha compartilhada.');
        } else {
          setSystemError(error?.message || 'Não foi possível conectar ao banco da interclasse.');
        }
      }
    })();
    return () => { active = false; };
  }, [sessionReady, authenticated, loadSequence]);

  useEffect(() => {
    if (!authenticated || !dataReady) return undefined;
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
          if (error?.status === 401) {
            setAuthenticated(false);
            setLoginError('Sua sessão expirou. Entre novamente com a senha compartilhada.');
            return;
          }
          setSaveStatus('error');
          setSaveError(error instanceof RevisionConflictError
            ? error.message
            : error?.message || 'Não foi possível salvar no Supabase. Confira a conexão e tente novamente.');
        }
      });
      saveQueueRef.current = queued;
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [data, authenticated, dataReady, retrySequence]);

  const reloadData = useCallback(async () => {
    if (!authenticated) return;
    setSaveStatus('saving');
    try {
      const loaded = await loadCloudState();
      dataRef.current = loaded.data;
      setData(loaded.data);
      revisionRef.current = loaded.revision;
      lastSavedJsonRef.current = jsonOf(loaded.data);
      setSaveStatus('saved');
      setSaveError('');
    } catch (error) {
      if (error?.status === 401) {
        setAuthenticated(false);
        setLoginError('Sua sessão expirou. Entre novamente com a senha compartilhada.');
        return;
      }
      setSaveStatus('error');
      setSaveError(error?.message || 'Não foi possível recarregar os dados compartilhados.');
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !dataReady) return undefined;
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
      } catch (error) {
        if (active && error?.status === 401) {
          setAuthenticated(false);
          setLoginError('Sua sessão expirou. Entre novamente com a senha compartilhada.');
        }
      }
    };
    const timer = window.setInterval(refreshIfClean, 20000);
    window.addEventListener('focus', refreshIfClean);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfClean);
    };
  }, [authenticated, dataReady]);

  async function handleLogout() {
    try {
      await signOut();
    } catch (error) {
      setSystemError(error?.message || 'Não foi possível encerrar a sessão.');
      return;
    }
    revisionRef.current = null;
    lastSavedJsonRef.current = '';
    setData(emptyData());
    setDataReady(false);
    setAuthenticated(false);
    setLoginError('');
    setSystemError('');
  }

  if (!sessionReady) return <LoadingPage />;
  if (!authenticated && loginError.includes('INTERCLASSE_SHARED_PASSWORD')) return <SetupPage message={loginError} />;
  if (!authenticated) return <LoginPage onLogin={() => { setLoginError(''); setAuthenticated(true); }} error={loginError} />;
  if (systemError) return <main className="system-error-page"><section className="setup-card"><span className="auth-form-eyebrow">NÃO FOI POSSÍVEL CARREGAR</span><h1>O painel continua protegido.</h1><p>{systemError}</p><div className="system-error-actions"><button className="button button-primary" onClick={() => { setSystemError(''); setLoadSequence((value) => value + 1); }}>Tentar novamente</button><button className="button button-quiet" onClick={handleLogout}>Sair</button></div></section></main>;
  if (!dataReady) return <LoadingPage message="Validando a sessão e carregando a competição…" />;

  return React.cloneElement(children, {
    data,
    setData,
    saveStatus,
    saveError,
    onRetrySave: () => setRetrySequence((value) => value + 1),
    onReloadData: reloadData,
    onLogout: handleLogout,
  });
}
