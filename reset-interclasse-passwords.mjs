import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const require = createRequire(`${process.cwd()}/package.json`);
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const newPassword = process.env.RESET_PASSWORD;
const accounts = [
  { username: 'andreson', email: 'andreson@accounts.interclasse.invalid' },
  { username: 'leilson', email: 'leilson@accounts.interclasse.invalid' },
  { username: 'luisroberto', email: 'luisroberto@accounts.interclasse.invalid' },
];

if (!supabaseUrl || !secretKey || !newPassword) {
  console.error('Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) e RESET_PASSWORD no ambiente.');
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error('A nova senha precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.error(`Não foi possível consultar as contas do Supabase Auth: ${error.message}`);
  process.exit(1);
}

const byEmail = new Map((data.users || []).map((user) => [String(user.email || '').toLowerCase(), user]));
const targets = accounts.map((account) => ({ ...account, user: byEmail.get(account.email) }));
const missing = targets.filter((target) => !target.user);
if (missing.length) {
  console.error(`Conta(s) não encontrada(s): ${missing.map((item) => item.username).join(', ')}. Nenhuma senha foi alterada.`);
  process.exit(1);
}

console.log('Serão redefinidas as senhas das três contas: andreson, leilson e luisroberto.');
console.log('A nova senha não será exibida pelo script.');
const readline = createInterface({ input: stdin, output: stdout });
const confirmation = await readline.question('Para confirmar, digite REDEFINIR: ');
readline.close();
if (confirmation.trim() !== 'REDEFINIR') {
  console.log('Cancelado. Nenhuma senha foi alterada.');
  process.exit(0);
}

for (const target of targets) {
  const { error: updateError } = await supabase.auth.admin.updateUserById(target.user.id, { password: newPassword });
  if (updateError) {
    console.error(`Falha ao redefinir ${target.username}: ${updateError.message}`);
    console.error('As contas anteriores nesta execução podem já ter sido atualizadas.');
    process.exit(1);
  }
  console.log(`Senha redefinida para ${target.username}.`);
}

console.log('Concluído. Entre no sistema usando o nome de usuário e a nova senha.');
