import api from './api';

export const chatService = {
  async sendMessage(message, conversationId, action = null) {
    const response = await api.post('/chat', {
      message,
      conversation_id: conversationId,
      action,
    }, {
      timeout: 300000 // 300 seconds (5 minutes) for CPU inference headroom
    });
    return response.data;
  },
};
