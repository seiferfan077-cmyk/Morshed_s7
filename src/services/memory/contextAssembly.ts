import { AIMessage } from '../ai/aiService';
import { MemoryContextItem, MemoryItem } from '../../types/memory';
import { retrieveRelevantMemories } from './memoryRetrieval';

export interface ContextPackage {
  currentMessage: string;
  conversation: AIMessage[];
  relevantMemories: MemoryContextItem[];
  activeGoals: string[];
  activeTasks: string[];
}

export function assembleContext(currentMessage: string, conversation: AIMessage[], memories: MemoryItem[], activeGoals: string[] = [], activeTasks: string[] = []): ContextPackage {
  const relevantMemories = retrieveRelevantMemories(currentMessage, memories, 5).map(({ id, type, content, importance, tags }) => ({ id, type, content, importance, tags }));
  return { currentMessage, conversation: conversation.slice(-12), relevantMemories, activeGoals: activeGoals.slice(0, 5), activeTasks: activeTasks.slice(0, 5) };
}
