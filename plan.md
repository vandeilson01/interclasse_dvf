# Plano — Acesso único com dados compartilhados

## Arquitetura aprovada

Manter o front-end React + Vite e a identidade visual azul-marinho/ciano já aprovada. A Vercel servirá o build estático e as funções serverless do diretório `api/`. O Supabase será usado somente como banco Postgres; o aplicativo não usará Supabase Auth para iniciar sessão nem consultará contas ou papéis de professores.

O acesso usa uma única senha compartilhada, conferida exclusivamente na função server-side `api/session.js` contra a variável privada `INTERCLASSE_SHARED_PASSWORD`. Após validar, a função emite uma sessão assinada, temporária e em cookie `HttpOnly; Secure; SameSite=None`. A senha não será incluída no React, no repositório, no ZIP ou em respostas da API. A assinatura é verificada no servidor para cada acesso ao estado. A sessão expira em 12 horas; para trocar a senha, o titular atualiza a variável privada na Vercel e publica novamente.

O front-end não usa uma chave Supabase. `api/state.js` valida a sessão e consulta/atualiza a linha única `interclasse_state` usando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, ambos somente no servidor. A API aceita gravações apenas da mesma origem. A migração `20261018120000_shared_password_only_access.sql` revoga leitura/gravação direta da tabela para `anon` e `authenticated`, mantendo todas as tabelas e contas e permitindo à API server-side operar no JSON.

Todos que souberem a senha única têm as mesmas permissões operacionais no app: consultar e alterar alunos, equipes, sorteios, placares, importar/exportar JSON. Não há identificação individual de quem fez cada alteração nem gestão de usuários/papéis dentro do app.

## Organização do código

- `api/session.js`: confere a senha configurada, emite/valida/encerra sessão assinada em cookie seguro.
- `api/state.js`: carrega e atualiza o estado JSON no Supabase após validar sessão e origem.
- `server/session.js`: assinatura HMAC, comparação constante de senha, validação da origem e atributos do cookie.
- `server/supabaseAdmin.js`: cliente Supabase server-side que consome a chave de serviço sem expô-la ao navegador.
- `src/lib/auth.js`: chama os endpoints de sessão; não usa `signInWithPassword` nem `teacher_roles`.
- `src/lib/cloudStore.js`: sincroniza a linha Supabase exclusivamente pelo endpoint `/api/state`, com controle de revisão otimista.
- `src/components/AuthGate.jsx` e `LoginPage.jsx`: validam sessão ao iniciar e mostram somente um campo de senha.
- `src/App.jsx` e `src/lib/permissions.js`: removem nomes/cargos de professores, o menu Acessos e verificações divergentes; conservam cadastro, mata-mata, placares e backup, com um único nível de acesso.
- `supabase/migrations/`: preserva as migrações existentes e adiciona a política de acesso exclusivo por API.
- `.env.example` e `README.md`: documentam senha compartilhada e variáveis da Vercel sem incluir valores secretos.

## Estado Supabase existente

A migração original, as contas Andreson/Leilson/Luis Roberto e os respectivos papéis permanecem no Supabase e não serão apagados nem usados pelo app atual. A migração aditiva `20261018120000_shared_password_only_access.sql` foi executada no projeto Supabase `interclasse` em 18/10/2026 e retornou sucesso; a consulta de verificação confirmou RLS ativa, nenhuma policy/grant para `anon` ou `authenticated` nas tabelas do app e permissões de serviço para a API server-side. A linha de estado e as contas existentes foram preservadas.

## Interface

Preservar o design existente, a logo da escola e o painel de gestão. A tela de entrada substitui usuário e senha por um único campo de senha com ação de mostrar/ocultar. O indicador superior mostra sincronização do banco, sem avatar, nome de professor ou rótulo de cargo; o painel deixa de exibir a página Acessos e as ações são as mesmas para todas as pessoas autenticadas.
