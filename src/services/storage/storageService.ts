import { MediaMetadata } from '../../types/domain';

export interface StorageProvider { saveFile(sourceUri: string, filename: string): Promise<string>; deleteFile(uri: string): Promise<void>; getFile(uri: string): Promise<string | null>; listFiles(): Promise<string[]>; getMedia(): Promise<MediaMetadata[]>; saveMediaMetadata(item: MediaMetadata): Promise<void>; }

/** Local provider placeholder: the contract is real; native FileSystem wiring is intentionally isolated for the next phase. */
export class LocalStorageProvider implements StorageProvider {
  private media: MediaMetadata[] = [];
  async saveFile(sourceUri: string) { return sourceUri; }
  async deleteFile(_uri: string) { return undefined; }
  async getFile(uri: string) { return uri; }
  async listFiles() { return []; }
  async getMedia() { return this.media; }
  async saveMediaMetadata(item: MediaMetadata) { this.media = [item, ...this.media.filter((entry) => entry.id !== item.id)]; }
}
