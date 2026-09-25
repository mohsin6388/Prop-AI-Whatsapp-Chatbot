import api from './axios.js';

export const conversationApi = {
  list: (params) => api.get('/conversations', { params }).then((r) => r.data),
  get: (id, params) => api.get(`/conversations/${id}`, { params }).then((r) => r.data),
  sendMessage: (id, text) => api.post(`/conversations/${id}/messages`, { text }).then((r) => r.data),
  takeover: (id) => api.post(`/conversations/${id}/takeover`).then((r) => r.data),
  resumeAI: (id) => api.post(`/conversations/${id}/resume-ai`).then((r) => r.data),
  markRead: (id) => api.post(`/conversations/${id}/read`).then((r) => r.data),
  close: (id) => api.post(`/conversations/${id}/close`).then((r) => r.data),
};