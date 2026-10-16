import { emptyData, normalizeData } from './storage.js';
import { recordResult, recalculateBracket } from './tournament.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const SPORTS = ['futsal', 'volei'];

function pristineDraw(tournament) {
  const rounds = tournament.rounds.map((round, roundIndex) => ({
    ...round,
    matches: round.matches.map((match) => {
      const isOpeningBye = roundIndex === 0 && match.status === 'bye';
      return {
        ...match,
        score1: null,
        score2: null,
        decision: '',
        winnerId: isOpeningBye ? (match.team1Id || match.team2Id || null) : null,
        status: isOpeningBye ? 'bye' : (match.team1Id && match.team2Id ? 'pending' : 'waiting'),
      };
    }),
  }));
  return { ...tournament, rounds: recalculateBracket(rounds) };
}

function resultsFromTournament(tournament) {
  const results = {};
  for (const round of tournament.rounds || []) {
    for (const match of round.matches || []) {
      if (match.status !== 'complete' || match.score1 === null || match.score2 === null) continue;
      results[match.id] = {
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        score1: Number(match.score1),
        score2: Number(match.score2),
        winnerId: match.winnerId,
        decision: match.decision || '',
      };
    }
  }
  return results;
}

export function splitDataForCloud(value) {
  const data = normalizeData(value);
  const draws = { futsal: null, volei: null };
  const results = { futsal: {}, volei: {} };
  for (const sport of SPORTS) {
    const tournament = data.competitions[sport];
    if (!tournament) continue;
    draws[sport] = pristineDraw(tournament);
    results[sport] = resultsFromTournament(tournament);
  }
  return {
    students: clone(data.students),
    teams: clone(data.teams),
    draws,
    results,
  };
}

function findMatch(tournament, matchId) {
  for (const round of tournament.rounds || []) {
    const match = round.matches.find((item) => item.id === matchId);
    if (match) return match;
  }
  return null;
}

function hydrateTournament(draw, resultMap) {
  if (!draw || typeof draw !== 'object' || !Array.isArray(draw.rounds)) return null;
  let tournament = clone(draw);
  const records = resultMap && typeof resultMap === 'object' ? resultMap : {};
  const matchIds = draw.rounds.flatMap((round) => (round.matches || []).map((match) => match.id));
  for (const matchId of matchIds) {
    const result = records[matchId];
    const current = findMatch(tournament, matchId);
    if (!result || !current?.team1Id || !current?.team2Id) continue;
    if (result.team1Id !== current.team1Id || result.team2Id !== current.team2Id) continue;
    try {
      tournament = recordResult(tournament, matchId, {
        score1: Number(result.score1),
        score2: Number(result.score2),
        winnerId: result.winnerId,
        decision: result.decision || '',
      });
    } catch {
      // Ignora placares incompatíveis com uma chave anterior; nunca os usa para trocar o sorteio.
    }
  }
  return tournament;
}

export function mergeCloudState(row) {
  const fallback = emptyData();
  const draws = row?.draws || {};
  const results = row?.results || {};
  return normalizeData({
    students: Array.isArray(row?.students) ? row.students : fallback.students,
    teams: Array.isArray(row?.teams) ? row.teams : fallback.teams,
    competitions: {
      futsal: hydrateTournament(draws.futsal, results.futsal),
      volei: hydrateTournament(draws.volei, results.volei),
    },
  });
}
