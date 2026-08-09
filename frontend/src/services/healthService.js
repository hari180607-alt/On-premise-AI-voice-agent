import api from './api';

export const healthService = {
  // Check system health status from /api/v1/health using configured API client
  async getHealthStatus() {
    try {
      const response = await api.get('/health', { suppressToast: true, timeout: 5000 });
      return response.data;
    } catch (error) {
      return {
        status: 'unhealthy',
        backend: { connected: false },
        database: { connected: false, status: 'Disconnected' },
        ollama: { connected: false, status: 'Disconnected', model: 'qwen3:4b', model_available: false },
        voice: { whisper_stt: false, tts: false }
      };
    }
  },
};
