import { useState, useEffect } from 'react'
import useNotifications from '../../hooks/useNotifications'
import useAuth from '../../hooks/useAuth'
import api from '../../api/axios'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'

export default function AdminNotifications() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteNotification,
  } = useNotifications()
  const [modalOpen, setModalOpen] = useState(false)
  const [scholars, setScholars] = useState([])
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    audience: 'all_scholars', // 'all_scholars', 'specific_scholar', 'evaluators', 'everyone'
    scholarId: '',
    type: 'info', // 'info', 'warning', 'success'
    title: '',
    message: '',
  })

  useEffect(() => {
    api
      .get('/scholars')
      .then((res) => {
        if (Array.isArray(res.data)) setScholars(res.data)
      })
      .catch(() => {})
  }, [])

  const handleOpenModal = () => {
    setErrorMsg('')
    setForm({
      audience: 'all_scholars',
      scholarId: scholars[0]?.scholarId || '',
      type: 'info',
      title: '',
      message: '',
    })
    setModalOpen(true)
  }

  const handleSendNotification = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!form.title.trim() || !form.message.trim()) {
      setErrorMsg('Please enter both a title and a message.')
      return
    }

    if (form.audience === 'specific_scholar' && !form.scholarId.trim()) {
      setErrorMsg('Please select a scholar.')
      return
    }

    setSending(true)
    try {
      const recipientRole =
        form.audience === 'evaluators'
          ? 'evaluator'
          : form.audience === 'everyone'
          ? 'all'
          : 'student'

      const scholarId =
        form.audience === 'specific_scholar' ? form.scholarId.trim() : ''

      await createNotification({
        recipientRole,
        scholarId,
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
      })

      setModalOpen(false)
      setSuccessMsg('Notification sent successfully.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error || 'Could not send notification. Please try again.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>System Notifications</h2>
          <p className="muted small">
            Send official announcements to scholars and staff, and view system alerts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {notifications.some((n) => !n.read) && (
            <Button variant="outline" onClick={markAllAsRead}>
              Mark All as Read
            </Button>
          )}
          {isAdmin && (
            <Button variant="primary" onClick={handleOpenModal}>
              + Create Notification
            </Button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="note-ok" style={{ marginBottom: '18px' }}>
          {successMsg}
        </div>
      )}

      <div className="card">
        {notifications.length === 0 ? (
          <div className="table-empty">No system notifications at this time.</div>
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
                  opacity: n.read ? 0.85 : 1,
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  {isAdmin && (
                    <button
                      type="button"
                      className="link-small"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#dc2626',
                      }}
                      onClick={() => deleteNotification(n.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={modalOpen}
        title="Create Notification"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSendNotification} disabled={sending}>
              {sending ? 'Sending...' : 'Send Notification'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSendNotification}>
          {errorMsg && (
            <div className="auth-error" style={{ marginBottom: '14px' }}>
              {errorMsg}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              marginBottom: '14px',
            }}
          >
            <div>
              <label className="form-label">Send To</label>
              <select
                className="form-select"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="all_scholars">All Scholars</option>
                <option value="specific_scholar">Specific Scholar</option>
                <option value="evaluators">Evaluators / Staff</option>
                <option value="everyone">All Scholars & Evaluators</option>
              </select>
            </div>

            <div>
              <label className="form-label">Notification Type</label>
              <select
                className="form-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="info">Announcement (Info)</option>
                <option value="warning">Important Reminder (Warning)</option>
                <option value="success">Update / Confirmation (Success)</option>
              </select>
            </div>
          </div>

          {form.audience === 'specific_scholar' && (
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label">Select Scholar *</label>
              <select
                className="form-select"
                value={form.scholarId}
                onChange={(e) => setForm({ ...form, scholarId: e.target.value })}
              >
                <option value="">-- Choose a Scholar --</option>
                {scholars.map((s) => (
                  <option key={s.scholarId} value={s.scholarId}>
                    {s.scholarId} — {s.name} ({s.cluster})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Semester Renewal Deadline Reminder"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div style={{ marginBottom: '6px' }}>
            <label className="form-label">Message *</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Write your announcement or message here..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              style={{ resize: 'vertical' }}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
