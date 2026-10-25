const assert = require('node:assert/strict');
const test = require('node:test');
const { parseChatSessions, trimChatSessions } = require('../.tmp-pomodoro-test/ai/chatHistoryStorage.js');

const oldHistory = [
  { id: 'old-u', role: 'user', content: 'عايز أنظم يومي', createdAt: 100 },
  { id: 'old-a', role: 'assistant', content: 'نبدأ بخطة بسيطة', createdAt: 110 },
];

test('migrates the previous single chat array into one titled session', () => {
  const sessions = parseChatSessions(null, JSON.stringify(oldHistory), 200);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, 'عايز أنظم يومي');
  assert.deepEqual(sessions[0].messages.map(({ id }) => id), ['old-u', 'old-a']);
});

test('loads valid versioned sessions and ignores malformed messages', () => {
  const raw = JSON.stringify([
    { id: 'chat-b', title: 'الثانية', updatedAt: 200, messages: [{ id: 'x', role: 'system', content: 'invalid' }, { id: 'u', role: 'user', content: 'اختبار', createdAt: 190 }] },
    { id: 'chat-a', title: 'الأولى', updatedAt: 100, messages: [] },
  ]);
  const sessions = parseChatSessions(raw, null, 300);
  assert.deepEqual(sessions.map(({ id }) => id), ['chat-b', 'chat-a']);
  assert.equal(sessions[0].messages.length, 1);
});

test('falls back to a clean new session when both storage values are invalid', () => {
  const sessions = parseChatSessions('{broken', '{broken', 123);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, 'محادثة جديدة');
  assert.equal(sessions[0].messages.length, 0);
});

test('keeps the newest sessions and message limits', () => {
  const sessions = Array.from({ length: 25 }, (_, index) => ({ id: `s${index}`, title: `s${index}`, updatedAt: index, messages: Array.from({ length: 70 }, (_, message) => ({ id: `${index}-${message}`, role: 'user', content: 'x', createdAt: message })) }));
  const trimmed = trimChatSessions(sessions);
  assert.equal(trimmed.length, 20);
  assert.equal(trimmed[0].id, 's24');
  assert.equal(trimmed[0].messages.length, 60);
});
