import { useState } from 'react'
import useNotifications from '../../hooks/useNotifications'
import Button from '../../components/common/Button'

export default function StudentNotifications() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications()
  const [selectedNotification, setSelectedNotification] = useState(null)

  const handleOpenNotification = async (notification) => {
    setSelectedNotification(notification)

    if (!notification.read) {
      await markAsRead(notification.id)
    }
  }

  const handleCloseModal = () => {
    setSelectedNotification(null)
  }

  const getDotClass = (type) => {
    if (type === 'success') return 'dot-success'
    if (type === 'warning') return 'dot-warning'
    return 'dot-info'
  }

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
                role="button"
                tabIndex={0}
                onClick={() => handleOpenNotification(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpenNotification(n)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '16px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  opacity: n.read ? 0.78 : 1,
                  background: n.read ? 'transparent' : 'rgba(59, 79, 224, 0.04)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div
                  className={`dot ${getDotClass(n.type)}`}
                  style={{ marginTop: '6px', flexShrink: 0 }}
                />

                <div className="update-text" style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <strong style={{ fontSize: '15px' }}>{n.title}</strong>
                    <span className="muted small" style={{ flexShrink: 0 }}>
                      {n.date}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '14px',
                      color: '#1e2a44',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {n.message}
                  </p>
                </div>

                {!n.read && (
                  <button
                    type="button"
                    className="link-small"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      markAsRead(n.id)
                    }}
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedNotification && (
        <div
          onClick={handleCloseModal}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 9999,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              boxShadow: '0 20px 45px rgba(15, 23, 42, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '6px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className={`dot ${getDotClass(selectedNotification.type)}`} />
                <h3 style={{ margin: 0, fontSize: '18px' }}>{selectedNotification.title}</h3>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Close notification modal"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '2px 6px',
                }}
              >
                ×
              </button>
            </div>

            <div className="muted small" style={{ marginBottom: '14px', flexShrink: 0 }}>
              {selectedNotification.date}
            </div>

            <div
              style={{
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#1e2a44',
                whiteSpace: 'pre-line',
                overflowY: 'auto',
                paddingRight: '6px',
                marginBottom: '20px',
                flex: 1,
              }}
            >
              {selectedNotification.message}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <Button variant="outline" onClick={handleCloseModal}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}