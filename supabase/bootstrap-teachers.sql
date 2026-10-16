-- Execute once, after creating the three Auth users with these internal e-mail aliases.
-- This statement aborts if any account is missing and never changes an existing role.
do $$
declare
  found_count integer;
begin
  select count(*)
    into found_count
    from auth.users
   where lower(email) in (
     'andreson@accounts.interclasse.invalid',
     'leilson@accounts.interclasse.invalid',
     'luisroberto@accounts.interclasse.invalid'
   );

  if found_count <> 3 then
    raise exception 'Crie as três contas Andreson, Leilson e Luis Roberto no Supabase Auth antes de executar este bootstrap.';
  end if;

  insert into public.teacher_roles (user_id, username, display_name, role)
  select u.id, v.username, v.display_name, v.role
    from (values
      ('andreson@accounts.interclasse.invalid', 'andreson', 'Andreson', 'admin'),
      ('leilson@accounts.interclasse.invalid', 'leilson', 'Leilson', 'organizer'),
      ('luisroberto@accounts.interclasse.invalid', 'luisroberto', 'Luis Roberto', 'scorekeeper')
    ) as v(email, username, display_name, role)
    join auth.users as u on lower(u.email) = v.email
  on conflict (user_id) do nothing;
end;
$$;
