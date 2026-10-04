export type MemoryType = 'fact' | 'context' | 'situation' | 'habit' | 'goal' | 'preference';
export type MemorySensitivity = 'normal' | 'sensitive';
export type MemoryConsent = 'pending' | 'accepted' | 'rejected';
export type MemorySource = 'user' | 'assistant' | 'imported';
export type MemoryImportance = 'low' | 'medium' | 'high';

export interface MemoryItem {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  confidence: number;
  importance: MemoryImportance;
  sensitivity: MemorySensitivity;
  expiration?: string;
  consent: 'accepted';
  lastUsed?: string;
  relatedGoals?: string[];
  tags: string[];
}

export interface MemoryCandidate {
  id: string;
  type: MemoryType;
  content: string;
  sourceMessage: string;
  confidence: number;
  importance: MemoryImportance;
  sensitivity: MemorySensitivity;
  suggestedExpiration?: string;
  tags: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface MemorySettings {
  enabled: boolean;
  retrievalEnabled: boolean;
  retentionDays: number | null;
  disabledTypes: MemoryType[];
}

export const defaultMemorySettings: MemorySettings = {
  enabled: true,
  retrievalEnabled: true,
  retentionDays: null,
  disabledTypes: [],
};
