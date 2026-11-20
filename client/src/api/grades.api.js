import api from './axios'

export const getGrades = (params) => api.get('/grades', { params })
export const addGrade = (data) => api.post('/grades', data)