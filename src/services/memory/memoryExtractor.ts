import { MemoryCandidate, MemoryType } from '../../types/memory';

const patterns: { type: MemoryType; regex: RegExp; confidence: number; importance: 'low' | 'medium' | 'high'; tag: string }[] = [
  { type: 'preference', regex: /(?:بحب|أفضل|افضل|بفضل|مش بحب|لا أحب|أحب)\s+(.{2,80})/i, confidence: 0.86, importance: 'medium', tag: 'preference' },
  { type: 'habit', regex: /(?:كل يوم|عادة|متعود|بحاول ألتزم|بحاول التزم|روتيني)\s+(.{2,100})/i, confidence: 0.78, importance: 'medium', tag: 'habit' },
  { type: 'goal', regex: /(?:عايز|أريد|نفسي|هدفي|هدفي هو|محتاج)\s+(.{2,100})/i, confidence: 0.72, importance: 'medium', tag: 'goal' },
  { type: 'context', regex: /(?:حاليًا|دلوقتي|الآن|عندي|مؤقتًا|لفترة قصيرة)\s+(.{2,100})/i, confidence: 0.68, importance: 'low', tag: 'temporary-context' },
];

function clean(value: string) {
  return value.replace(/[.!؟،,]+$/, '').replace(/\s+/g, ' ').trim();
}

export function extractMemoryCandidates(message: string, now = new Date()): MemoryCandidate[] {
  const text = message.trim();
  if (text.length < 8 || text.includes('?') || text.includes('؟')) return [];
  const candidates: MemoryCandidate[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match?.[1]) continue;
    const content = clean(match[1]);
    if (content.length < 3) continue;
    const temporary = pattern.type === 'context' || /(?:مؤقتًا|مؤقت|حاليًا|دلوقتي|لفترة قصيرة)/i.test(text);
    candidates.push({ id: `candidate-${now.getTime()}-${candidates.length}`, type: pattern.type, content, sourceMessage: text, confidence: pattern.confidence, importance: pattern.importance, sensitivity: 'normal', suggestedExpiration: temporary ? new Date(now.getTime() + 7 * 86_400_000).toISOString() : undefined, tags: [pattern.tag], status: 'pending', createdAt: now.toISOString(), suggestedAction: 'save' });
  }
  return candidates.filter((candidate, index, all) => all.findIndex((entry) => entry.type === candidate.type && entry.content === candidate.content) === index);
}
