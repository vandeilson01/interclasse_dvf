begin;

-- O app não usa mais Supabase Auth para abrir sessão. Nenhuma tabela ou conta existente é apagada.
-- Apenas a função server-side da Vercel, autenticada por senha compartilhada, acessa o JSON.

create or replace function public.enforce_interclasse_state_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.current_interclasse_role();
begin
  if auth.role() = 'service_role' then
    null;
  elsif actor_role = 'admin' then
    null;
  elsif actor_role = 'organizer' then
    if new.draws is distinct from old.draws then
      raise exception 'Somente o administrador pode criar ou refazer sorteios.' using errcode = '42501';
    end if;
  elsif actor_role = 'scorekeeper' then
    if new.students is distinct from old.students
       or new.teams is distinct from old.teams
       or new.draws is distinct from old.draws then
      raise exception 'Seu acesso permite somente lançar placares.' using errcode = '42501';
    end if;
    perform public.assert_scorekeeper_results(new.draws, old.results, new.results);
  else
    raise exception 'Este usuário não possui papel ativo na interclasse.' using errcode = '42501';
  end if;

  if new.results is distinct from old.results then
    perform public.validate_interclasse_results(new.draws, new.results);
  end if;
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

revoke all on function public.enforce_interclasse_state_permissions() from public, anon, authenticated;

-- RLS permanece ativa, mas não há policy nem grants para usuários do navegador.
drop policy if exists interclasse_state_read_members on public.interclasse_state;
drop policy if exists interclasse_state_update_members on public.interclasse_state;
drop policy if exists teacher_roles_read_self_or_admin on public.teacher_roles;
revoke all on table public.interclasse_state from anon, authenticated;
revoke all on table public.teacher_roles from anon, authenticated;
grant select, update on table public.interclasse_state to service_role;
grant select, insert, update, delete on table public.teacher_roles to service_role;

commit;
