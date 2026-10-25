import type { PomodoroTimer } from '../pomodoro/pomodoroPolicy';

export const CHAT_SESSIONS_KEY = '@murshid/ai-chat-sessions:v1';
export const LEGACY_CHAT_HISTORY_KEY = '@murshid/ai-chat-history';
export const MAX_CHAT_SESSIONS = 20;
export const MAX_MESSAGES_PER_SESSION = 60;

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  kind?: 'pomodoro';
  timer?: PomodoroTimer;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessageRecord[];
  anchorMessageId?: string;
}

export function createChatSession(now = Date.now()): ChatSessionRecord {
  return { id: `chat-${now}-${Math.random().toString(36).slice(2, 7)}`, title: 'محادثة جديدة', updatedAt: now, messages: [] };
}

function normalizeMessage(value: unknown): ChatMessageRecord | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if ((item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') return null;
  const timer = item.timer && typeof item.timer === 'object' ? item.timer as PomodoroTimer : undefined;
  const hasTimer = item.kind === 'pomodoro' && timer
    && Number.isFinite(timer.durationMs) && Number.isFinite(timer.remainingMs)
    && (timer.endsAt === null || Number.isFinite(timer.endsAt))
    && ['running', 'paused', 'completed', 'cancelled'].includes(timer.status);
  return {
    id: typeof item.id === 'string' ? item.id : `message-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: item.role,
    content: item.content,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    ...(hasTimer ? { kind: 'pomodoro' as const, timer } : {}),
  };
}

function normalizeSession(value: unknown): ChatSessionRecord | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!Array.isArray(item.messages)) return null;
  const messages = item.messages.map(normalizeMessage).filter((message): message is ChatMessageRecord => message !== null).slice(-MAX_MESSAGES_PER_SESSION);
  const firstUserMessage = messages.find((message) => message.role === 'user');
  return {
    id: typeof item.id === 'string' ? item.id : createChatSession().id,
    title: typeof item.title === 'string' && item.title.trim() ? item.title : firstUserMessage?.content.slice(0, 48) || 'محادثة جديدة',
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    messages,
    ...(typeof item.anchorMessageId === 'string' ? { anchorMessageId: item.anchorMessageId } : {}),
  };
}

/** Loads versioned sessions, migrating the old single-history array when needed. */
export function parseChatSessions(rawSessions: string | null, legacyHistory: string | null, now = Date.now()): ChatSessionRecord[] {
  if (rawSessions) {
    try {
      const parsed: unknown = JSON.parse(rawSessions);
      if (Array.isArray(parsed)) {
        const sessions = parsed.map(normalizeSession).filter((session): session is ChatSessionRecord => session !== null)
          .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHAT_SESSIONS);
        if (sessions.length) return sessions;
      }
    } catch { /* Recover from the legacy history or start fresh. */ }
  }

  if (legacyHistory) {
    try {
      const parsed: unknown = JSON.parse(legacyHistory);
      if (Array.isArray(parsed)) {
        const messages = parsed.map(normalizeMessage).filter((message): message is ChatMessageRecord => message !== null).slice(-MAX_MESSAGES_PER_SESSION);
        if (messages.length) {
          const firstUserMessage = messages.find((message) => message.role === 'user');
          return [{
            id: `chat-migrated-${now}`,
            title: firstUserMessage?.content.slice(0, 48) || 'محادثة سابقة',
            updatedAt: messages[messages.length - 1].createdAt,
            messages,
          }];
        }
      }
    } catch { /* Ignore malformed legacy data. */ }
  }
  return [createChatSession(now)];
}

export function trimChatSessions(sessions: ChatSessionRecord[]) {
  return [...sessions]
    .map((session) => ({ ...session, messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION) }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHAT_SESSIONS);
}
