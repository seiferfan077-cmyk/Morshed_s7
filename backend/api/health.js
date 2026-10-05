import { handleHealthRequest } from '../lib/chat-handler.js';

export default {
  fetch(request) {
    return handleHealthRequest(request);
  },
};
