import api from './axios'

export const getSdpProgress = () => api.get('/sdp')
export const updateSdpActivity = (id, data) => api.patch(`/sdp/${id}`, data)