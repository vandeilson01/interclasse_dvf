import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStudentSignup } from '../src/lib/studentRegistration.js';

test('normaliza nome e turma e mantém modalidades válidas sem duplicatas', () => {
  const result = normalizeStudentSignup({
    name: '  Ana   Beatriz Silva  ',
    classroom: ' 2º ano B ',
    course: 'Informática',
    modalities: ['futsal', 'futsal', 'volei'],
  });
  assert.deepEqual(result, {
    value: {
      name: 'Ana Beatriz Silva',
      classroom: '2º ano B',
      course: 'Informática',
      modalities: ['futsal', 'volei'],
    },
  });
});

test('rejeita nome vazio, turma vazia e modalidade ausente ou inválida', () => {
  assert.match(normalizeStudentSignup({ classroom: '2º ano B', modalities: ['futsal'] }).error, /nome completo/i);
  assert.match(normalizeStudentSignup({ name: 'Ana', modalities: ['futsal'] }).error, /turma/i);
  assert.match(normalizeStudentSignup({ name: 'Ana', classroom: '2º ano B', modalities: [] }).error, /modalidade/i);
  assert.match(normalizeStudentSignup({ name: 'Ana', classroom: '2º ano B', modalities: ['basquete'] }).error, /modalidade/i);
});

test('rejeita campos além dos limites definidos e curso inválido', () => {
  assert.match(normalizeStudentSignup({ name: 'A'.repeat(81), classroom: '2º ano B', modalities: ['volei'] }).error, /nome completo/i);
  assert.match(normalizeStudentSignup({ name: 'Ana', classroom: 'T'.repeat(31), modalities: ['volei'] }).error, /turma/i);
  assert.match(normalizeStudentSignup({ name: 'Ana', classroom: '2º ano B', course: 'Curso inventado', modalities: ['volei'] }).error, /curso/i);
});
