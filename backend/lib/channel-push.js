const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_TOKENS_PER_REQUEST = 100;

export async function sendChannelPostNotifications(env, post, fetchImpl = fetch) {
  const database = env.CHANNEL_DB;
  if (!database) return { sent: 0 };
  const result = await database.prepare('SELECT token FROM channel_devices').all();
  const tokens = [...new Set((result.results ?? []).map((row) => row.token).filter((token) => typeof token === 'string'))];
  if (!tokens.length) return { sent: 0 };

  let sent = 0;
  for (let offset = 0; offset < tokens.length; offset += MAX_TOKENS_PER_REQUEST) {
    const batch = tokens.slice(offset, offset + MAX_TOKENS_PER_REQUEST);
    const messages = batch.map((to) => ({
      to,
      sound: 'default',
      title: 'القناة الرسمية لمُرشد',
      body: post.body.length > 160 ? `${post.body.slice(0, 157)}…` : post.body,
      priority: 'high',
      channelId: 'murshid-channel-updates',
      data: { route: 'channel', postId: post.id },
    }));
    const headers = { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' };
    if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
    const response = await fetchImpl(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
    if (!response.ok) throw new Error(`expo_push_http_${response.status}`);
    const payload = await response.json().catch(() => ({}));
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    const invalid = [];
    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      if (ticket?.status === 'ok') sent += 1;
      if (ticket?.details?.error === 'DeviceNotRegistered') invalid.push(batch[index]);
    }
    if (invalid.length) {
      const statements = invalid.map((token) => database.prepare('DELETE FROM channel_devices WHERE token = ?').bind(token));
      await database.batch(statements);
    }
  }
  return { sent };
}
