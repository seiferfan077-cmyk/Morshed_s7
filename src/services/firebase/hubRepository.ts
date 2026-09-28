import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebaseClient';

export type ProposalStatus = 'draft' | 'review' | 'approved' | 'published' | 'rolled_back';
export type UpdateClass = 'dynamic' | 'ota' | 'native';

export interface HubProposal {
  id: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  updateClass: UpdateClass;
  updatedAt: string;
  authorId?: string;
}

export interface HubRepository {
  listRecentProposals(): Promise<HubProposal[]>;
}

export class UnconfiguredHubRepository implements HubRepository {
  async listRecentProposals(): Promise<HubProposal[]> { return []; }
}

export class FirestoreHubRepository implements HubRepository {
  async listRecentProposals(): Promise<HubProposal[]> {
    const db = getFirebaseFirestore();
    if (!db) return [];
    const proposals = query(collection(db, 'hubProposals'), orderBy('updatedAt', 'desc'), limit(20));
    const snapshot = await getDocs(proposals);
    return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as Omit<HubProposal, 'id'>) }));
  }
}

export function createHubRepository(): HubRepository {
  return getFirebaseFirestore() ? new FirestoreHubRepository() : new UnconfiguredHubRepository();
}
