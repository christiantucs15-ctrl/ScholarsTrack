import { createContext, useState, useEffect } from 'react'
import api from '../api/axios'
import useAuth from '../hooks/useAuth'

// =============================================================================
// NotificationsContext.jsx
// Connects the Topbar bell icon and the Notifications page to the C# API
// (GET /api/notifications, PUT /api/notifications/{id}/read) in PostgreSQL.
// =============================================================================
export const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])

  // Fetch live notifications from PostgreSQL whenever the logged-in user changes
  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }

    const role = user.role || 'student'
    const scholarId = user.scholarId ?? user.scholar_id ?? ''

    api
      .get('/notifications', { params: { role, scholarId } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setNotifications(res.data)
        }
      })
      .catch((err) => console.error('Failed to load notifications:', err))
  }, [user])

  // Count how many notifications are still unread
  const unreadCount = notifications.filter((n) => !n.read).length

  // Mark a single notification as read in PostgreSQL and update UI state
  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    try {
      await api.put(`/notifications/${id}/read`)
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  // Mark all notifications as read for the current user role in PostgreSQL
  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      const role = user?.role || 'student'
      await api.put('/notifications/read-all', null, { params: { role } })
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  // Create and broadcast a new notification / announcement
  const createNotification = async (payload) => {
    const res = await api.post('/notifications', payload)
    if (res.data) {
      setNotifications((prev) => [res.data, ...prev])
    }
    return res.data
  }

  // Delete a notification
  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await api.delete(`/notifications/${id}`)
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        createNotification,
        deleteNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}
