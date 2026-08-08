import api from './api';

export const appointmentService = {
  // GET /appointments
  async getAppointments(params = {}) {
    const response = await api.get('/appointments', { params });
    return response.data;
  },

  // GET /appointments/{id}
  async getAppointmentById(id) {
    const response = await api.get(`/appointments/${id}`);
    return response.data;
  },

  // POST /appointments
  async createAppointment(appointmentData) {
    const response = await api.post('/appointments', appointmentData);
    return response.data;
  },

  // PUT /appointments/{id}
  async updateAppointment(id, appointmentData) {
    const response = await api.put(`/appointments/${id}`, appointmentData);
    return response.data;
  },

  // DELETE /appointments/{id}
  async deleteAppointment(id) {
    const response = await api.delete(`/appointments/${id}`);
    return response.data;
  },
};
