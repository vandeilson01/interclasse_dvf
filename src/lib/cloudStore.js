import { supabase } from './supabase.js';
import { mergeCloudState, splitDataForCloud } from './cloudState.js';

export class RevisionConflictError extends Error {
  constructor() {
    super('Outro professor salvou alterações enquanto você editava. Recarregue os dados antes de continuar.');
    this.name = 'RevisionConflictError';
  }
}

function requireClient() {
  if (!supabase) throw new Error('As variáveis públicas do Supabase não foram configuradas.');
  return supabase;
}

export async function loadCloudState() {
  const client = requireClient();
  const { data, error } = await client
    .from('interclasse_state')
    .select('students, teams, draws, results, revision')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return { data: mergeCloudState(data), revision: data.revision };
}

export async function saveCloudState(value, expectedRevision) {
  const client = requireClient();
  if (!expectedRevision) throw new RevisionConflictError();
  const payload = splitDataForCloud(value);
  const { data, error } = await client
    .from('interclasse_state')
    .update(payload)
    .eq('id', 1)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle();
  if (error) throw error;
  if (typeof data?.revision !== 'number') throw new RevisionConflictError();
  return data.revision;
}
