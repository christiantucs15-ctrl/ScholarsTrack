import useNotifications from '../../hooks/useNotifications'
import { formatDate } from '../../utils/formatDate'

export default function NotificationList() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  return (
    <div className="card">
      <div className="dash-section-head">
        <h3>{unreadCount} unread</h3>
        <button
          className="ui-btn ui-btn-outline small-btn"
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </button>
      </div>

      {notifications.length === 0 && <p className="muted">No notifications.</p>}

      <ul className="notif-list">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`notif-item ${n.read ? '' : 'unread'}`}
            onClick={() => markAsRead(n.id)}
          >
            <span className={`dot dot-${n.type}`} />
            <div className="notif-body">
              <strong>{n.title}</strong>
              <span className="muted">{n.message}</span>
            </div>
            <span className="muted small">{formatDate(n.date)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}