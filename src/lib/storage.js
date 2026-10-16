export const STORAGE_KEY = 'cem-dvf-interclasse-json-v1';
export const BACKUP_VERSION = 1;

export function emptyData() {
  return {
    students: [],
    teams: [],
    competitions: { futsal: null, volei: null },
  };
}

export function readStoredData() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return emptyData();
    const parsed = JSON.parse(value);
    return normalizeData(parsed);
  } catch {
    return emptyData();
  }
}

export function normalizeData(value) {
  if (!value || typeof value !== 'object') throw new Error('O arquivo não contém um objeto JSON válido.');
  const data = value.data && typeof value.data === 'object' ? value.data : value;
  if (!Array.isArray(data.students) || !Array.isArray(data.teams)) {
    throw new Error('JSON inválido: os campos "students" e "teams" devem ser listas.');
  }
  const competitions = data.competitions && typeof data.competitions === 'object' ? data.competitions : {};
  return {
    students: data.students,
    teams: data.teams,
    competitions: {
      futsal: competitions.futsal || null,
      volei: competitions.volei || null,
    },
  };
}

export function makeBackup(data) {
  return {
    app: 'Interclasse Técnico 2026 · C.E. Domingos Vieira Filho',
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    school: 'CENTRO EDUCA MAIS DOMINGOS VIEIRA FILHO',
    city: 'Paço do Lumiar - MA',
    data,
  };
}
