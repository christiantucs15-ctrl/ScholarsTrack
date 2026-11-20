import api from './axios'

export const getReportSummary = () => api.get('/reports/summary')
export const generateReport = (params) => api.get('/reports/generate', { params })
export const downloadReport = (id) =>
  api.get(`/reports/${id}/download`, { responseType: 'blob' })