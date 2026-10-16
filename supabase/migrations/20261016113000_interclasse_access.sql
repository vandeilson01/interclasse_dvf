begin;

-- Supabase Auth users are mapped to one of the three application roles in teacher_roles.
-- The only tournament row stores JSON collections, but separates draws from score records.

create table if not exists public.teacher_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  role text not null check (role in ('admin', 'organizer', 'scorekeeper')),
  created_at timestamptz not null default now()
);

create table if not exists public.interclasse_state (
  id smallint primary key default 1 check (id = 1),
  students jsonb not null default '[]'::jsonb check (jsonb_typeof(students) = 'array'),
  teams jsonb not null default '[]'::jsonb check (jsonb_typeof(teams) = 'array'),
  draws jsonb not null default '{"futsal":null,"volei":null}'::jsonb check (jsonb_typeof(draws) = 'object'),
  results jsonb not null default '{"futsal":{},"volei":{}}'::jsonb check (jsonb_typeof(results) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.interclasse_state (id) values (1) on conflict (id) do nothing;
alter table public.interclasse_state add column if not exists revision bigint not null default 1;

create or replace function public.current_interclasse_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tr.role
  from public.teacher_roles as tr
  where tr.user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_interclasse_role() from public, anon;
grant execute on function public.current_interclasse_role() to authenticated, service_role;

create or replace function public.validate_interclasse_results(p_draws jsonb, p_results jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  sport text;
  draw_data jsonb;
  result_map jsonb;
  result_row record;
  score_one numeric;
  score_two numeric;
begin
  if jsonb_typeof(p_draws) is distinct from 'object' or jsonb_typeof(p_results) is distinct from 'object' then
    raise exception 'O estado do torneio deve ser um objeto JSON.' using errcode = '22023';
  end if;

  foreach sport in array array['futsal', 'volei'] loop
    draw_data := p_draws -> sport;
    result_map := coalesce(p_results -> sport, '{}'::jsonb);
    if jsonb_typeof(result_map) is distinct from 'object' then
      raise exception 'A lista de placares da modalidade % é inválida.', sport using errcode = '22023';
    end if;
    if draw_data is null or draw_data = 'null'::jsonb then
      if result_map <> '{}'::jsonb then
        raise exception 'Não é possível registrar placares sem sorteio em %.', sport using errcode = '22023';
      end if;
      continue;
    end if;

    for result_row in select key, value from jsonb_each(result_map) loop
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(draw_data -> 'rounds', '[]'::jsonb)) as r(round_json)
        cross join lateral jsonb_array_elements(coalesce(r.round_json -> 'matches', '[]'::jsonb)) as m(match_json)
        where m.match_json ->> 'id' = result_row.key
      ) then
        raise exception 'O placar informado não pertence a uma partida sorteada.' using errcode = '22023';
      end if;

      if jsonb_typeof(result_row.value -> 'score1') is distinct from 'number'
         or jsonb_typeof(result_row.value -> 'score2') is distinct from 'number'
         or jsonb_typeof(result_row.value -> 'team1Id') is distinct from 'string'
         or jsonb_typeof(result_row.value -> 'team2Id') is distinct from 'string'
         or jsonb_typeof(result_row.value -> 'winnerId') is distinct from 'string'
         or jsonb_typeof(result_row.value -> 'decision') is distinct from 'string' then
        raise exception 'O placar da partida % está incompleto ou inválido.', result_row.key using errcode = '22023';
      end if;

      score_one := (result_row.value ->> 'score1')::numeric;
      score_two := (result_row.value ->> 'score2')::numeric;
      if score_one < 0 or score_two < 0 then
        raise exception 'O placar não pode ser negativo.' using errcode = '22023';
      end if;
      if result_row.value ->> 'team1Id' = result_row.value ->> 'team2Id'
         or result_row.value ->> 'winnerId' not in (result_row.value ->> 'team1Id', result_row.value ->> 'team2Id') then
        raise exception 'O vencedor precisa ser uma das equipes deste confronto.' using errcode = '22023';
      end if;
      if score_one = score_two and length(trim(result_row.value ->> 'decision')) = 0 then
        raise exception 'Informe o critério de desempate.' using errcode = '22023';
      end if;
      if not (coalesce(draw_data -> 'teamIds', '[]'::jsonb) ? (result_row.value ->> 'team1Id'))
         or not (coalesce(draw_data -> 'teamIds', '[]'::jsonb) ? (result_row.value ->> 'team2Id')) then
        raise exception 'O placar contém equipe que não participa desta chave.' using errcode = '22023';
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.validate_interclasse_results(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.is_pending_interclasse_match(
  p_draw jsonb,
  p_existing_results jsonb,
  p_match_id text,
  p_new_result jsonb
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  round_row record;
  match_row record;
  prior_round jsonb;
  prior_match jsonb;
  source_ids jsonb;
  source_id text;
  source_winner text;
  team_one text;
  team_two text;
  source_index integer;
begin
  for round_row in
    select value as round_data, ordinality::integer as round_index
    from jsonb_array_elements(coalesce(p_draw -> 'rounds', '[]'::jsonb)) with ordinality
    order by ordinality
  loop
    for match_row in
      select value as match_data
      from jsonb_array_elements(coalesce(round_row.round_data -> 'matches', '[]'::jsonb))
    loop
      if match_row.match_data ->> 'id' <> p_match_id then continue; end if;
      if match_row.match_data ->> 'status' = 'bye' then return false; end if;

      if round_row.round_index = 1 then
        team_one := match_row.match_data ->> 'team1Id';
        team_two := match_row.match_data ->> 'team2Id';
      else
        source_ids := match_row.match_data -> 'sourceMatchIds';
        if jsonb_typeof(source_ids) <> 'array' or jsonb_array_length(source_ids) <> 2 then return false; end if;
        select value into prior_round
        from jsonb_array_elements(coalesce(p_draw -> 'rounds', '[]'::jsonb)) with ordinality
        where ordinality = round_row.round_index - 1;
        team_one := null;
        team_two := null;
        for source_index in 0..1 loop
          source_id := source_ids ->> source_index;
          select value into prior_match
          from jsonb_array_elements(coalesce(prior_round -> 'matches', '[]'::jsonb))
          where value ->> 'id' = source_id;
          if prior_match is null then return false; end if;
          source_winner := null;
          if prior_match ->> 'status' = 'bye' then
            source_winner := prior_match ->> 'winnerId';
          else
            source_winner := p_existing_results -> (prior_match ->> 'id') ->> 'winnerId';
          end if;
          if source_index = 0 then team_one := source_winner; else team_two := source_winner; end if;
        end loop;
      end if;

      return team_one is not null
        and team_two is not null
        and (p_new_result ->> 'team1Id') = team_one
        and (p_new_result ->> 'team2Id') = team_two;
    end loop;
  end loop;
  return false;
end;
$$;

create or replace function public.assert_scorekeeper_results(
  p_draws jsonb,
  p_old_results jsonb,
  p_new_results jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  sport text;
  old_map jsonb;
  new_map jsonb;
  old_row record;
  new_row record;
begin
  foreach sport in array array['futsal', 'volei'] loop
    old_map := coalesce(p_old_results -> sport, '{}'::jsonb);
    new_map := coalesce(p_new_results -> sport, '{}'::jsonb);

    for old_row in select key, value from jsonb_each(old_map) loop
      if new_map -> old_row.key is distinct from old_row.value then
        raise exception 'O responsável pelos placares não pode editar ou apagar um resultado finalizado.' using errcode = '42501';
      end if;
    end loop;

    for new_row in select key, value from jsonb_each(new_map) loop
      if old_map ? new_row.key then continue; end if;
      if not public.is_pending_interclasse_match(p_draws -> sport, old_map, new_row.key, new_row.value) then
        raise exception 'O responsável pelos placares só pode lançar uma partida pendente com as equipes classificadas.' using errcode = '42501';
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.is_pending_interclasse_match(jsonb, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.assert_scorekeeper_results(jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.enforce_interclasse_state_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.current_interclasse_role();
begin
  if actor_role = 'admin' then
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

drop trigger if exists enforce_interclasse_state_permissions on public.interclasse_state;
create trigger enforce_interclasse_state_permissions
before update on public.interclasse_state
for each row execute function public.enforce_interclasse_state_permissions();

alter table public.teacher_roles enable row level security;
alter table public.interclasse_state enable row level security;

revoke all on table public.teacher_roles from anon, authenticated;
revoke all on table public.interclasse_state from anon, authenticated;
grant select on table public.teacher_roles to authenticated;
grant select, update on table public.interclasse_state to authenticated;
grant select, insert, update, delete on table public.teacher_roles to service_role;
grant select, update on table public.interclasse_state to service_role;

drop policy if exists teacher_roles_read_self_or_admin on public.teacher_roles;
create policy teacher_roles_read_self_or_admin
on public.teacher_roles for select to authenticated
using ((select auth.uid()) = user_id or (select public.current_interclasse_role()) = 'admin');

drop policy if exists interclasse_state_read_members on public.interclasse_state;
create policy interclasse_state_read_members
on public.interclasse_state for select to authenticated
using ((select public.current_interclasse_role()) in ('admin', 'organizer', 'scorekeeper'));

drop policy if exists interclasse_state_update_members on public.interclasse_state;
create policy interclasse_state_update_members
on public.interclasse_state for update to authenticated
using ((select public.current_interclasse_role()) in ('admin', 'organizer', 'scorekeeper'))
with check ((select public.current_interclasse_role()) in ('admin', 'organizer', 'scorekeeper'));

commit;
