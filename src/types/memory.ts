export type MemoryType = 'fact' | 'context' | 'situation' | 'habit' | 'goal' | 'preference';
export type MemorySensitivity = 'normal' | 'sensitive';
export type MemoryConsent = 'pending' | 'accepted' | 'rejected';

export interface MemoryItem {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  source: 'user' | 'assistant' | 'imported';
  createdAt: string;
  updatedAt: string;
  confidence: number;
  importance: 'low' | 'medium' | 'high';
  sensitivity: MemorySensitivity;
  expiration?: string;
  consent: MemoryConsent;
  lastUsed?: string;
  relatedGoals?: string[];
  tags: string[];
}

export interface MemorySettings {
  enabled: boolean;
  retentionDays: number | null;
  disabledTypes: MemoryType[];
}

export const defaultMemorySettings: MemorySettings = {
  enabled: true,
  retentionDays: null,
  disabledTypes: [],
};
