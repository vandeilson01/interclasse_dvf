async function requestSession(method, body) {
  const response = await fetch('/api/session', {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let result = {};
  try { result = await response.json(); } catch { /* Resposta vazia ou não JSON. */ }
  if (!response.ok) {
    const message = response.status === 401 && method === 'POST'
      ? 'Senha incorreta. Confira com a organização da interclasse.'
      : result.error || 'Não foi possível verificar o acesso. Confira a configuração na Vercel.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function checkSession() {
  try {
    const result = await requestSession('GET');
    return result.authenticated === true;
  } catch (error) {
    if (error.status === 401) return false;
    throw error;
  }
}

export async function signInWithSharedPassword(password) {
  if (typeof password !== 'string' || !password) throw new Error('Informe a senha compartilhada.');
  const result = await requestSession('POST', { password });
  if (result.authenticated !== true) throw new Error('O servidor não confirmou o acesso. Publique as funções serverless da Vercel e tente novamente.');
}

export async function signOut() {
  await requestSession('DELETE');
}
