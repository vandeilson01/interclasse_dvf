# Entregas

- [x] **Cadastro de alunos** — Permitir cadastro, edição, consulta e exclusão de alunos participantes; registrar nome, turma, modalidades e, quando informado, curso técnico.
- [x] **Equipes por modalidade** — Permitir cadastrar e organizar equipes por modalidade, vinculando alunos aos respectivos times.
- [x] **Competições separadas** — Manter equipes, confrontos e resultados de vôlei e futsal organizados separadamente.
- [x] **Sorteio e chave eliminatória** — Sortear automaticamente os confrontos iniciais entre equipes inscritas; gerar e visualizar a chave exclusivamente em mata-mata; avançar vencedores pelas fases até a final, com vagas diretas quando o número de equipes não completar uma chave.
- [x] **Placares e resultados** — Registrar e atualizar placares de cada confronto; solicitar a escolha do vencedor e critério quando houver empate no placar.
- [x] **Tabela de jogos** — Exibir tabelas de jogos e resultados com fase, equipes, placar, vencedor e situação da partida.
- [x] **Armazenamento compartilhado e JSON** — Guardar alunos, equipes, sorteios e resultados no Postgres Supabase; exportar backups `.json` e importar arquivos válidos para substituir o estado compartilhado.
- [x] **Identidade e responsividade** — Exibir o título Interclasse Técnico 2026, o lema “Esporte, Gestão e Profissões em Ação”, o nome CENTRO EDUCA MAIS DOMINGOS VIEIRA FILHO, Paço do Lumiar - MA, e a logo fornecida em uma interface responsiva. Refletir o vínculo interdisciplinar com os cursos técnicos de Informática, Administração e Marketing e a Feira das Profissões, conforme o documento enviado.
- [x] **Senha única de acesso** — Substituir os logins individuais do Supabase Auth por um único campo de senha compartilhada; conferir a senha somente no servidor pela variável privada `INTERCLASSE_SHARED_PASSWORD`; não gravar ou incluir a senha no React, no repositório, no ZIP nem em respostas do sistema.
- [x] **Sessão privada** — Após uma senha correta, criar uma sessão temporária assinada em cookie `HttpOnly; Secure; SameSite=None`; validar a sessão no servidor, encerrá-la ao sair e exigir novo login quando expirar.
- [x] **Mesmo nível de permissão** — Toda pessoa autenticada pela senha única pode consultar e alterar alunos, equipes, sorteios, placares e backups JSON. Remover a divisão de cargos, a identificação do professor e o menu de gestão de contas; informar que alterações não terão autoria individual.
- [x] **Supabase somente como banco** — Continuar compartilhando o estado JSON dos campeonatos por meio de uma função serverless autenticada; manter `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor; revogar o acesso direto `anon`/`authenticated` à tabela de estado, sem apagar dados ou contas existentes. Migração executada e verificada no projeto Supabase `interclasse`.
- [x] **Configuração da Vercel** — Documentar que o titular deve adicionar `INTERCLASSE_SHARED_PASSWORD`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variáveis server-side da Vercel e publicar uma nova versão; não fazer deploy para o usuário.

**Estado preservado:** as contas individuais já criadas para Andreson, Leilson e Luis Roberto permanecem no Supabase, mas deixam de ser usadas pelo app e não serão apagadas.
