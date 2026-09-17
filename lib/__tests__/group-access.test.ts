import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

const mocks = vi.hoisted(() => ({ getDoc: vi.fn(), get: vi.fn(), set: vi.fn(), setCurrentOrg: vi.fn() }));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../organizations', () => ({ setCurrentOrg: mocks.setCurrentOrg }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: mocks.getDoc,
  runTransaction: (_db: unknown, fn: (tx: unknown) => unknown) => fn({ get: mocks.get, set: mocks.set }),
  Timestamp: { fromMillis: (ms: number) => ms },
}));
import { joinGroup, normalizeGroupCode } from '../group-access';
const user = { uid: 'player' } as User;

describe('entrada por código', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ orgId: 'fut', expiresAt: { toMillis: () => Date.now() + 60000 } }) });
    mocks.get.mockResolvedValue({ exists: () => false });
  });
  it('aceita espaços, hífens e minúsculas', () => {
    expect(normalizeGroupCode(' ab12-cd34 ef56 ')).toBe('AB12CD34EF56');
  });
  it('rejeita código malformado antes de consultar o banco', async () => {
    await expect(joinGroup('../fut', user)).rejects.toThrow('12 caracteres');
    expect(mocks.getDoc).not.toHaveBeenCalled();
  });
  it('rejeita código inexistente', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });
    await expect(joinGroup('AB12CD34EF56', user)).rejects.toThrow('inválido ou expirado');
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('rejeita código expirado', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ expiresAt: { toMillis: () => 0 } }) });
    await expect(joinGroup('AB12CD34EF56', user)).rejects.toThrow('inválido ou expirado');
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('cria somente membro de consulta, inclusive para conta de telefone', async () => {
    await expect(joinGroup('ab12cd34ef56', user)).resolves.toBe('fut');
    expect(mocks.set).toHaveBeenCalledWith('organizations/fut/members/player', expect.objectContaining({ role: 'member', userId: 'player', orgId: 'fut', joinCode: 'AB12CD34EF56' }));
  });
  it('preserva papel de quem já participa', async () => {
    mocks.get.mockResolvedValue({ exists: () => true });
    await joinGroup('AB12CD34EF56', user);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.setCurrentOrg).toHaveBeenCalledWith('fut');
  });
});
