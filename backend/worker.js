import { handleChatRequest, handleHealthRequest } from './lib/chat-handler.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/health') {
      return handleHealthRequest(request, { env });
    }

    if (pathname === '/api/ai/chat') {
      return handleChatRequest(request, { env });
    }

    return Response.json(
      { error: { code: 'not_found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  },
};
