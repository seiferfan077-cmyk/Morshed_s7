export type MediaType = 'image' | 'video' | 'file';
export type MediaStatus = 'downloading' | 'completed' | 'failed';
export interface MediaMetadata { id: string; uri: string; filename: string; type: MediaType; size?: number; createdAt: string; duration?: number; thumbnail?: string; status: MediaStatus; source?: string; }
export interface AppSettings { homePage: string; searchEngine: 'google' | 'bing' | 'duckduckgo'; kioskEnabled: boolean; zoom: 100 | 125 | 150; saveBehavior: 'app' | 'device' | 'both'; }
