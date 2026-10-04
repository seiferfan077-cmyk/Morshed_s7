import { AIMessage } from '../ai/aiService';
import { MemoryItem } from '../../types/memory';
import { retrieveRelevantMemories } from './memoryRetrieval';

export interface ContextPackage {
  currentMessage: string;
  conversation: AIMessage[];
  relevantMemories: MemoryItem[];
  activeGoals: string[];
  activeTasks: string[];
}

export function assembleContext(currentMessage: string, conversation: AIMessage[], memories: MemoryItem[], activeGoals: string[] = [], activeTasks: string[] = []): ContextPackage {
  return { currentMessage, conversation: conversation.slice(-12), relevantMemories: retrieveRelevantMemories(currentMessage, memories, 5), activeGoals: activeGoals.slice(0, 5), activeTasks: activeTasks.slice(0, 5) };
}
