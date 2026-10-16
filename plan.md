# Plano — Acessos dos professores e dados compartilhados

## Arquitetura

Manter o front-end React + Vite e a identidade visual azul-marinho/ciano já aprovada. A Vercel servirá o build estático e as funções do diretório `api/`. Supabase Auth fará o login; o Postgres do projeto `interclasse` guardará o estado compartilhado do torneio. Não haverá conta demo nem modo de desenvolvimento que ignore a autenticação.

A tela de login mostrará usuário e senha. Como o login de senha do Supabase usa e-mail ou telefone, o app converterá cada nome de usuário para um endereço interno reservado `@accounts.interclasse.invalid`; esse endereço não é exibido nem usado para enviar e-mail. Não haverá cadastro público ou recuperação de senha por e-mail fictício. O administrador poderá redefinir senhas no painel.

O navegador usará somente a URL pública e a chave publishable/anon do Supabase. RLS e uma trigger no banco limitarão as mudanças por papel, mesmo que alguém altere o JavaScript enviado ao navegador. A chave `service_role`, necessária ao endpoint administrativo de usuários, ficará exclusivamente em variável de ambiente de servidor na Vercel; nunca no bundle, no repositório ou no ZIP.

## Permissões aprovadas

- **Andreson — administrador:** consulta e administra alunos, equipes, sorteios/chaves e placares; pode importar o backup JSON e gerenciar os acessos dos professores.
- **Leilson — organizador:** consulta/cadastra/edita/exclui alunos e equipes; consulta e lança/edita placares; não sorteia/refaz chaves nem administra usuários.
- **Luis Roberto — placares:** consulta os dados do torneio e lança placares de jogos pendentes; não altera alunos/equipes, chaves ou placares já finalizados; não administra acessos.

## Persistência e compatibilidade

Persistir no banco as coleções de alunos/equipes, chaves sorteadas e resultados, mantendo os resultados separados da estrutura do sorteio para que os papéis de placar não possam alterar a chave. O app continuará exportando e importando backups JSON. Apenas o administrador poderá importar um estado completo. Backups antigos, com `competitions` embutindo placares, serão normalizados para o novo formato.

## Estrutura principal

- `src/lib/supabase.js`: cliente público Supabase e estado de configuração.
- `src/lib/auth.js`: login por usuário, sessão, perfil/papel e logout.
- `src/lib/cloudStore.js`: carregar/salvar estado compartilhado e converter compatibilidade JSON.
- `src/App.jsx`: login, rótulo de papel, ações condicionadas e tela de gestão de acessos.
- `api/users.js`: listar/criar/alterar papel/redefinir senha/desativar usuários; valida sessão e papel admin antes de usar `service_role`.
- `supabase/migrations/`: tabelas, RLS, políticas e trigger de autorização reproduzíveis.
- `.env.example` e `README.md`: variáveis públicas e secretas, configuração de Auth no Supabase e publicação na Vercel.

## Estado e configuração

A migração foi aplicada no projeto Supabase informado e verificada por leitura: as duas tabelas próprias, RLS, três políticas, trigger e linha inicial estão presentes. As contas Auth foram criadas e os papéis confirmados no banco: `andreson`/admin, `leilson`/organizer e `luisroberto`/scorekeeper. As senhas temporárias não são armazenadas no repositório.

Para usar o site publicado, configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no front-end, e `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor da Vercel. O titular fará o deploy; o ZIP não contém a chave service role nem a chave pública preenchida.
