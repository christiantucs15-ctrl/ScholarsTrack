import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'

// =============================================================================
// Dashboard.jsx - Student Overview Page
// Loads the scholar's live requirements checklist, SDP progress, and recent
// notifications directly from the C# + PostgreSQL backend.
// =============================================================================
export default function Dashboard() {
  const { user } = useAuth()

  const scholarship = { status: 'Active', semester: '1st Semester, 2026-2027' }

  const [requirements, setRequirements] = useState([
    { id: 1, name: 'Latest Grades', done: false },
    { id: 2, name: 'Certificate of Enrollment', done: false },
    { id: 3, name: 'Accomplishment Report', done: false },
    { id: 4, name: 'Parent Consent', done: false },
  ])

  const [sdp, setSdp] = useState({
    percent: 0,
    completed: 0,
    total: 0,
    next: { name: 'Loading...', date: '' },
  })

  const [updates, setUpdates] = useState([])

  // Load real requirements, SDP progress, and notifications from PostgreSQL via C# API
  useEffect(() => {
    const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
    const name = user?.name ?? ''

    // 1. Check which of the 4 required documents have been uploaded/verified
    api
      .get('/documents', { params: { scholarId, name } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          const uploadedTypes = new Set(res.data.map((d) => d.docType))
          setRequirements((prev) =>
            prev.map((r) => ({
              ...r,
              done: uploadedTypes.has(r.name),
            }))
          )
        }
      })
      .catch((err) => console.error('Failed to fetch requirements:', err))

    // 2. Load SDP progress from PostgreSQL
    api
      .get('/sdp')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const total = res.data.length
          const completed = res.data.filter((a) => a.status === 'completed').length
          const upcoming = res.data.find((a) => a.status !== 'completed')
          setSdp({
            percent: Math.round((completed / total) * 100),
            completed,
            total,
            next: upcoming
              ? { name: upcoming.name, date: upcoming.targetDate }
              : { name: 'All Completed!', date: '1st Semester, 2026-2027' },
          })
        }
      })
      .catch((err) => console.error('Failed to fetch SDP:', err))

    // 3. Load recent updates from the PostgreSQL notifications table
    api
      .get('/notifications', { params: { role: 'student', scholarId } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setUpdates(
            res.data.slice(0, 5).map((n) => ({
              id: n.id,
              text: `${n.title}: ${n.message}`,
              date: n.date,
              type: n.type || 'info',
            }))
          )
        }
      })
      .catch((err) => console.error('Failed to fetch updates:', err))
  }, [user])

  const doneCount = requirements.filter((r) => r.done).length
  const renewalPercent =
    requirements.length > 0 ? Math.round((doneCount / requirements.length) * 100) : 0

  return (
    <div>
      <h2>Good day, {user?.name}!</h2>
      <p>Here's your scholarship journey at a glance.</p>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Scholarship Status</div>
          <div className="stat-big">
            <span className="pill pill-green">{scholarship.status}</span>
          </div>
          <div className="muted small">{scholarship.semester}</div>
        </div>

        <div className="card">
          <div className="stat-label">Renewal Requirements</div>
          <div className="stat-value">
            {doneCount}/{requirements.length}
          </div>
          <div className="muted small">uploaded this period</div>
        </div>

        <div className="card">
          <div className="stat-label">SDP Progress</div>
          <div className="stat-value">{sdp.percent}%</div>
          <div className="muted small">
            {sdp.completed} of {sdp.total} activities completed
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card dash-section">
          <div className="dash-section-head">
            <h3>Renewal Checklist</h3>
            <Link to="/student/renewal" className="link-small">
              Go to Renewal
            </Link>
          </div>

          <div className="progress">
            <div className="progress-bar" style={{ width: `${renewalPercent}%` }} />
          </div>
          <div className="muted small">{renewalPercent}% of requirements uploaded</div>

          <ul className="checklist">
            {requirements.map((r) => (
              <li key={r.id}>
                <span className={`check ${r.done ? 'check-done' : ''}`}>
                  {r.done ? '✓' : ''}
                </span>
                <span className="check-text">{r.name}</span>
                <span
                  className={`pill ${r.done ? 'pill-green' : ''}`}
                  style={!r.done ? { background: '#f0f2f8', color: '#6b7694' } : undefined}
                >
                  {r.done ? 'Uploaded' : 'Not Uploaded'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card dash-section">
          <div className="dash-section-head">
            <h3>SDP Progress</h3>
            <Link to="/student/sdp" className="link-small">
              View SDP
            </Link>
          </div>

          <div className="progress">
            <div className="progress-bar" style={{ width: `${sdp.percent}%` }} />
          </div>
          <div className="muted small">
            {sdp.completed} of {sdp.total} activities completed
          </div>

          <div className="next-activity">
            <div className="muted small">Next activity</div>
            <strong>{sdp.next.name}</strong>
            <div className="muted small">Target date: {sdp.next.date}</div>
          </div>
        </div>
      </div>

      <div className="card dash-section">
        <h3>Recent Updates</h3>
        <ul className="updates">
          {updates.map((u) => (
            <li key={u.id}>
              <span className={`dot dot-${u.type}`} />
              <span className="update-text">{u.text}</span>
              <span className="muted small">{u.date}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
