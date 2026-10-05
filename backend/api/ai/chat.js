import { handleChatRequest } from '../../lib/chat-handler.js';

export default {
  fetch(request) {
    return handleChatRequest(request);
  },
};
