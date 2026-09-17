import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => {
  return { db: {}, auth: {} };
});

import { slugify } from '../organizations';

describe('slugify', () => {
  it('converte nome simples em slug', () => {
    expect(slugify('Fut das Quintas')).toBe('fut-das-quintas');
  });

  it('remove acentos e caixa alta', () => {
    expect(slugify('Pelada do Sábado à Noite')).toBe('pelada-do-sabado-a-noite');
  });

  it('troca caracteres especiais por hifen unico', () => {
    expect(slugify('  Fut   @#$  Galera!!  ')).toBe('fut-galera');
  });

  it('remove hifens das bordas', () => {
    expect(slugify('---Resenha---')).toBe('resenha');
  });

  it('retorna vazio para nome sem letras ou numeros', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('limita o tamanho para caber no id do documento', () => {
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(60);
  });
});
