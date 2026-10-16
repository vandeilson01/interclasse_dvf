import { createContext, useContext } from 'react';

export const AccessContext = createContext(null);

export const ROLE_LABEL = {
  admin: 'Administrador',
  organizer: 'Organizador',
  scorekeeper: 'Responsável pelos placares',
};

export function useAccess() {
  const access = useContext(AccessContext);
  if (!access) throw new Error('O contexto de acesso não foi carregado.');
  return access;
}

export function permissionsFor(role) {
  return {
    role,
    roleLabel: ROLE_LABEL[role] || 'Sem permissão',
    isAdmin: role === 'admin',
    canManageRoster: role === 'admin' || role === 'organizer',
    canManageDraw: role === 'admin',
    canEditScores: role === 'admin' || role === 'organizer',
    canEnterPendingScores: role === 'admin' || role === 'organizer' || role === 'scorekeeper',
    canManageUsers: role === 'admin',
  };
}
