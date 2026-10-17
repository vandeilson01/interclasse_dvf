export const STUDENT_COURSES = ['Não informado', 'Informática', 'Administração', 'Marketing', 'Outro'];
export const STUDENT_MODALITIES = ['futsal', 'volei'];

export function normalizeStudentSignup(input = {}) {
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  const classroom = String(input.classroom || '').trim().replace(/\s+/g, ' ');
  const course = String(input.course || 'Não informado').trim();

  if (name.length < 2 || name.length > 80) {
    return { error: 'Informe seu nome completo (2 a 80 caracteres).' };
  }
  if (classroom.length < 1 || classroom.length > 30) {
    return { error: 'Informe sua turma (até 30 caracteres).' };
  }
  if (!STUDENT_COURSES.includes(course)) {
    return { error: 'Selecione um curso válido.' };
  }
  if (!Array.isArray(input.modalities)) {
    return { error: 'Selecione pelo menos uma modalidade.' };
  }
  const modalities = [...new Set(input.modalities)];
  if (modalities.length < 1 || modalities.some((item) => !STUDENT_MODALITIES.includes(item))) {
    return { error: 'Selecione futsal, vôlei ou as duas modalidades.' };
  }

  return {
    value: { name, classroom, course, modalities },
  };
}
