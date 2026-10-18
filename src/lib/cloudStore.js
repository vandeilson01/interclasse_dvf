import { mergeCloudState, splitDataForCloud } from './cloudState.js';

export class RevisionConflictError extends Error {
  constructor(message = 'Outra pessoa salvou alterações enquanto você editava. Recarregue os dados antes de continuar.') {
    super(message);
    this.name = 'RevisionConflictError';
  }
}

async function requestState(method, body) {
  const response = await fetch('/api/state', {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let result = {};
  try { result = await response.json(); } catch { /* Resposta vazia ou não JSON. */ }
  if (response.status === 409) throw new RevisionConflictError(result.error);
  if (!response.ok) {
    const error = new Error(result.error || 'Não foi possível conectar aos dados compartilhados.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function loadCloudState() {
  const result = await requestState('GET');
  if (!result.row) throw new Error('O estado compartilhado não foi encontrado no Supabase.');
  return { data: mergeCloudState(result.row), revision: result.row.revision };
}

export async function saveCloudState(value, expectedRevision) {
  if (!expectedRevision) throw new RevisionConflictError();
  const payload = splitDataForCloud(value);
  const result = await requestState('PUT', { payload, expectedRevision });
  if (typeof result.revision !== 'number') throw new Error('O Supabase não confirmou a atualização dos dados.');
  return result.revision;
}
