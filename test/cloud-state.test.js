import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTournament, recordResult } from '../src/lib/tournament.js';
import { mergeCloudState, splitDataForCloud } from '../src/lib/cloudState.js';

function completeTournament(initial) {
  let current = initial;
  for (const round of initial.rounds) {
    for (const match of round.matches) {
      const liveMatch = current.rounds.flatMap((item) => item.matches).find((item) => item.id === match.id);
      if (liveMatch?.status !== 'pending' || !liveMatch.team1Id || !liveMatch.team2Id) continue;
      current = recordResult(current, liveMatch.id, { score1: 3, score2: 1, winnerId: null, decision: '' });
    }
  }
  return current;
}

function makeCompetition(teamCount) {
  const teams = Array.from({ length: teamCount }, (_, index) => ({ id: `team-${index + 1}`, name: `Equipe ${index + 1}` }));
  return drawTournament('futsal', teams);
}

test('separa sorteio e placares e recompõe vencedores, placares e vagas diretas', () => {
  const competition = completeTournament(makeCompetition(5));
  const state = {
    students: [{ id: 'student-1', name: 'Ana' }],
    teams: Array.from({ length: 5 }, (_, index) => ({ id: `team-${index + 1}`, name: `Equipe ${index + 1}`, studentIds: [] })),
    competitions: { futsal: competition, volei: null },
  };
  const split = splitDataForCloud(state);
  const merged = mergeCloudState(split);
  const originalMatches = competition.rounds.flatMap((round) => round.matches);
  const restoredMatches = merged.competitions.futsal.rounds.flatMap((round) => round.matches);

  assert.deepEqual(merged.students, state.students);
  assert.equal(merged.competitions.volei, null);
  assert.equal(restoredMatches.filter((match) => match.status === 'bye').length, 3);
  for (const original of originalMatches) {
    const restored = restoredMatches.find((match) => match.id === original.id);
    assert.equal(restored.winnerId, original.winnerId);
    assert.equal(restored.score1, original.score1);
    assert.equal(restored.score2, original.score2);
  }
});

test('descarta placares de fases seguintes se um resultado anterior trocar os participantes', () => {
  const competition = completeTournament(makeCompetition(4));
  const state = {
    students: [],
    teams: Array.from({ length: 4 }, (_, index) => ({ id: `team-${index + 1}`, name: `Equipe ${index + 1}`, studentIds: [] })),
    competitions: { futsal: competition, volei: null },
  };
  const split = splitDataForCloud(state);
  const openingMatch = competition.rounds[0].matches.find((match) => match.status === 'complete');
  const previousResult = split.results.futsal[openingMatch.id];
  split.results.futsal[openingMatch.id] = {
    ...previousResult,
    score1: previousResult.score1 > previousResult.score2 ? 1 : 4,
    score2: previousResult.score1 > previousResult.score2 ? 4 : 1,
  };

  const merged = mergeCloudState(split);
  const final = merged.competitions.futsal.rounds.at(-1).matches[0];
  assert.notEqual(final.status, 'complete');
  assert.equal(final.score1, null);
  assert.equal(final.score2, null);
});
