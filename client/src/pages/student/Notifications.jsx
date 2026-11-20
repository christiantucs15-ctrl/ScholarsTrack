import useNotifications from '../../hooks/useNotifications'
import Button from '../../components/common/Button'

export default function StudentNotifications() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications()

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Notifications</h2>
          <p className="muted small">
            Official announcements, document verification updates, and renewal deadlines.
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <Button variant="outline" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        )}
      </div>

      <div className="card">
        {notifications.length === 0 ? (
          <div className="table-empty">You have no notifications right now.</div>
        ) : (
          <ul className="updates">
            {notifications.map((n) => (
              <li
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '16px 0',
                  opacity: n.read ? 0.75 : 1,
                  background: n.read ? 'transparent' : 'rgba(59, 79, 224, 0.02)',
                }}
              >
                <div
                  className={`dot dot-${n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : 'info'}`}
                  style={{ marginTop: '6px' }}
                />

                <div className="update-text" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '15px' }}>{n.title}</strong>
                    <span className="muted small">{n.date}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#1e2a44' }}>{n.message}</p>
                </div>

                {!n.read && (
                  <button
                    type="button"
                    className="link-small"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => markAsRead(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
