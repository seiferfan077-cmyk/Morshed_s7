import { MemoryItem } from '../../types/memory';

const stopWords = new Set(['أنا', 'انت', 'أنت', 'في', 'من', 'على', 'إلى', 'عن', 'مع', 'ده', 'دي', 'هو', 'هي', 'the', 'and']);

function tokens(value: string) {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 1 && !stopWords.has(token));
}

function recencyScore(item: MemoryItem, now: number) {
  const ageDays = Math.max(0, (now - new Date(item.updatedAt).getTime()) / 86_400_000);
  return Math.max(0, 1 - ageDays / 90);
}

export function retrieveRelevantMemories(query: string, memories: MemoryItem[], limit = 5, now = Date.now()) {
  const queryTokens = new Set(tokens(query));
  if (!queryTokens.size) return [];
  return memories
    .map((item) => {
      const itemTokens = new Set(tokens(`${item.content} ${item.tags.join(' ')} ${item.type}`));
      const overlap = [...queryTokens].filter((token) => itemTokens.has(token)).length;
      const relevance = overlap / queryTokens.size;
      const importance = item.importance === 'high' ? 0.2 : item.importance === 'medium' ? 0.1 : 0;
      const confidence = Math.max(0, Math.min(1, item.confidence)) * 0.15;
      return { item, score: relevance * 0.65 + (relevance > 0 ? recencyScore(item, now) * 0.2 + importance + confidence : 0) };
    })
    .filter(({ score }) => score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
