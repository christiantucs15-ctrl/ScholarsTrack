import api from './axios'

export const getApplications = (params) => api.get('/applications', { params })
export const getApplication = (id) => api.get(`/applications/${id}`)
export const createApplication = (data) => api.post('/applications', data)
export const saveDraft = (data) => api.post('/applications/draft', data)
export const updateApplicationStatus = (id, status, remarks) =>
  api.patch(`/applications/${id}/status`, { status, remarks })
export const getApplicationTimeline = (id) => api.get(`/applications/${id}/timeline`)