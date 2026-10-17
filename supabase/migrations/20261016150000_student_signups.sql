begin;

create table if not exists public.student_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  classroom text not null check (length(trim(classroom)) between 1 and 30),
  course text not null default 'Não informado'
    check (course in ('Não informado', 'Informática', 'Administração', 'Marketing', 'Outro')),
  modalities jsonb not null
    check (
      jsonb_typeof(modalities) = 'array'
      and jsonb_array_length(modalities) between 1 and 2
      and modalities <@ '["futsal", "volei"]'::jsonb
    ),
  created_at timestamptz not null default now()
);

create index if not exists student_signups_created_at_idx
  on public.student_signups (created_at);

alter table public.student_signups enable row level security;
revoke all on table public.student_signups from anon, authenticated;
grant select, insert, update, delete on table public.student_signups to service_role;

-- The public endpoint can create pending rows only through the server-side service key.
-- On approval, that same server can append one validated student, but cannot alter teams,
-- draws, or match results. Browser users remain governed by their existing teacher roles.
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
    if new.teams is distinct from old.teams
       or new.draws is distinct from old.draws
       or new.results is distinct from old.results then
      raise exception 'A inscrição server-side só pode alterar a lista de alunos.' using errcode = '42501';
    end if;
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

commit;
