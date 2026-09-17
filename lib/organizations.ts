'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { Member, Organization } from '@/lib/fut-types';

export const CURRENT_ORG_KEY = 'na-trave:org';

/** Nome "Fut das Quintas" -> "fut-das-quintas". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueSuffix(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

/** Cria a org (doc-id = slug) + registra o criador como admin, de forma atômica. */
export async function createOrganization(
  name: string,
  fbUser: FirebaseUser,
): Promise<Organization> {
  const cleanName = name.trim();
  if (cleanName.length < 2) throw new Error('Informe o nome do futebol.');
  const base = slugify(cleanName);
  if (!base) throw new Error('Não foi possível gerar o link do futebol.');

  let slug = base;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    slug = uniqueSuffix(base, attempt);
    const existing = await getDoc(doc(db, 'organizations', slug));
    if (!existing.exists()) break;
    if (attempt === 20) throw new Error('Tente outro nome para o futebol.');
  }

  const now = new Date().toISOString();
  const org: Organization = {
    id: slug,
    name: cleanName,
    slug,
    createdAt: now,
    createdBy: fbUser.uid,
  };
  const member: Member = {
    userId: fbUser.uid,
    orgId: slug,
    role: 'admin',
    joinedAt: now,
    displayName: fbUser.displayName ?? undefined,
    email: fbUser.email ?? undefined,
    phone: fbUser.phoneNumber ?? undefined,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'organizations', slug), org);
  batch.set(doc(db, 'organizations', slug, 'members', fbUser.uid), member);
  await batch.commit();
  setCurrentOrg(slug);
  return org;
}

/** Todos os futebóis onde o usuário é membro (via subcoleção members). */
export async function listMyOrganizations(uid: string): Promise<Organization[]> {
  const groups = await getDocs(
    query(collection(db, 'organizations'), where('createdBy', '==', uid)),
  );
  const owned = groups.docs.map((d) => d.data() as Organization);

  // Membro sem ser dono: varre members via collectionGroup não é permitido aqui
  // sem índice; o app resolve via leitura direta das orgs conhecidas + current.
  // Mantemos owned + current como base; a página /app completa com getDoc.
  const current = getCurrentOrg();
  if (current && !owned.some((o) => o.id === current)) {
    const snap = await getDoc(doc(db, 'organizations', current));
    if (snap.exists()) owned.push(snap.data() as Organization);
  }
  return owned;
}

export async function getOrganization(slug: string): Promise<Organization | null> {
  const snap = await getDoc(doc(db, 'organizations', slug));
  return snap.exists() ? (snap.data() as Organization) : null;
}

export function getCurrentOrg(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CURRENT_ORG_KEY);
}

export function setCurrentOrg(slug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CURRENT_ORG_KEY, slug);
}
