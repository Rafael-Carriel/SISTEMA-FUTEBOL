import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {}, auth: {} }));

import {
  formatBrazilianPhoneInput,
  isValidBrazilianPhone,
  validateBrazilianPhone,
} from '../phone-auth';

describe('validateBrazilianPhone', () => {
  it('aceita formatos comuns de celular brasileiro', () => {
    for (const input of ['(11) 99999-9999', '+5511999999999', '+55 11 99999-9999', '11999999999']) {
      const result = validateBrazilianPhone(input);
      expect(result.valid).toBe(true);
      expect(result.e164).toBe('+5511999999999');
      expect(result.formatted).toBe('+55 11 99999-9999');
      expect(result.error).toBeNull();
    }
  });

  it('rejeita vazio e incompleto', () => {
    expect(validateBrazilianPhone('').valid).toBe(false);
    expect(validateBrazilianPhone('(11) 9999-999').valid).toBe(false);
  });

  it('rejeita DDD com zero e numero sem 9 na frente', () => {
    expect(validateBrazilianPhone('(01) 99999-9999').error).toMatch(/DDD/);
    expect(validateBrazilianPhone('(11) 89999-9999').valid).toBe(false);
  });

  it('rejeita numero longo demais', () => {
    expect(validateBrazilianPhone('119999999999').valid).toBe(false);
  });
});

describe('isValidBrazilianPhone', () => {
  it('espelha a validacao completa', () => {
    expect(isValidBrazilianPhone('(21) 98888-7777')).toBe(true);
    expect(isValidBrazilianPhone('abc')).toBe(false);
  });
});

describe('formatBrazilianPhoneInput', () => {
  it('aplica mascara progressiva enquanto digita', () => {
    expect(formatBrazilianPhoneInput('')).toBe('');
    expect(formatBrazilianPhoneInput('1')).toBe('(1');
    expect(formatBrazilianPhoneInput('11')).toBe('(11');
    expect(formatBrazilianPhoneInput('119')).toBe('(11) 9');
    expect(formatBrazilianPhoneInput('1199999')).toBe('(11) 99999');
    expect(formatBrazilianPhoneInput('11999999999')).toBe('(11) 99999-9999');
  });

  it('ignora codigo do pais digitado', () => {
    expect(formatBrazilianPhoneInput('+5511999999999')).toBe('(11) 99999-9999');
  });
});
