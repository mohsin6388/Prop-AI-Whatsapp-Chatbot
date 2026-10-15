import api from './axios.js';

export const emailApi = {
  status: () => api.get('/email/status').then((r) => r.data),
  templates: () => api.get('/email/templates').then((r) => r.data),
  createTemplate: (payload) => api.post('/email/templates', payload).then((r) => r.data),
  updateTemplate: (id, payload) => api.put(`/email/templates/${id}`, payload).then((r) => r.data),
  deleteTemplate: (id) => api.delete(`/email/templates/${id}`).then((r) => r.data),
  replies: (params) => api.get('/email/replies', { params }).then((r) => r.data),
  thread: (id) => api.get(`/email/replies/${id}`).then((r) => r.data),
  reply: (id, text) => api.post(`/email/replies/${id}/reply`, { text }).then((r) => r.data),
};
