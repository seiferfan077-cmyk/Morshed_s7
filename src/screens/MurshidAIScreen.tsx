import { useState } from 'react';
import { AIScreen } from './AIScreen';
import { MemoryScreen } from './MemoryScreen';

type Section = 'chat' | 'memory';

/** One entry point for the assistant and its user-controlled memory. */
export function MurshidAIScreen() {
  const [section, setSection] = useState<Section>('chat');

  if (section === 'memory') {
    return <MemoryScreen onBackToAssistant={() => setSection('chat')} />;
  }

  return <AIScreen onOpenMemory={() => setSection('memory')} />;
}
