# Supabase — Interclasse Técnico

## Projeto atual

No projeto `interclasse` informado pelo titular, a migração foi aplicada com sucesso e verificada. O banco contém as tabelas `teacher_roles` e `interclasse_state`, RLS habilitado, três políticas de acesso, a trigger de autorização e a linha inicial de estado.

As contas Auth abaixo foram criadas e seus papéis confirmados por consulta somente de leitura:

- Andreson (`andreson`) — `admin`.
- Leilson (`leilson`) — `organizer`.
- Luis Roberto (`luisroberto`) — `scorekeeper`.

**Não execute `bootstrap-teachers.sql` novamente nesse projeto.** As credenciais não ficam neste repositório; foram entregues ao titular separadamente.

## Configurar outro projeto Supabase

1. No SQL Editor, execute `migrations/20261016113000_interclasse_access.sql`. Ela cria tabelas, uma linha vazia de estado, RLS e triggers sem apagar tabelas ou registros existentes.
2. Crie as contas Auth usando os endereços internos definidos em `bootstrap-teachers.sql`, marque-as como confirmadas e defina senhas temporárias fortes. Os endereços terminam em `.invalid` e não recebem e-mails.
3. Execute `bootstrap-teachers.sql` uma vez após criar exatamente as três contas. O script aborta se alguma estiver faltando e não altera um papel existente.
4. Configure as variáveis de ambiente conforme o README da raiz. `SUPABASE_SERVICE_ROLE_KEY` é somente server-side na Vercel; nunca use um prefixo `VITE_`.

Não há cadastro público no app. Uma conta sem papel em `teacher_roles` não consegue ler ou atualizar os dados, mesmo se existir em Supabase Auth.
