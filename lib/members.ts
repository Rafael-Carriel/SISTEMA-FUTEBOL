'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invite, Member, Role } from '@/lib/fut-types';

function memberRef(orgId: string, userId: string) {
  return doc(db, 'organizations', orgId, 'members', userId);
}

export async function listMembers(orgId: string): Promise<Member[]> {
  const snap = await getDocs(collection(db, 'organizations', orgId, 'members'));
  return snap.docs.map((d) => d.data() as Member);
}

export async function getMember(orgId: string, userId: string): Promise<Member | null> {
  const snap = await getDoc(memberRef(orgId, userId));
  return snap.exists() ? (snap.data() as Member) : null;
}

/** Admin convida por e-mail com papel admin|member. Retorna o convite criado. */
export async function inviteMember(
  orgId: string,
  orgName: string,
  email: string,
  role: Role,
): Promise<Invite> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    throw new Error('Informe um e-mail válido.');
  }
  const now = new Date().toISOString();
  const code =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const invite: Invite = {
    id: code,
    email: cleanEmail,
    role,
    code,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    orgId,
    orgName,
    createdAt: now,
    status: 'pending',
  };
  await setDoc(doc(db, 'organizations', orgId, 'invites', code), invite);
  return invite;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: Role,
): Promise<void> {
  const members = await listMembers(orgId);
  const admins = members.filter((m) => m.role === 'admin');
  const target = members.find((m) => m.userId === userId);
  if (target?.role === 'admin' && role !== 'admin' && admins.length <= 1) {
    throw new Error('O futebol precisa de ao menos um administrador.');
  }
  await updateDoc(memberRef(orgId, userId), { role });
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const members = await listMembers(orgId);
  const target = members.find((m) => m.userId === userId);
  if (target?.role === 'admin' && members.filter((m) => m.role === 'admin').length <= 1) {
    throw new Error('Não é possível remover o último administrador.');
  }
  await deleteDoc(memberRef(orgId, userId));
}

/** Usuário logado aceita convite pelo código (vincula pelo e-mail do convite). */
export async function acceptInvite(
  orgId: string,
  code: string,
  user: { uid: string; email?: string | null; displayName?: string | null; phoneNumber?: string | null },
): Promise<Member> {
  const snap = await getDoc(doc(db, 'organizations', orgId, 'invites', code));
  if (!snap.exists()) throw new Error('Convite não encontrado.');
  const invite = snap.data() as Invite;
  if (invite.status !== 'pending') throw new Error('Convite já utilizado.');
  if (new Date(invite.expiresAt).getTime() < Date.now()) throw new Error('Convite expirado.');
  if (invite.email && user.email && invite.email !== user.email.toLowerCase()) {
    throw new Error('Este convite é para outro e-mail.');
  }
  const member: Member = {
    userId: user.uid,
    orgId,
    role: invite.role,
    joinedAt: new Date().toISOString(),
    displayName: user.displayName ?? undefined,
    email: user.email ?? undefined,
    phone: user.phoneNumber ?? undefined,
  };
  await setDoc(memberRef(orgId, user.uid), member);
  await updateDoc(doc(db, 'organizations', orgId, 'invites', code), { status: 'accepted' });
  return member;
}

export async function findInviteByEmail(orgId: string, email: string): Promise<Invite[]> {
  const snap = await getDocs(
    query(
      collection(db, 'organizations', orgId, 'invites'),
      where('email', '==', email.trim().toLowerCase()),
    ),
  );
  return snap.docs.map((d) => d.data() as Invite);
}
