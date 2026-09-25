import api from './axios.js';

export const whatsappApi = {
  status: () => api.get('/whatsapp/status').then((r) => r.data),
  sendTest: (phone, text) => api.post('/whatsapp/send-test', { phone, text }).then((r) => r.data),
  sendTestTemplate: (phone) => api.post('/whatsapp/send-test-template', { phone }).then((r) => r.data),
  disconnect: () => api.post('/whatsapp/disconnect').then((r) => r.data),
  reconnect: () => api.post('/whatsapp/reconnect').then((r) => r.data),
};
