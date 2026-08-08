import api from './api';

export const customerService = {
  // GET /customers
  async getCustomers(skip = 0, limit = 100) {
    const response = await api.get('/customers', {
      params: { skip, limit },
    });
    return response.data;
  },

  // GET /customers/{id}
  async getCustomerById(id) {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  // POST /customers
  async createCustomer(customerData) {
    const response = await api.post('/customers', customerData);
    return response.data;
  },

  // PUT /customers/{id}
  async updateCustomer(id, customerData) {
    const response = await api.put(`/customers/${id}`, customerData);
    return response.data;
  },

  // DELETE /customers/{id}
  async deleteCustomer(id) {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
};
