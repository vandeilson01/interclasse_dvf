# Validação da migração

A migração `migrations/20261016113000_interclasse_access.sql` aplica RLS às duas tabelas. A função `enforce_interclasse_state_permissions` compara as colunas alteradas no banco:

- `admin`: pode alterar alunos, equipes, sorteios e resultados.
- `organizer`: pode alterar alunos, equipes e resultados; a coluna `draws` é imutável para este papel.
- `scorekeeper`: pode alterar apenas `results`.
- sem papel: não lê nem atualiza a linha de estado.

Toda alteração de resultados também passa pela validação SQL: partida existente, equipes pertencentes à chave, vencedor entre as equipes do registro, placares numéricos não negativos e critério preenchido quando houver empate. O conjunto executável de testes do cliente e do round-trip JSON está em `test/cloud-state.test.js` (`pnpm test`).
