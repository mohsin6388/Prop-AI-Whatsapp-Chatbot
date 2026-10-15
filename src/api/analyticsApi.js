import api from './axios.js';

export const analyticsApi = {
  dashboard: (params) => api.get('/analytics/dashboard', { params }).then((r) => r.data),
  timeseries: (params) => api.get('/analytics/timeseries', { params }).then((r) => r.data),
  funnel: (params) => api.get('/analytics/funnel', { params }).then((r) => r.data),
  leadSources: (params) => api.get('/analytics/lead-sources', { params }).then((r) => r.data),
  propertyPerformance: (params) => api.get('/analytics/property-performance', { params }).then((r) => r.data),
};