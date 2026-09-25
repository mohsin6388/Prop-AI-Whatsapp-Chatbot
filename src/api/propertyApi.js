import api from './axios.js';

export const propertyApi = {
  list: (params) => api.get('/properties', { params }).then((r) => r.data),
  get: (id) => api.get(`/properties/${id}`).then((r) => r.data),
  create: (payload) => api.post('/properties', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/properties/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/properties/${id}`).then((r) => r.data),
  bulkDelete: (ids) => api.post('/properties/bulk-delete', { ids }).then((r) => r.data),
  importPreview: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/properties/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  importConfirm: (rows) => api.post('/properties/import/confirm', { rows }).then((r) => r.data),
  exportUrl: () => `${api.defaults.baseURL}/properties/export`,
};