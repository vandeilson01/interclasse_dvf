export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
export const INTERNAL_AUTH_DOMAIN = 'accounts.interclasse.invalid';

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('O usuário deve ter de 3 a 32 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.');
  }
  return username;
}

export function usernameToAuthEmail(value) {
  return `${validateUsername(value)}@${INTERNAL_AUTH_DOMAIN}`;
}
