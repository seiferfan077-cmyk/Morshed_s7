import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebaseClient';

export type ProposalStatus = 'draft' | 'review' | 'approved' | 'published' | 'rolled_back';
export type UpdateClass = 'dynamic' | 'ota' | 'native';
export type ReleaseStatus = 'queued' | 'testing' | 'active' | 'stopped' | 'failed' | 'rolled_back';

export interface HubProposal { id: string; title: string; summary: string; status: ProposalStatus; updateClass: UpdateClass; updatedAt: string; authorId?: string; }
export interface CreateProposalInput { title: string; summary: string; updateClass: UpdateClass; }
export interface HubRelease { id: string; channel: 'development' | 'preview' | 'production'; runtimeVersion: string; commitSha: string; status: ReleaseStatus; rolloutPercent: number; updatedAt: string; }

export interface HubRepository {
  listRecentProposals(): Promise<HubProposal[]>;
  createProposal(input: CreateProposalInput): Promise<string>;
  transitionProposal(id: string, status: ProposalStatus): Promise<void>;
}

export class UnconfiguredHubRepository implements HubRepository {
  async listRecentProposals(): Promise<HubProposal[]> { return []; }
  async createProposal(): Promise<string> { throw new Error('Firebase is not configured'); }
  async transitionProposal(): Promise<void> { throw new Error('Firebase is not configured'); }
}

export class FirestoreHubRepository implements HubRepository {
  private db() { const db = getFirebaseFirestore(); if (!db) throw new Error('Firebase is not configured'); return db; }
  async listRecentProposals(): Promise<HubProposal[]> {
    const snapshot = await getDocs(query(collection(this.db(), 'hubProposals'), orderBy('updatedAt', 'desc'), limit(20)));
    return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as Omit<HubProposal, 'id'>) }));
  }
  async createProposal(input: CreateProposalInput) {
    const created = await addDoc(collection(this.db(), 'hubProposals'), { ...input, status: 'draft', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return created.id;
  }
  async transitionProposal(id: string, status: ProposalStatus) {
    await updateDoc(doc(this.db(), 'hubProposals', id), { status, updatedAt: serverTimestamp() });
    await addDoc(collection(this.db(), 'hubAuditLogs'), { action: 'proposal_status_changed', entityType: 'proposal', entityId: id, status, createdAt: serverTimestamp() });
  }
}

export function createHubRepository(): HubRepository { return getFirebaseFirestore() ? new FirestoreHubRepository() : new UnconfiguredHubRepository(); }
