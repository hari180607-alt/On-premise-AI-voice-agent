import api from './api';
import axios from 'axios';

export const healthService = {
  // Check health status from /api/v1/health
  async getHealthStatus() {
    const response = await api.get('/health', { suppressToast: true });
    return response.data;
  },

  // Check root status from http://127.0.0.1:8000/
  async getRootStatus() {
    const response = await axios.get('http://127.0.0.1:8000/', { timeout: 5000 });
    return response.data;
  },
};
