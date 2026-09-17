import { doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { setCurrentOrg } from './organizations';

export function normalizeGroupCode(value: string): string {
  return value.trim().replace(/[\s-]/g, '').toUpperCase();
}

export async function generateGroupCode(orgId: string): Promise<string> {
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  await runTransaction(db, async (tx) => {
    const orgRef = doc(db, 'organizations', orgId, 'settings', 'access');
    const org = await tx.get(orgRef);
    const codeRef = doc(db, 'groupCodes', code);
    const existing = await tx.get(codeRef);
    if (existing.exists()) throw new Error('Tente gerar o código novamente.');
    const previous = org.data()?.joinCode;
    if (previous) tx.delete(doc(db, 'groupCodes', previous));
    tx.set(codeRef, { orgId, expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000) });
    tx.set(orgRef, { joinCode: code });
  });
  return code;
}

export async function joinGroup(rawCode: string, user: User): Promise<string> {
  const code = normalizeGroupCode(rawCode);
  if (!/^[A-F0-9]{12}$/.test(code)) throw new Error('Informe o código de 12 caracteres enviado pelo administrador.');
  const invite = await getDoc(doc(db, 'groupCodes', code));
  if (!invite.exists() || invite.data().expiresAt.toMillis() <= Date.now()) {
    throw new Error('Código inválido ou expirado. Peça um novo ao administrador.');
  }
  const orgId = invite.data().orgId as string;
  await runTransaction(db, async (tx) => {
    const memberRef = doc(db, 'organizations', orgId, 'members', user.uid);
    const existing = await tx.get(memberRef);
    if (existing.exists()) return; // Never downgrade an existing administrator.
    tx.set(memberRef, {
      userId: user.uid, orgId, role: 'member', joinCode: code,
      joinedAt: new Date().toISOString(),
      displayName: user.displayName ?? '', email: user.email ?? '', phone: user.phoneNumber ?? '',
    });
  });
  setCurrentOrg(orgId);
  return orgId;
}
