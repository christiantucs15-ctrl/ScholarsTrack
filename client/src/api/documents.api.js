import api from './axios'

export const getDocuments = (params) => api.get('/documents', { params })

export const uploadDocument = (file, documentTypeId) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('documentTypeId', documentTypeId)
  return api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const verifyDocument = (id, status, remarks) =>
  api.patch(`/documents/${id}/verify`, { status, remarks })