import { handleChatRequest, handleHealthRequest } from './lib/chat-handler.js';
import { handleChannelRequest, handleChannelAdminRequest } from './lib/channel-handler.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/health') {
      return handleHealthRequest(request, { env });
    }

    if (pathname === '/api/ai/chat') {
      return handleChatRequest(request, { env });
    }

    if (pathname.startsWith('/api/channel/admin/')) {
      return handleChannelAdminRequest(request, env);
    }

    if (pathname.startsWith('/api/channel/')) {
      return handleChannelRequest(request, env);
    }

    return Response.json(
      { error: { code: 'not_found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  },
};
