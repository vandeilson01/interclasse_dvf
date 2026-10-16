import { supabase } from './supabase.js';
import { usernameToAuthEmail } from './usernames.js';

export async function signInWithUsername(username, password) {
  if (!supabase) throw new Error('O Supabase ainda não foi configurado.');
  if (!String(password || '').trim()) throw new Error('Informe sua senha.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password,
  });
  if (error) throw error;
  return data;
}

export async function getTeacherProfile(userId) {
  if (!supabase) throw new Error('O Supabase ainda não foi configurado.');
  const { data, error } = await supabase
    .from('teacher_roles')
    .select('user_id, username, display_name, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function changeOwnPassword(password) {
  if (!supabase) throw new Error('O Supabase ainda não foi configurado.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
