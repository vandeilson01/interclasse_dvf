const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function nextPowerOfTwo(value) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function roundLabel(matchCount, totalRounds) {
  if (matchCount === 1) return 'Final';
  if (matchCount === 2) return 'Semifinal';
  if (matchCount === 4) return 'Quartas de final';
  if (matchCount === 8) return 'Oitavas de final';
  if (matchCount > 8) return `${matchCount * 2} avos de final`;
  return `Fase ${totalRounds - matchCount + 1}`;
}

export function drawTournament(modality, registeredTeams) {
  if (!Array.isArray(registeredTeams) || registeredTeams.length < 2) {
    throw new Error('Cadastre pelo menos duas equipes nesta modalidade para realizar o sorteio.');
  }
  const teams = shuffle(registeredTeams);
  const bracketSize = nextPowerOfTwo(teams.length);
  const byeCount = bracketSize - teams.length;
  const firstPairs = [];

  // Distribui as vagas diretas sem criar confrontos entre duas vagas vazias.
  for (let index = 0; index < byeCount; index += 1) {
    firstPairs.push([teams[index], null]);
  }
  for (let index = byeCount; index < teams.length; index += 2) {
    firstPairs.push([teams[index], teams[index + 1] || null]);
  }

  const firstRound = firstPairs.map(([team1, team2], index) => ({
    id: makeId(),
    number: index + 1,
    team1Id: team1?.id ?? null,
    team2Id: team2?.id ?? null,
    sourceMatchIds: null,
    score1: null,
    score2: null,
    decision: '',
    winnerId: team2 ? null : (team1?.id ?? null),
    status: team2 ? 'pending' : 'bye',
  }));

  const rounds = [{ label: '', matches: firstRound }];
  let previousRound = firstRound;
  while (previousRound.length > 1) {
    const currentRound = [];
    for (let index = 0; index < previousRound.length; index += 2) {
      currentRound.push({
        id: makeId(),
        number: index / 2 + 1,
        team1Id: previousRound[index]?.winnerId ?? null,
        team2Id: previousRound[index + 1]?.winnerId ?? null,
        sourceMatchIds: [previousRound[index].id, previousRound[index + 1].id],
        score1: null,
        score2: null,
        decision: '',
        winnerId: null,
        status: 'waiting',
      });
    }
    rounds.push({ label: '', matches: currentRound });
    previousRound = currentRound;
  }
  rounds.forEach((round) => { round.label = roundLabel(round.matches.length, rounds.length); });
  return {
    modality,
    rounds,
    teamIds: teams.map((team) => team.id),
    createdAt: new Date().toISOString(),
  };
}

export function recalculateBracket(rounds) {
  const next = rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));

  for (let roundIndex = 1; roundIndex < next.length; roundIndex += 1) {
    const previous = next[roundIndex - 1].matches;
    for (const match of next[roundIndex].matches) {
      const [source1, source2] = match.sourceMatchIds || [];
      const team1Id = previous.find((item) => item.id === source1)?.winnerId ?? null;
      const team2Id = previous.find((item) => item.id === source2)?.winnerId ?? null;
      if (team1Id !== match.team1Id || team2Id !== match.team2Id) {
        match.team1Id = team1Id;
        match.team2Id = team2Id;
        match.score1 = null;
        match.score2 = null;
        match.decision = '';
        match.winnerId = null;
        match.status = 'waiting';
      }
      if (match.winnerId && ![match.team1Id, match.team2Id].includes(match.winnerId)) {
        match.score1 = null;
        match.score2 = null;
        match.decision = '';
        match.winnerId = null;
        match.status = 'waiting';
      }
      if (match.winnerId) match.status = 'complete';
      else match.status = match.team1Id && match.team2Id ? 'pending' : 'waiting';
    }
  }
  return next;
}

export function recordResult(tournament, matchId, { score1, score2, winnerId, decision }) {
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  let target;
  for (const round of rounds) {
    target = round.matches.find((match) => match.id === matchId);
    if (target) break;
  }
  if (!target) throw new Error('Partida não encontrada.');
  if (!target.team1Id || !target.team2Id) throw new Error('Este confronto ainda não está definido.');
  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 < 0 || score2 < 0) {
    throw new Error('Informe placares válidos.');
  }
  if (score1 === score2 && ![target.team1Id, target.team2Id].includes(winnerId)) {
    throw new Error('Em caso de empate, selecione quem venceu a decisão.');
  }
  const resolvedWinner = score1 === score2 ? winnerId : (score1 > score2 ? target.team1Id : target.team2Id);
  Object.assign(target, {
    score1,
    score2,
    winnerId: resolvedWinner,
    decision: score1 === score2 ? decision : '',
    status: 'complete',
  });
  return {
    ...tournament,
    rounds: recalculateBracket(rounds),
    updatedAt: new Date().toISOString(),
  };
}
