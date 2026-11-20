
import api from './axios'

// Get all notifications
export const getNotifications = (params) =>
  api.get('/notifications', { params })

// Get a specific notification
export const getNotificationById = (id) =>
  api.get(`/notifications/${id}`)

// Mark a notification as read
export const markAsRead = (id) =>
  api.patch(`/notifications/${id}/read`)

// Mark all notifications as read
export const markAllAsRead = () =>
  api.patch('/notifications/read-all')
