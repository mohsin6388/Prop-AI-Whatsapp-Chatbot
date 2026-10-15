import api from './axios.js';

export const meetingApi = {
  list: (params) => api.get('/meetings', { params }).then((r) => r.data),
  create: (payload) => api.post('/meetings', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/meetings/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/meetings/${id}`).then((r) => r.data),
};