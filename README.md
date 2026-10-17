# Interclasse Técnico 2026 — Centro Educa Mais Domingos Vieira Filho

**Esporte, Gestão e Profissões em Ação.** Aplicação React + Vite para a interclasse de vôlei e futsal, em formato mata-mata. O painel também apresenta o projeto integrador dos cursos técnicos de Informática, Administração e Marketing para a Feira das Profissões.

## O que já está configurado

A migração de banco foi executada com sucesso no projeto Supabase `interclasse`, e as três contas foram criadas e associadas aos seus papéis:

- `andreson` — administrador.
- `leilson` — organizador.
- `luisroberto` — responsável pelos placares.

**Não recrie essas contas nem rode o bootstrap novamente no projeto atual.** As senhas temporárias foram entregues separadamente ao titular; cada professor pode trocá-la no painel após entrar.

Os endereços `.invalid` usados pelo Supabase são internos e não recebem e-mails. No app, os professores informam apenas username e senha.

## Executar localmente

Requer Node.js 20.19+ (ou 22.12+) e pnpm 11. Copie `.env.example` para `.env.local`, preencha a chave pública do Supabase e execute:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

O front-end usa somente valores públicos do Supabase. A função de administração de contas, `api/users.js`, é serverless da Vercel e não está disponível no servidor simples do Vite. Os arquivos de produção são gerados em `dist/` com `pnpm build`; os testes ficam em `pnpm test`.

## Supabase em outro projeto

No projeto Supabase atual, as etapas abaixo já foram concluídas e verificadas. Para configurar **outro** projeto:

1. No SQL Editor, execute `supabase/migrations/20261016113000_interclasse_access.sql` e, em seguida, `supabase/migrations/20261016150000_student_signups.sql`. As migrações criam tabelas e políticas próprias da interclasse sem apagar tabelas ou registros existentes.
2. Em **Authentication → Users**, crie os três usuários com os endereços internos da tabela e uma senha forte para cada um. Marque-os como confirmados; os aliases `.invalid` não recebem e-mails.

   | Professor | Username no app | E-mail interno do Supabase |
   | --- | --- | --- |
   | Andreson | `andreson` | `andreson@accounts.interclasse.invalid` |
   | Leilson | `leilson` | `leilson@accounts.interclasse.invalid` |
   | Luis Roberto | `luisroberto` | `luisroberto@accounts.interclasse.invalid` |

3. Só depois de criar as três contas, execute `supabase/bootstrap-teachers.sql` **uma vez** para associar administrador, organizador e responsável pelos placares. O script aborta se uma conta estiver faltando e não altera papéis já associados.
4. O cadastro de contas de professores continua restrito. A página pública de inscrição de alunos não dá acesso ao painel nem aos dados compartilhados; os registros ficam pendentes para revisão por administrador ou organizador.

No projeto Supabase já usado pela interclasse, aplique somente a migração nova `supabase/migrations/20261016150000_student_signups.sql` no SQL Editor antes de publicar esta versão. Ela cria a tabela privada de inscrições pendentes e autoriza a API server-side a inserir alunos aprovados sem liberar escrita pública no estado do torneio.

## Publicar na Vercel

1. Envie a pasta do projeto a um repositório GitHub e importe-o na Vercel usando o preset **Vite**.
2. Use o comando `pnpm build` e o diretório de saída `dist`. As funções serverless `api/users.js` e `api/student-signups.js` são detectadas pela Vercel.
3. Em **Project Settings → Environment Variables**, configure:

   | Variável | Onde | Valor |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | Front-end | `https://dppbejaxouoqfnhutjmg.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY` | Front-end | Chave pública do projeto Supabase |
   | `SUPABASE_URL` | Somente servidor | A mesma URL do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Somente servidor** | Chave administrativa do Supabase |

4. Faça um novo deploy para carregar as variáveis.

**Nunca** prefixe `SUPABASE_SERVICE_ROLE_KEY` com `VITE_`, nem a inclua no código, no GitHub, no ZIP ou em mensagens. A tela **Acessos** e as rotas `/api/users` e `/api/student-signups` dependem da chave somente server-side. A senha dos professores é validada pelo Supabase Auth; nunca a escreva no front-end.

## Permissões

- **Andreson — administrador:** administra alunos, equipes, sorteios/chaves, placares, backups JSON e acessos.
- **Leilson — organizador:** administra alunos/equipes e lança/edita placares; não pode sortear/refazer chaves nem administrar acessos.
- **Luis Roberto — responsável pelos placares:** consulta o torneio e lança placares de jogos pendentes; não altera cadastros, equipes, chaves ou resultados finalizados.

As permissões são aplicadas na interface **e** reforçadas por RLS e triggers no Postgres. O endpoint `/api/users` valida o token e o papel de administrador antes de usar a chave de serviço.

## Dados, backups e cadastro

Alunos, equipes, sorteios e placares ficam compartilhados no Postgres Supabase. **Exportar JSON** cria uma cópia de segurança; somente o administrador pode importar um estado completo, substituindo os dados compartilhados. Backups da versão local anterior podem ser importados pelo administrador.

Os alunos podem acessar `/inscricao` pelo QR Code exibido na página **Alunos** do painel. O formulário solicita somente nome, turma, curso técnico opcional e modalidades; cada inscrição aguarda revisão de um professor antes de entrar no elenco. Depois de aprovada, a pessoa pode ser vinculada às equipes na tela **Equipes**. Mantenha os backups JSON em local controlado.
