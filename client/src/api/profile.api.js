import api from './axios'

// Fetch the logged-in scholar's real profile from C# + PostgreSQL
export const getMyProfile = (scholarId, name) =>
  api.get('/students/me', { params: { scholarId, name } })

export const updateMyProfile = (data) => api.put('/students/me', data)
