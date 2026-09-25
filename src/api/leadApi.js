import api from './axios.js';

export const leadApi = {
  list: (params) => api.get('/leads', { params }).then((r) => r.data),
  get: (id) => api.get(`/leads/${id}`).then((r) => r.data),
  create: (payload) => api.post('/leads', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/leads/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/leads/${id}`).then((r) => r.data),
  bulkDelete: (ids) => api.post('/leads/bulk-delete', { ids }).then((r) => r.data),
  updateTags: (id, payload) => api.post(`/leads/${id}/tags`, payload).then((r) => r.data),
  importPreview: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/leads/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  importConfirm: (rows) => api.post('/leads/import/confirm', { rows }).then((r) => r.data),
  startConversations: (leadIds) => api.post('/leads/start-conversations', { leadIds }).then((r) => r.data),
  exportUrl: () => `${api.defaults.baseURL}/leads/export`,
};