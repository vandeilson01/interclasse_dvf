# Supabase — Interclasse Técnico

## Projeto atual

O projeto Supabase `interclasse` já tem a tabela compartilhada `interclasse_state`. A migração original, as três contas Auth (Andreson, Leilson e Luis Roberto) e os papéis antigos foram criados em uma configuração anterior e continuam guardados; o app de senha única não os usa.

A migração `migrations/20261018120000_shared_password_only_access.sql` **já foi executada e verificada** no projeto atual em 18/10/2026. A verificação confirmou RLS habilitada, zero policies e grants de tabela para `anon`/`authenticated`, e a função de serviço disponível para a API server-side. Não a execute novamente no projeto atual. Nenhum aluno, equipe, torneio, placar, conta ou tabela foi apagado.

Depois, configure na Vercel apenas como variáveis server-side:

- `INTERCLASSE_SHARED_PASSWORD`: senha única, aleatória, com pelo menos 24 caracteres.
- `SUPABASE_URL`: `https://dppbejaxouoqfnhutjmg.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role` do projeto.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no navegador, em variáveis `VITE_`, no Git ou no ZIP.

## Se for configurar um projeto novo

1. Execute `migrations/20261016113000_interclasse_access.sql`.
2. Execute `migrations/20261018120000_shared_password_only_access.sql`.
3. Configure as três variáveis server-side na Vercel.

O app atual não precisa de contas no Supabase Auth nem do script `bootstrap-teachers.sql`. Os arquivos antigos são mantidos no repositório como registro da configuração anterior.
