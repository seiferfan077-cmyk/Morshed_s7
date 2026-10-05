import { handleChatRequest } from '../../lib/chat-handler.js';
import { createVercelHandler } from '../../lib/vercel-adapter.js';

export default createVercelHandler((request) => handleChatRequest(request));
