import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTournament, recordResult } from '../src/lib/tournament.js';

const makeTeams = (count, prefix = 'team') => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index + 1}`,
  name: `Equipe ${index + 1}`,
}));

test('sorteia e termina torneios com quantidade irregular ou regular de equipes', () => {
  for (let count = 2; count <= 17; count += 1) {
    const teams = makeTeams(count);
    let tournament = drawTournament('futsal', teams);
    const expectedBracketSize = 2 ** Math.ceil(Math.log2(count));
    const matches = tournament.rounds.flatMap((round) => round.matches);

    assert.equal(matches.length, expectedBracketSize - 1);
    assert.equal(matches.filter((match) => match.status === 'bye').length, expectedBracketSize - count);
    assert.ok(tournament.rounds[0].matches.every((match) => match.team1Id || match.team2Id));

    let completed = 0;
    while (!tournament.rounds.at(-1).matches[0].winnerId && completed < 50) {
      const match = tournament.rounds.flatMap((round) => round.matches).find((item) => item.status === 'pending');
      assert.ok(match, `a próxima partida deve estar pronta para ${count} equipes`);
      tournament = recordResult(tournament, match.id, { score1: 1, score2: 0, winnerId: '', decision: '' });
      completed += 1;
    }
    assert.ok(tournament.rounds.at(-1).matches[0].winnerId, `deve haver campeão com ${count} equipes`);
    assert.equal(completed, count - 1);
  }
});

test('empate exige vencedor da decisão e guarda o critério', () => {
  let tournament = drawTournament('futsal', makeTeams(2, 'tie'));
  const match = tournament.rounds[0].matches[0];
  assert.throws(() => recordResult(tournament, match.id, { score1: 2, score2: 2, winnerId: '', decision: '' }), /selecione quem venceu/i);
  tournament = recordResult(tournament, match.id, { score1: 2, score2: 2, winnerId: match.team2Id, decision: 'Pênaltis' });
  assert.equal(tournament.rounds[0].matches[0].winnerId, match.team2Id);
  assert.equal(tournament.rounds[0].matches[0].decision, 'Pênaltis');
});

test('alterar um resultado anterior invalida placares dependentes nas fases seguintes', () => {
  let tournament = drawTournament('volei', makeTeams(4, 'edit'));
  const [first, second] = tournament.rounds[0].matches;
  tournament = recordResult(tournament, first.id, { score1: 2, score2: 0, winnerId: '', decision: '' });
  tournament = recordResult(tournament, second.id, { score1: 2, score2: 0, winnerId: '', decision: '' });
  const final = tournament.rounds.at(-1).matches[0];
  tournament = recordResult(tournament, final.id, { score1: 2, score2: 1, winnerId: '', decision: '' });

  tournament = recordResult(tournament, first.id, { score1: 0, score2: 3, winnerId: '', decision: '' });
  assert.equal(tournament.rounds.at(-1).matches[0].winnerId, null);
  assert.equal(tournament.rounds.at(-1).matches[0].score1, null);
});
