import api from './axios.js';

export const settingsApi = {
  get: () => api.get('/settings').then((r) => r.data),
  update: (payload) => api.patch('/settings', payload).then((r) => r.data),
  pauseAI: () => api.post('/settings/ai/pause').then((r) => r.data),
  resumeAI: () => api.post('/settings/ai/resume').then((r) => r.data),
};
