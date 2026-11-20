import { useContext } from 'react'
import { NotificationsContext } from '../context/NotificationsContext'

const DEFAULT_STATE = {
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  createNotification: async () => {},
  deleteNotification: async () => {},
}

export default function useNotifications() {
  const context = useContext(NotificationsContext)
  return context || DEFAULT_STATE
}
