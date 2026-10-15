import api from './axios.js';

export const outreachApi = {
  summary: () => api.get('/outreach/summary').then((r) => r.data),
  jobs: (params) => api.get('/outreach/jobs', { params }).then((r) => r.data),
};

export const campaignApi = {
  launch: (payload) => api.post('/campaigns/launch', payload).then((r) => r.data),
  list: () => api.get('/campaigns').then((r) => r.data),
  pause: (id) => api.post(`/campaigns/${id}/pause`).then((r) => r.data),
  resume: (id) => api.post(`/campaigns/${id}/resume`).then((r) => r.data),
  cancel: (id) => api.post(`/campaigns/${id}/cancel`).then((r) => r.data),
  retryFailed: (id, channel) =>
    api.post(`/campaigns/${id}/retry-failed`, channel ? { channel } : {}).then((r) => r.data),
};
