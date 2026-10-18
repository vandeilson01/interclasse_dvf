# Interclasse Técnico 2026 — Centro Educa Mais Domingos Vieira Filho

**Esporte, Gestão e Profissões em Ação.** Aplicação React + Vite para a interclasse de vôlei e futsal, em formato mata-mata. O painel também apresenta o projeto integrador dos cursos técnicos de Informática, Administração e Marketing para a Feira das Profissões.

## Modelo de acesso atual

O app usa **uma senha única compartilhada**, configurada em `INTERCLASSE_SHARED_PASSWORD` nas variáveis server-side da Vercel. A senha é validada por uma função protegida; o navegador recebe somente um cookie de sessão `HttpOnly`, seguro e temporário. Não existe usuário individual nem separação de permissões: toda pessoa que souber a senha poderá cadastrar/editar/remover alunos e equipes, sortear ou refazer chaves, lançar/editar placares e importar/exportar o JSON. O sistema não registra qual pessoa fez cada alteração.

As três contas Andreson, Leilson e Luis Roberto e seus papéis antigos continuam no Supabase Auth, mas **não são usados pelo app e não foram apagados**. O app não pede username, não chama Supabase Auth e não oferece uma página de administração de usuários.

## Supabase já configurado

A migração original `20261016113000_interclasse_access.sql`, o estado inicial e os papéis anteriores já existem no projeto Supabase `interclasse`. A migração nova `supabase/migrations/20261018120000_shared_password_only_access.sql` foi executada com sucesso e verificada: o navegador não tem grants nem policies para acessar as tabelas do app; o estado e as contas não foram apagados.

No código, o cliente Supabase existe somente nas funções Vercel. Não há URL ou chave no bundle React. Configure as três variáveis abaixo antes de publicar:

| Variável | Escopo | Valor |
| --- | --- | --- |
| `INTERCLASSE_SHARED_PASSWORD` | Somente servidor | Senha compartilhada forte, com pelo menos 24 caracteres |
| `SUPABASE_URL` | Somente servidor | `https://dppbejaxouoqfnhutjmg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Somente servidor** | Chave `service_role` do projeto Supabase |

A chave `SUPABASE_SERVICE_ROLE_KEY` permite acesso administrativo ao banco. **Nunca** a prefixe com `VITE_`, nem a coloque no JavaScript, GitHub, ZIP, screenshot ou mensagem pública. O arquivo `.env.example` contém apenas placeholders.

## Executar e testar

Requer Node.js 20.19+ (ou 22.12+) e pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

`pnpm dev` inicia a tela Vite, mas não executa as funções serverless `/api/session` e `/api/state`. Para testar login e persistência localmente, use a Vercel CLI com as variáveis server-side em um `.env.local` que nunca seja enviado ao Git:

```bash
pnpm dlx vercel dev
```

Não adicione as variáveis reais a `.env.example` nem ao ZIP.

## Publicar na Vercel

1. Envie o conteúdo do ZIP para o seu repositório GitHub e importe esse repositório na Vercel; alternativamente, faça o deploy pela Vercel CLI a partir da pasta do projeto.
2. Selecione o preset **Vite**, o comando de build `pnpm build` e o diretório de saída `dist`.
3. Em **Project Settings → Environment Variables**, cadastre `INTERCLASSE_SHARED_PASSWORD`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` com escopo server-side. Não use o prefixo `VITE_`.
4. A migração já está aplicada no projeto Supabase `interclasse`; não a execute novamente nesse projeto.
5. Publique/republique na Vercel para carregar as variáveis e as funções `api/session.js` e `api/state.js`.

A troca da senha também é feita atualizando `INTERCLASSE_SHARED_PASSWORD` na Vercel e publicando novamente; isso invalida imediatamente as sessões assinadas com a senha anterior. Cada sessão também expira após 12 horas.

## Dados e privacidade

O cadastro de alunos é manual pelo formulário; **não há cadastro por QR Code nesta versão**. Alunos, equipes, sorteios e placares são guardados no registro JSON compartilhado do Supabase. **Exportar JSON** baixa um backup; **Importar** substitui o estado compartilhado completo, após confirmação. Guarde cópias em local controlado e registre somente os dados necessários à organização escolar.
