import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp, getDoc } from 'firebase/firestore';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('permissões no Firestore', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-na-trave-access', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organizations/fut'), { name: 'Fut', slug: 'fut', createdBy: 'owner' });
      await setDoc(doc(db, 'organizations/fut/members/owner'), { userId: 'owner', orgId: 'fut', role: 'admin' });
      await setDoc(doc(db, 'organizations/fut/members/player'), { userId: 'player', orgId: 'fut', role: 'member' });
      await setDoc(doc(db, 'groupCodes/AB12CD34EF56'), { orgId: 'fut', expiresAt: Timestamp.fromMillis(Date.now() + 60000) });
      await setDoc(doc(db, 'players/p'), { orgId: 'fut', name: 'Jogador' });
    });
  });
  it('criação atômica do futebol e responsável', async () => {
    const db = env.authenticatedContext('new').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'organizations/new'), { name: 'Novo', slug: 'new', createdBy: 'new' });
    batch.set(doc(db, 'organizations/new/members/new'), { userId: 'new', orgId: 'new', role: 'admin' });
    await assertSucceeds(batch.commit());
  });
  it('não permite criar admin em futebol inexistente', async () => {
    const db = env.authenticatedContext('intruder').firestore();
    await assertFails(setDoc(doc(db, 'organizations/missing/members/intruder'), { userId: 'intruder', orgId: 'missing', role: 'admin' }));
  });
  it('código válido só concede consulta ao próprio usuário', async () => {
    const db = env.authenticatedContext('new').firestore();
    const member = { userId: 'new', orgId: 'fut', role: 'member', joinCode: 'AB12CD34EF56' };
    await assertFails(setDoc(doc(db, 'organizations/fut/members/new'), { ...member, role: 'admin' }));
    await assertFails(setDoc(doc(db, 'organizations/fut/members/other'), { ...member, userId: 'other' }));
    await assertSucceeds(setDoc(doc(db, 'organizations/fut/members/new'), member));
  });
  it('recusa código expirado, revogado ou de outro futebol', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'groupCodes/AB12CD34EF56'), { expiresAt: Timestamp.fromMillis(0) });
    });
    const db = env.authenticatedContext('new').firestore();
    await assertFails(setDoc(doc(db, 'organizations/fut/members/new'), { userId: 'new', orgId: 'fut', role: 'member', joinCode: 'AB12CD34EF56' }));
    await assertFails(setDoc(doc(db, 'organizations/fut/members/new'), { userId: 'new', orgId: 'fut', role: 'member', joinCode: '000000000000' }));
    await assertFails(setDoc(doc(db, 'organizations/other/members/new'), { userId: 'new', orgId: 'other', role: 'member', joinCode: 'AB12CD34EF56' }));
  });
  it('jogador lê estatísticas mas não altera dados ou papel', async () => {
    const db = env.authenticatedContext('player').firestore();
    await assertSucceeds(getDoc(doc(db, 'players/p')));
    await assertFails(updateDoc(doc(db, 'players/p'), { name: 'Alterado' }));
    await assertFails(updateDoc(doc(db, 'organizations/fut/members/player'), { role: 'admin' }));
  });
  it('admin promove membro, mas não remove ou rebaixa o responsável', async () => {
    const db = env.authenticatedContext('owner').firestore();
    await assertSucceeds(updateDoc(doc(db, 'organizations/fut/members/player'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'organizations/fut/members/owner')));
    await assertFails(updateDoc(doc(db, 'organizations/fut/members/owner'), { role: 'member' }));
    await assertFails(updateDoc(doc(db, 'organizations/fut'), { createdBy: 'player' }));
  });
  it('claims de outro grupo não concedem acesso', async () => {
    const db = env.authenticatedContext('other', { admin: true, organizations: { elsewhere: 'admin' } }).firestore();
    await assertFails(getDoc(doc(db, 'players/p')));
    await assertFails(updateDoc(doc(db, 'players/p'), { name: 'Alterado' }));
  });
  it('somente administrador gera código e lê configurações privadas', async () => {
    const admin = env.authenticatedContext('owner').firestore();
    const player = env.authenticatedContext('player').firestore();
    const data = { orgId: 'fut', expiresAt: Timestamp.fromMillis(Date.now() + 60000) };
    await assertSucceeds(setDoc(doc(admin, 'groupCodes/111111111111'), data));
    await assertFails(setDoc(doc(player, 'groupCodes/222222222222'), data));
    await assertSucceeds(setDoc(doc(admin, 'organizations/fut/settings/access'), { joinCode: '111111111111' }));
    await assertFails(getDoc(doc(player, 'organizations/fut/settings/access')));
  });
});
